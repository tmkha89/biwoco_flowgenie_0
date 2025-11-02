import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';
import * as nodemailer from 'nodemailer';

/**
 * Email Action Handler
 * Sends emails using SMTP, Gmail, or SendGrid
 */
@Injectable()
export class EmailActionHandler extends BaseActionHandler {
  readonly type = 'email';
  readonly name = 'Send Email';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const {
      provider = 'smtp', // 'smtp', 'gmail', 'sendgrid'
      to,
      from,
      subject,
      body,
      htmlBody,
      smtpConfig,
      sendgridApiKey,
      gmailCredentials,
    } = config;

    if (!to || !subject || (!body && !htmlBody)) {
      throw new Error('Email action requires to, subject, and body or htmlBody');
    }

    // Resolve template variables
    const resolvedTo = this.resolveTemplate(to, context);
    const resolvedFrom = this.resolveTemplate(from || 'noreply@flowgenie.com', context);
    const resolvedSubject = this.resolveTemplate(subject, context);
    const resolvedBody = body ? this.resolveTemplate(body, context) : undefined;
    const resolvedHtmlBody = htmlBody ? this.resolveTemplate(htmlBody, context) : undefined;

    let transporter: nodemailer.Transporter;

    try {
      if (provider === 'sendgrid' && sendgridApiKey) {
        // Use SendGrid
        transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: this.resolveTemplate(sendgridApiKey, context),
          },
        });
      } else if (provider === 'gmail' && gmailCredentials) {
        // Use Gmail OAuth2
        const credentials = this.resolveTemplateObject(gmailCredentials, context);
        transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: credentials.user,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            refreshToken: credentials.refreshToken,
          },
        });
      } else {
        // Use SMTP
        const smtp = smtpConfig ? this.resolveTemplateObject(smtpConfig, context) : {};
        transporter = nodemailer.createTransport({
          host: smtp.host || 'smtp.gmail.com',
          port: smtp.port || 587,
          secure: smtp.secure !== false, // true for 465, false for other ports
          auth: smtp.auth
            ? {
                user: this.resolveTemplate(smtp.auth.user, context),
                pass: this.resolveTemplate(smtp.auth.pass, context),
              }
            : undefined,
        });
      }

      const mailOptions = {
        from: resolvedFrom,
        to: resolvedTo,
        subject: resolvedSubject,
        text: resolvedBody,
        html: resolvedHtmlBody || resolvedBody,
      };

      const info = await transporter.sendMail(mailOptions);

      return {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        response: info.response,
      };
    } catch (error: any) {
      throw new Error(`Email send failed: ${error.message}`);
    }
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

  /**
   * Resolve template variables in an object
   */
  private resolveTemplateObject(obj: Record<string, any>, context: ExecutionContext): Record<string, any> {
    const resolved: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = typeof value === 'string' ? this.resolveTemplate(value, context) : value;
    }
    return resolved;
  }
}

