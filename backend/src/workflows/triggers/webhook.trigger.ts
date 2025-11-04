import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';
import { WorkflowEventService } from '../services/workflow-event.service';

/**
 * Webhook trigger handler
 * Registers webhook endpoints for workflows
 * Exposes public endpoints like /api/triggers/webhook/:id
 */
@Injectable()
export class WebhookTriggerHandler implements ITriggerHandler {
  private readonly logger = new Logger(WebhookTriggerHandler.name);
  readonly type: TriggerType = TriggerType.WEBHOOK;
  readonly name = 'Webhook Trigger';

  private registeredWebhooks: Map<number, { path: string; secret?: string }> =
    new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEventService: WorkflowEventService,
  ) {}

  async validate(config: Record<string, any>): Promise<boolean> {
    // Webhook triggers should have a path
    if (!config.path || typeof config.path !== 'string') {
      return false;
    }
    return true;
  }

  async register(
    workflowId: number,
    config: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Registering webhook trigger for workflow ${workflowId}`);

    // Generate a unique webhook ID if not provided
    const webhookId = config.webhookId || `webhook-${workflowId}-${Date.now()}`;

    // Store webhook info
    this.registeredWebhooks.set(workflowId, {
      path: config.path || webhookId,
      secret: config.secret,
    });

    // Update trigger config with webhook ID and URL
    await this.prisma.trigger.update({
      where: { workflowId },
      data: {
        config: {
          ...config,
          webhookId,
          webhookUrl: config.webhookUrl || `/api/triggers/webhook/${webhookId}`,
        },
      },
    });

    this.logger.log(
      `Webhook trigger registered for workflow ${workflowId}, webhookId: ${webhookId}`,
    );
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

  /**
   * Handle webhook request and trigger workflow
   */
  async handleWebhookRequest(
    webhookId: string,
    payload: any,
    headers?: Record<string, string>,
  ): Promise<void> {
    this.logger.log(`Handling webhook request for webhookId: ${webhookId}`);

    // Find workflow by webhookId
    const triggers = await this.prisma.trigger.findMany({
      where: {
        type: TriggerType.WEBHOOK,
      },
      include: { workflow: true },
    });

    let workflowId: number | null = null;
    let secret: string | undefined;

    for (const trigger of triggers) {
      const config = trigger.config as any;
      if (config.webhookId === webhookId) {
        workflowId = trigger.workflowId;
        secret = config.secret;

        // Update memory cache
        this.registeredWebhooks.set(workflowId, {
          path: config.path || webhookId,
          secret: config.secret,
        });
        break;
      }
    }

    if (!workflowId) {
      this.logger.warn(`No workflow found for webhookId: ${webhookId}`);
      throw new Error(`Webhook ${webhookId} not found`);
    }

    // Validate secret if required
    if (secret) {
      const providedSecret =
        headers?.['x-webhook-secret'] ||
        headers?.['x-secret'] ||
        payload?.secret;
      if (providedSecret !== secret) {
        this.logger.warn(`Invalid secret for webhook ${webhookId}`);
        throw new Error('Invalid webhook secret');
      }
    }

    // Emit workflow trigger event
    this.logger.log(
      `Triggering workflow ${workflowId} via webhook ${webhookId}`,
    );
    this.workflowEventService.emitWorkflowTrigger(workflowId, {
      triggerType: TriggerType.WEBHOOK,
      webhookId,
      payload,
      headers: headers || {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get webhook URL for a workflow
   */
  async getWebhookUrl(workflowId: number): Promise<string | undefined> {
    const webhook = this.registeredWebhooks.get(workflowId);
    if (!webhook) {
      return undefined;
    }

    // Try to get from database config
    try {
      const trigger = await this.prisma.trigger.findUnique({
        where: { workflowId },
      });

      if (trigger) {
        const config = trigger.config as any;
        return (
          config.webhookUrl ||
          `/api/triggers/webhook/${config.webhookId || webhook.path}`
        );
      }

      return `/api/triggers/webhook/${webhook.path}`;
    } catch (error) {
      return `/api/triggers/webhook/${webhook.path}`;
    }
  }
}
