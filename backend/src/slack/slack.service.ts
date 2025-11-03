import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthService } from '../oauth/oauth.service';
import axios from 'axios';
import * as crypto from 'crypto';

export interface SlackTokenResponse {
  ok: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
  };
  bot_user_id?: string;
  bot_access_token?: string; // Bot token (for workspace-wide installations)
  enterprise?: {
    id: string;
    name: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

export interface SlackStoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  teamId: string;
  userId: string;
  botToken?: string; // Bot token for workspace-wide operations
  botUserId?: string; // Bot user ID
  scope?: string; // Scopes granted
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly signingSecret: string;
  private readonly isEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly oauthService: OAuthService,
  ) {
    const clientId = this.configService.get<string>('SLACK_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('SLACK_CLIENT_SECRET', '');
    const redirectUri = this.configService.get<string>('SLACK_REDIRECT_URI', '');
    const signingSecret = this.configService.get<string>('SLACK_SIGNING_SECRET', '');

    const hasAllCredentials =
      clientId && clientId.trim() !== '' &&
      clientSecret && clientSecret.trim() !== '' &&
      redirectUri && redirectUri.trim() !== '';

    if (!hasAllCredentials) {
      this.logger.warn(
        '⚠️  Slack OAuth Service: Credentials not provided. Slack OAuth functionality will be disabled.',
      );
      this.isEnabled = false;
      this.clientId = '';
      this.clientSecret = '';
      this.redirectUri = '';
      this.signingSecret = '';
    } else {
      this.isEnabled = true;
      this.clientId = clientId;
      this.clientSecret = clientSecret;
      this.redirectUri = redirectUri;
      this.signingSecret = signingSecret;
    }
  }

  /**
   * Get Slack OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.isEnabled) {
      this.logger.error('Slack OAuth not configured - cannot generate authorization URL');
      throw new Error(
        'Slack OAuth is not configured. Please set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI environment variables.',
      );
    }

    const scopes = [
      'chat:write',
      'chat:write.public',
      'channels:history',
      'users:read',
      'im:history',
    ].join(',');

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes,
      response_type: 'code',
    });

    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    this.logger.log(`Generated Slack OAuth authorization URL for state: ${state || 'none'}`);
    return authUrl;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForTokens(code: string): Promise<SlackStoredTokens> {
    if (!this.isEnabled) {
      this.logger.error('Slack OAuth not configured - cannot exchange code for tokens');
      throw new Error(
        'Slack OAuth is not configured. Please set required environment variables.',
      );
    }

    this.logger.log('Exchanging Slack authorization code for access token');
    
    const params = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });

    try {
      this.logger.debug('Calling Slack OAuth API: oauth.v2.access');
      const response = await axios.post<SlackTokenResponse>(
        'https://slack.com/api/oauth.v2.access',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.debug(`Slack OAuth API response status: ${response.status}`);

      if (!response.data || !response.data.access_token) {
        // Check for error in response
        if ((response.data as any).ok === false) {
          const errorMsg = (response.data as any).error || 'Unknown error';
          this.logger.error(`Slack OAuth API error: ${errorMsg}`);
          throw new Error(`Slack OAuth error: ${errorMsg}`);
        }
        this.logger.error('Invalid token response from Slack - missing access_token');
        throw new Error('Invalid token response from Slack');
      }

      const tokenData = response.data;
      this.logger.log(
        `Successfully exchanged code for tokens - Team: ${tokenData.team?.id || 'N/A'}, User: ${tokenData.authed_user?.id || tokenData.bot_user_id || 'N/A'}`,
      );

      return {
        accessToken: tokenData.access_token || tokenData.bot_access_token || '',
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        teamId: tokenData.team?.id || '',
        userId: tokenData.authed_user?.id || tokenData.bot_user_id || '',
        botToken: tokenData.bot_access_token,
        botUserId: tokenData.bot_user_id,
        scope: tokenData.scope,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to exchange Slack authorization code: ${error.message}`,
        error.stack,
      );
      if (error.response?.data?.error) {
        this.logger.error(`Slack API error details: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Slack OAuth error: ${error.response.data.error}`);
      }
      throw error;
    }
  }

  /**
   * Store tokens in database
   * Stores both user tokens and bot tokens per workspace
   */
  async storeTokens(userId: number, tokens: SlackStoredTokens): Promise<any> {
    this.logger.log(`Storing Slack tokens for user ${userId}, team ${tokens.teamId}`);
    
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : undefined;

    // Store user tokens
    this.logger.debug(`Storing user token for Slack user ${tokens.userId}`);
    await this.oauthService.upsertOAuthAccount({
      userId,
      provider: 'slack',
      providerUserId: tokens.userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt,
    });
    this.logger.log(`Stored user token for Slack user ${tokens.userId}`);

    // If bot token exists, store it separately for workspace-wide operations
    // Store bot token with team ID as providerUserId
    if (tokens.botToken && tokens.teamId) {
      this.logger.debug(`Storing bot token for workspace ${tokens.teamId}`);
      await this.oauthService.upsertOAuthAccount({
        userId, // Link to user who installed
        provider: 'slack',
        providerUserId: `team_${tokens.teamId}_bot`, // Use team_bot format for bot tokens
        accessToken: tokens.botToken,
        refreshToken: tokens.refreshToken, // Bot tokens may not have refresh tokens
        expiresAt,
      });

      this.logger.log(`Stored bot token for workspace ${tokens.teamId}, bot user: ${tokens.botUserId || 'N/A'}`);
    } else {
      this.logger.debug(`No bot token provided for workspace ${tokens.teamId}`);
    }

    this.logger.log(`Successfully stored Slack tokens for user ${userId}`);
    return { success: true };
  }

  /**
   * Get bot token for a workspace
   */
  async getBotToken(teamId: string): Promise<string | null> {
    this.logger.debug(`Retrieving bot token for workspace ${teamId}`);
    const botAccount = await this.oauthService.findByProviderAndUserId(
      'slack',
      `team_${teamId}_bot`,
    );

    if (!botAccount || !botAccount.accessToken) {
      this.logger.warn(`No bot token found for workspace ${teamId}`);
      return null;
    }

    // Check if token is expired and needs refresh
    if (botAccount.expiresAt && botAccount.expiresAt < new Date()) {
      if (botAccount.refreshToken) {
        this.logger.log(`Bot token expired for team ${teamId}, attempting refresh`);
        // TODO: Implement bot token refresh
      } else {
        this.logger.warn(`Bot token expired and no refresh token available for team ${teamId}`);
      }
      return null;
    }

    this.logger.debug(`Retrieved valid bot token for workspace ${teamId}`);
    return botAccount.accessToken;
  }

  /**
   * Get access token for user (with automatic refresh if expired)
   */
  async getAccessToken(userId: number): Promise<string | null> {
    this.logger.debug(`Retrieving Slack access token for user ${userId}`);
    const accounts = await this.oauthService.findByUserId(userId);
    const slackAccount = accounts.find((acc) => acc.provider === 'slack');

    if (!slackAccount || !slackAccount.accessToken) {
      this.logger.warn(`No Slack access token found for user ${userId}`);
      return null;
    }

    // Check if token is expired and needs refresh
    if (slackAccount.expiresAt && slackAccount.expiresAt < new Date()) {
      this.logger.log(`Slack token expired for user ${userId}, expiresAt: ${slackAccount.expiresAt}`);
      if (slackAccount.refreshToken) {
        this.logger.log(`Refreshing expired Slack token for user ${userId}`);
        return this.refreshAccessToken(userId);
      }
      this.logger.warn(`Slack token expired and no refresh token available for user ${userId}`);
      return null;
    }

    this.logger.debug(`Retrieved valid Slack access token for user ${userId}`);
    return slackAccount.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(userId: number): Promise<string> {
    this.logger.log(`Refreshing Slack access token for user ${userId}`);
    const accounts = await this.oauthService.findByUserId(userId);
    const slackAccount = accounts.find((acc) => acc.provider === 'slack');

    if (!slackAccount || !slackAccount.refreshToken) {
      this.logger.error(`No refresh token available for user ${userId}`);
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: slackAccount.refreshToken,
      grant_type: 'refresh_token',
    });

    try {
      this.logger.debug('Calling Slack OAuth API to refresh token: oauth.v2.access');
      const response = await axios.post<SlackTokenResponse>(
        'https://slack.com/api/oauth.v2.access',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.logger.debug(`Slack token refresh API response status: ${response.status}`);

      if (!response.data || !response.data.access_token) {
        if ((response.data as any).ok === false) {
          const errorMsg = (response.data as any).error || 'Unknown error';
          this.logger.error(`Slack token refresh API error: ${errorMsg}`);
          throw new Error(`Failed to refresh Slack token: ${errorMsg}`);
        }
        this.logger.error('Invalid refresh token response from Slack - missing access_token');
        throw new Error('Invalid refresh token response from Slack');
      }

      const tokenData = response.data;
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : undefined;

      // Update stored token
      await this.oauthService.updateOAuthAccount(slackAccount.id, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || slackAccount.refreshToken,
        expiresAt,
      });

      this.logger.log(`Successfully refreshed Slack access token for user ${userId}, expires in ${tokenData.expires_in || 'N/A'} seconds`);
      return tokenData.access_token;
    } catch (error: any) {
      this.logger.error(
        `Failed to refresh Slack access token for user ${userId}: ${error.message}`,
        error.stack,
      );
      if (error.response?.data?.error) {
        this.logger.error(`Slack API error details: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Failed to refresh Slack token: ${error.response.data.error}`);
      }
      throw error;
    }
  }

  /**
   * Send message to Slack channel or user
   */
  async sendMessage(userId: number, channelId: string, text: string): Promise<any> {
    this.logger.log(`Sending Slack message - User: ${userId}, Channel: ${channelId}, Text length: ${text.length}`);
    const accessToken = await this.getAccessToken(userId);

    if (!accessToken) {
      this.logger.error(`No Slack access token found for user ${userId}`);
      throw new Error('No Slack access token found for user');
    }

    try {
      this.logger.debug(`Calling Slack API: chat.postMessage to channel ${channelId}`);
      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: channelId,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.debug(`Slack API response status: ${response.status}`);

      if ((response.data as any).ok === false) {
        const errorMsg = (response.data as any).error || 'Unknown error';
        this.logger.error(`Slack API error when sending message: ${errorMsg}`);
        throw new Error(`Slack API error: ${errorMsg}`);
      }

      const messageTs = (response.data as any).ts || 'N/A';
      this.logger.log(`Successfully sent Slack message to channel ${channelId}, message timestamp: ${messageTs}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send Slack message - User: ${userId}, Channel: ${channelId}, Error: ${error.message}`,
        error.stack,
      );
      if (error.response?.data?.error) {
        this.logger.error(`Slack API error details: ${JSON.stringify(error.response.data)}`);
        throw new Error(`Slack API error: ${error.response.data.error}`);
      }
      throw error;
    }
  }

  /**
   * Verify Slack request signature
   * Implements Slack's signature verification using HMAC-SHA256
   */
  verifySignature(
    signature: string,
    timestamp: string,
    rawBody: string,
  ): boolean {
    this.logger.debug(`Verifying Slack request signature, timestamp: ${timestamp}`);
    
    if (!this.signingSecret) {
      this.logger.warn('Slack signing secret not configured, skipping signature verification');
      return true; // Allow if not configured (for testing)
    }

    // Check timestamp to prevent replay attacks (reject if older than 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 300) {
      this.logger.warn(`Slack request timestamp validation failed - time difference: ${timeDiff} seconds (max: 300)`);
      return false;
    }

    // Create signature base string
    const sigBaseString = `v0:${timestamp}:${rawBody}`;

    // Create expected signature
    const expectedSignature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(sigBaseString)
      .digest('hex');

    // Format: v0=<hex_signature>
    const expectedSignatureFormatted = `v0=${expectedSignature}`;

    // Compare signatures using constant-time comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignatureFormatted),
    );

    if (isValid) {
      this.logger.debug('Slack request signature verified successfully');
    } else {
      this.logger.warn('Slack request signature verification failed');
    }

    return isValid;
  }
}

