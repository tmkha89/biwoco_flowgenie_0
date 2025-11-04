import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';
import { PrismaService } from '../../database/prisma.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import * as nodemailer from 'nodemailer';

/**
 * Gmail OAuth2 Email Action Handler
 * Sends emails using Gmail SMTP via OAuth2 tokens
 */
@Injectable()
export class GmailOAuth2ActionHandler extends BaseActionHandler {
  readonly type = 'gmail-oauth2-send';
  readonly name = 'Send Email (Gmail OAuth2)';

  private readonly logger = new Logger(GmailOAuth2ActionHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async execute(
    context: ExecutionContext,
    config: Record<string, any>,
  ): Promise<any> {
    const { to, subject, body, htmlBody, from } = config;

    this.logger.log(
      `[GmailOAuth2] Starting email send for user ${context.userId}, to: ${to}`,
    );
    this.logger.debug(
      `[GmailOAuth2] Config: ${JSON.stringify({ to, subject, hasBody: !!body, hasHtmlBody: !!htmlBody, from })}`,
    );

    // Validate required fields
    if (!to || !subject || (!body && !htmlBody)) {
      throw new Error(
        'Email action requires to, subject, and body or htmlBody',
      );
    }

    // Get Google OAuth account for the user
    this.logger.log(
      `[GmailOAuth2] Fetching OAuth account for user ${context.userId}`,
    );
    const oauthAccount = await this.prismaService.oAuthAccount.findFirst({
      where: {
        userId: context.userId,
        provider: 'google',
      },
      include: {
        user: true,
      },
    });

    if (
      !oauthAccount ||
      !oauthAccount.accessToken ||
      !oauthAccount.refreshToken
    ) {
      this.logger.error(
        `[GmailOAuth2] No OAuth account found for user ${context.userId}`,
      );
      throw new Error(
        'No Google OAuth account found for user. Please connect your Google account.',
      );
    }

    const userEmail = oauthAccount.user.email;
    this.logger.log(
      `[GmailOAuth2] OAuth account found for provider user ${oauthAccount.providerUserId}`,
    );
    this.logger.log(`[GmailOAuth2] User email: ${userEmail}`);
    this.logger.debug(
      `[GmailOAuth2] Token expires at: ${oauthAccount.expiresAt}`,
    );

    // Get OAuth2 credentials
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.error(
        '[GmailOAuth2] Google OAuth credentials not configured',
      );
      throw new Error('Google OAuth credentials not configured');
    }

    this.logger.debug(
      `[GmailOAuth2] OAuth credentials configured, clientId: ${clientId ? '✓' : '✗'}, clientSecret: ${clientSecret ? '✓' : '✗'}`,
    );

    // Check if token is expired
    let accessToken = oauthAccount.accessToken;
    const isTokenExpired =
      oauthAccount.expiresAt && oauthAccount.expiresAt < new Date();

    if (isTokenExpired || !oauthAccount.expiresAt) {
      this.logger.log('[GmailOAuth2] Access token expired, refreshing...');
      const refreshedToken = await this.googleOAuthService.refreshAccessToken(
        oauthAccount.refreshToken,
      );

      this.logger.log(
        `[GmailOAuth2] Token refreshed, expires in ${refreshedToken.expires_in}s`,
      );

      // Update the stored token
      await this.prismaService.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          accessToken: refreshedToken.access_token,
          expiresAt: new Date(Date.now() + refreshedToken.expires_in * 1000),
        },
      });

      accessToken = refreshedToken.access_token;
      this.logger.log('[GmailOAuth2] Access token refreshed successfully');
    } else {
      this.logger.log('[GmailOAuth2] Access token is valid, no refresh needed');
    }

    this.logger.log(
      '[GmailOAuth2] Proceeding to send email with current OAuth credentials',
    );

    // Resolve template variables
    const resolvedTo = this.resolveTemplate(to, context);
    const resolvedFrom = this.resolveTemplate(from || userEmail, context);
    const resolvedSubject = this.resolveTemplate(subject, context);
    const resolvedBody = body ? this.resolveTemplate(body, context) : undefined;
    const resolvedHtmlBody = htmlBody
      ? this.resolveTemplate(htmlBody, context)
      : undefined;

    this.logger.debug(
      `[GmailOAuth2] Resolved email config: from="${resolvedFrom}", to="${resolvedTo}", subject="${resolvedSubject}"`,
    );

    // Create Gmail transporter with OAuth2
    this.logger.log('[GmailOAuth2] Creating Gmail transporter with OAuth2');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail, // Use the user's email address
        clientId,
        clientSecret,
        refreshToken: oauthAccount.refreshToken,
        accessToken,
      },
    } as any);

    this.logger.log('[GmailOAuth2] Transporter created successfully');

    // Retry logic: up to 3 attempts
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const mailOptions = {
          from: resolvedFrom,
          to: resolvedTo,
          subject: resolvedSubject,
          text: resolvedBody,
          html: resolvedHtmlBody || resolvedBody,
        };

        this.logger.log(
          `[GmailOAuth2] Sending email (attempt ${attempt}/3) to ${resolvedTo}`,
        );
        const info = await transporter.sendMail(mailOptions);

        this.logger.log(
          `[GmailOAuth2] Email sent successfully: ${info.messageId} (attempt ${attempt})`,
        );
        this.logger.debug(
          `[GmailOAuth2] Response: accepted=${info.accepted?.length || 0}, rejected=${info.rejected?.length || 0}`,
        );

        return {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        };
      } catch (error: any) {
        lastError = error;
        this.logger.error(
          `[GmailOAuth2] Email send attempt ${attempt} failed: ${error.message}`,
        );

        // If it's an authentication error and we haven't refreshed, try refreshing
        if (
          attempt < 3 &&
          error.message?.includes('Invalid Credentials') &&
          !isTokenExpired
        ) {
          this.logger.log(
            '[GmailOAuth2] Authentication error detected, refreshing token...',
          );
          const refreshedToken =
            await this.googleOAuthService.refreshAccessToken(
              oauthAccount.refreshToken,
            );

          this.logger.log(
            `[GmailOAuth2] Token refreshed, expires in ${refreshedToken.expires_in}s`,
          );

          await this.prismaService.oAuthAccount.update({
            where: { id: oauthAccount.id },
            data: {
              accessToken: refreshedToken.access_token,
              expiresAt: new Date(
                Date.now() + refreshedToken.expires_in * 1000,
              ),
            },
          });

          accessToken = refreshedToken.access_token;

          // Recreate transporter with new token
          this.logger.log(
            '[GmailOAuth2] Recreating transporter with new token',
          );
          transporter.close();
          Object.assign(
            transporter,
            nodemailer.createTransport({
              service: 'gmail',
              auth: {
                type: 'OAuth2',
                user: userEmail,
                clientId,
                clientSecret,
                refreshToken: oauthAccount.refreshToken,
                accessToken,
              },
            } as any),
          );
        } else if (attempt < 3) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.log(`[GmailOAuth2] Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    this.logger.error(
      `[GmailOAuth2] Email send failed after 3 attempts: ${lastError?.message}`,
    );
    throw new Error(
      `Email send failed after 3 attempts: ${lastError?.message}`,
    );
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.to || !config.subject || (!config.body && !config.htmlBody)) {
      throw new Error(
        'Email action requires to, subject, and body or htmlBody',
      );
    }
    return true;
  }

  /**
   * Resolve template variables like {{step.1.output.data}} or {{trigger.email}}
   */
  private resolveTemplate(template: string, context: ExecutionContext): any {
    if (typeof template !== 'string') {
      return template;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const parts = path.trim().split('.');
      let value: any = context;

      for (const part of parts) {
        if (value === null || value === undefined) {
          return match;
        }
        value = value[part];
      }

      return value !== undefined && value !== null ? String(value) : match;
    });
  }
}
