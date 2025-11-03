import { Worker, Job } from 'bullmq';
import { defaultWorkerOptions } from '../queues/queue.config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { WorkflowEventService } from '../workflows/services/workflow-event.service';
import { SlackTriggerHandler } from '../workflows/triggers/slack.trigger';
import { TriggerType } from '../workflows/interfaces/workflow.interface';

interface SlackEventJobData {
  event: {
    type: string;
    text?: string;
    channel?: string;
    user?: string;
    ts?: string;
    [key: string]: any;
  };
  teamId: string;
  timestamp?: number;
  receivedAt: string;
}

/**
 * Slack event worker
 * Processes Slack events from the Events API and triggers workflows
 */
export class SlackEventWorker {
  private worker: Worker;
  private prisma: PrismaService;
  private workflowEventService: WorkflowEventService;
  private slackTriggerHandler: SlackTriggerHandler;
  private appContext: any;

  constructor() {
    this.worker = new Worker(
      'slack-event',
      async (job: Job<SlackEventJobData>) => {
        return this.processJob(job);
      },
      {
        ...defaultWorkerOptions,
        concurrency: 10, // Process up to 10 Slack events concurrently
      },
    );

    this.setupEventHandlers();
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`[SlackEventWorker] Job ${job.id} completed for event ${job.data.event.type}`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(
          `[SlackEventWorker] Job ${job.id} failed for event ${job.data.event.type}:`,
          error.message,
        );
      } else {
        console.error('[SlackEventWorker] Job failed:', error.message);
      }
    });

    this.worker.on('error', (error: Error) => {
      console.error('[SlackEventWorker] Worker error:', error);
    });
  }

  /**
   * Process a Slack event job
   */
  private async processJob(job: Job<SlackEventJobData>): Promise<void> {
    const { event, teamId, timestamp, receivedAt } = job.data;

    if (!this.prisma || !this.workflowEventService || !this.slackTriggerHandler) {
      // Initialize services from NestJS context
      if (!this.appContext) {
        this.appContext = await NestFactory.createApplicationContext(AppModule);
      }
      this.prisma = this.appContext.get(PrismaService);
      this.workflowEventService = this.appContext.get(WorkflowEventService);
      this.slackTriggerHandler = this.appContext.get(SlackTriggerHandler);
    }

    try {
      console.log(
        `[SlackEventWorker] Processing Slack event: ${event.type} for team ${teamId}`,
      );

      // Use SlackTriggerHandler to process the event
      // This will find matching workflows and emit trigger events
      if (this.slackTriggerHandler) {
        await this.slackTriggerHandler.handleSlackEvent(
          event,
          teamId,
          timestamp || Math.floor(Date.now() / 1000),
        );
      } else {
        console.error('[SlackEventWorker] SlackTriggerHandler not initialized');
      }
    } catch (error) {
      console.error(`[SlackEventWorker] Error processing Slack event:`, error);
      throw error;
    }
  }

  /**
   * Get worker name
   */
  get name(): string {
    return 'slack-event-worker';
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    if (this.appContext) {
      await this.appContext.close();
    }
  }
}

// Export singleton instance
export const slackEventWorker = new SlackEventWorker();

