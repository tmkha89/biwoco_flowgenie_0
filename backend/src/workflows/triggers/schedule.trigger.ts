import {
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
  Inject,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { ITriggerHandler, TriggerType } from '../interfaces/workflow.interface';
import { WorkflowEventService } from '../services/workflow-event.service';
import * as cron from 'node-cron';

/**
 * Schedule trigger handler
 * Uses BullMQ and node-cron for scheduling workflow executions
 * Supports CRON expressions and fixed intervals
 */
@Injectable()
export class ScheduleTriggerHandler
  implements ITriggerHandler, OnModuleDestroy
{
  private readonly logger = new Logger(ScheduleTriggerHandler.name);
  readonly type: TriggerType = TriggerType.SCHEDULE;
  readonly name = 'Schedule Trigger';

  private scheduledJobs: Map<number, cron.ScheduledTask> = new Map();
  private scheduleQueue: Queue | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEventService: WorkflowEventService,
    @Optional() @Inject('WORKFLOW_SCHEDULE_QUEUE') scheduleQueue?: Queue,
  ) {
    this.scheduleQueue = scheduleQueue || null;
  }

  async validate(config: Record<string, any>): Promise<boolean> {
    // Schedule trigger requires either:
    // - cron: CRON expression (e.g., '0 * * * *' for every hour)
    // - interval: Fixed interval in seconds (e.g., 3600 for hourly)
    if (!config.cron && !config.interval) {
      this.logger.warn(
        'Schedule trigger validation failed: cron or interval is required',
      );
      return false;
    }

    if (config.cron && typeof config.cron !== 'string') {
      this.logger.warn(
        'Schedule trigger validation failed: cron must be a string',
      );
      return false;
    }

    if (
      config.interval &&
      (typeof config.interval !== 'number' || config.interval <= 0)
    ) {
      this.logger.warn(
        'Schedule trigger validation failed: interval must be a positive number',
      );
      return false;
    }

    // Validate CRON expression if provided
    if (config.cron && !cron.validate(config.cron)) {
      this.logger.warn(
        `Schedule trigger validation failed: invalid CRON expression: ${config.cron}`,
      );
      return false;
    }

    return true;
  }

  async register(
    workflowId: number,
    config: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Registering schedule trigger for workflow ${workflowId}`);

    // Unregister existing job if any
    await this.unregister(workflowId);

    let scheduleTask: cron.ScheduledTask;

    if (config.cron) {
      // Schedule using CRON expression
      this.logger.log(
        `Scheduling workflow ${workflowId} with CRON: ${config.cron}`,
      );

      scheduleTask = cron.schedule(
        config.cron,
        async () => {
          this.logger.log(`CRON trigger fired for workflow ${workflowId}`);
          await this.triggerWorkflow(workflowId, { cron: config.cron });
        },
        {
          timezone: config.timezone || 'UTC',
        },
      );
    } else if (config.interval) {
      // Schedule using fixed interval (convert seconds to milliseconds)
      const intervalMs = config.interval * 1000;
      this.logger.log(
        `Scheduling workflow ${workflowId} with interval: ${config.interval}s`,
      );

      const runTask = async () => {
        this.logger.log(`Interval trigger fired for workflow ${workflowId}`);
        await this.triggerWorkflow(workflowId, { interval: config.interval });
      };

      // Run immediately if configured
      if (config.runImmediately !== false) {
        await runTask();
      }

      // Schedule recurring execution
      const intervalId = setInterval(runTask, intervalMs);

      // Wrap in a cron-like task object for consistency
      scheduleTask = {
        start: () => {
          // Already started
        },
        stop: () => {
          clearInterval(intervalId);
        },
        destroy: () => {
          clearInterval(intervalId);
        },
        getStatus: () => 'scheduled' as any,
      } as cron.ScheduledTask;
    } else {
      throw new Error('Either cron or interval must be provided');
    }

    // Store scheduled job
    this.scheduledJobs.set(workflowId, scheduleTask);

    // Also add to BullMQ queue for distributed scheduling (optional, for multi-instance deployments)
    if (config.useQueue !== false && this.scheduleQueue) {
      try {
        await this.scheduleQueue.add(
          `workflow-schedule-${workflowId}`,
          {
            workflowId,
            config,
          },
          {
            repeat: config.cron
              ? {
                  pattern: config.cron,
                  tz: config.timezone || 'UTC',
                }
              : {
                  every: config.interval * 1000, // Convert to milliseconds
                },
            jobId: `schedule-${workflowId}`,
          },
        );
        this.logger.log(
          `Added schedule to BullMQ queue for workflow ${workflowId}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `Failed to add schedule to BullMQ queue: ${error.message}`,
        );
      }
    }

    // Update trigger config with schedule metadata
    await this.prisma.trigger.update({
      where: { workflowId },
      data: {
        config: {
          ...config,
          scheduled: true,
          nextRun: this.getNextRunTime(config),
        },
      },
    });

    this.logger.log(
      `Schedule trigger registered successfully for workflow ${workflowId}`,
    );
  }

  async unregister(workflowId: number): Promise<void> {
    this.logger.log(
      `Unregistering schedule trigger for workflow ${workflowId}`,
    );

    // Stop cron job
    const job = this.scheduledJobs.get(workflowId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(workflowId);
      this.logger.log(`Cron job stopped for workflow ${workflowId}`);
    }

    // Remove from BullMQ queue
    if (this.scheduleQueue) {
      try {
        const jobId = `schedule-${workflowId}`;
        await this.scheduleQueue.removeRepeatableByKey(jobId);
        this.logger.log(`BullMQ schedule removed for workflow ${workflowId}`);
      } catch (error: any) {
        // Job might not exist in queue, ignore error
        this.logger.debug(
          `No BullMQ schedule found for workflow ${workflowId}`,
        );
      }
    }

    // Update trigger config
    await this.prisma.trigger.update({
      where: { workflowId },
      data: {
        config: {
          scheduled: false,
          nextRun: null,
        },
      },
    });

    this.logger.log(`Schedule trigger unregistered for workflow ${workflowId}`);
  }

  async onModuleDestroy() {
    // Stop all scheduled jobs on module destruction
    this.logger.log('Stopping all scheduled jobs');
    for (const [workflowId, job] of this.scheduledJobs.entries()) {
      job.stop();
      this.logger.log(`Stopped scheduled job for workflow ${workflowId}`);
    }
    this.scheduledJobs.clear();
  }

  /**
   * Trigger workflow execution
   */
  private async triggerWorkflow(
    workflowId: number,
    scheduleInfo: { cron?: string; interval?: number },
  ): Promise<void> {
    try {
      this.logger.log(`Triggering workflow ${workflowId} via schedule`);

      // Emit workflow trigger event
      this.workflowEventService.emitWorkflowTrigger(workflowId, {
        triggerType: TriggerType.SCHEDULE,
        schedule: scheduleInfo,
        timestamp: new Date().toISOString(),
      });

      // Update next run time
      const trigger = await this.prisma.trigger.findUnique({
        where: { workflowId },
      });

      if (trigger) {
        const config = trigger.config as any;
        await this.prisma.trigger.update({
          where: { workflowId },
          data: {
            config: {
              ...config,
              nextRun: this.getNextRunTime(config),
            },
          },
        });
      }
    } catch (error: any) {
      this.logger.error(
        `Error triggering scheduled workflow ${workflowId}:`,
        error.message,
      );
    }
  }

  /**
   * Calculate next run time based on schedule config
   */
  private getNextRunTime(config: Record<string, any>): string | null {
    try {
      if (config.cron) {
        // Calculate next run from CRON expression
        // For simplicity, return a placeholder - in production, use a library like 'cron-parser'
        return new Date(Date.now() + 3600000).toISOString(); // Approximate: 1 hour from now
      } else if (config.interval) {
        const nextRun = new Date(Date.now() + config.interval * 1000);
        return nextRun.toISOString();
      }
    } catch (error) {
      // Ignore calculation errors
    }
    return null;
  }
}
