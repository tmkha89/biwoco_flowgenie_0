import {
  Controller,
  Post,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { GoogleMailTriggerHandler } from '../triggers/google-mail.trigger';

/**
 * Gmail Trigger Controller
 * Handles Gmail push notifications at /api/triggers/Google Mail
 * Note: The path uses a space as requested (URL-encoded as %20 in HTTP)
 */
@Controller('triggers')
export class GmailTriggerController {
  private readonly logger = new Logger(GmailTriggerController.name);

  constructor(
    private readonly googleMailTriggerHandler: GoogleMailTriggerHandler,
  ) {}

  /**
   * Gmail Push Notification Webhook
   * POST /api/triggers/Google Mail
   *
   * This endpoint receives push notifications from Google Gmail API
   * The path uses a space as requested (URL-encoded as %20 in HTTP)
   */
  @Post('Google Mail')
  @HttpCode(HttpStatus.OK)
  async handleGmailPush(
    @Body() body: any,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log(
      'Received Gmail push notification at /api/triggers/Google Mail',
    );
    this.logger.debug(`Gmail push payload: ${JSON.stringify(body)}`);

    try {
      // Validate webhook signature/token if provided
      const authToken =
        headers['authorization'] || headers['x-google-auth-token'];
      if (authToken) {
        // Add token validation logic here if needed
        this.logger.debug('Webhook authentication token received');
      }

      // Handle Pub/Sub push notification format
      // Google sends notifications in Pub/Sub format
      if (body.message && body.message.data) {
        // Decode base64-encoded data
        const decodedData = Buffer.from(body.message.data, 'base64').toString(
          'utf-8',
        );
        const notification = JSON.parse(decodedData);

        this.logger.log(
          `Processing Gmail push notification: ${JSON.stringify(notification)}`,
        );

        // Extract channel ID and workflow information
        const channelId = notification.channelId || notification.emailAddress;

        if (!channelId) {
          this.logger.warn('No channel ID found in Gmail push notification');
          return { success: false, message: 'No channel ID found' };
        }

        // Delegate to existing Pub/Sub handler
        await this.googleMailTriggerHandler.handlePubSubNotification(
          channelId,
          notification,
        );

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
          this.logger.warn(
            'Missing required fields in Gmail push notification',
          );
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
      this.logger.error(
        'Error processing Gmail push notification:',
        error.message,
      );
      return { success: false, message: error.message };
    }
  }
}
