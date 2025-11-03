import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';
import { PrismaService } from '../../database/prisma.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import * as nodemailer from 'nodemailer';

/**
 * Email Action Handler
 * Sends emails using Gmail via OAuth2
 */
@Injectable()
export class EmailActionHandler extends BaseActionHandler {
  readonly type = 'email';
  readonly name = 'Send Google Email';

  private readonly logger = new Logger(EmailActionHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const { to, subject, body, htmlBody } = config;

    console.log(`📧 [EmailActionHandler] === SEND GOOGLE EMAIL START ===`);
    console.log(`📧 [EmailActionHandler] User: ${context.userId}, Email: ${to}, Execution: ${context.executionId}, Workflow: ${context.workflowId}`);
    this.logger.log(`Starting email send for user ${context.userId}, to: ${to}`);
    this.logger.debug(`Config: ${JSON.stringify({ to, subject, hasBody: !!body, hasHtmlBody: !!htmlBody })}`);

    // Validate required fields
    if (!to || !subject || (!body && !htmlBody)) {
      console.error(`❌ [EmailActionHandler] Missing required fields: to=${!!to}, subject=${!!subject}, body=${!!body || !!htmlBody}`);
      throw new Error('Email action requires to, subject, and body or htmlBody');
    }

    // Get Google OAuth account for the user
    console.log(`🔐 [EmailActionHandler] Fetching Google OAuth account for user ${context.userId}`);
    this.logger.log(`Fetching OAuth account for user ${context.userId}`);
    const oauthAccount = await this.prismaService.oAuthAccount.findFirst({
      where: {
        userId: context.userId,
        provider: 'google',
      },
      include: {
        user: true,
      },
    });

    if (!oauthAccount || !oauthAccount.accessToken || !oauthAccount.refreshToken) {
      console.error(`❌ [EmailActionHandler] No Google OAuth account found for user ${context.userId}`);
      this.logger.error(`No OAuth account found for user ${context.userId}`);
      throw new Error('No Google OAuth account found for user. Please connect your Google account.');
    }

    const userEmail = oauthAccount.user.email;
    console.log(`✅ [EmailActionHandler] OAuth account found - Provider User: ${oauthAccount.providerUserId}, Email: ${userEmail}`);
    this.logger.log(`OAuth account found for provider user ${oauthAccount.providerUserId}`);
    this.logger.log(`User email: ${userEmail}`);
    this.logger.debug(`Token expires at: ${oauthAccount.expiresAt}`);

    // Get OAuth2 credentials
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const accessUrl = this.configService.get<string>('GOOGLE_ACCESS_URL');

    if (!clientId || !clientSecret) {
      this.logger.error('Google OAuth credentials not configured');
      throw new Error('Google OAuth credentials not configured');
    }

    this.logger.debug(`OAuth credentials configured, clientId: ${clientId ? '✓' : '✗'}, clientSecret: ${clientSecret ? '✓' : '✗'}`);

    // Check if token is expired
    let accessToken = oauthAccount.accessToken;
    const isTokenExpired = oauthAccount.expiresAt && oauthAccount.expiresAt < new Date();

    if (isTokenExpired || !oauthAccount.expiresAt) {
      console.log(`🔄 [EmailActionHandler] Access token expired, refreshing...`);
      this.logger.log('Access token expired, refreshing...');
      const refreshedToken = await this.googleOAuthService.refreshAccessToken(
        oauthAccount.refreshToken,
      );

      console.log(`✅ [EmailActionHandler] Token refreshed successfully, expires in ${refreshedToken.expires_in}s`);
      this.logger.log(`Token refreshed, expires in ${refreshedToken.expires_in}s`);

      // Update the stored token
      await this.prismaService.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          accessToken: refreshedToken.access_token,
          expiresAt: new Date(Date.now() + refreshedToken.expires_in * 1000),
        },
      });

      accessToken = refreshedToken.access_token;
      this.logger.log('Access token refreshed successfully');
    } else {
      console.log(`✅ [EmailActionHandler] Access token is valid, no refresh needed`);
      this.logger.log('Access token is valid, no refresh needed');
    }

    console.log(`✅ [EmailActionHandler] Proceeding to send email with current OAuth credentials`);
    this.logger.log('Proceeding to send email with current OAuth credentials');

    // Resolve template variables
    const resolvedTo = this.resolveTemplate(to, context);
    const resolvedFrom = userEmail;
    const resolvedSubject = this.resolveTemplate(subject, context);
    const resolvedBody = body ? this.resolveTemplate(body, context) : undefined;
    const resolvedHtmlBody = htmlBody ? this.resolveTemplate(htmlBody, context) : undefined;

    console.log(`📝 [EmailActionHandler] Email config - From: ${resolvedFrom}, To: ${resolvedTo}, Subject: ${resolvedSubject}`);
    this.logger.debug(`Resolved email config: from="${resolvedFrom}", to="${resolvedTo}", subject="${resolvedSubject}"`);

    // Create Gmail transporter with OAuth2
    console.log(`📧 [EmailActionHandler] Creating Gmail transporter with OAuth2`);
    this.logger.log('Creating Gmail transporter with OAuth2');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      secure: false,
      port: 587,
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId,
        clientSecret,
        refreshToken: oauthAccount.refreshToken,
        accessToken,
        accessUrl
      },
    } as any);

    console.log(`✅ [EmailActionHandler] Transporter created successfully`);
    this.logger.log('Transporter created successfully');

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

        console.log(`📤 [EmailActionHandler] Sending email (attempt ${attempt}/3) - From: ${resolvedFrom} → To: ${resolvedTo}`);
        this.logger.log(`Sending email (attempt ${attempt}/3) to ${resolvedTo}`);
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ [EmailActionHandler] Email sent successfully! Message ID: ${info.messageId}`);
        this.logger.log(`Email sent successfully: ${info.messageId} (attempt ${attempt})`);
        this.logger.debug(`Response: accepted=${info.accepted?.length || 0}, rejected=${info.rejected?.length || 0}`);

        console.log(`📧 [EmailActionHandler] === SEND GOOGLE EMAIL SUCCESS ===`);
        return {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
        };
      } catch (error: any) {
        lastError = error;
        console.error(`❌ [EmailActionHandler] Email send attempt ${attempt}/3 failed: ${error.message}`);
        this.logger.error(`Email send attempt ${attempt} failed: ${error.message}`);

        // If it's an authentication error and we haven't refreshed, try refreshing
        if (
          attempt < 3 &&
          error.message?.includes('Invalid Credentials') &&
          !isTokenExpired
        ) {
          this.logger.log('Authentication error detected, refreshing token...');
          const refreshedToken = await this.googleOAuthService.refreshAccessToken(
            oauthAccount.refreshToken,
          );

          this.logger.log(`Token refreshed, expires in ${refreshedToken.expires_in}s`);

          await this.prismaService.oAuthAccount.update({
            where: { id: oauthAccount.id },
            data: {
              accessToken: refreshedToken.access_token,
              expiresAt: new Date(Date.now() + refreshedToken.expires_in * 1000),
            },
          });

          accessToken = refreshedToken.access_token;

          // Recreate transporter with new token
          this.logger.log('Recreating transporter with new token');
          transporter.close();
          Object.assign(
            transporter,
            nodemailer.createTransport({
              service: 'gmail',
              host: 'smtp.gmail.com',
              secure: false,
              port: 587,
              auth: {
                type: 'OAuth2',
                user: userEmail,
                clientId,
                clientSecret,
                refreshToken: oauthAccount.refreshToken,
                accessToken,
                accessUrl
              },
            } as any),
          );
        } else if (attempt < 3) {
          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.log(`Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error(`❌ [EmailActionHandler] === SEND GOOGLE EMAIL FAILED ===`);
    console.error(`❌ [EmailActionHandler] Failed after 3 attempts: ${lastError?.message}`);
    this.logger.error(`Email send failed after 3 attempts: ${lastError?.message}`);
    throw new Error(`Email send failed after 3 attempts: ${lastError?.message}`);
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.to || !config.subject || (!config.body && !config.htmlBody)) {
      throw new Error('Email action requires to, subject, and body or htmlBody');
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

