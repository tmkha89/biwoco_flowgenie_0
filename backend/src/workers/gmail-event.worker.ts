import { Worker, Job } from 'bullmq';
import { defaultWorkerOptions } from '../queues/queue.config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { WorkflowEventService } from '../workflows/services/workflow-event.service';
import { GmailService } from '../workflows/services/gmail.service';
import { OAuthService } from '../oauth/oauth.service';
import { GoogleOAuthService } from '../auth/services/google-oauth.service';
import { GmailEventJobData } from '../queues/gmail-event.queue';
import { TriggerType } from '../workflows/interfaces/workflow.interface';

/**
 * Gmail event worker
 * Processes Gmail push notifications and triggers workflows
 */
export class GmailEventWorker {
  private worker: Worker;
  private prisma: PrismaService | null = null;
  private workflowEventService: WorkflowEventService | null = null;
  private gmailService: GmailService | null = null;
  private oauthService: OAuthService | null = null;
  private googleOAuthService: GoogleOAuthService | null = null;
  private appContext: any;

  constructor() {
    try {
      console.log('[GmailEventWorker] Initializing Gmail event worker...');
      
      this.worker = new Worker(
        'gmail-event',
        async (job: Job<GmailEventJobData>) => {
          return this.processJob(job);
        },
        {
          ...defaultWorkerOptions,
          concurrency: 10, // Process up to 10 Gmail events concurrently
        },
      );

      this.setupEventHandlers();
      
      console.log('[GmailEventWorker] ✅ Gmail event worker initialized successfully');
    } catch (error: any) {
      console.error('[GmailEventWorker] ❌ Failed to initialize Gmail event worker:', error);
      throw error;
    }
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(`[GmailEventWorker] ✅ Job ${job.id} completed for workflow ${job.data.workflowId}`);
    });

    this.worker.on('active', (job: Job) => {
      console.log(`[GmailEventWorker] 🔄 Job ${job.id} started processing for workflow ${job.data.workflowId}`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(
          `[GmailEventWorker] ❌ Job ${job.id} failed for workflow ${job.data.workflowId}:`,
          error.message,
        );
        console.error('[GmailEventWorker] Error stack:', error.stack);
      } else {
        console.error('[GmailEventWorker] ❌ Job failed:', error.message);
      }
    });

    this.worker.on('error', (error: Error) => {
      console.error('[GmailEventWorker] ⚠️ Worker error:', error);
      console.error('[GmailEventWorker] Error stack:', error.stack);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`[GmailEventWorker] ⚠️ Job ${jobId} stalled`);
    });
  }

  /**
   * Initialize services from NestJS context
   */
  private async initializeServices(): Promise<void> {
    if (!this.appContext) {
      this.appContext = await NestFactory.createApplicationContext(AppModule);
    }
    
    if (!this.prisma) {
      this.prisma = this.appContext.get(PrismaService);
    }
    
    if (!this.workflowEventService) {
      this.workflowEventService = this.appContext.get(WorkflowEventService);
    }
    
    if (!this.gmailService) {
      this.gmailService = this.appContext.get(GmailService);
    }
    
    if (!this.oauthService) {
      this.oauthService = this.appContext.get(OAuthService);
    }
    
    if (!this.googleOAuthService) {
      this.googleOAuthService = this.appContext.get(GoogleOAuthService);
    }
  }

  /**
   * Process a Gmail event job
   */
  private async processJob(job: Job<GmailEventJobData>): Promise<void> {
    const { workflowId, userId, messageId, threadId, labelIds, snippet, historyId } = job.data;

    await this.initializeServices();

    if (!this.prisma || !this.workflowEventService || !this.gmailService || !this.oauthService || !this.googleOAuthService) {
      throw new Error('Failed to initialize services');
    }

    try {
      console.log(`[GmailEventWorker] Processing Gmail event for workflow ${workflowId}, message ${messageId}`);

      // Verify workflow exists and is enabled
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { trigger: true },
      });

      if (!workflow) {
        console.error(`[GmailEventWorker] Workflow ${workflowId} not found`);
        return;
      }

      if (!workflow.enabled) {
        console.warn(`[GmailEventWorker] Workflow ${workflowId} is disabled, skipping`);
        return;
      }

      if (!workflow.trigger || workflow.trigger.type !== TriggerType.GOOGLE_MAIL) {
        console.error(`[GmailEventWorker] Workflow ${workflowId} does not have Gmail trigger`);
        return;
      }

      // Get and refresh OAuth tokens if needed
      let oauthAccount = await this.oauthService.findByUserIdAndProvider(userId, 'google');
      
      if (!oauthAccount || !oauthAccount.accessToken) {
        console.error(`[GmailEventWorker] No Google OAuth tokens found for user ${userId}`);
        return;
      }

      // Refresh token if expired
      if (oauthAccount.expiresAt && oauthAccount.expiresAt < new Date()) {
        if (!oauthAccount.refreshToken) {
          console.error(`[GmailEventWorker] Access token expired and no refresh token available for user ${userId}`);
          return;
        }

        console.log(`[GmailEventWorker] Refreshing expired access token for user ${userId}`);
        oauthAccount = await this.oauthService.refreshGoogleTokens(
          userId,
          oauthAccount.refreshToken,
          this.googleOAuthService,
        );
      }

      // Fetch full message content if needed
      let messageContent: any = null;
      try {
        messageContent = await this.gmailService.getMessage(oauthAccount.accessToken!, messageId);
      } catch (error: any) {
        console.warn(`[GmailEventWorker] Failed to fetch full message content: ${error.message}`);
        // Continue with available data
      }

      // Extract message metadata
      const headers = messageContent?.payload?.headers || [];
      const getHeader = (name: string) => {
        const header = headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value || '';
      };

      const sender = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');
      const to = getHeader('To');

      // Build trigger payload with full message data
      const triggerPayload = {
        triggerType: TriggerType.GOOGLE_MAIL,
        messageId,
        threadId,
        labelIds,
        snippet: snippet || messageContent?.snippet || '',
        historyId,
        sender,
        subject,
        date,
        to,
        messageContent: messageContent ? {
          id: messageContent.id,
          threadId: messageContent.threadId,
          labelIds: messageContent.labelIds,
          snippet: messageContent.snippet,
          sizeEstimate: messageContent.sizeEstimate,
          historyId: messageContent.historyId,
        } : null,
      };

      // Emit workflow trigger event
      this.workflowEventService.emitWorkflowTrigger(workflowId, triggerPayload);

      // Update history ID in trigger config
      const config = workflow.trigger.config as any;
      await this.prisma.trigger.update({
        where: { workflowId },
        data: {
          config: {
            ...config,
            watchHistoryId: historyId,
            historyId,
            lastProcessedAt: new Date().toISOString(),
          },
        },
      });

      console.log(`[GmailEventWorker] Successfully triggered workflow ${workflowId} for message ${messageId}`);
    } catch (error: any) {
      console.error(`[GmailEventWorker] Error processing Gmail event:`, error);
      throw error;
    }
  }

  /**
   * Get worker name
   */
  get name(): string {
    return 'gmail-event-worker';
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
let gmailEventWorkerInstance: GmailEventWorker | null = null;

try {
  gmailEventWorkerInstance = new GmailEventWorker();
  console.log('[GmailEventWorker] ✅ Gmail event worker singleton created');
} catch (error: any) {
  console.error('[GmailEventWorker] ❌ Failed to create Gmail event worker singleton:', error);
  console.error('[GmailEventWorker] Error stack:', error.stack);
  // Create a dummy worker to prevent import errors
  gmailEventWorkerInstance = {
    name: 'gmail-event-worker',
    close: async () => {},
  } as any;
}

export const gmailEventWorker = gmailEventWorkerInstance;

