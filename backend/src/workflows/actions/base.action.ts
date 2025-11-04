import {
  IActionHandler,
  ExecutionContext,
} from '../interfaces/workflow.interface';

/**
 * Base class for action handlers
 * Provides common functionality and utilities
 */
export abstract class BaseActionHandler implements IActionHandler {
  abstract readonly type: string;
  abstract readonly name: string;

  /**
   * Execute the action
   */
  abstract execute(
    context: ExecutionContext,
    config: Record<string, any>,
  ): Promise<any>;

  /**
   * Validate action configuration
   */
  validateConfig(_config: Record<string, any>): boolean {
    // Override in subclasses for specific validation
    return true;
  }

  /**
   * Get value from previous step result
   */
  protected getStepResult(context: ExecutionContext, actionId: number): any {
    return context.stepResults[actionId];
  }

  /**
   * Get trigger data
   */
  protected getTriggerData(context: ExecutionContext): Record<string, any> {
    return context.triggerData;
  }
}
