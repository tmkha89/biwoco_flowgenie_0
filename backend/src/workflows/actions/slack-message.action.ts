import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';
import { SlackService } from '../../slack/slack.service';

/**
 * Slack Message Action Handler
 * Sends messages to Slack channels or users
 */
@Injectable()
export class SlackMessageActionHandler extends BaseActionHandler {
  readonly type = 'slack_message';
  readonly name = 'Send Slack Message';

  constructor(private readonly slackService: SlackService) {
    super();
  }

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const { channelId, text } = config;

    if (!channelId || !text) {
      throw new Error('Slack message action requires channelId and text');
    }

    // Resolve template variables
    const resolvedChannelId = this.resolveTemplate(channelId, context);
    const resolvedText = this.resolveTemplate(text, context);

    try {
      const result = await this.slackService.sendMessage(
        context.userId,
        resolvedChannelId,
        resolvedText,
      );

      return result;
    } catch (error: any) {
      throw new Error(`Slack message failed: ${error.message}`);
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.channelId || !config.text) {
      throw new Error('Slack message action requires channelId and text');
    }
    return true;
  }

  /**
   * Resolve template variables like {{step.1.output.data}} or {{trigger.message}}
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

