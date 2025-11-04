import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsEnum,
  IsObject,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TriggerType } from '../interfaces/workflow.interface';

export class RetryConfigDto {
  @IsEnum(['fixed', 'exponential'])
  type: 'fixed' | 'exponential';

  @IsNumber()
  delay: number;
}

export class CreateActionDto {
  @IsString()
  type: string;

  @IsString()
  name: string;

  @IsObject()
  config: Record<string, any>;

  @IsNumber()
  order: number;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsNumber()
  nextActionOrder?: number; // Order index of next action (for sequential flow)

  @IsOptional()
  @IsNumber()
  parentActionOrder?: number; // Order index of parent action (for parallel/loop children)

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryConfigDto)
  retryConfig?: RetryConfigDto;
}

export class CreateTriggerDto {
  @IsEnum(TriggerType)
  type: TriggerType;

  @IsObject()
  config: Record<string, any>;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ValidateNested()
  @Type(() => CreateTriggerDto)
  trigger: CreateTriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateActionDto)
  actions: CreateActionDto[];
}
