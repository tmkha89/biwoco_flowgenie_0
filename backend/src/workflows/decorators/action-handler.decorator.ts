import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for action handler registration
 */
export const ACTION_HANDLER_KEY = 'action_handler';

/**
 * Decorator to mark a class as an action handler
 * Usage: @ActionHandler('action_type')
 */
export const ActionHandler = (type: string) => SetMetadata(ACTION_HANDLER_KEY, type);

