import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

/**
 * Wait/Delay Action Handler
 * Waits for a specific duration or until a condition is met
 */
@Injectable()
export class WaitActionHandler extends BaseActionHandler {
  readonly type = 'wait';
  readonly name = 'Wait/Delay';

  async execute(
    context: ExecutionContext,
    config: Record<string, any>,
  ): Promise<any> {
    const { duration, condition, maxWaitTime = 60000 } = config;

    if (duration) {
      // Wait for a fixed duration
      const milliseconds = this.parseDuration(duration);
      if (milliseconds <= 0) {
        throw new Error('Wait duration must be positive');
      }
      if (milliseconds > 3600000) {
        throw new Error('Wait duration cannot exceed 1 hour');
      }

      await this.sleep(milliseconds);
      return {
        waited: milliseconds,
        type: 'duration',
      };
    } else if (condition) {
      // Wait until condition is met
      const startTime = Date.now();
      const maxWait = this.parseDuration(maxWaitTime) || 60000;

      while (Date.now() - startTime < maxWait) {
        if (this.evaluateCondition(condition, context)) {
          const waited = Date.now() - startTime;
          return {
            waited,
            type: 'condition',
            conditionMet: true,
          };
        }
        await this.sleep(1000); // Check every second
      }

      throw new Error(`Wait condition not met within ${maxWait}ms`);
    } else {
      throw new Error('Wait action requires either duration or condition');
    }
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.duration && !config.condition) {
      throw new Error('Wait action requires either duration or condition');
    }
    return true;
  }

  /**
   * Parse duration string (e.g., "5s", "10m", "2h") or number (milliseconds)
   */
  private parseDuration(duration: string | number): number {
    if (typeof duration === 'number') {
      return duration;
    }

    const match = duration.match(/^(\d+)(s|m|h|ms)$/);
    if (!match) {
      throw new Error(
        `Invalid duration format: ${duration}. Use format like "5s", "10m", "2h", or milliseconds`,
      );
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'ms':
        return value;
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }

  /**
   * Evaluate a condition expression
   * Supports: field == value, field != value, field > value, etc.
   */
  private evaluateCondition(
    condition: string,
    context: ExecutionContext,
  ): boolean {
    // Simple condition evaluation
    // Format: "{{step.1.output.status}} == 'success'"
    const resolvedCondition = this.resolveTemplate(condition, context);

    // Basic comparison operators
    if (resolvedCondition.includes('==')) {
      const [left, right] = resolvedCondition.split('==').map((s) => s.trim());
      return this.compareValues(left, right, '==');
    } else if (resolvedCondition.includes('!=')) {
      const [left, right] = resolvedCondition.split('!=').map((s) => s.trim());
      return this.compareValues(left, right, '!=');
    } else if (resolvedCondition.includes('>')) {
      const [left, right] = resolvedCondition.split('>').map((s) => s.trim());
      return this.compareValues(left, right, '>');
    } else if (resolvedCondition.includes('<')) {
      const [left, right] = resolvedCondition.split('<').map((s) => s.trim());
      return this.compareValues(left, right, '<');
    }

    // If no operator, evaluate as boolean
    return Boolean(resolvedCondition);
  }

  /**
   * Compare two values
   */
  private compareValues(
    left: string,
    right: string,
    operator: string,
  ): boolean {
    // Remove quotes
    const leftVal = this.parseValue(left);
    const rightVal = this.parseValue(right);

    switch (operator) {
      case '==':
        return leftVal === rightVal;
      case '!=':
        return leftVal !== rightVal;
      case '>':
        return Number(leftVal) > Number(rightVal);
      case '<':
        return Number(leftVal) < Number(rightVal);
      default:
        return false;
    }
  }

  /**
   * Parse a value (remove quotes, convert to appropriate type)
   */
  private parseValue(value: string): any {
    value = value.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }

  /**
   * Resolve template variables
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
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
