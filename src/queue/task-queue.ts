/**
 * Task Queue implementation using Bull Queue
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import { EventEmitter } from 'events';
import { Task, WorkResult } from '../models/types';
import { validateTask, validateWorkResult } from '../models/validation';
import { RedisConnection } from './redis-connection';
import { TaskJob, ResultJob, QueueStats } from './types';
import { QUEUE_NAMES, JOB_PRIORITIES, QUEUE_PROCESSING_OPTIONS } from './config';

export class TaskQueue extends EventEmitter {
  private taskQueue!: Queue<TaskJob>;
  private resultQueue!: Queue<ResultJob>;
  private redisConnection: RedisConnection;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.redisConnection = RedisConnection.getInstance();
  }

  /**
   * Initialize the task queue system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure Redis connection is established
      const redisClient = await this.redisConnection.connect();
      
      // Create Bull queues with Redis connection
      const redisConfig: any = {
        redis: {
          port: redisClient.options.port || 6379,
          host: redisClient.options.host || 'localhost',
          db: redisClient.options.db || 0
        }
      };

      if (redisClient.options.password) {
        redisConfig.redis.password = redisClient.options.password;
      }

      this.taskQueue = new Bull(QUEUE_NAMES.TASKS, redisConfig);
      this.resultQueue = new Bull(QUEUE_NAMES.RESULTS, redisConfig);

      // Set up queue event listeners
      this.setupQueueEventListeners();

      // Set up queue processors
      this.setupQueueProcessors();

      this.isInitialized = true;
      this.emit('queue:ready');
      
      console.log('Task queue system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize task queue:', error);
      this.emit('queue:error', error);
      throw error;
    }
  }

  /**
   * Add a task to the queue
   */
  public async addTask(task: Task, options: Partial<JobOptions> = {}): Promise<string> {
    this.ensureInitialized();
    
    try {
      // Validate the task
      const validatedTask = validateTask(task);
      
      // Create task job
      const taskJob: TaskJob = {
        id: validatedTask.id,
        task: validatedTask,
        priority: validatedTask.priority,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date()
      };

      if (validatedTask.assignedTo) {
        taskJob.assignedTo = validatedTask.assignedTo;
      }

      // Set job options
      const jobOptions: JobOptions = {
        priority: this.mapTaskPriorityToJobPriority(validatedTask.priority),
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50,
        ...options
      };

      // Add job to queue
      const job = await this.taskQueue.add(taskJob, jobOptions);
      
      console.log(`Task added to queue: ${validatedTask.id} (Job ID: ${job.id})`);
      this.emit('job:added', taskJob);
      
      return job.id?.toString() || validatedTask.id;
    } catch (error) {
      console.error('Failed to add task to queue:', error);
      throw error;
    }
  }

  /**
   * Get next available task for an agent
   */
  public async getNextTask(agentId: string): Promise<Task | null> {
    this.ensureInitialized();
    
    try {
      // Get waiting jobs ordered by priority
      const waitingJobs = await this.taskQueue.getWaiting();
      
      if (waitingJobs.length === 0) {
        return null;
      }

      // Find the highest priority job that's not assigned or assigned to this agent
      const availableJob = waitingJobs.find(job => {
        const taskJob = job.data as TaskJob;
        return !taskJob.assignedTo || taskJob.assignedTo === agentId;
      });

      if (!availableJob) {
        return null;
      }

      // Assign the task to the agent
      const taskJob = availableJob.data as TaskJob;
      taskJob.assignedTo = agentId;
      
      // Update job data
      await availableJob.update(taskJob);
      
      console.log(`Task ${taskJob.task.id} assigned to agent ${agentId}`);
      
      return taskJob.task;
    } catch (error) {
      console.error('Failed to get next task:', error);
      throw error;
    }
  }

  /**
   * Mark a task as completed and submit work result
   */
  public async completeTask(taskId: string, workResult: WorkResult): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Validate work result
      const validatedResult = validateWorkResult(workResult);
      
      if (validatedResult.taskId !== taskId) {
        throw new Error(`Work result task ID (${validatedResult.taskId}) does not match expected task ID (${taskId})`);
      }

      // Find the job in active jobs
      const activeJobs = await this.taskQueue.getActive();
      const job = activeJobs.find(j => (j.data as TaskJob).task.id === taskId);
      
      if (!job) {
        throw new Error(`Active job not found for task ID: ${taskId}`);
      }

      // Create result job
      const resultJob: ResultJob = {
        id: `result-${taskId}-${Date.now()}`,
        workResult: validatedResult,
        createdAt: new Date()
      };

      // Add result to result queue
      await this.resultQueue.add(resultJob);

      // Mark the task job as completed
      await job.moveToCompleted('Task completed successfully', true);
      
      console.log(`Task ${taskId} completed by agent ${validatedResult.agentId}`);
      this.emit('job:completed', job.data as TaskJob, validatedResult);
      
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    }
  }

  /**
   * Mark a task as failed
   */
  public async failTask(taskId: string, error: Error): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Find the job in active jobs
      const activeJobs = await this.taskQueue.getActive();
      const job = activeJobs.find(j => (j.data as TaskJob).task.id === taskId);
      
      if (!job) {
        throw new Error(`Active job not found for task ID: ${taskId}`);
      }

      // Mark the job as failed
      await job.moveToFailed(error, true);
      
      console.log(`Task ${taskId} failed: ${error.message}`);
      this.emit('job:failed', job.data as TaskJob, error);
      
    } catch (error) {
      console.error('Failed to mark task as failed:', error);
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  public async getStats(): Promise<QueueStats> {
    this.ensureInitialized();
    
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.taskQueue.getWaiting(),
        this.taskQueue.getActive(),
        this.taskQueue.getCompleted(),
        this.taskQueue.getFailed(),
        this.taskQueue.getDelayed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: 0
      };
    } catch (error) {
      console.error('Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Get all tasks with their current status
   */
  public async getAllTasks(): Promise<{ task: Task; status: string; jobId?: string }[]> {
    this.ensureInitialized();
    
    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.taskQueue.getWaiting(),
        this.taskQueue.getActive(),
        this.taskQueue.getCompleted(),
        this.taskQueue.getFailed()
      ]);

      const allJobs = [
        ...waiting.map(job => ({ job, status: 'waiting' })),
        ...active.map(job => ({ job, status: 'active' })),
        ...completed.map(job => ({ job, status: 'completed' })),
        ...failed.map(job => ({ job, status: 'failed' }))
      ];

      return allJobs.map(({ job, status }) => ({
        task: (job.data as TaskJob).task,
        status,
        jobId: job.id?.toString()
      }));
    } catch (error) {
      console.error('Failed to get all tasks:', error);
      throw error;
    }
  }

  /**
   * Remove a task from the queue
   */
  public async removeTask(taskId: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const allJobs = await this.taskQueue.getJobs(['waiting', 'active', 'delayed']);
      const job = allJobs.find(j => (j.data as TaskJob).task.id === taskId);
      
      if (job) {
        await job.remove();
        console.log(`Task ${taskId} removed from queue`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to remove task:', error);
      throw error;
    }
  }

  /**
   * Clean up completed and failed jobs
   */
  public async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    this.ensureInitialized();
    
    try {
      await Promise.all([
        this.taskQueue.clean(maxAge, 'completed'),
        this.taskQueue.clean(maxAge, 'failed'),
        this.resultQueue.clean(maxAge, 'completed'),
        this.resultQueue.clean(maxAge, 'failed')
      ]);
      
      console.log('Queue cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup queues:', error);
      throw error;
    }
  }

  /**
   * Close the queue connections
   */
  public async close(): Promise<void> {
    try {
      if (this.taskQueue) {
        await this.taskQueue.close();
      }
      if (this.resultQueue) {
        await this.resultQueue.close();
      }
      
      this.isInitialized = false;
      console.log('Task queue closed');
    } catch (error) {
      console.error('Failed to close task queue:', error);
      throw error;
    }
  }

  /**
   * Set up queue event listeners
   */
  private setupQueueEventListeners(): void {
    // Task queue events
    this.taskQueue.on('completed', (job: Job<TaskJob>) => {
      console.log(`Job ${job.id} completed for task ${job.data.task.id}`);
    });

    this.taskQueue.on('failed', (job: Job<TaskJob>, err: Error) => {
      console.error(`Job ${job.id} failed for task ${job.data.task.id}:`, err.message);
    });

    this.taskQueue.on('stalled', (job: Job<TaskJob>) => {
      console.warn(`Job ${job.id} stalled for task ${job.data.task.id}`);
    });

    this.taskQueue.on('error', (error: Error) => {
      console.error('Task queue error:', error);
      this.emit('queue:error', error);
    });

    // Result queue events
    this.resultQueue.on('completed', (job: Job<ResultJob>) => {
      console.log(`Result job ${job.id} completed for task ${job.data.workResult.taskId}`);
    });

    this.resultQueue.on('error', (error: Error) => {
      console.error('Result queue error:', error);
      this.emit('queue:error', error);
    });
  }

  /**
   * Set up queue processors
   */
  private setupQueueProcessors(): void {
    // Task queue processor (placeholder - actual processing happens in agents)
    this.taskQueue.process(QUEUE_PROCESSING_OPTIONS.concurrency, async (job: Job<TaskJob>) => {
      const taskJob = job.data;
      console.log(`Processing task: ${taskJob.task.id}`);
      
      // Update job progress
      await job.progress(0);
      
      // The actual task processing is handled by AI agents
      // This processor just manages the job lifecycle
      return { taskId: taskJob.task.id, status: 'processed' };
    });

    // Result queue processor
    this.resultQueue.process(async (job: Job<ResultJob>) => {
      const resultJob = job.data;
      console.log(`Processing result for task: ${resultJob.workResult.taskId}`);
      
      // Here you could add logic to handle work results
      // For example, notify the boss AI, update databases, etc.
      
      return { resultId: resultJob.id, status: 'processed' };
    });
  }

  /**
   * Map task priority to Bull job priority
   */
  private mapTaskPriorityToJobPriority(taskPriority: number): number {
    if (taskPriority >= 10) return JOB_PRIORITIES.CRITICAL;
    if (taskPriority >= 5) return JOB_PRIORITIES.HIGH;
    if (taskPriority >= 2) return JOB_PRIORITIES.NORMAL;
    return JOB_PRIORITIES.LOW;
  }

  /**
   * Ensure the queue is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Task queue is not initialized. Call initialize() first.');
    }
  }
}