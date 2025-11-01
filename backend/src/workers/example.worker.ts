/**
 * Example Worker Processor
 * This is a template for creating new worker processors
 */
import { Worker, Job } from 'bullmq';
import { ExampleJobData, exampleQueue } from '../queues/example.queue';
import { defaultQueueOptions, defaultWorkerOptions } from '../queues/queue.config';

/**
 * Example worker processor
 * Processes jobs from the example queue
 */
export const exampleWorker = new Worker<ExampleJobData>(
  'example',
  async (job: Job<ExampleJobData>) => {
    console.log(`[Worker] Processing example job ${job.id}:`, job.data);

    try {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Process the job data
      const { message, userId, metadata } = job.data;
      
      console.log(`[Worker] Job ${job.id} completed successfully`);
      console.log(`[Worker] Message: ${message}`);
      if (userId) {
        console.log(`[Worker] User ID: ${userId}`);
      }

      // Return result (optional)
      return {
        success: true,
        processedAt: new Date().toISOString(),
        message,
      };
    } catch (error) {
      console.error(`[Worker] Job ${job.id} failed:`, error);
      throw error; // Re-throw to mark job as failed
    }
  },
  {
    ...defaultWorkerOptions,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

// Worker event handlers
exampleWorker.on('completed', (job) => {
  console.log(`[Worker] ✅ Job ${job.id} completed`);
});

exampleWorker.on('failed', (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} failed:`, err.message);
});

exampleWorker.on('error', (err) => {
  console.error(`[Worker] ⚠️ Worker error:`, err);
});

