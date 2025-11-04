/**
 * Core workflow interfaces
 */

export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ExecutionStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum TriggerType {
  GOOGLE_MAIL = 'google-mail',
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
  SCHEDULE = 'schedule',
}

export interface IWorkflow {
  id: number;
  userId: number;
  name: string;
  description?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITrigger {
  id: number;
  workflowId: number;
  type: TriggerType;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAction {
  id: number;
  workflowId: number;
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
  retryConfig?: RetryConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetryConfig {
  attempts: number;
  backoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
}

export interface IExecution {
  id: number;
  workflowId: number;
  userId: number;
  status: WorkflowStatus;
  triggerData?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IExecutionStep {
  id: number;
  executionId: number;
  actionId: number;
  status: ExecutionStepStatus;
  order: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow execution context passed between steps
 */
export interface ExecutionContext {
  executionId: number;
  workflowId: number;
  userId: number;
  triggerData: Record<string, any>;
  stepResults: Record<number, any>; // actionId -> result
  currentStepOrder: number;
  loopContext?: LoopContext; // Context for loop iterations
}

/**
 * Loop execution context
 */
export interface LoopContext {
  item: any;
  index: number;
  itemVariable: string;
  parentActionId: number;
}

/**
 * Action execution result with metadata
 */
export interface ActionResult {
  actionId: number;
  result: any;
  nextActionId?: number; // For conditional/sequential actions
  parallelActionIds?: number[]; // For parallel actions
  loopItems?: any[]; // For loop actions
  shouldContinue: boolean;
}

/**
 * Action handler interface - all action handlers must implement this
 */
export interface IActionHandler {
  /**
   * Unique identifier for this action type
   */
  readonly type: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Execute the action
   */
  execute(context: ExecutionContext, config: Record<string, any>): Promise<any>;
}

/**
 * Trigger handler interface - all trigger handlers must implement this
 */
export interface ITriggerHandler {
  /**
   * Unique identifier for this trigger type
   */
  readonly type: TriggerType;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Validate trigger configuration
   */
  validate(config: Record<string, any>): Promise<boolean>;

  /**
   * Register the trigger (e.g., set up webhook, subscribe to events)
   */
  register(workflowId: number, config: Record<string, any>): Promise<void>;

  /**
   * Unregister the trigger
   */
  unregister(workflowId: number): Promise<void>;
}

