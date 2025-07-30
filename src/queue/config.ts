/**
 * Queue system configuration
 */

import { QueueConfig } from './types';

// Default queue configuration
export const defaultQueueConfig: QueueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
    db: parseInt(process.env.REDIS_DB || '0')
  },
  defaultJobOptions: {
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50,      // Keep last 50 failed jobs
    attempts: 3,           // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',
      delay: 2000          // Start with 2 second delay, exponentially increase
    }
  }
};

// Queue names configuration
export const QUEUE_NAMES = {
  TASKS: 'claude-company:tasks',
  RESULTS: 'claude-company:results',
  PRIORITY: 'claude-company:priority'
} as const;

// Job priorities
export const JOB_PRIORITIES = {
  LOW: 1,
  NORMAL: 5,
  HIGH: 10,
  CRITICAL: 20
} as const;

// Queue processing options
export const QUEUE_PROCESSING_OPTIONS = {
  concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '3'),
  maxStalledCount: 1,
  stalledInterval: 30 * 1000, // 30 seconds
  retryProcessDelay: 5 * 1000  // 5 seconds
} as const;