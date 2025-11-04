import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

/**
 * Parallel Action Handler
 * Executes multiple sub-actions in parallel
 * Note: This action returns metadata about which actions to run in parallel,
 * the execution service will handle the parallel execution
 */
@Injectable()
export class ParallelActionHandler extends BaseActionHandler {
  readonly type = 'parallel';
  readonly name = 'Parallel';

  async execute(
    context: ExecutionContext,
    config: Record<string, any>,
  ): Promise<any> {
    const { actionIds, waitForAll = true, stopOnFirstFailure = false } = config;

    if (!actionIds || !Array.isArray(actionIds) || actionIds.length === 0) {
      throw new Error(
        'Parallel action requires a non-empty array of actionIds',
      );
    }

    // Return metadata for the execution service to handle parallel execution
    return {
      actionIds,
      waitForAll,
      stopOnFirstFailure,
      actionCount: actionIds.length,
    };
  }

  validateConfig(config: Record<string, any>): boolean {
    if (
      !config.actionIds ||
      !Array.isArray(config.actionIds) ||
      config.actionIds.length === 0
    ) {
      throw new Error(
        'Parallel action requires a non-empty array of actionIds',
      );
    }
    return true;
  }
}
