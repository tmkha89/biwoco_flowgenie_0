import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';
import { WorkflowEventService } from '../services/workflow-event.service';

/**
 * Slack trigger handler
 * Registers Slack event subscriptions for workflows
 * Handles events from Slack Events API and emits them to workflows
 */
@Injectable()
export class SlackTriggerHandler implements ITriggerHandler {
  private readonly logger = new Logger(SlackTriggerHandler.name);
  readonly type: TriggerType = TriggerType.SLACK;
  readonly name = 'Slack Trigger';

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEventService: WorkflowEventService,
  ) {}

  async validate(config: Record<string, any>): Promise<boolean> {
    // Slack trigger requires:
    // - eventType: the Slack event type to listen for (e.g., 'message', 'app_mention', 'reaction_added')
    // - teamId: optional, filter by team ID
    // - channelId: optional, filter by channel ID
    if (!config.eventType || typeof config.eventType !== 'string') {
      this.logger.warn('Slack trigger validation failed: eventType is required');
      return false;
    }

    // Validate event type is supported
    const supportedBotEvents = [
      'message',
      'app_mention',
      'reaction_added',
      'reaction_removed',
      'message.channels',
      'message.groups',
      'message.im',
      'message.mpim',
    ];

    const supportedWorkspaceEvents = [
      'app_home_opened',
      'user_change',
      'team_join',
      'channel_created',
      'channel_archive',
      'channel_unarchive',
      'channel_deleted',
      'channel_rename',
      'channel_id_changed',
      'member_joined_channel',
      'member_left_channel',
    ];

    const allSupportedEvents = [...supportedBotEvents, ...supportedWorkspaceEvents];

    if (!allSupportedEvents.includes(config.eventType)) {
      this.logger.warn(`Slack trigger validation failed: unsupported event type: ${config.eventType}`);
      return false;
    }

    return true;
  }

  async register(workflowId: number, config: Record<string, any>): Promise<void> {
    this.logger.log(`Registering Slack trigger for workflow ${workflowId}`);

    // Get workflow to find user
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { user: true },
    });

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Get user's Slack OAuth account to get team ID
    const oauthAccounts = await this.prisma.oAuthAccount.findMany({
      where: {
        userId: workflow.userId,
        provider: 'slack',
      },
    });

    if (oauthAccounts.length === 0) {
      throw new Error(`User ${workflow.userId} does not have a Slack account connected. Please connect Slack first.`);
    }

    // Get team ID from the first Slack account (or from config if specified)
    const teamId = config.teamId || oauthAccounts[0].providerUserId || null;

    // Update trigger config with team ID and event subscription info
    await this.prisma.trigger.update({
      where: { workflowId },
      data: {
        config: {
          ...config,
          teamId,
          eventType: config.eventType,
          channelId: config.channelId || null,
          registeredAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(
      `Slack trigger registered for workflow ${workflowId}, eventType: ${config.eventType}, teamId: ${teamId}`,
    );
  }

  async unregister(workflowId: number): Promise<void> {
    this.logger.log(`Unregistering Slack trigger for workflow ${workflowId}`);

    // Clear trigger config
    await this.prisma.trigger.update({
      where: { workflowId },
      data: {
        config: {
          teamId: null,
          eventType: null,
          registeredAt: null,
        },
      },
    });

    this.logger.log(`Slack trigger unregistered for workflow ${workflowId}`);
  }

  /**
   * Handle Slack event and emit workflow triggers
   * This method is called from the Slack controller when events are received
   */
  async handleSlackEvent(
    event: any,
    teamId: string,
    timestamp?: number,
  ): Promise<void> {
    this.logger.log(`Handling Slack event: ${event.type} for team ${teamId}`);

    // Find all workflows with Slack triggers that match this event
    const triggers = await this.prisma.trigger.findMany({
      where: {
        type: TriggerType.SLACK,
      },
      include: {
        workflow: true,
      },
    });

    // Filter triggers that match this team and event type
    const matchingTriggers = triggers.filter((trigger) => {
      const config = trigger.config as any;
      const triggerTeamId = config.teamId;
      const triggerEventType = config.eventType;

      // Check if workflow is enabled
      if (!trigger.workflow.enabled) {
        return false;
      }

      // Check team match
      if (triggerTeamId && triggerTeamId !== teamId) {
        return false;
      }

      // Check event type match
      if (triggerEventType !== event.type && triggerEventType !== '*') {
        return false;
      }

      // Check channel filter if specified
      if (config.channelId && event.channel && event.channel !== config.channelId) {
        return false;
      }

      return true;
    });

    if (matchingTriggers.length === 0) {
      this.logger.debug(`No matching workflows found for Slack event ${event.type} on team ${teamId}`);
      return;
    }

    this.logger.log(
      `Found ${matchingTriggers.length} matching workflow(s) for Slack event ${event.type}`,
    );

    // Emit workflow trigger event for each matching trigger
    for (const trigger of matchingTriggers) {
      try {
        const triggerData = {
          triggerType: TriggerType.SLACK,
          eventType: event.type,
          event,
          teamId,
          channelId: event.channel,
          userId: event.user,
          timestamp: timestamp || Math.floor(Date.now() / 1000),
          receivedAt: new Date().toISOString(),
        };

        this.logger.log(`Emitting workflow trigger for workflow ${trigger.workflowId}`);
        this.workflowEventService.emitWorkflowTrigger(trigger.workflowId, triggerData);
      } catch (error: any) {
        this.logger.error(
          `Error emitting workflow trigger for workflow ${trigger.workflowId}:`,
          error.message,
        );
        // Continue with other workflows even if one fails
      }
    }
  }
}

