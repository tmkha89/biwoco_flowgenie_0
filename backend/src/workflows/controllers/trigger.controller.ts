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
   * POST /api/triggers/gmail/pubsub
   * 
   * This endpoint receives notifications from Google Pub/Sub when Gmail events occur
   */
  @Post('gmail/pubsub')
  @HttpCode(HttpStatus.OK)
  async handleGmailPubSub(
    @Body() body: any,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    this.logger.log('Received Gmail Pub/Sub notification');

    try {
      // Google Pub/Sub sends notifications in a specific format
      // https://cloud.google.com/pubsub/docs/push#receiving_messages
      const message = body.message;
      
      if (!message) {
        // This might be a subscription verification request
        if (body.challenge) {
          this.logger.log('Received Pub/Sub subscription verification challenge');
          return { success: true };
        }
        
        this.logger.warn('Invalid Pub/Sub notification format: missing message');
        return { success: false };
      }

      // Decode base64-encoded data
      const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
      const notification = JSON.parse(decodedData);

      this.logger.log(`Processing Gmail Pub/Sub notification: ${JSON.stringify(notification)}`);

      // Extract channel ID from the notification
      const channelId = notification.channelId || notification.emailAddress;

      if (!channelId) {
        this.logger.warn('No channel ID found in Pub/Sub notification');
        return { success: false };
      }

      // Handle the notification
      await this.googleMailTriggerHandler.handlePubSubNotification(channelId, notification);

      return { success: true };
    } catch (error: any) {
      this.logger.error('Error processing Gmail Pub/Sub notification:', error.message);
      // Return success to avoid retries for non-critical errors
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
}

