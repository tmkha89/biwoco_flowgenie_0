import { Injectable } from '@nestjs/common';
import { IActionHandler } from '../interfaces/workflow.interface';
import { ActionRegistry } from './action.registry';

/**
 * Action Factory
 * Uses strategy pattern to get the appropriate action handler
 */
@Injectable()
export class ActionFactory {
  constructor(private readonly actionRegistry: ActionRegistry) {}

  /**
   * Get action handler by type
   */
  getHandler(actionType: string): IActionHandler {
    const handler = this.actionRegistry.getHandler(actionType);
    if (!handler) {
      throw new Error(`No handler found for action type: ${actionType}`);
    }
    return handler;
  }

  /**
   * Check if an action type is supported
   */
  isSupported(actionType: string): boolean {
    return this.actionRegistry.getHandler(actionType) !== undefined;
  }

  /**
   * Get all supported action types
   */
  getSupportedTypes(): string[] {
    return this.actionRegistry.getRegisteredTypes();
  }
}

