import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SlackService } from './slack.service';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * @openapi
 * /slack:
 *   tags:
 *     - Slack
 *     description: Slack OAuth and Events API integration
 */
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly configService: ConfigService,
    @Inject('SLACK_EVENT_QUEUE') private readonly slackEventQueue: Queue,
  ) {}

  /**
   * @openapi
   * /slack/oauth/start:
   *   get:
   *     summary: Start Slack OAuth flow
   *     description: Initiates the Slack OAuth2 authorization flow for the authenticated user. Redirects to Slack's authorization page.
   *     tags:
   *       - Slack
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       302:
   *         description: Redirect to Slack OAuth authorization page
   *       401:
   *         description: Unauthorized - User not authenticated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Unauthorized
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Failed to start OAuth flow
   */
  @Get('oauth/start')
  @UseGuards(JwtAuthGuard)
  async startOAuth(
    @CurrentUser('id') userId: number,
    @Res() res: Response,
  ): Promise<void> {
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      this.logger.log(`Starting Slack OAuth flow for user ${userId}`);
      const state = `user_${userId}`;
      const authUrl = this.slackService.getAuthorizationUrl(state);
      this.logger.log(`Redirecting user ${userId} to Slack authorization URL`);
      res.redirect(authUrl);
    } catch (error: any) {
      this.logger.error(`Error starting Slack OAuth for user ${userId}: ${error.message}`, error.stack);
      res.status(500).json({ message: 'Failed to start OAuth flow' });
    }
  }


  /**
   * @openapi
   * /slack/status:
   *   get:
   *     summary: Get Slack connection status
   *     description: Returns the Slack connection status for the authenticated user.
   *     tags:
   *       - Slack
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Slack connection status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 connected:
   *                   type: boolean
   *                   example: true
   *                 teamId:
   *                   type: string
   *                   example: connected
   *                 userId:
   *                   type: string
   *                   example: U123456
   *       401:
   *         description: Unauthorized
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser('id') userId: number): Promise<any> {
    try {
      this.logger.debug(`Checking Slack connection status for user ${userId}`);
      // Try to get access token to verify connection
      const accessToken = await this.slackService.getAccessToken(userId);
      
      if (!accessToken) {
        this.logger.debug(`Slack not connected for user ${userId}`);
        return { connected: false };
      }

      // Get OAuth account details using the service's internal oauthService
      const oauthService = (this.slackService as any).oauthService;
      const accounts = await oauthService.findByUserId(userId);
      const slackAccount = accounts.find((acc: any) => acc.provider === 'slack');

      if (!slackAccount) {
        this.logger.debug(`No Slack account found for user ${userId}`);
        return { connected: false };
      }

      this.logger.log(`Slack connected for user ${userId}, Slack user ID: ${slackAccount.providerUserId}`);
      return {
        connected: true,
        teamId: 'connected',
        userId: slackAccount.providerUserId,
      };
    } catch (error: any) {
      this.logger.error(`Error getting Slack status for user ${userId}: ${error.message}`, error.stack);
      return { connected: false };
    }
  }

  /**
   * @openapi
   * /slack/oauth/callback:
   *   get:
   *     summary: Slack OAuth callback
   *     description: Handles the OAuth callback from Slack after user authorization. Exchanges authorization code for tokens and stores them for the user.
   *     tags:
   *       - Slack
   *     parameters:
   *       - in: query
   *         name: code
   *         required: false
   *         schema:
   *           type: string
   *         description: Authorization code from Slack
   *       - in: query
   *         name: state
   *         required: false
   *         schema:
   *           type: string
   *         description: State parameter for OAuth flow (should contain user_${userId})
   *       - in: query
   *         name: error
   *         required: false
   *         schema:
   *           type: string
   *         description: OAuth error if authorization was denied
   *     responses:
   *       302:
   *         description: Redirect to frontend success or error page
   *       400:
   *         description: Bad request - Invalid state or missing code
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Invalid state parameter
   */
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    // Handle OAuth errors
    if (error) {
      this.logger.warn(`Slack OAuth error: ${error}`);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      res.redirect(`${frontendUrl}/slack/oauth/error?error=${encodeURIComponent(error)}`);
      return;
    }

    // Validate state parameter
    if (!state || !state.startsWith('user_')) {
      res.status(400).json({ message: 'Invalid state parameter' });
      return;
    }

    const userId = parseInt(state.replace('user_', ''), 10);
    if (isNaN(userId)) {
      res.status(400).json({ message: 'Invalid state parameter' });
      return;
    }

    if (!code) {
      res.status(400).json({ message: 'Authorization code is required' });
      return;
    }

    try {
      this.logger.log(`Handling Slack OAuth callback for user ${userId}`);
      // Exchange code for tokens
      const tokens = await this.slackService.exchangeCodeForTokens(code);

      // Store tokens
      await this.slackService.storeTokens(userId, tokens);

      this.logger.log(`Slack OAuth completed successfully for user ${userId}, team: ${tokens.teamId}`);

      // Redirect to frontend success page
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      this.logger.log(`Redirecting user ${userId} to frontend success page`);
      res.redirect(`${frontendUrl}/slack/oauth/success`);
    } catch (error: any) {
      this.logger.error(`Error handling Slack OAuth callback for user ${userId}: ${error.message}`, error.stack);
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
      res.redirect(`${frontendUrl}/slack/oauth/error?error=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * @openapi
   * /slack/events:
   *   post:
   *     summary: Handle Slack Events API
   *     description: |
   *       Receives events from Slack Events API. This endpoint:
   *       1. Verifies the request signature using X-Slack-Signature header
   *       2. Handles URL verification challenges (url_verification type)
   *       3. Responds immediately with 200 OK
   *       4. Enqueues event processing to worker queue for async handling
   *       
   *       **Note:** This endpoint is designed to be called by Slack, not directly by clients.
   *     tags:
   *       - Slack
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - type: object
   *                 description: URL verification challenge
   *                 required:
   *                   - type
   *                   - challenge
   *                 properties:
   *                   type:
   *                     type: string
   *                     enum: [url_verification]
   *                     example: url_verification
   *                   challenge:
   *                     type: string
   *                     example: 3eZbrw1aBm2rQmZo7t1sx7Gx8jRqZ1xY3wK8pL9mN0oP
   *               - type: object
   *                 description: Event callback
   *                 required:
   *                   - type
   *                   - team_id
   *                   - event
   *                 properties:
   *                   type:
   *                     type: string
   *                     enum: [event_callback]
   *                     example: event_callback
   *                   team_id:
   *                     type: string
   *                     example: T123456
   *                   event:
   *                     type: object
   *                     description: Slack event object
   *                     properties:
   *                       type:
   *                         type: string
   *                         example: message
   *                       channel:
   *                         type: string
   *                         example: C123456
   *                       user:
   *                         type: string
   *                         example: U123456
   *                       text:
   *                         type: string
   *                         example: Hello world
   *                   event_time:
   *                     type: integer
   *                     example: 1609459200
   *                   retry_reason:
   *                     type: string
   *                     nullable: true
   *     responses:
   *       200:
   *         description: Event processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - type: object
   *                   properties:
   *                     challenge:
   *                       type: string
   *                       example: 3eZbrw1aBm2rQmZo7t1sx7Gx8jRqZ1xY3wK8pL9mN0oP
   *                 - type: object
   *                   properties:
   *                     ok:
   *                       type: boolean
   *                       example: true
   *       401:
   *         description: Invalid signature or missing headers
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Invalid signature
   */
  @Post('events')
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Body() body: any,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
    @Res() res: Response,
  ): Promise<any> {
    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      this.logger.log('Received Slack URL verification challenge');
      return { challenge: body.challenge };
    }

    // Get raw body for signature verification
    // Note: NestJS doesn't preserve raw body by default, we need middleware or custom handling
    // For now, we'll use JSON.stringify as a fallback (not ideal, but works for most cases)
    const rawBody = (req as any).rawBody 
      ? (req as any).rawBody.toString('utf8')
      : JSON.stringify(body);

    // Get signature and timestamp from headers
    const signature = headers['x-slack-signature'] || headers['X-Slack-Signature'];
    const timestamp = headers['x-slack-request-timestamp'] || headers['X-Slack-Request-Timestamp'];

    if (!signature || !timestamp) {
      this.logger.warn('Missing Slack signature or timestamp headers');
      res.status(401).json({ message: 'Invalid signature' });
      return;
    }

    // Verify signature
    const isValid = this.slackService.verifySignature(signature, timestamp, rawBody);
    if (!isValid) {
      this.logger.warn('Invalid Slack signature');
      res.status(401).json({ message: 'Invalid signature' });
      return;
    }

    // Handle event_callback
    if (body.type === 'event_callback') {
      // Check if this is a retry (Slack retries failed requests)
      if (body.retry_reason) {
        this.logger.log(`Received Slack retry event: ${body.retry_reason}`);
        // Still return 200 OK to acknowledge, but may skip processing
        return { ok: true };
      }

      // Extract event data
      const event = body.event;
      const teamId = body.team_id;

      if (!event || !teamId) {
        this.logger.warn('Invalid event_callback format');
        return { ok: true }; // Still return 200 OK
      }

      this.logger.log(`Received Slack event: ${event.type} for team ${teamId}`);

      // Enqueue event to worker queue for async processing
      // We respond immediately with 200 OK before processing
      try {
        await this.slackEventQueue.add('slack.event', {
          event,
          teamId,
          timestamp: body.event_time || Math.floor(Date.now() / 1000),
          receivedAt: new Date().toISOString(),
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        });

        this.logger.log(`Enqueued Slack event ${event.type} for processing`);
      } catch (error: any) {
        this.logger.error(`Failed to enqueue Slack event: ${error.message}`);
        // Still return 200 OK to prevent Slack from retrying
      }

      // Return 200 OK immediately
      return { ok: true };
    }

    // For other event types, just acknowledge
    this.logger.log(`Received Slack event type: ${body.type}`);
    return { ok: true };
  }
}

