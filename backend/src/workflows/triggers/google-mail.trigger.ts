import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';
import { WorkflowEventService } from '../services/workflow-event.service';
import { GmailService } from '../services/gmail.service';
import { PubSubService } from '../services/pubsub.service';
import { gmailEventQueue, GmailEventJobData } from '../../queues/gmail-event.queue';
import { OAuthService } from '../../oauth/oauth.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
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
    private readonly pubSubService?: PubSubService,
    private readonly oauthService?: OAuthService,
    private readonly googleOAuthService?: GoogleOAuthService,
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
    this.logger.log(`Registering Gmail trigger for workflow ${workflowId}, config: ${JSON.stringify(config)}`);
    
    // Get userId from config or fetch from workflow
    let userId = config.userId;
    if (!userId) {
      // Fetch userId from workflow if not provided in config
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: workflowId },
        select: { userId: true },
      });
      
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      userId = workflow.userId;
      this.logger.log(`[GmailTrigger] userId not in config, using workflow userId: ${userId}`);
      
      // Update config with userId for future reference
      config.userId = userId;
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

    if (!oauthAccount.refreshToken) {
      throw new Error(`User ${userId} does not have a refresh token. Please re-authenticate with Google.`);
    }

    // Validate and refresh access token if needed
    let accessToken = oauthAccount.accessToken;
    const now = new Date();
    const expiresAt = oauthAccount.expiresAt;
    
    // Check if token is expired or expires within the next 5 minutes
    const needsRefresh = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
    
    if (needsRefresh) {
      if (!this.googleOAuthService) {
        throw new Error('GoogleOAuthService is not available. Cannot refresh access token.');
      }
      
      this.logger.log(`[GmailTrigger] Access token expired or expiring soon (expiresAt: ${expiresAt}), refreshing...`);
      
      try {
        const refreshedTokens = await this.googleOAuthService.refreshAccessToken(oauthAccount.refreshToken);
        accessToken = refreshedTokens.access_token;
        
        // Update OAuth account with new token
        const newExpiresAt = refreshedTokens.expires_in 
          ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
          : expiresAt;
        
        await this.prisma.oAuthAccount.update({
          where: { id: oauthAccount.id },
          data: {
            accessToken: refreshedTokens.access_token,
            expiresAt: newExpiresAt,
            refreshToken: refreshedTokens.refresh_token || oauthAccount.refreshToken,
          },
        });
        
        this.logger.log(`[GmailTrigger] ✅ Access token refreshed successfully, expires at: ${newExpiresAt}`);
      } catch (refreshError: any) {
        this.logger.error(`[GmailTrigger] Failed to refresh access token: ${refreshError.message}`);
        throw new Error(`Failed to refresh access token. Please re-authenticate with Google: ${refreshError.message}`);
      }
    } else {
      this.logger.log(`[GmailTrigger] Access token is valid (expires at: ${expiresAt})`);
    }

    // Generate unique channel ID for this workflow
    const channelId = `${workflowId}-${Date.now()}`;
    
    // Get or create Pub/Sub topic name - use auto-created topic if available
    let topicName: string;
    if (this.pubSubService?.isAvailable()) {
      try {
        // Use auto-created topic for this user
        topicName = this.pubSubService.getTopicPath(userId);
        console.log(`[GmailTrigger] Using auto-created Pub/Sub topic: ${topicName}`);
        this.logger.log(`[GmailTrigger] Using auto-created Pub/Sub topic: ${topicName}`);
        
        // Ensure topic exists before registering Gmail watch
        // This prevents "Resource not found" errors when Google tries to send test messages
        if (this.pubSubService?.isAvailable()) {
          try {
            await this.pubSubService.createTopic(userId);
            this.logger.log(`[GmailTrigger] ✅ Pub/Sub topic verified/created before Gmail watch registration`);
          } catch (topicError: any) {
            // If topic creation fails, log but continue (topic might already exist)
            this.logger.warn(`[GmailTrigger] Could not create topic (may already exist): ${topicError.message}`);
          }
        } else {
          this.logger.warn(`[GmailTrigger] ⚠️ Pub/Sub service not available. Topic will not be created automatically.`);
        }
      } catch (error: any) {
        this.logger.warn(`[GmailTrigger] Failed to get topic path: ${error.message}, falling back to manual topic`);
        // Fallback to manual topic name if topic path generation fails
        const projectId = this.configService.get<string>('GOOGLE_PROJECT_NAME') || 
                          this.configService.get<string>('GCP_PROJECT_ID') || 'my-project';
        topicName = config.topicName || `projects/${projectId}/topics/workflow-${workflowId}`;
      }
    } else {
      // Fallback to manual topic name if Pub/Sub service not available
      const projectId = this.configService.get<string>('GOOGLE_PROJECT_NAME') || 
                        this.configService.get<string>('GCP_PROJECT_ID') || 'my-project';
      topicName = config.topicName || `projects/${projectId}/topics/workflow-${workflowId}`;
      this.logger.warn(`[GmailTrigger] Pub/Sub service not available, using manual topic: ${topicName}`);
    }
    
    const pubsubEndpoint = this.configService.get<string>('PUBLIC_API_URL', this.configService.get<string>('PUBSUB_ENDPOINT', `http://localhost:3000`)) + '/api/triggers/gmail';

    // Create Gmail watch
    try {
      const watchResponse = await this.gmailService.createWatch(
        accessToken,
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
      this.logger.error(`Failed to create Gmail watch for workflow ${workflowId}`, error.message);
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

        if (!oauthAccount?.accessToken) {
          this.logger.warn(`No OAuth tokens found for workflow ${workflowId}`);
          return;
        }

        if (!oauthAccount.refreshToken) {
          this.logger.warn(`No refresh token found for workflow ${workflowId}`);
          return;
        }

        // Validate and refresh access token if needed
        let accessToken = oauthAccount.accessToken;
        const now = new Date();
        const expiresAt = oauthAccount.expiresAt;
        
        // Check if token is expired or expires within the next 5 minutes
        const needsRefresh = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
        
        if (needsRefresh) {
          if (!this.googleOAuthService) {
            this.logger.warn(`GoogleOAuthService not available for workflow ${workflowId}`);
            return;
          }
          
          this.logger.log(`[GmailTrigger] Refreshing access token before stopping watch for workflow ${workflowId}`);
          
          try {
            const refreshedTokens = await this.googleOAuthService.refreshAccessToken(oauthAccount.refreshToken);
            accessToken = refreshedTokens.access_token;
            
            // Update OAuth account with new token
            const newExpiresAt = refreshedTokens.expires_in 
              ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
              : expiresAt;
            
            await this.prisma.oAuthAccount.update({
              where: { id: oauthAccount.id },
              data: {
                accessToken: refreshedTokens.access_token,
                expiresAt: newExpiresAt,
                refreshToken: refreshedTokens.refresh_token || oauthAccount.refreshToken,
              },
            });
            
            this.logger.log(`[GmailTrigger] ✅ Access token refreshed before stopping watch`);
          } catch (refreshError: any) {
            this.logger.error(`[GmailTrigger] Failed to refresh access token before stopping watch: ${refreshError.message}`);
            // Continue anyway - try to stop watch with existing token
          }
        }

        await this.gmailService.stopWatch(accessToken);
        this.logger.log(`Gmail watch stopped for workflow ${workflowId}`);
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
    this.logger.log(`[GmailTrigger] Received Gmail Pub/Sub notification for channel ${channelId}`);

    // Extract user ID from topic name if available
    // Topic format: projects/{projectId}/topics/flowgenie-gmail-{userId}
    let userId: number | null = null;
    if (payload.topicName || payload.topic) {
      const topicName = payload.topicName || payload.topic;
      this.logger.log(`[GmailTrigger] Extracting user ID from topic: ${topicName}`);
      
      // Extract userId from topic name: flowgenie-gmail-{userId}
      const match = topicName.match(/flowgenie-gmail-(\d+)/);
      if (match && match[1]) {
        userId = parseInt(match[1], 10);
        this.logger.log(`[GmailTrigger] Extracted user ID: ${userId} from topic`);
      }
    }

    // Find workflows for this user
    let workflowIds: number[] = [];
    
    if (userId) {
      // Find all enabled workflows with Gmail trigger for this user
      const workflows = await this.prisma.workflow.findMany({
        where: {
          userId,
          enabled: true,
        },
        include: {
          trigger: true,
        },
      });

      workflowIds = workflows
        .filter(w => w.trigger && w.trigger.type === TriggerType.GOOGLE_MAIL)
        .map(w => w.id);

      this.logger.log(`[GmailTrigger] Found ${workflowIds.length} Gmail workflows for user ${userId}`);
    } else {
      // Fallback: Try to find by channel ID (for backward compatibility)
      this.logger.warn(`[GmailTrigger] No user ID found, falling back to channel ID lookup`);
      
      for (const [workflow, watchInfo] of this.watchedWorkflows.entries()) {
        if (watchInfo.channelId === channelId) {
          workflowIds.push(workflow);
          break;
        }
      }

      // If not found in memory, search in database
      if (workflowIds.length === 0) {
        const triggers = await this.prisma.trigger.findMany({
          where: {
            type: TriggerType.GOOGLE_MAIL,
          },
          include: { workflow: true },
        });

        for (const trigger of triggers) {
          const config = trigger.config as any;
          if (config.watchChannelId === channelId) {
            workflowIds.push(trigger.workflowId);
            // Update memory cache
            this.watchedWorkflows.set(trigger.workflowId, {
              channelId: config.watchChannelId,
              topicName: config.topicName,
            });
          }
        }
      }
    }

    if (workflowIds.length === 0) {
      this.logger.warn(`[GmailTrigger] No workflows found for channel ID ${channelId}${userId ? ` or user ${userId}` : ''}`);
      return;
    }

    // Process each workflow
    for (const workflowId of workflowIds) {
      await this.processGmailNotificationForWorkflow(workflowId, channelId, payload);
    }
  }

  /**
   * Process Gmail notification for a specific workflow
   */
  private async processGmailNotificationForWorkflow(
    workflowId: number,
    channelId: string,
    payload: any,
  ): Promise<void> {
    this.logger.log(`[GmailTrigger] Processing Gmail notification for workflow ${workflowId}`);

    // Get trigger and workflow to fetch new messages
    const trigger = await this.prisma.trigger.findUnique({
      where: { workflowId },
      include: { workflow: true },
    });

    if (!trigger || !trigger.workflow.enabled) {
      this.logger.warn(`[GmailTrigger] Workflow ${workflowId} not found or disabled`);
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
        this.logger.error(`[GmailTrigger] No OAuth tokens found for workflow ${workflowId}`);
        return;
      }

      if (!oauthAccount.refreshToken) {
        this.logger.error(`[GmailTrigger] No refresh token found for workflow ${workflowId}`);
        return;
      }

      // Validate and refresh access token if needed
      let accessToken = oauthAccount.accessToken;
      const now = new Date();
      const expiresAt = oauthAccount.expiresAt;
      
      // Check if token is expired or expires within the next 5 minutes
      const needsRefresh = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
      
      if (needsRefresh) {
        if (!this.googleOAuthService) {
          this.logger.error(`[GmailTrigger] GoogleOAuthService not available for workflow ${workflowId}`);
          return;
        }
        
        this.logger.log(`[GmailTrigger] Refreshing access token before fetching messages for workflow ${workflowId}`);
        
        try {
          const refreshedTokens = await this.googleOAuthService.refreshAccessToken(oauthAccount.refreshToken);
          accessToken = refreshedTokens.access_token;
          
          // Update OAuth account with new token
          const newExpiresAt = refreshedTokens.expires_in 
            ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
            : expiresAt;
          
          await this.prisma.oAuthAccount.update({
            where: { id: oauthAccount.id },
            data: {
              accessToken: refreshedTokens.access_token,
              expiresAt: newExpiresAt,
              refreshToken: refreshedTokens.refresh_token || oauthAccount.refreshToken,
            },
          });
          
          this.logger.log(`[GmailTrigger] ✅ Access token refreshed before fetching messages`);
        } catch (refreshError: any) {
          this.logger.error(`[GmailTrigger] Failed to refresh access token before fetching messages: ${refreshError.message}`);
          // Continue anyway - try to fetch with existing token
        }
      }

      // Fetch new messages from Gmail
      const config = trigger.config as any;
      const historyId = config.watchHistoryId || config.historyId || '0';
      
      this.logger.log(`[GmailTrigger] Fetching new messages for workflow ${workflowId} since historyId: ${historyId}`);
      const messages = await this.gmailService.fetchNewMessages(
        accessToken,
        historyId,
      );

      this.logger.log(`[GmailTrigger] Found ${messages.length} new messages for workflow ${workflowId}`);

      // Queue workflow trigger event for each new message
      // Using BullMQ queue for better reliability and retry handling
      for (const message of messages) {
        await this.queueGmailEvent({
          workflowId,
          userId: trigger.workflow.userId,
          messageId: message.id,
          threadId: message.threadId,
          labelIds: message.labelIds,
          snippet: message.snippet,
          historyId: message.historyId,
          channelId,
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
              lastProcessedAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch (error: any) {
      this.logger.error(`[GmailTrigger] Error processing Gmail notification for workflow ${workflowId}:`, error.message);
    }
  }

  /**
   * Queue a Gmail event for processing by the worker
   */
  async queueGmailEvent(data: Omit<GmailEventJobData, 'receivedAt'>): Promise<void> {
    this.logger.log(`Queueing Gmail event for workflow ${data.workflowId}, message ${data.messageId}`);
    
    try {
      await gmailEventQueue.add(
        'gmail-event',
        {
          ...data,
          receivedAt: new Date().toISOString(),
        },
        {
          jobId: `gmail-${data.workflowId}-${data.messageId}-${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      
      this.logger.log(`Successfully queued Gmail event for workflow ${data.workflowId}`);
    } catch (error: any) {
      this.logger.error(`Failed to queue Gmail event: ${error.message}`);
      throw error;
    }
  }

  /**
   * Auto-register Gmail trigger when user connects Google account
   */
  async autoRegisterForUser(userId: number): Promise<void> {
    this.logger.log(`Auto-registering Gmail triggers for user ${userId}`);
    
    try {
      // Find all enabled workflows with Gmail trigger for this user
      const workflows = await this.prisma.workflow.findMany({
        where: {
          userId,
          enabled: true,
        },
        include: {
          trigger: true,
        },
      });

      const gmailWorkflows = workflows.filter(
        w => w.trigger && w.trigger.type === TriggerType.GOOGLE_MAIL,
      );

      this.logger.log(`Found ${gmailWorkflows.length} Gmail workflows for user ${userId}`);

      // Register each workflow
      for (const workflow of gmailWorkflows) {
        try {
          const config = workflow.trigger!.config as any;
          await this.register(workflow.id, {
            ...config,
            userId,
          });
          this.logger.log(`Auto-registered Gmail trigger for workflow ${workflow.id}`);
        } catch (error: any) {
          this.logger.error(`Failed to auto-register workflow ${workflow.id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error auto-registering Gmail triggers for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Renew expired watch subscriptions
   * Gmail watch subscriptions expire after 7 days
   */
  async renewExpiredWatches(): Promise<void> {
    this.logger.log('Checking for expired Gmail watch subscriptions');

    try {
      const triggers = await this.prisma.trigger.findMany({
        where: {
          type: TriggerType.GOOGLE_MAIL,
        },
        include: {
          workflow: {
            include: {
              user: true,
            },
          },
        },
      });

      const now = new Date();
      
      for (const trigger of triggers) {
        if (!trigger.workflow.enabled) {
          continue;
        }

        const config = trigger.config as any;
        const expiration = config.watchExpiration;
        
        if (!expiration) {
          continue;
        }

        const expirationDate = new Date(expiration);
        // Renew 24 hours before expiration
        const renewalThreshold = new Date(expirationDate.getTime() - 24 * 60 * 60 * 1000);

        if (now >= renewalThreshold) {
          this.logger.log(`Renewing expired watch for workflow ${trigger.workflowId}`);
          
          try {
            // Get OAuth tokens
            const oauthAccount = await this.prisma.oAuthAccount.findFirst({
              where: {
                userId: trigger.workflow.userId,
                provider: 'google',
              },
            });

            if (!oauthAccount?.accessToken) {
              this.logger.warn(`No OAuth tokens found for workflow ${trigger.workflowId}`);
              continue;
            }

            if (!oauthAccount.refreshToken) {
              this.logger.warn(`No refresh token found for workflow ${trigger.workflowId}`);
              continue;
            }

            // Validate and refresh access token if needed
            let accessToken = oauthAccount.accessToken;
            const expiresAt = oauthAccount.expiresAt;
            
            // Check if token is expired or expires within the next 5 minutes
            const needsRefresh = !expiresAt || expiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
            
            if (needsRefresh) {
              if (!this.googleOAuthService) {
                this.logger.warn(`GoogleOAuthService not available for workflow ${trigger.workflowId}`);
                continue;
              }
              
              this.logger.log(`[GmailTrigger] Refreshing access token for workflow ${trigger.workflowId} (expiresAt: ${expiresAt})`);
              
              try {
                const refreshedTokens = await this.googleOAuthService.refreshAccessToken(oauthAccount.refreshToken);
                accessToken = refreshedTokens.access_token;
                
                // Update OAuth account with new token
                const newExpiresAt = refreshedTokens.expires_in 
                  ? new Date(Date.now() + refreshedTokens.expires_in * 1000)
                  : expiresAt;
                
                await this.prisma.oAuthAccount.update({
                  where: { id: oauthAccount.id },
                  data: {
                    accessToken: refreshedTokens.access_token,
                    expiresAt: newExpiresAt,
                    refreshToken: refreshedTokens.refresh_token || oauthAccount.refreshToken,
                  },
                });
                
                this.logger.log(`[GmailTrigger] ✅ Access token refreshed for workflow ${trigger.workflowId}, expires at: ${newExpiresAt}`);
              } catch (refreshError: any) {
                this.logger.error(`[GmailTrigger] Failed to refresh access token for workflow ${trigger.workflowId}: ${refreshError.message}`);
                continue; // Skip this workflow and continue with others
              }
            }

            // Renew watch - use auto-created topic if available
            let topicName: string;
            if (this.pubSubService?.isAvailable()) {
              try {
                topicName = this.pubSubService.getTopicPath(trigger.workflow.userId);
                this.logger.log(`[GmailTrigger] Using auto-created topic for renewal: ${topicName}`);
              } catch (error: any) {
                this.logger.warn(`[GmailTrigger] Failed to get topic path for renewal: ${error.message}, using manual topic`);
                const projectId = this.configService.get<string>('GOOGLE_PROJECT_NAME') || 
                                  this.configService.get<string>('GCP_PROJECT_ID') || 'my-project';
                topicName = config.topicName || `projects/${projectId}/topics/workflow-${trigger.workflowId}`;
              }
            } else {
              const projectId = this.configService.get<string>('GOOGLE_PROJECT_NAME') || 
                                this.configService.get<string>('GCP_PROJECT_ID') || 'my-project';
              topicName = config.topicName || `projects/${projectId}/topics/workflow-${trigger.workflowId}`;
              this.logger.warn(`[GmailTrigger] Pub/Sub service not available, using manual topic: ${topicName}`);
            }

            // Renew watch
            const watchResponse = await this.gmailService.renewWatch(accessToken, {
              topicName,
              labelIds: config.labelIds || ['INBOX'],
            });

            // Update trigger config
            await this.prisma.trigger.update({
              where: { workflowId: trigger.workflowId },
              data: {
                config: {
                  ...config,
                  watchHistoryId: watchResponse.historyId,
                  watchExpiration: watchResponse.expiration,
                  lastRenewedAt: new Date().toISOString(),
                },
              },
            });

            this.logger.log(`Successfully renewed watch for workflow ${trigger.workflowId}`);
          } catch (error: any) {
            this.logger.error(`Failed to renew watch for workflow ${trigger.workflowId}: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Error renewing expired watches: ${error.message}`);
    }
  }

  /**
   * Get channel ID for a workflow
   */
  getChannelId(workflowId: number): string | undefined {
    return this.watchedWorkflows.get(workflowId)?.channelId;
  }
}

