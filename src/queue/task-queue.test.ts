/**
 * Unit tests for TaskQueue class
 */

import { TaskQueue } from './task-queue';
import { RedisConnection } from './redis-connection';
import { Task, WorkResult, TaskStatus, TestType } from '../models/types';

// Mock dependencies
jest.mock('./redis-connection');
jest.mock('bull', () => {
  const mockJob = {
    id: 'job-123',
    data: {},
    update: jest.fn(),
    moveToCompleted: jest.fn(),
    moveToFailed: jest.fn(),
    remove: jest.fn(),
    progress: jest.fn()
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue(mockJob),
    getWaiting: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getCompleted: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    getPaused: jest.fn().mockResolvedValue([]),
    getJobs: jest.fn().mockResolvedValue([]),
    clean: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    process: jest.fn(),
    on: jest.fn()
  };

  return jest.fn(() => mockQueue);
});

describe('TaskQueue', () => {
  let taskQueue: TaskQueue;
  let mockRedisConnection: jest.Mocked<RedisConnection>;

  const sampleTask: Task = {
    id: 'task-001',
    title: 'Test Task',
    description: 'A test task for unit testing',
    priority: 5,
    dependencies: [],
    assignedTo: 'agent-001',
    status: TaskStatus.PENDING,
    createdAt: new Date(),
    deadline: new Date(Date.now() + 86400000) // 1 day from now
  };

  const sampleWorkResult: WorkResult = {
    taskId: 'task-001',
    agentId: 'agent-001',
    codeChanges: [
      {
        filePath: '/test/file.ts',
        action: 'CREATE',
        content: 'console.log("test");'
      }
    ],
    testResults: {
      testType: TestType.UNIT,
      passed: true,
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      executionTime: 100,
      details: [
        {
          name: 'test case 1',
          passed: true,
          duration: 100
        }
      ]
    },
    completionTime: new Date()
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock RedisConnection
    mockRedisConnection = {
      connect: jest.fn().mockResolvedValue({
        options: { host: 'localhost', port: 6379, password: undefined, db: 0 }
      }),
      getInstance: jest.fn().mockReturnThis()
    } as any;

    (RedisConnection.getInstance as jest.Mock).mockReturnValue(mockRedisConnection);
    
    taskQueue = new TaskQueue();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await taskQueue.initialize();
      
      expect(mockRedisConnection.connect).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await taskQueue.initialize();
      await taskQueue.initialize();
      
      expect(mockRedisConnection.connect).toHaveBeenCalledTimes(1);
    });

    it('should emit queue:ready event on successful initialization', async () => {
      const readyHandler = jest.fn();
      taskQueue.on('queue:ready', readyHandler);
      
      await taskQueue.initialize();
      
      expect(readyHandler).toHaveBeenCalled();
    });

    it('should emit queue:error event on initialization failure', async () => {
      const errorHandler = jest.fn();
      taskQueue.on('queue:error', errorHandler);
      
      mockRedisConnection.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(taskQueue.initialize()).rejects.toThrow('Connection failed');
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('addTask', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should add task to queue successfully', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const jobId = await taskQueue.addTask(sampleTask);
      
      expect(mockQueue.add).toHaveBeenCalled();
      expect(jobId).toBe('job-123');
    });

    it('should validate task before adding', async () => {
      const invalidTask = { ...sampleTask, id: '' }; // Invalid task
      
      await expect(taskQueue.addTask(invalidTask as Task)).rejects.toThrow();
    });

    it('should emit job:added event', async () => {
      const addedHandler = jest.fn();
      taskQueue.on('job:added', addedHandler);
      
      await taskQueue.addTask(sampleTask);
      
      expect(addedHandler).toHaveBeenCalled();
    });

    it('should map task priority to job priority correctly', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const highPriorityTask = { ...sampleTask, priority: 15 };
      await taskQueue.addTask(highPriorityTask);
      
      const addCall = mockQueue.add.mock.calls[0];
      expect(addCall[1].priority).toBe(20); // CRITICAL priority
    });
  });

  describe('getNextTask', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should return null when no tasks available', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      mockQueue.getWaiting.mockResolvedValueOnce([]);
      
      const task = await taskQueue.getNextTask('agent-001');
      
      expect(task).toBeNull();
    });

    it('should return available task for agent', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: {
          task: sampleTask,
          assignedTo: undefined
        },
        update: jest.fn()
      };
      
      mockQueue.getWaiting.mockResolvedValueOnce([mockJob]);
      
      const task = await taskQueue.getNextTask('agent-001');
      
      expect(task).toEqual(sampleTask);
      expect(mockJob.update).toHaveBeenCalled();
    });

    it('should return task assigned to specific agent', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: {
          task: sampleTask,
          assignedTo: 'agent-001'
        },
        update: jest.fn()
      };
      
      mockQueue.getWaiting.mockResolvedValueOnce([mockJob]);
      
      const task = await taskQueue.getNextTask('agent-001');
      
      expect(task).toEqual(sampleTask);
    });

    it('should not return task assigned to different agent', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: {
          task: sampleTask,
          assignedTo: 'agent-002'
        },
        update: jest.fn()
      };
      
      mockQueue.getWaiting.mockResolvedValueOnce([mockJob]);
      
      const task = await taskQueue.getNextTask('agent-001');
      
      expect(task).toBeNull();
    });
  });

  describe('completeTask', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should complete task successfully', async () => {
      const Bull = require('bull');
      const mockTaskQueue = new Bull();
      const mockResultQueue = new Bull();
      
      const mockJob = {
        data: { task: sampleTask },
        moveToCompleted: jest.fn()
      };
      
      mockTaskQueue.getActive.mockResolvedValueOnce([mockJob]);
      
      await taskQueue.completeTask('task-001', sampleWorkResult);
      
      expect(mockResultQueue.add).toHaveBeenCalled();
      expect(mockJob.moveToCompleted).toHaveBeenCalled();
    });

    it('should validate work result', async () => {
      const invalidWorkResult = { ...sampleWorkResult, taskId: '' };
      
      await expect(taskQueue.completeTask('task-001', invalidWorkResult as WorkResult))
        .rejects.toThrow();
    });

    it('should check task ID matches work result', async () => {
      const mismatchedWorkResult = { ...sampleWorkResult, taskId: 'different-task' };
      
      await expect(taskQueue.completeTask('task-001', mismatchedWorkResult))
        .rejects.toThrow('Work result task ID');
    });

    it('should emit job:completed event', async () => {
      const completedHandler = jest.fn();
      taskQueue.on('job:completed', completedHandler);
      
      const Bull = require('bull');
      const mockTaskQueue = new Bull();
      
      const mockJob = {
        data: { task: sampleTask },
        moveToCompleted: jest.fn()
      };
      
      mockTaskQueue.getActive.mockResolvedValueOnce([mockJob]);
      
      await taskQueue.completeTask('task-001', sampleWorkResult);
      
      expect(completedHandler).toHaveBeenCalled();
    });
  });

  describe('failTask', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should fail task successfully', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: { task: sampleTask },
        moveToFailed: jest.fn()
      };
      
      mockQueue.getActive.mockResolvedValueOnce([mockJob]);
      
      const error = new Error('Task failed');
      await taskQueue.failTask('task-001', error);
      
      expect(mockJob.moveToFailed).toHaveBeenCalledWith(error, true);
    });

    it('should emit job:failed event', async () => {
      const failedHandler = jest.fn();
      taskQueue.on('job:failed', failedHandler);
      
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: { task: sampleTask },
        moveToFailed: jest.fn()
      };
      
      mockQueue.getActive.mockResolvedValueOnce([mockJob]);
      
      const error = new Error('Task failed');
      await taskQueue.failTask('task-001', error);
      
      expect(failedHandler).toHaveBeenCalledWith(mockJob.data, error);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should return queue statistics', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      mockQueue.getWaiting.mockResolvedValueOnce([1, 2]);
      mockQueue.getActive.mockResolvedValueOnce([1]);
      mockQueue.getCompleted.mockResolvedValueOnce([1, 2, 3]);
      mockQueue.getFailed.mockResolvedValueOnce([]);
      mockQueue.getDelayed.mockResolvedValueOnce([]);

      
      const stats = await taskQueue.getStats();
      
      expect(stats).toEqual({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 0,
        delayed: 0,
        paused: 0
      });
    });
  });

  describe('getAllTasks', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should return all tasks with status', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJobs = [
        { id: '1', data: { task: sampleTask } },
        { id: '2', data: { task: { ...sampleTask, id: 'task-002' } } }
      ];
      
      mockQueue.getWaiting.mockResolvedValueOnce([mockJobs[0]]);
      mockQueue.getActive.mockResolvedValueOnce([mockJobs[1]]);
      mockQueue.getCompleted.mockResolvedValueOnce([]);
      mockQueue.getFailed.mockResolvedValueOnce([]);
      
      const tasks = await taskQueue.getAllTasks();
      
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        task: sampleTask,
        status: 'waiting',
        jobId: '1'
      });
      expect(tasks[1]).toEqual({
        task: { ...sampleTask, id: 'task-002' },
        status: 'active',
        jobId: '2'
      });
    });
  });

  describe('removeTask', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should remove task successfully', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      const mockJob = {
        data: { task: sampleTask },
        remove: jest.fn()
      };
      
      mockQueue.getJobs.mockResolvedValueOnce([mockJob]);
      
      const result = await taskQueue.removeTask('task-001');
      
      expect(result).toBe(true);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should return false if task not found', async () => {
      const Bull = require('bull');
      const mockQueue = new Bull();
      
      mockQueue.getJobs.mockResolvedValueOnce([]);
      
      const result = await taskQueue.removeTask('nonexistent-task');
      
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should clean up old jobs', async () => {
      const Bull = require('bull');
      const mockTaskQueue = new Bull();
      const mockResultQueue = new Bull();
      
      await taskQueue.cleanup(86400000); // 24 hours
      
      expect(mockTaskQueue.clean).toHaveBeenCalledWith(86400000, 'completed');
      expect(mockTaskQueue.clean).toHaveBeenCalledWith(86400000, 'failed');
      expect(mockResultQueue.clean).toHaveBeenCalledWith(86400000, 'completed');
      expect(mockResultQueue.clean).toHaveBeenCalledWith(86400000, 'failed');
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await taskQueue.initialize();
    });

    it('should close queue connections', async () => {
      const Bull = require('bull');
      const mockTaskQueue = new Bull();
      const mockResultQueue = new Bull();
      
      await taskQueue.close();
      
      expect(mockTaskQueue.close).toHaveBeenCalled();
      expect(mockResultQueue.close).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(taskQueue.addTask(sampleTask)).rejects.toThrow('not initialized');
      await expect(taskQueue.getNextTask('agent-001')).rejects.toThrow('not initialized');
      await expect(taskQueue.completeTask('task-001', sampleWorkResult)).rejects.toThrow('not initialized');
      await expect(taskQueue.getStats()).rejects.toThrow('not initialized');
    });
  });
});