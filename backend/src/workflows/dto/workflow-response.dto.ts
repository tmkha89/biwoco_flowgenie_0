import { Expose, Type } from 'class-transformer';
import { WorkflowStatus, ExecutionStepStatus } from '../interfaces/workflow.interface';

export class TriggerResponseDto {
  @Expose()
  id: number;

  @Expose()
  workflowId: number;

  @Expose()
  type: string;

  @Expose()
  config: Record<string, any>;

  @Expose()
  positionX?: number;

  @Expose()
  positionY?: number;
}

export class ActionResponseDto {
  @Expose()
  id: number;

  @Expose()
  workflowId: number;

  @Expose()
  type: string;

  @Expose()
  name: string;

  @Expose()
  config: Record<string, any>;

  @Expose()
  order: number;

  @Expose()
  positionX?: number;

  @Expose()
  positionY?: number;

  @Expose()
  nextActionId?: number;

  @Expose()
  parentActionId?: number;

  @Expose()
  retryConfig?: Record<string, any>;
}

export class WorkflowResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  name: string;

  @Expose()
  description?: string;

  @Expose()
  enabled: boolean;

  @Expose()
  @Type(() => TriggerResponseDto)
  trigger?: TriggerResponseDto;

  @Expose()
  @Type(() => ActionResponseDto)
  actions: ActionResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

export class ExecutionStepResponseDto {
  @Expose()
  id: number;

  @Expose()
  executionId: number;

  @Expose()
  actionId: number;

  @Expose()
  status: ExecutionStepStatus;

  @Expose()
  order: number;

  @Expose()
  input?: Record<string, any>;

  @Expose()
  output?: Record<string, any>;

  @Expose()
  error?: string;

  @Expose()
  retryCount: number;

  @Expose()
  startedAt?: Date;

  @Expose()
  completedAt?: Date;
}

export class WorkflowInfoDto {
  @Expose()
  id: number;

  @Expose()
  name: string;
}

export class ExecutionResponseDto {
  @Expose()
  id: number;

  @Expose()
  workflowId: number;

  @Expose()
  userId: number;

  @Expose()
  status: WorkflowStatus;

  @Expose()
  triggerData?: Record<string, any>;

  @Expose()
  result?: Record<string, any>;

  @Expose()
  error?: string;

  @Expose()
  startedAt?: Date;

  @Expose()
  completedAt?: Date;

  @Expose()
  @Type(() => ExecutionStepResponseDto)
  executionSteps: ExecutionStepResponseDto[];

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  // Workflow info (from included relation)
  @Expose()
  @Type(() => WorkflowInfoDto)
  workflow?: WorkflowInfoDto;
}

