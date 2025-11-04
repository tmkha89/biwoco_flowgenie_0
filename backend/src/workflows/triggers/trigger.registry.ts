import { Injectable } from '@nestjs/common';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';

/**
 * Registry for trigger handlers
 * Allows registering and retrieving trigger handlers by type
 */
@Injectable()
export class TriggerRegistry {
  private handlers: Map<TriggerType, ITriggerHandler> = new Map();

  /**
   * Register a trigger handler
   */
  registerHandler(handler: ITriggerHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Get a trigger handler by type
   */
  getHandler(type: TriggerType): ITriggerHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Register a workflow trigger (set up webhook, subscribe to events, etc.)
   */
  async register(
    workflowId: number,
    type: TriggerType,
    config: Record<string, any>,
  ): Promise<void> {
    const handler = this.getHandler(type);

    if (!handler) {
      throw new Error(`Trigger type "${type}" is not registered`);
    }

    await handler.register(workflowId, config);
  }

  /**
   * Unregister a workflow trigger
   */
  async unregister(workflowId: number): Promise<void> {
    // Iterate through all handlers and unregister
    // This is a simplified approach - in production, you might want to track
    // which handler is registered for which workflow
    for (const handler of this.handlers.values()) {
      try {
        await handler.unregister(workflowId);
      } catch (error) {
        // Continue trying other handlers
      }
    }
  }
}
