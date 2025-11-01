/**
 * Example Queue Definition
 * This is a template for creating new queues
 */
import { Queue } from 'bullmq';
import { defaultQueueOptions, defaultWorkerOptions } from './queue.config';

export interface ExampleJobData {
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Example queue for demonstration
 * Replace with your actual queue definitions
 */
export const exampleQueue = new Queue<ExampleJobData>('example', {
  ...defaultWorkerOptions,
});

/**
 * Helper function to add jobs to the example queue
 */
export async function addExampleJob(data: ExampleJobData) {
  return await exampleQueue.add('process-example', data);
}

