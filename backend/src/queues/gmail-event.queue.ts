import { Queue } from 'bullmq';
import { getRedisConnectionObject } from './queue.config';

/**
 * Gmail Event Queue
 * Queue for processing Gmail push notifications
 */
export const gmailEventQueue = new Queue('gmail-event', {
  connection: getRedisConnectionObject(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
});

/**
 * Gmail Event Job Data
 */
export interface GmailEventJobData {
  workflowId: number;
  userId: number;
  messageId: string;
  threadId: string;
  labelIds: string[];
  snippet?: string;
  historyId: string;
  receivedAt: string;
  channelId?: string;
}
