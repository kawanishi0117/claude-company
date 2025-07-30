/**
 * Task Queue specific types and interfaces
 */

import { Task, WorkResult } from '../models/types';

// Queue-specific enums
export enum QueueName {
  TASK_QUEUE = 'task-queue',
  RESULT_QUEUE = 'result-queue',
  PRIORITY_QUEUE = 'priority-queue'
}

export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused'
}

// Queue job interfaces
export interface TaskJob {
  id: string;
  task: Task;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  assignedTo?: string;
}

export interface ResultJob {
  id: string;
  workResult: WorkResult;
  createdAt: Date;
}

// Queue configuration
export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: string;
      delay: number;
    };
  };
}

// Queue statistics
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

// Queue events
export interface QueueEvents {
  'job:added': (job: TaskJob) => void;
  'job:started': (job: TaskJob) => void;
  'job:completed': (job: TaskJob, result: WorkResult) => void;
  'job:failed': (job: TaskJob, error: Error) => void;
  'queue:ready': () => void;
  'queue:error': (error: Error) => void;
}

// Task assignment interface
export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  priority: number;
}