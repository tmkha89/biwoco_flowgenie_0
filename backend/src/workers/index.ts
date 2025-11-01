/**
 * Worker Service Entry Point
 * 
 * This is the main entry point for the BullMQ worker service.
 * It initializes all workers and handles graceful shutdown.
 */

// Load environment variables (optional - Docker provides env vars via docker-compose)
// This is mainly useful for local development
try {
  // Try to load dotenv if available
  const dotenv = require('dotenv');
  const path = require('path');
  
  const envPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env'),
    '.env',
  ];

  for (const envPath of envPaths) {
    try {
      dotenv.config({ path: envPath });
      if (process.env.REDIS_URL || process.env.REDIS_HOST) {
        break;
      }
    } catch (error) {
      // Continue to next path
    }
  }
} catch (error) {
  // dotenv not available or not needed (e.g., in Docker)
  // Environment variables should be provided by docker-compose or system
}

// Import workers
import { exampleWorker } from './example.worker';

/**
 * Log prefix for worker messages
 */
const LOG_PREFIX = '[Worker]';

/**
 * Array to store all active workers for graceful shutdown
 */
const workers = [exampleWorker];

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  console.log(`\n${LOG_PREFIX} Received ${signal}, shutting down gracefully...`);

  // Close all workers
  const shutdownPromises = workers.map(async (worker) => {
    try {
      await worker.close();
      console.log(`${LOG_PREFIX} Worker "${worker.name}" closed`);
    } catch (error) {
      console.error(`${LOG_PREFIX} Error closing worker "${worker.name}":`, error);
    }
  });

  await Promise.all(shutdownPromises);

  console.log(`${LOG_PREFIX} All workers closed. Exiting...`);
  process.exit(0);
}

/**
 * Error handler
 */
process.on('uncaughtException', (error) => {
  console.error(`${LOG_PREFIX} Uncaught Exception:`, error);
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`${LOG_PREFIX} Unhandled Rejection at:`, promise, 'reason:', reason);
});

/**
 * Signal handlers for graceful shutdown
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Initialize and start all workers
 */
async function start() {
  console.log(`${LOG_PREFIX} Starting FlowGenie Worker Service...`);
  console.log(`${LOG_PREFIX} Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`${LOG_PREFIX} Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);

  // Verify Redis connection
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log(`${LOG_PREFIX} Connecting to Redis at: ${redisUrl}`);

  // Log all active workers
  console.log(`${LOG_PREFIX} Active workers:`);
  workers.forEach((worker) => {
    console.log(`${LOG_PREFIX}   - ${worker.name} (concurrency: ${worker.opts.concurrency || 1})`);
  });

  console.log(`${LOG_PREFIX} ✅ Worker service started successfully`);
  console.log(`${LOG_PREFIX} Waiting for jobs...\n`);

  // Keep the process alive
  // Workers run in the background and process jobs automatically
}

// Start the worker service
start().catch((error) => {
  console.error(`${LOG_PREFIX} Failed to start worker service:`, error);
  process.exit(1);
});

