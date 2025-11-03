import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SlackService } from './slack/slack.service';

/**
 * @openapi
 * /install:
 *   tags:
 *     - Slack
 *     description: OAuth2 installation endpoints for Slack
 */
@Controller('install')
export class InstallController {
  private readonly logger = new Logger(InstallController.name);

  constructor(
    private readonly slackService: SlackService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * @openapi
   * /install/slack:
   *   get:
   *     summary: Slack OAuth2 installation
   *     description: |
   *       Handles Slack OAuth2 installation flow. This endpoint:
   *       - Exchanges authorization code for access tokens
   *       - Stores user tokens and bot tokens (if available) in the database
   *       - Supports both user-initiated and workspace-wide installations
   *       - Redirects to frontend success or error page
   *     tags:
   *       - Slack
   *     parameters:
   *       - in: query
   *         name: code
   *         required: false
   *         schema:
   *           type: string
   *         description: Authorization code from Slack OAuth
   *       - in: query
   *         name: state
   *         required: false
   *         schema:
   *           type: string
   *         description: State parameter (optional, can contain user_${userId} for user-specific installations)
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
   *         description: Bad request - Missing authorization code
   */
  @Get('slack')
  async installSlack(
    @Query('code') code: string,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const FRONTEND_URL =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    // Handle OAuth errors
    if (error) {
      return res.redirect(
        `${FRONTEND_URL}/slack/oauth/error?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code) {
      return res.redirect(
        `${FRONTEND_URL}/slack/oauth/error?error=${encodeURIComponent('No authorization code received')}`,
      );
    }

    try {
      // Extract userId from state if provided
      let userId: number | undefined;
      if (state && state.startsWith('user_')) {
        userId = parseInt(state.replace('user_', ''), 10);
        if (isNaN(userId)) {
          userId = undefined;
        }
      }

      // Exchange code for tokens
      const tokens = await this.slackService.exchangeCodeForTokens(code);

      // If userId is provided, store tokens for that user
      if (userId) {
        await this.slackService.storeTokens(userId, tokens);
      } else {
        // For workspace-wide installations, we need to identify the workspace owner
        // For now, log the installation and store with team ID as identifier
        // TODO: Handle workspace-wide token storage
        this.logger.log(`Slack OAuth installation completed for team ${tokens.teamId}`);
      }

      // Redirect to success page
      res.redirect(`${FRONTEND_URL}/slack/oauth/success`);
    } catch (error: any) {
      this.logger.error('Error handling Slack OAuth installation:', error.message);
      res.redirect(
        `${FRONTEND_URL}/slack/oauth/error?error=${encodeURIComponent(error.message || 'Installation failed')}`,
      );
    }
  }
}

