import { Worker, Job } from 'bullmq';
import { defaultWorkerOptions } from '../queues/queue.config';
import { ExecutionService } from '../workflows/execution.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

/**
 * Workflow execution worker
 * Processes workflow execution jobs from the queue
 */
export class WorkflowWorker {
  private worker: Worker;
  private executionService: ExecutionService;
  private appContext: any;

  constructor() {
    this.worker = new Worker(
      'workflow-execution',
      async (job: Job) => {
        return this.processJob(job);
      },
      {
        ...defaultWorkerOptions,
        concurrency: 5, // Process up to 5 workflows concurrently
      },
    );

    this.setupEventHandlers();
  }

  /**
   * Setup worker event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job) => {
      console.log(
        `[WorkflowWorker] Job ${job.id} completed for execution ${job.data.executionId}`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(
          `[WorkflowWorker] Job ${job.id} failed for execution ${job.data.executionId}:`,
          error.message,
        );
      } else {
        console.error('[WorkflowWorker] Job failed:', error.message);
      }
    });

    this.worker.on('error', (error: Error) => {
      console.error('[WorkflowWorker] Worker error:', error);
    });
  }

  /**
   * Process a workflow execution job
   */
  private async processJob(job: Job): Promise<void> {
    const { executionId } = job.data;

    if (!this.executionService) {
      // Initialize execution service from NestJS context
      if (!this.appContext) {
        this.appContext = await NestFactory.createApplicationContext(AppModule);
      }
      this.executionService = this.appContext.get(ExecutionService);
    }

    try {
      await this.executionService.execute(executionId);
    } catch (error) {
      console.error(
        `[WorkflowWorker] Error executing workflow ${executionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get worker name
   */
  get name(): string {
    return 'workflow-execution-worker';
  }

  /**
   * Close the worker
   */
  async close(): Promise<void> {
    await this.worker.close();
    if (this.appContext) {
      await this.appContext.close();
    }
  }
}

// Export singleton instance
export const workflowWorker = new WorkflowWorker();
