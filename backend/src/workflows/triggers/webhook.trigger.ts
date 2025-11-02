import { Injectable } from '@nestjs/common';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';

/**
 * Webhook trigger handler
 * Registers webhook endpoints for workflows
 */
@Injectable()
export class WebhookTriggerHandler implements ITriggerHandler {
  readonly type: TriggerType = TriggerType.WEBHOOK;
  readonly name = 'Webhook Trigger';

  private registeredWebhooks: Map<number, { path: string; secret?: string }> = new Map();

  async validate(config: Record<string, any>): Promise<boolean> {
    // Webhook triggers should have a path
    if (!config.path || typeof config.path !== 'string') {
      return false;
    }
    return true;
  }

  async register(workflowId: number, config: Record<string, any>): Promise<void> {
    // In a real implementation, you would register the webhook route
    // This is a simplified version that just stores the webhook info
    this.registeredWebhooks.set(workflowId, {
      path: config.path,
      secret: config.secret,
    });

    // TODO: Register webhook route with the HTTP server
    // This could be done via a dynamic route registry
  }

  async unregister(workflowId: number): Promise<void> {
    // Remove webhook registration
    this.registeredWebhooks.delete(workflowId);

    // TODO: Unregister webhook route from the HTTP server
  }

  getWebhookPath(workflowId: number): string | undefined {
    const webhook = this.registeredWebhooks.get(workflowId);
    return webhook?.path;
  }

  validateWebhook(workflowId: number, secret?: string): boolean {
    const webhook = this.registeredWebhooks.get(workflowId);
    if (!webhook) {
      return false;
    }
    if (webhook.secret && webhook.secret !== secret) {
      return false;
    }
    return true;
  }
}

