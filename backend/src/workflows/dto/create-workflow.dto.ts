import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsEnum, IsObject, IsNumber } from 'class-validator';
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
  @ValidateNested()
  @Type(() => RetryConfigDto)
  retryConfig?: RetryConfigDto;
}

export class CreateTriggerDto {
  @IsEnum(TriggerType)
  type: TriggerType;

  @IsObject()
  config: Record<string, any>;
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

