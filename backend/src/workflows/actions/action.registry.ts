import { Injectable } from '@nestjs/common';
import { IActionHandler } from '../interfaces/workflow.interface';

/**
 * Registry for action handlers
 * Allows registering and retrieving action handlers by type
 */
@Injectable()
export class ActionRegistry {
  private handlers: Map<string, IActionHandler> = new Map();

  /**
   * Register an action handler
   */
  registerHandler(handler: IActionHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Get an action handler by type
   */
  getHandler(type: string): IActionHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Get all registered action types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}
