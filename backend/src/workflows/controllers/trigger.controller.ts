import { Controller, Post, Get, Body, Param, Req, Res, HttpCode, HttpStatus, Logger, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhookTriggerHandler } from '../triggers/webhook.trigger';
import { GoogleMailTriggerHandler } from '../triggers/google-mail.trigger';

/**
 * Controller for handling trigger endpoints
 * - Webhook endpoint: /api/triggers/webhook/:id
 * - Gmail Pub/Sub endpoint: /api/triggers/gmail/pubsub
 */
@Controller('triggers')
export class TriggerController {
  private readonly logger = new Logger(TriggerController.name);

  constructor(
    private readonly webhookTriggerHandler: WebhookTriggerHandler,
    private readonly googleMailTriggerHandler: GoogleMailTriggerHandler,
  ) {}

  /**
   * Webhook endpoint
   * POST /api/triggers/webhook/:id
   */
  @Post('webhook/:id')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('id') webhookId: string,
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Received webhook request for webhookId: ${webhookId}`);

    try {
      // Convert headers to lowercase keys for consistency
      const normalizedHeaders: Record<string, string> = {};
      Object.keys(headers).forEach(key => {
        normalizedHeaders[key.toLowerCase()] = headers[key];
      });

      await this.webhookTriggerHandler.handleWebhookRequest(
        webhookId,
        body,
        normalizedHeaders,
      );

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error: any) {
      this.logger.error(`Error processing webhook ${webhookId}:`, error.message);
      throw error;
    }
  }

  /**
   * Gmail Pub/Sub endpoint
   * POST /api/triggers/gmail
   * POST /api/triggers/gmail/pubsub
   * 
   * This endpoint receives push notifications from Google Pub/Sub when Gmail events occur
   * Validates X-Goog headers and processes messages
   */
  @Post('gmail')
  @Post('gmail/pubsub')
  @HttpCode(HttpStatus.OK)
  async handleGmailPubSub(
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    this.logger.log('[PubSub] Received Gmail Pub/Sub push notification');

    try {
      // Validate Pub/Sub headers
      const channelId = headers['x-goog-channel-id'] || headers['x-goog-channel-id'.toLowerCase()];
      const resourceState = headers['x-goog-resource-state'] || headers['x-goog-resource-state'.toLowerCase()];
      const resourceId = headers['x-goog-resource-id'] || headers['x-goog-resource-id'.toLowerCase()];
      const resourceUri = headers['x-goog-resource-uri'] || headers['x-goog-resource-uri'.toLowerCase()];

      this.logger.debug(`[PubSub] Headers: channelId=${channelId}, resourceState=${resourceState}, resourceId=${resourceId}`);

      // Handle subscription verification challenge
      if (body.challenge) {
        this.logger.log('[PubSub] Received subscription verification challenge');
        return { success: true };
      }

      // Google Pub/Sub sends notifications in a specific format
      // https://cloud.google.com/pubsub/docs/push#receiving_messages
      const message = body.message;
      
      if (!message) {
        this.logger.warn('[PubSub] Invalid Pub/Sub notification format: missing message');
        return { success: false };
      }

      // Decode base64-encoded data
      let notification: any;
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
        notification = JSON.parse(decodedData);
        this.logger.log(`[PubSub] Decoded notification: ${JSON.stringify(notification)}`);
      } catch (parseError: any) {
        this.logger.error(`[PubSub] Failed to decode message data: ${parseError.message}`);
        return { success: false };
      }

      // Extract channel ID from notification or headers
      const notificationChannelId = notification.channelId || notification.emailAddress || channelId;

      if (!notificationChannelId) {
        this.logger.warn('[PubSub] No channel ID found in notification or headers');
        return { success: false };
      }

      // Validate resource state (Gmail sends 'exists' when there are changes)
      if (resourceState && resourceState !== 'exists' && resourceState !== 'sync') {
        this.logger.debug(`[PubSub] Resource state is '${resourceState}', ignoring notification`);
        return { success: true }; // Not an error, just not a change notification
      }

      // Handle the notification
      this.logger.log(`[PubSub] Processing Gmail notification for channel: ${notificationChannelId}`);
      await this.googleMailTriggerHandler.handlePubSubNotification(notificationChannelId, {
        ...notification,
        channelId: notificationChannelId,
        resourceState,
        resourceId,
        resourceUri,
      });

      this.logger.log(`[PubSub] ✅ Successfully processed Gmail notification`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`[PubSub] ❌ Error processing Gmail Pub/Sub notification: ${error.message}`);
      this.logger.error(`[PubSub] Error stack: ${error.stack}`);
      // Return success to avoid retries for non-critical errors
      // Pub/Sub will retry if we return an error status
      return { success: false };
    }
  }

  /**
   * Health check endpoint for Pub/Sub
   * GET /api/triggers/gmail/pubsub
   */
  @Get('gmail/pubsub')
  async healthCheck(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Handle subscription verification
    const mode = req.query['hub.mode'] as string;
    const topic = req.query['hub.topic'] as string;
    const challenge = req.query['hub.challenge'] as string;

    if (mode === 'subscribe' && topic && challenge) {
      this.logger.log(`Pub/Sub subscription verification for topic: ${topic}`);
      res.status(200).send(challenge);
    } else {
      res.status(200).json({ status: 'ok' });
    }
  }

  /**
   * Gmail Push Notification Webhook
   * POST /api/triggers/gmail (primary)
   * 
   * This endpoint receives push notifications from Google Gmail API
   */
  @Post('gmail')
  @HttpCode(HttpStatus.OK)
  async handleGmailPush(
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log('Received Gmail push notification');
    this.logger.debug(`Gmail push payload: ${JSON.stringify(body)}`);

    try {
      // Validate webhook signature/token if provided
      const authToken = headers['authorization'] || headers['x-google-auth-token'];
      if (authToken) {
        // Add token validation logic here if needed
        this.logger.debug('Webhook authentication token received');
      }

      // Handle Pub/Sub push notification format
      // Google sends notifications in Pub/Sub format
      if (body.message && body.message.data) {
        // Decode base64-encoded data
        const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8');
        const notification = JSON.parse(decodedData);
        
        this.logger.log(`Processing Gmail push notification: ${JSON.stringify(notification)}`);

        // Extract channel ID and workflow information
        const channelId = notification.channelId || notification.emailAddress;
        
        if (!channelId) {
          this.logger.warn('No channel ID found in Gmail push notification');
          return { success: false, message: 'No channel ID found' };
        }

        // Delegate to existing Pub/Sub handler
        await this.googleMailTriggerHandler.handlePubSubNotification(channelId, notification);
        
        return { success: true, message: 'Gmail push notification processed' };
      }

      // Handle direct notification format (alternative format)
      if (body.historyId || body.messageId) {
        const workflowId = body.workflowId;
        const userId = body.userId;
        const messageId = body.messageId || body.id;
        const threadId = body.threadId;
        const labelIds = body.labelIds || [];
        const snippet = body.snippet;
        const historyId = body.historyId;

        if (!workflowId || !userId || !messageId) {
          this.logger.warn('Missing required fields in Gmail push notification');
          return { success: false, message: 'Missing required fields' };
        }

        // Queue the event for processing
        await this.googleMailTriggerHandler.queueGmailEvent({
          workflowId,
          userId,
          messageId,
          threadId: threadId || '',
          labelIds,
          snippet,
          historyId: historyId || '0',
        });

        return { success: true, message: 'Gmail event queued for processing' };
      }

      // Handle subscription verification
      if (body.challenge) {
        this.logger.log('Received Gmail subscription verification challenge');
        return { success: true, message: 'Subscription verified' };
      }

      this.logger.warn('Unrecognized Gmail push notification format');
      return { success: false, message: 'Unrecognized notification format' };
    } catch (error: any) {
      this.logger.error('Error processing Gmail push notification:', error.message);
      return { success: false, message: error.message };
    }
  }
}

