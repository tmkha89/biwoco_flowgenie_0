import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

/**
 * Example action handler
 * This is a simple action that logs and returns data
 */
@Injectable()
export class ExampleActionHandler extends BaseActionHandler {
  readonly type = 'example_action';
  readonly name = 'Example Action';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    // Example: log the execution
    console.log(`Executing ${this.name} for workflow ${context.workflowId}`);

    // Example: use configuration
    const message = config.message || 'Hello from example action';

    // Example: access trigger data
    const triggerData = this.getTriggerData(context);

    // Return result that will be available to subsequent steps
    return {
      message,
      triggerData,
      timestamp: new Date().toISOString(),
    };
  }

  validateConfig(config: Record<string, any>): boolean {
    // Validate that config has required fields
    // This example doesn't require any specific fields
    return true;
  }
}

