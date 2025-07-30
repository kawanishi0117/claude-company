/**
 * Main export file for the task queue system
 */

// Export main classes
export { TaskQueue } from './task-queue';
export { RedisConnection } from './redis-connection';

// Export types and interfaces
export * from './types';

// Export configuration
export * from './config';

// Re-export commonly used items for convenience
export {
  QueueName,
  JobStatus,
  TaskJob,
  ResultJob,
  QueueStats,
  TaskAssignment,
  QueueConfig
} from './types';

export {
  defaultQueueConfig,
  QUEUE_NAMES,
  JOB_PRIORITIES,
  QUEUE_PROCESSING_OPTIONS
} from './config';