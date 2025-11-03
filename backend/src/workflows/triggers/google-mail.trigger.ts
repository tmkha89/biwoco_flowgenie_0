import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';
import { WorkflowEventService } from '../services/workflow-event.service';
import { GmailService } from '../services/gmail.service';
import axios from 'axios';

/**
 * Google Mail (Gmail) trigger handler
 * Uses Gmail API with OAuth2 credentials
 * Creates Gmail watch using users.watch API
 * Handles Pub/Sub notifications to trigger workflows
 */
@Injectable()
export class GoogleMailTriggerHandler implements ITriggerHandler {
  private readonly logger = new Logger(GoogleMailTriggerHandler.name);
  private readonly watchedWorkflows: Map<number, { channelId: string; topicName: string }> = new Map();

  readonly type: TriggerType = TriggerType.GOOGLE_MAIL;
  readonly name = 'Google-Mail Trigger';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly workflowEventService: WorkflowEventService,
    private readonly gmailService: GmailService,
  ) {}

  async validate(config: Record<string, any>): Promise<boolean> {
    // Google Mail trigger requires:
    // - userId: to get OAuth tokens
    // - topicName: Pub/Sub topic name (optional, will be generated if not provided)
    if (!config.userId || typeof config.userId !== 'number') {
      this.logger.warn('Google Mail trigger validation failed: userId is required');
      return false;
    }
    return true;
  }

  async register(workflowId: number, config: Record<string, any>): Promise<void> {
    this.logger.log(`Registering Gmail trigger for workflow ${workflowId}`);
    
    const userId = config.userId;
    if (!userId) {
      throw new Error('userId is required for Gmail trigger');
    }

    // Get OAuth tokens for the user
    const oauthAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: 'google',
      },
    });

    if (!oauthAccount || !oauthAccount.accessToken) {
      throw new Error(`User ${userId} does not have Google OAuth tokens. Please authenticate with Google first.`);
    }

    // Generate unique channel ID for this workflow
    const channelId = `${workflowId}-${Date.now()}`;
    
    // Get or create Pub/Sub topic name
    const topicName = config.topicName || `workflow-${workflowId}`;
    const pubsubEndpoint = this.configService.get<string>('PUBSUB_ENDPOINT', `http://localhost:3000/api/triggers/gmail/pubsub`);

    // Create Gmail watch
    try {
      const watchResponse = await this.gmailService.createWatch(
        oauthAccount.accessToken,
        {
          topicName,
          labelIds: config.labelIds || ['INBOX'],
        },
      );

      this.logger.log(`Gmail watch created for workflow ${workflowId}, historyId: ${watchResponse.historyId}`);

      // Store watch metadata
      this.watchedWorkflows.set(workflowId, {
        channelId,
        topicName,
      });

      // Update trigger config with watch metadata
      await this.prisma.trigger.update({
        where: { workflowId },
        data: {
          config: {
            ...config,
            watchChannelId: channelId,
            watchHistoryId: watchResponse.historyId,
            watchExpiration: watchResponse.expiration,
            topicName,
            pubsubEndpoint,
          },
        },
      });

      this.logger.log(`Gmail trigger registered successfully for workflow ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to create Gmail watch for workflow ${workflowId}:`, error.message);
      throw new Error(`Failed to register Gmail trigger: ${error.message}`);
    }
  }

  async unregister(workflowId: number): Promise<void> {
    this.logger.log(`Unregistering Gmail trigger for workflow ${workflowId}`);
    
    const watchInfo = this.watchedWorkflows.get(workflowId);
    if (!watchInfo) {
      this.logger.warn(`No watch info found for workflow ${workflowId}`);
      return;
    }

    // Stop Gmail watch
    try {
      // Get trigger to find access token
      const trigger = await this.prisma.trigger.findUnique({
        where: { workflowId },
        include: { workflow: true },
      });

      if (trigger) {
        const oauthAccount = await this.prisma.oAuthAccount.findFirst({
          where: {
            userId: trigger.workflow.userId,
            provider: 'google',
          },
        });

        if (oauthAccount?.accessToken) {
          await this.gmailService.stopWatch(oauthAccount.accessToken);
          this.logger.log(`Gmail watch stopped for workflow ${workflowId}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to stop Gmail watch for workflow ${workflowId}:`, error.message);
    }

    this.watchedWorkflows.delete(workflowId);
    this.logger.log(`Gmail trigger unregistered for workflow ${workflowId}`);
  }

  /**
   * Handle Pub/Sub notification from Google
   * This method is called when Gmail sends a notification to our Pub/Sub endpoint
   */
  async handlePubSubNotification(
    channelId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`Received Gmail Pub/Sub notification for channel ${channelId}`);

    // Find workflow by channel ID
    let workflowId: number | null = null;
    for (const [workflow, watchInfo] of this.watchedWorkflows.entries()) {
      if (watchInfo.channelId === channelId) {
        workflowId = workflow;
        break;
      }
    }

    // If not found in memory, search in database
    if (!workflowId) {
      const triggers = await this.prisma.trigger.findMany({
        where: {
          type: TriggerType.GOOGLE_MAIL,
        },
        include: { workflow: true },
      });

      for (const trigger of triggers) {
        const config = trigger.config as any;
        if (config.watchChannelId === channelId) {
          workflowId = trigger.workflowId;
          // Update memory cache
          this.watchedWorkflows.set(workflowId, {
            channelId: config.watchChannelId,
            topicName: config.topicName,
          });
          break;
        }
      }
    }

    if (!workflowId) {
      this.logger.warn(`No workflow found for channel ID ${channelId}`);
      return;
    }

    // Get trigger and workflow to fetch new messages
    const trigger = await this.prisma.trigger.findUnique({
      where: { workflowId },
      include: { workflow: true },
    });

    if (!trigger || !trigger.workflow.enabled) {
      this.logger.warn(`Workflow ${workflowId} not found or disabled`);
      return;
    }

    try {
      // Get OAuth tokens
      const oauthAccount = await this.prisma.oAuthAccount.findFirst({
        where: {
          userId: trigger.workflow.userId,
          provider: 'google',
        },
      });

      if (!oauthAccount?.accessToken) {
        this.logger.error(`No OAuth tokens found for workflow ${workflowId}`);
        return;
      }

      // Fetch new messages from Gmail
      const config = trigger.config as any;
      const historyId = config.watchHistoryId || config.historyId || '0';
      const messages = await this.gmailService.fetchNewMessages(
        oauthAccount.accessToken,
        historyId,
      );

      this.logger.log(`Found ${messages.length} new messages for workflow ${workflowId}`);

      // Emit workflow trigger event for each new message
      for (const message of messages) {
        this.workflowEventService.emitWorkflowTrigger(workflowId, {
          triggerType: TriggerType.GOOGLE_MAIL,
          messageId: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds,
          snippet: message.snippet,
          historyId: message.historyId,
        });
      }

      // Update history ID
      if (messages.length > 0) {
        const latestHistoryId = messages[messages.length - 1].historyId;
        await this.prisma.trigger.update({
          where: { workflowId },
          data: {
            config: {
              ...config,
              watchHistoryId: latestHistoryId,
              historyId: latestHistoryId,
            },
          },
        });
      }
    } catch (error: any) {
      this.logger.error(`Error processing Gmail notification for workflow ${workflowId}:`, error.message);
    }
  }

  /**
   * Get channel ID for a workflow
   */
  getChannelId(workflowId: number): string | undefined {
    return this.watchedWorkflows.get(workflowId)?.channelId;
  }
}

