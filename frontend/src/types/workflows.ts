/**
 * Workflow TypeScript interfaces matching backend DTOs
 * These types ensure type safety across frontend and backend
 */

export enum TriggerType {
  GOOGLE_MAIL = 'google-mail',
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
  SCHEDULE = 'schedule',
}

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

export interface RetryConfig {
  type: 'fixed' | 'exponential';
  delay: number;
}

export interface CreateAction {
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
  positionX?: number;
  positionY?: number;
  nextActionOrder?: number; // Order index of next action (for sequential flow)
  parentActionOrder?: number; // Order index of parent action (for parallel/loop children)
  retryConfig?: RetryConfig;
}

export interface CreateTrigger {
  type: TriggerType;
  config: Record<string, any>;
  positionX?: number;
  positionY?: number;
}

export interface CreateWorkflow {
  name: string;
  description?: string;
  enabled?: boolean;
  trigger: CreateTrigger;
  actions: CreateAction[];
}

export interface TriggerResponse {
  id: number;
  workflowId: number;
  type: string;
  config: Record<string, any>;
  positionX?: number;
  positionY?: number;
}

export interface ActionResponse {
  id: number;
  workflowId: number;
  type: string;
  name: string;
  config: Record<string, any>;
  order: number;
  positionX?: number;
  positionY?: number;
  nextActionId?: number;
  parentActionId?: number;
  retryConfig?: Record<string, any>;
}

export interface WorkflowResponse {
  id: number;
  userId: number;
  name: string;
  description?: string;
  enabled: boolean;
  trigger?: TriggerResponse;
  actions: ActionResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionStepResponse {
  id: number;
  executionId: number;
  actionId: number;
  status: ExecutionStepStatus;
  order: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
}

export interface ExecutionResponse {
  id: number;
  workflowId: number;
  userId: number;
  status: WorkflowStatus;
  triggerData?: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  executionSteps: ExecutionStepResponse[];
  createdAt: string;
  updatedAt: string;
  workflow?: {
    id: number;
    name: string;
  };
}

export interface TriggerWorkflowRequest {
  triggerData?: Record<string, any>;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: CreateTrigger;
  actions?: CreateAction[];
}

