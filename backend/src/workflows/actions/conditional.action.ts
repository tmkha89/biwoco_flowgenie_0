import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

/**
 * Conditional Action Handler
 * Evaluates a condition and branches execution
 * Note: This action returns metadata about which branch to take,
 * the execution service will handle the branching logic
 */
@Injectable()
export class ConditionalActionHandler extends BaseActionHandler {
  readonly type = 'conditional';
  readonly name = 'Conditional';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const { condition, trueActionId, falseActionId } = config;

    if (!condition) {
      throw new Error('Conditional action requires a condition');
    }

    const result = this.evaluateCondition(condition, context);
    const nextActionId = result ? trueActionId : falseActionId;

    return {
      conditionResult: result,
      nextActionId,
      evaluatedCondition: condition,
    };
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.condition) {
      throw new Error('Conditional action requires a condition');
    }
    return true;
  }

  /**
   * Evaluate a condition expression
   * Supports: {{field}} == value, {{field}} != value, {{field}} > value, etc.
   */
  private evaluateCondition(condition: string | Record<string, any>, context: ExecutionContext): boolean {
    // If condition is a string, parse it
    if (typeof condition === 'string') {
      return this.evaluateStringCondition(condition, context);
    }

    // If condition is an object, handle different operators
    if (typeof condition === 'object') {
      return this.evaluateObjectCondition(condition, context);
    }

    throw new Error('Invalid condition format');
  }

  /**
   * Evaluate string-based condition
   * Format: "{{step.1.output.status}} == 'success'"
   */
  private evaluateStringCondition(condition: string, context: ExecutionContext): boolean {
    const resolvedCondition = this.resolveTemplate(condition, context);

    // Check for comparison operators
    if (resolvedCondition.includes('==')) {
      const [left, right] = resolvedCondition.split('==').map((s) => s.trim());
      return this.compareValues(left, right, '==');
    } else if (resolvedCondition.includes('!=')) {
      const [left, right] = resolvedCondition.split('!=').map((s) => s.trim());
      return this.compareValues(left, right, '!=');
    } else if (resolvedCondition.includes('>=')) {
      const [left, right] = resolvedCondition.split('>=').map((s) => s.trim());
      return this.compareValues(left, right, '>=');
    } else if (resolvedCondition.includes('<=')) {
      const [left, right] = resolvedCondition.split('<=').map((s) => s.trim());
      return this.compareValues(left, right, '<=');
    } else if (resolvedCondition.includes('>')) {
      const [left, right] = resolvedCondition.split('>').map((s) => s.trim());
      return this.compareValues(left, right, '>');
    } else if (resolvedCondition.includes('<')) {
      const [left, right] = resolvedCondition.split('<').map((s) => s.trim());
      return this.compareValues(left, right, '<');
    } else if (resolvedCondition.includes('&&')) {
      // AND logic
      const parts = resolvedCondition.split('&&').map((s) => s.trim());
      return parts.every((part) => this.evaluateStringCondition(part, context));
    } else if (resolvedCondition.includes('||')) {
      // OR logic
      const parts = resolvedCondition.split('||').map((s) => s.trim());
      return parts.some((part) => this.evaluateStringCondition(part, context));
    }

    // If no operator, evaluate as boolean
    return Boolean(this.parseValue(resolvedCondition));
  }

  /**
   * Evaluate object-based condition
   * Format: { field: "{{step.1.output.status}}", operator: "==", value: "success" }
   */
  private evaluateObjectCondition(condition: Record<string, any>, context: ExecutionContext): boolean {
    const { field, operator = '==', value } = condition;

    if (!field) {
      throw new Error('Condition object must have a field property');
    }

    const resolvedField = this.resolveTemplate(String(field), context);
    const resolvedValue = value !== undefined ? this.resolveTemplate(String(value), context) : undefined;

    return this.compareValues(String(resolvedField), String(resolvedValue || ''), operator);
  }

  /**
   * Compare two values
   */
  private compareValues(left: string, right: string, operator: string): boolean {
    const leftVal = this.parseValue(left);
    const rightVal = this.parseValue(right);

    switch (operator) {
      case '==':
      case '===':
        return leftVal === rightVal;
      case '!=':
      case '!==':
        return leftVal !== rightVal;
      case '>':
        return Number(leftVal) > Number(rightVal);
      case '<':
        return Number(leftVal) < Number(rightVal);
      case '>=':
        return Number(leftVal) >= Number(rightVal);
      case '<=':
        return Number(leftVal) <= Number(rightVal);
      case 'contains':
        return String(leftVal).includes(String(rightVal));
      case 'notContains':
        return !String(leftVal).includes(String(rightVal));
      default:
        throw new Error(`Unknown comparison operator: ${operator}`);
    }
  }

  /**
   * Parse a value (remove quotes, convert to appropriate type)
   */
  private parseValue(value: string): any {
    if (!value) return value;
    value = String(value).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
}

