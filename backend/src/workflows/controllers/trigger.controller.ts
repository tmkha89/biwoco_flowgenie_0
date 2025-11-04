import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhookTriggerHandler } from '../triggers/webhook.trigger';
import { GoogleMailTriggerHandler } from '../triggers/google-mail.trigger';

/**
 * @openapi
 * tags:
 *   - name: Triggers
 *     description: Trigger endpoints for webhooks and Gmail Pub/Sub notifications
 */
@Controller('api/triggers')
export class TriggerController {
  private readonly logger = new Logger(TriggerController.name);

  constructor(
    private readonly webhookTriggerHandler: WebhookTriggerHandler,
    private readonly googleMailTriggerHandler: GoogleMailTriggerHandler,
  ) {}

  /**
   * @openapi
   * /api/triggers/webhook/{id}:
   *   post:
   *     summary: Handle webhook trigger
   *     description: Receives webhook requests for a specific webhook ID and triggers associated workflows
   *     tags:
   *       - Triggers
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Webhook ID
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             additionalProperties: true
   *           example:
   *             event: "user_signup"
   *             userId: 123
   *             data: {}
   *     responses:
   *       200:
   *         description: Webhook processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Webhook processed successfully"
   *       400:
   *         description: Invalid request
   *       404:
   *         description: Webhook not found
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
      Object.keys(headers).forEach((key) => {
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
      this.logger.error(
        `Error processing webhook ${webhookId}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * @openapi
   * /api/triggers/gmail:
   *   post:
   *     summary: Handle Gmail Pub/Sub push notification
   *     description: Receives push notifications from Google Cloud Pub/Sub when Gmail events occur. Validates X-Goog headers and processes messages.
   *     tags:
   *       - Triggers
   *     headers:
   *       x-goog-channel-id:
   *         schema:
   *           type: string
   *         description: Gmail channel ID
   *       x-goog-resource-state:
   *         schema:
   *           type: string
   *         description: Resource state (exists, sync, etc.)
   *       x-goog-resource-id:
   *         schema:
   *           type: string
   *         description: Resource ID
   *       x-goog-resource-uri:
   *         schema:
   *           type: string
   *         description: Resource URI
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: object
   *                 properties:
   *                   data:
   *                     type: string
   *                     description: Base64-encoded notification data
   *                     example: "eyJjaGFubmVsSWQiOiAiMTIzIn0="
   *               challenge:
   *                 type: string
   *                 description: Subscription verification challenge
   *           example:
   *             message:
   *               data: "eyJjaGFubmVsSWQiOiAiMTIzIiwgImVtYWlsQWRkcmVzcyI6ICJ1c2VyQGV4YW1wbGUuY29tIn0="
   *     responses:
   *       200:
   *         description: Notification processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *       400:
   *         description: Invalid notification format
   *
   * /api/triggers/gmail/pubsub:
   *   post:
   *     summary: Handle Gmail Pub/Sub push notification (alternative route)
   *     description: Alternative route for Gmail Pub/Sub notifications. Same functionality as /api/triggers/gmail
   *     tags:
   *       - Triggers
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               message:
   *                 type: object
   *                 properties:
   *                   data:
   *                     type: string
   *                     description: Base64-encoded notification data
   *     responses:
   *       200:
   *         description: Notification processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
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
      const channelId =
        headers['x-goog-channel-id'] ||
        headers['x-goog-channel-id'.toLowerCase()];
      const resourceState =
        headers['x-goog-resource-state'] ||
        headers['x-goog-resource-state'.toLowerCase()];
      const resourceId =
        headers['x-goog-resource-id'] ||
        headers['x-goog-resource-id'.toLowerCase()];
      const resourceUri =
        headers['x-goog-resource-uri'] ||
        headers['x-goog-resource-uri'.toLowerCase()];

      this.logger.debug(
        `[PubSub] Headers: channelId=${channelId}, resourceState=${resourceState}, resourceId=${resourceId}`,
      );

      // Handle subscription verification challenge
      if (body.challenge) {
        this.logger.log(
          '[PubSub] Received subscription verification challenge',
        );
        return { success: true };
      }

      // Google Pub/Sub sends notifications in a specific format
      // https://cloud.google.com/pubsub/docs/push#receiving_messages
      const message = body.message;

      if (!message) {
        this.logger.warn(
          '[PubSub] Invalid Pub/Sub notification format: missing message',
        );
        return { success: false };
      }

      // Decode base64-encoded data
      let notification: any;
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString(
          'utf-8',
        );
        notification = JSON.parse(decodedData);
        this.logger.log(
          `[PubSub] Decoded notification: ${JSON.stringify(notification)}`,
        );
      } catch (parseError: any) {
        this.logger.error(
          `[PubSub] Failed to decode message data: ${parseError.message}`,
        );
        return { success: false };
      }

      // Extract channel ID from notification or headers
      const notificationChannelId =
        notification.channelId || notification.emailAddress || channelId;

      if (!notificationChannelId) {
        this.logger.warn(
          '[PubSub] No channel ID found in notification or headers',
        );
        return { success: false };
      }

      // Validate resource state (Gmail sends 'exists' when there are changes)
      if (
        resourceState &&
        resourceState !== 'exists' &&
        resourceState !== 'sync'
      ) {
        this.logger.debug(
          `[PubSub] Resource state is '${resourceState}', ignoring notification`,
        );
        return { success: true }; // Not an error, just not a change notification
      }

      // Handle the notification
      this.logger.log(
        `[PubSub] Processing Gmail notification for channel: ${notificationChannelId}`,
      );
      await this.googleMailTriggerHandler.handlePubSubNotification(
        notificationChannelId,
        {
          ...notification,
          channelId: notificationChannelId,
          resourceState,
          resourceId,
          resourceUri,
        },
      );

      this.logger.log(`[PubSub] ✅ Successfully processed Gmail notification`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `[PubSub] ❌ Error processing Gmail Pub/Sub notification: ${error.message}`,
      );
      this.logger.error(`[PubSub] Error stack: ${error.stack}`);
      // Return success to avoid retries for non-critical errors
      // Pub/Sub will retry if we return an error status
      return { success: false };
    }
  }

  /**
   * @openapi
   * /api/triggers/gmail/alt:
   *   post:
   *     summary: Handle Gmail push notification (alternative format)
   *     description: Handles direct notification format (alternative to Pub/Sub format). Used for direct Gmail API notifications.
   *     tags:
   *       - Triggers
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - workflowId
   *               - userId
   *               - messageId
   *             properties:
   *               workflowId:
   *                 type: integer
   *                 example: 1
   *               userId:
   *                 type: integer
   *                 example: 1
   *               messageId:
   *                 type: string
   *                 example: "1234567890"
   *               threadId:
   *                 type: string
   *                 example: "0987654321"
   *               labelIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 example: ["INBOX", "UNREAD"]
   *               snippet:
   *                 type: string
   *                 example: "Email preview text..."
   *               historyId:
   *                 type: string
   *                 example: "123456"
   *           example:
   *             workflowId: 1
   *             userId: 1
   *             messageId: "1234567890"
   *             threadId: "0987654321"
   *             labelIds: ["INBOX", "UNREAD"]
   *             snippet: "Email preview text..."
   *             historyId: "123456"
   *     responses:
   *       200:
   *         description: Event queued for processing
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Gmail event queued for processing"
   *       400:
   *         description: Missing required fields
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Missing required fields"
   */
  @Post('gmail/alt')
  @HttpCode(HttpStatus.OK)
  async handleGmailPushAlternative(
    @Body() body: any,
  ): Promise<{ success: boolean; message?: string }> {
    this.logger.log('Received Gmail push notification (alternative format)');
    this.logger.debug(`Gmail push payload: ${JSON.stringify(body)}`);

    try {
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

  /**
   * @openapi
   * /api/triggers/gmail/pubsub:
   *   get:
   *     summary: Health check for Gmail Pub/Sub endpoint
   *     description: Health check endpoint that also handles Pub/Sub subscription verification challenges
   *     tags:
   *       - Triggers
   *     parameters:
   *       - in: query
   *         name: hub.mode
   *         schema:
   *           type: string
   *         description: Subscription mode (subscribe)
   *       - in: query
   *         name: hub.topic
   *         schema:
   *           type: string
   *         description: Pub/Sub topic
   *       - in: query
   *         name: hub.challenge
   *         schema:
   *           type: string
   *         description: Verification challenge
   *     responses:
   *       200:
   *         description: Health check OK or challenge response
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "ok"
   *           text/plain:
   *             schema:
   *               type: string
   *               description: Challenge response (if verification challenge)
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
