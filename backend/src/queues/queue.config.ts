/**
 * Queue Configuration
 * Central configuration for BullMQ queues
 */
import { ConnectionOptions } from 'bullmq';

/**
 * Get Redis connection options from environment variables
 * BullMQ supports both URL strings and connection objects
 */
export function getRedisConnection(): ConnectionOptions | string {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  // BullMQ can use URL strings directly, which is simpler
  // But we'll also support connection objects for more control
  
  // If REDIS_URL is a full URL string, use it directly
  if (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://')) {
    return redisUrl;
  }
  
  // Fallback: parse individual components if URL is not provided
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
}

/**
 * Default queue options
 */
export const defaultQueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
};


/**
 * Get Redis connection options as a strict ConnectionOptions object.
 * This is required for Workers, which do not accept connection strings.
 */
export function getWorkerRedisConnection(): ConnectionOptions {
  // If REDIS_URL is a full URL string, you'd need a utility 
  // to parse it into host/port/password here if the worker
  // absolutely required an object.
  // However, based on your fallback logic, we can return the object structure:
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  };
}

/**
 * Default worker options (Connection MUST be an object)
 */
export const defaultWorkerOptions = {
  connection: getWorkerRedisConnection(), // This is guaranteed to be ConnectionOptions
};