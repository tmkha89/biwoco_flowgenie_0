import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GoogleMailTriggerHandler } from '../triggers/google-mail.trigger';
import { PubSubService } from '../services/pubsub.service';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Listener for Google account connection events
 * Auto-creates Pub/Sub topic and subscription, then registers Gmail triggers
 */
@Injectable()
export class GmailAutoRegisterListener implements OnModuleInit {
  private readonly logger = new Logger(GmailAutoRegisterListener.name);

  constructor(
    private readonly googleMailTriggerHandler: GoogleMailTriggerHandler,
    private readonly pubSubService: PubSubService,
  ) {}

  onModuleInit() {
    this.logger.log('GmailAutoRegisterListener initialized');
  }

  /**
   * Handle Google account connection event
   * Automatically creates Pub/Sub topic and subscription, then registers Gmail triggers
   */
  @OnEvent('google.account.connected')
  async handleGoogleAccountConnected(payload: { userId: number }) {
    const { userId } = payload;
    this.logger.log(`[GmailTrigger] Received google.account.connected event for user ${userId}`);
    
    try {
      // Step 1: Create Pub/Sub topic if not exists
      if (this.pubSubService.isAvailable()) {
        this.logger.log(`[PubSub] Creating Pub/Sub topic for user ${userId}`);
        const topicPath = await this.pubSubService.createTopic(userId);
        this.logger.log(`[PubSub] ✅ Topic created: ${topicPath}`);

        // Step 2: Create push subscription pointing to webhook endpoint
        this.logger.log(`[PubSub] Creating push subscription for user ${userId}`);
        const subscriptionPath = await this.pubSubService.createSubscription(userId, topicPath);
        this.logger.log(`[PubSub] ✅ Subscription created: ${subscriptionPath}`);

        // Step 3: Check Gmail push service account permissions
        await this.pubSubService.checkGmailPushPermissions(topicPath);
      } else {
        this.logger.warn(`[PubSub] Pub/Sub not available, skipping topic/subscription creation. Set GOOGLE_PROJECT_NAME (or GCP_PROJECT_ID) and GOOGLE_APPLICATION_CREDENTIALS.`);
      }

      // Step 4: Auto-register Gmail triggers for all enabled workflows
      this.logger.log(`[GmailTrigger] Auto-registering Gmail triggers for user ${userId}`);
      await this.googleMailTriggerHandler.autoRegisterForUser(userId);
      this.logger.log(`[GmailTrigger] ✅ Successfully auto-registered Gmail triggers for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`[GmailTrigger] ❌ Failed to setup Gmail trigger for user ${userId}: ${error.message}`);
      // Don't throw - we don't want to break the connection flow
    }
  }

  /**
   * Scheduled task to renew expired Gmail watch subscriptions
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleWatchRenewal() {
    this.logger.log('Running scheduled Gmail watch renewal task');
    
    try {
      await this.googleMailTriggerHandler.renewExpiredWatches();
      this.logger.log('Gmail watch renewal task completed');
    } catch (error: any) {
      this.logger.error(`Error in scheduled Gmail watch renewal: ${error.message}`);
    }
  }

  /**
   * Alternative: Run watch renewal every 6 hours
   * Uncomment this and comment out the daily one if you prefer more frequent checks
   */
  // @Cron(CronExpression.EVERY_6_HOURS)
  // async handleWatchRenewalFrequent() {
  //   this.logger.log('Running frequent Gmail watch renewal check');
  //   await this.googleMailTriggerHandler.renewExpiredWatches();
  // }
}

