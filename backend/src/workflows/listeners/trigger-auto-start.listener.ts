import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { TriggerRegistry } from '../triggers/trigger.registry';
import { TriggerType } from '../interfaces/workflow.interface';
import { GoogleMailTriggerHandler } from '../triggers/google-mail.trigger';
import { ScheduleTriggerHandler } from '../triggers/schedule.trigger';
import { WebhookTriggerHandler } from '../triggers/webhook.trigger';
import { PubSubService } from '../services/pubsub.service';

/**
 * Auto-start listener for workflow triggers
 * Automatically starts all trigger listeners on module initialization
 * Ensures fault tolerance and auto-restart on crash recovery
 */
@Injectable()
export class TriggerAutoStartListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TriggerAutoStartListener.name);
  private isInitialized = false;
  private restartInterval: NodeJS.Timeout | null = null;
  private readonly RESTART_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly triggerRegistry: TriggerRegistry,
    private readonly googleMailTriggerHandler: GoogleMailTriggerHandler,
    private readonly scheduleTriggerHandler: ScheduleTriggerHandler,
    private readonly webhookTriggerHandler: WebhookTriggerHandler,
    private readonly pubSubService: PubSubService,
  ) {}

  async onModuleInit() {
    this.logger.log('TriggerAutoStartListener initializing...');
    
    try {
      // Start all trigger listeners
      await this.startAllTriggerListeners();
      
      // Start health check and restart mechanism
      this.startHealthCheck();
      
      this.isInitialized = true;
      this.logger.log('✅ TriggerAutoStartListener initialized successfully');
    } catch (error: any) {
      this.logger.error(`❌ Failed to initialize TriggerAutoStartListener: ${error.message}`);
      // Retry after a delay
      setTimeout(() => this.onModuleInit(), 10000);
    }
  }

  async onModuleDestroy() {
    this.logger.log('TriggerAutoStartListener shutting down...');
    
    if (this.restartInterval) {
      clearInterval(this.restartInterval);
      this.restartInterval = null;
    }
    
    this.isInitialized = false;
  }

  /**
   * Start all trigger listeners for enabled workflows
   */
  private async startAllTriggerListeners(): Promise<void> {
    this.logger.log('Starting all trigger listeners...');

    try {
      // Find all enabled workflows with triggers
      const workflows = await this.prisma.workflow.findMany({
        where: {
          enabled: true,
        },
        include: {
          trigger: true,
        },
      });

      this.logger.log(`Found ${workflows.length} enabled workflows`);

      // Group workflows by trigger type
      const workflowsByType = new Map<TriggerType, typeof workflows>();
      for (const workflow of workflows) {
        if (!workflow.trigger) {
          continue;
        }

        const triggerType = workflow.trigger.type as TriggerType;
        if (!workflowsByType.has(triggerType)) {
          workflowsByType.set(triggerType, []);
        }
        workflowsByType.get(triggerType)!.push(workflow);
      }

      // Start listeners for each trigger type
      for (const [triggerType, workflows] of workflowsByType.entries()) {
        this.logger.log(`Starting ${workflows.length} workflows with trigger type: ${triggerType}`);
        
        for (const workflow of workflows) {
          try {
            await this.startTriggerListener(workflow.id, triggerType, workflow.trigger!.config as Record<string, any>, workflow.userId);
          } catch (error: any) {
            this.logger.error(`Failed to start trigger for workflow ${workflow.id}: ${error.message}`);
            // Continue with other workflows
          }
        }
      }

      this.logger.log(`✅ Started trigger listeners for ${workflows.length} workflows`);
    } catch (error: any) {
      this.logger.error(`Error starting trigger listeners: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start trigger listener for a specific workflow
   */
  private async startTriggerListener(
    workflowId: number,
    triggerType: TriggerType,
    config: Record<string, any>,
    userId: number,
  ): Promise<void> {
    this.logger.log(`Starting trigger listener for workflow ${workflowId} (type: ${triggerType})`);

    try {
      const handler = this.triggerRegistry.getHandler(triggerType);
      if (!handler) {
        this.logger.warn(`No handler found for trigger type: ${triggerType}`);
        return;
      }

      switch (triggerType) {
        case TriggerType.GOOGLE_MAIL:
          await this.startGmailListener(workflowId, config, userId);
          break;
        
        case TriggerType.SCHEDULE:
          await this.startScheduleListener(workflowId, config);
          break;
        
        case TriggerType.WEBHOOK:
          await this.startWebhookListener(workflowId, config);
          break;
        
        case TriggerType.MANUAL:
          // Manual triggers don't need listeners
          this.logger.debug(`Manual trigger for workflow ${workflowId} - no listener needed`);
          break;
        
        default:
          this.logger.warn(`Unknown trigger type: ${triggerType}`);
      }
    } catch (error: any) {
      this.logger.error(`Error starting trigger listener for workflow ${workflowId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start Gmail trigger listener
   * Auto-registers Gmail watch for existing workflows
   */
  private async startGmailListener(
    workflowId: number,
    config: Record<string, any>,
    userId: number,
  ): Promise<void> {
    this.logger.log(`Starting Gmail listener for workflow ${workflowId}`);

    try {
      // Check if user has Google OAuth account
      const oauthAccount = await this.prisma.oAuthAccount.findFirst({
        where: {
          userId,
          provider: 'google',
        },
      });

      if (!oauthAccount || !oauthAccount.accessToken) {
        this.logger.warn(`User ${userId} does not have Google OAuth account, skipping Gmail trigger for workflow ${workflowId}`);
        return;
      }

      // Ensure Pub/Sub topic and subscription exist
      if (this.pubSubService.isAvailable()) {
        try {
          await this.pubSubService.createTopic(userId);
          const topicPath = this.pubSubService.getTopicPath(userId);
          await this.pubSubService.createSubscription(userId, topicPath);
        } catch (error: any) {
          this.logger.warn(`Failed to create Pub/Sub topic/subscription: ${error.message}`);
        }
      }

      // Register Gmail watch
      await this.googleMailTriggerHandler.register(workflowId, {
        ...config,
        userId,
      });

      this.logger.log(`✅ Gmail listener started for workflow ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to start Gmail listener for workflow ${workflowId}: ${error.message}`);
      // Don't throw - allow other workflows to start
    }
  }

  /**
   * Start schedule trigger listener
   * Registers cron jobs for scheduled workflows
   */
  private async startScheduleListener(
    workflowId: number,
    config: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Starting schedule listener for workflow ${workflowId}`);

    try {
      await this.scheduleTriggerHandler.register(workflowId, config);
      this.logger.log(`✅ Schedule listener started for workflow ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to start schedule listener for workflow ${workflowId}: ${error.message}`);
      // Don't throw - allow other workflows to start
    }
  }

  /**
   * Start webhook trigger listener
   * Webhooks are handled via Express routes, so just ensure they're registered
   */
  private async startWebhookListener(
    workflowId: number,
    config: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Starting webhook listener for workflow ${workflowId}`);

    try {
      // Webhooks are handled via Express routes in TriggerController
      // Just ensure registration in memory
      await this.webhookTriggerHandler.register(workflowId, config);
      this.logger.log(`✅ Webhook listener started for workflow ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to start webhook listener for workflow ${workflowId}: ${error.message}`);
      // Don't throw - allow other workflows to start
    }
  }

  /**
   * Start health check and auto-restart mechanism
   */
  private startHealthCheck(): void {
    this.logger.log('Starting health check and auto-restart mechanism');

    this.restartInterval = setInterval(async () => {
      try {
        await this.checkAndRestartListeners();
      } catch (error: any) {
        this.logger.error(`Error in health check: ${error.message}`);
      }
    }, this.RESTART_CHECK_INTERVAL);
  }

  /**
   * Check if all listeners are running and restart if needed
   */
  private async checkAndRestartListeners(): Promise<void> {
    this.logger.debug('Running health check for trigger listeners...');

    try {
      // Find all enabled workflows with triggers
      const workflows = await this.prisma.workflow.findMany({
        where: {
          enabled: true,
        },
        include: {
          trigger: true,
        },
      });

      for (const workflow of workflows) {
        if (!workflow.trigger) {
          continue;
        }

        const triggerType = workflow.trigger.type as TriggerType;
        const config = workflow.trigger.config as Record<string, any>;

        // Check if listener is running for this workflow
        try {
          switch (triggerType) {
            case TriggerType.SCHEDULE:
              // Check if schedule job is running
              // If not, restart it
              await this.scheduleTriggerHandler.register(workflow.id, config);
              break;
            
            case TriggerType.GOOGLE_MAIL:
              // Check if Gmail watch is registered
              // Re-register if needed (will handle existing watch gracefully)
              await this.googleMailTriggerHandler.register(workflow.id, {
                ...config,
                userId: workflow.userId,
              });
              break;
            
            // Webhook and Manual don't need health checks
          }
        } catch (error: any) {
          this.logger.warn(`Health check failed for workflow ${workflow.id}: ${error.message}`);
          // Try to restart
          try {
            await this.startTriggerListener(workflow.id, triggerType, config, workflow.userId);
          } catch (restartError: any) {
            this.logger.error(`Failed to restart listener for workflow ${workflow.id}: ${restartError.message}`);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in health check: ${error.message}`);
    }
  }

  /**
   * Restart all trigger listeners (called on crash recovery)
   */
  async restartAllListeners(): Promise<void> {
    this.logger.log('Restarting all trigger listeners...');
    this.isInitialized = false;
    
    try {
      await this.startAllTriggerListeners();
      this.isInitialized = true;
      this.logger.log('✅ All trigger listeners restarted successfully');
    } catch (error: any) {
      this.logger.error(`Failed to restart trigger listeners: ${error.message}`);
      // Retry after delay
      setTimeout(() => this.restartAllListeners(), 10000);
    }
  }

  /**
   * Handle workflow created event
   * Automatically start trigger listener for newly created workflows
   */
  @OnEvent('workflow.created')
  async handleWorkflowCreated(payload: { workflowId: number; enabled: boolean }) {
    const { workflowId, enabled } = payload;
    
    if (!enabled) {
      this.logger.debug(`Workflow ${workflowId} created but disabled, skipping trigger listener start`);
      return;
    }

    this.logger.log(`Workflow ${workflowId} created and enabled, starting trigger listener...`);
    
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { trigger: true },
      });

      if (!workflow || !workflow.trigger) {
        this.logger.warn(`Workflow ${workflowId} or trigger not found`);
        return;
      }

      await this.startTriggerListener(
        workflowId,
        workflow.trigger.type as TriggerType,
        workflow.trigger.config as Record<string, any>,
        workflow.userId,
      );
      
      this.logger.log(`✅ Trigger listener started for newly created workflow ${workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to start trigger listener for new workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Handle workflow updated event
   * Restart trigger listener if workflow was enabled or trigger was updated
   */
  @OnEvent('workflow.updated')
  async handleWorkflowUpdated(payload: { workflowId: number; enabled: boolean; triggerUpdated?: boolean }) {
    const { workflowId, enabled, triggerUpdated } = payload;
    
    this.logger.log(`Workflow ${workflowId} updated, enabled: ${enabled}, triggerUpdated: ${triggerUpdated}`);
    
    try {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { trigger: true },
      });

      if (!workflow || !workflow.trigger) {
        this.logger.warn(`Workflow ${workflowId} or trigger not found`);
        return;
      }

      if (enabled) {
        // Restart trigger listener if workflow is enabled
        await this.startTriggerListener(
          workflowId,
          workflow.trigger.type as TriggerType,
          workflow.trigger.config as Record<string, any>,
          workflow.userId,
        );
        this.logger.log(`✅ Trigger listener restarted for updated workflow ${workflowId}`);
      } else {
        // Unregister trigger if workflow is disabled
        const handler = this.triggerRegistry.getHandler(workflow.trigger.type as TriggerType);
        if (handler) {
          await handler.unregister(workflowId);
          this.logger.log(`✅ Trigger listener stopped for disabled workflow ${workflowId}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Failed to handle workflow update for workflow ${workflowId}: ${error.message}`);
    }
  }
}

