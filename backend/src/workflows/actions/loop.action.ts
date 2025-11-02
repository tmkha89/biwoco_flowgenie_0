import { Injectable } from '@nestjs/common';
import { BaseActionHandler } from './base.action';
import { ExecutionContext } from '../interfaces/workflow.interface';

/**
 * Loop Action Handler
 * Iterates over a list and executes sub-actions for each item
 * Note: This action returns metadata about the loop items,
 * the execution service will handle iterating and executing sub-actions
 */
@Injectable()
export class LoopActionHandler extends BaseActionHandler {
  readonly type = 'loop';
  readonly name = 'Loop';

  async execute(context: ExecutionContext, config: Record<string, any>): Promise<any> {
    const { items, itemVariable = 'item', loopActionId, maxIterations = 1000 } = config;

    if (!items && !config.itemsPath) {
      throw new Error('Loop action requires items or itemsPath');
    }

    // Get items either directly or from a path in context
    let loopItems: any[] = [];
    if (items) {
      loopItems = Array.isArray(items) ? items : [items];
    } else if (config.itemsPath) {
      const resolvedPath = this.resolveTemplate(String(config.itemsPath), context);
      const itemsValue = this.getNestedValue(context, resolvedPath);
      loopItems = Array.isArray(itemsValue) ? itemsValue : [itemsValue];
    }

    // Validate max iterations
    if (loopItems.length > maxIterations) {
      throw new Error(`Loop has ${loopItems.length} items, exceeds maximum of ${maxIterations}`);
    }

    // Return metadata for the execution service to handle
    return {
      items: loopItems,
      itemVariable,
      loopActionId,
      itemCount: loopItems.length,
    };
  }

  validateConfig(config: Record<string, any>): boolean {
    if (!config.items && !config.itemsPath) {
      throw new Error('Loop action requires items or itemsPath');
    }
    return true;
  }

  /**
   * Get nested value from context using dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let value: any = obj;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

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

