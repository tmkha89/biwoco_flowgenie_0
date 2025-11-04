import { IsOptional, IsObject } from 'class-validator';

export class TriggerWorkflowDto {
  @IsOptional()
  @IsObject()
  triggerData?: Record<string, any>;
}
