/**
 * Data validation functions for the Claude Company System
 */

import {
  Task,
  Agent,
  Project,
  WorkResult,
  TestResult,
  CodeChange,
  AgentType,
  AgentStatus,
  TaskStatus,
  ProjectStatus,
  TestType,
  LogLevel,
  LogEntry,
  AgentStatusCard
} from './types';

// Validation error class
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Helper functions

const isValidDate = (date: any): date is Date => {
  return date instanceof Date && !isNaN(date.getTime());
};

const isNonEmptyString = (value: any): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

const isValidArray = (value: any): value is any[] => {
  return Array.isArray(value);
};

// Task validation
export const validateTask = (task: any): Task => {
  if (!task || typeof task !== 'object') {
    throw new ValidationError('Task must be an object');
  }

  if (!isNonEmptyString(task.id)) {
    throw new ValidationError('Task ID must be a non-empty string', 'id');
  }

  if (!isNonEmptyString(task.title)) {
    throw new ValidationError('Task title must be a non-empty string', 'title');
  }

  if (!isNonEmptyString(task.description)) {
    throw new ValidationError('Task description must be a non-empty string', 'description');
  }

  if (!isValidNumber(task.priority) || task.priority < 0) {
    throw new ValidationError('Task priority must be a non-negative number', 'priority');
  }

  if (!isValidArray(task.dependencies)) {
    throw new ValidationError('Task dependencies must be an array', 'dependencies');
  }

  if (!task.dependencies.every((dep: any) => isNonEmptyString(dep))) {
    throw new ValidationError('All task dependencies must be non-empty strings', 'dependencies');
  }

  if (task.assignedTo !== undefined && !isNonEmptyString(task.assignedTo)) {
    throw new ValidationError('Task assignedTo must be a non-empty string or undefined', 'assignedTo');
  }

  if (!Object.values(TaskStatus).includes(task.status)) {
    throw new ValidationError('Task status must be a valid TaskStatus', 'status');
  }

  if (!isValidDate(task.createdAt)) {
    throw new ValidationError('Task createdAt must be a valid Date', 'createdAt');
  }

  if (task.deadline !== undefined && !isValidDate(task.deadline)) {
    throw new ValidationError('Task deadline must be a valid Date or undefined', 'deadline');
  }

  return task as Task;
};

// Agent validation
export const validateAgent = (agent: any): Agent => {
  if (!agent || typeof agent !== 'object') {
    throw new ValidationError('Agent must be an object');
  }

  if (!isNonEmptyString(agent.id)) {
    throw new ValidationError('Agent ID must be a non-empty string', 'id');
  }

  if (!Object.values(AgentType).includes(agent.type)) {
    throw new ValidationError('Agent type must be a valid AgentType', 'type');
  }

  if (!Object.values(AgentStatus).includes(agent.status)) {
    throw new ValidationError('Agent status must be a valid AgentStatus', 'status');
  }

  if (agent.currentTask !== undefined && !isNonEmptyString(agent.currentTask)) {
    throw new ValidationError('Agent currentTask must be a non-empty string or undefined', 'currentTask');
  }

  if (!isValidDate(agent.lastActivity)) {
    throw new ValidationError('Agent lastActivity must be a valid Date', 'lastActivity');
  }

  if (!agent.performanceMetrics || typeof agent.performanceMetrics !== 'object') {
    throw new ValidationError('Agent performanceMetrics must be an object', 'performanceMetrics');
  }

  return agent as Agent;
};

// Project validation
export const validateProject = (project: any): Project => {
  if (!project || typeof project !== 'object') {
    throw new ValidationError('Project must be an object');
  }

  if (!isNonEmptyString(project.id)) {
    throw new ValidationError('Project ID must be a non-empty string', 'id');
  }

  if (!isNonEmptyString(project.name)) {
    throw new ValidationError('Project name must be a non-empty string', 'name');
  }

  if (!isNonEmptyString(project.description)) {
    throw new ValidationError('Project description must be a non-empty string', 'description');
  }

  if (!isNonEmptyString(project.repositoryPath)) {
    throw new ValidationError('Project repositoryPath must be a non-empty string', 'repositoryPath');
  }

  if (!Object.values(ProjectStatus).includes(project.status)) {
    throw new ValidationError('Project status must be a valid ProjectStatus', 'status');
  }

  if (!isValidDate(project.createdAt)) {
    throw new ValidationError('Project createdAt must be a valid Date', 'createdAt');
  }

  if (!isValidDate(project.updatedAt)) {
    throw new ValidationError('Project updatedAt must be a valid Date', 'updatedAt');
  }

  if (!isValidArray(project.tasks)) {
    throw new ValidationError('Project tasks must be an array', 'tasks');
  }

  // Validate each task in the project
  project.tasks.forEach((task: any, index: number) => {
    try {
      validateTask(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ValidationError(`Invalid task at index ${index}: ${errorMessage}`, `tasks[${index}]`);
    }
  });

  return project as Project;
};

// CodeChange validation
export const validateCodeChange = (codeChange: any): CodeChange => {
  if (!codeChange || typeof codeChange !== 'object') {
    throw new ValidationError('CodeChange must be an object');
  }

  if (!isNonEmptyString(codeChange.filePath)) {
    throw new ValidationError('CodeChange filePath must be a non-empty string', 'filePath');
  }

  const validActions = ['CREATE', 'UPDATE', 'DELETE'];
  if (!validActions.includes(codeChange.action)) {
    throw new ValidationError('CodeChange action must be CREATE, UPDATE, or DELETE', 'action');
  }

  if (codeChange.content !== undefined && typeof codeChange.content !== 'string') {
    throw new ValidationError('CodeChange content must be a string or undefined', 'content');
  }

  if (codeChange.diff !== undefined && typeof codeChange.diff !== 'string') {
    throw new ValidationError('CodeChange diff must be a string or undefined', 'diff');
  }

  return codeChange as CodeChange;
};

// TestResult validation
export const validateTestResult = (testResult: any): TestResult => {
  if (!testResult || typeof testResult !== 'object') {
    throw new ValidationError('TestResult must be an object');
  }

  if (!Object.values(TestType).includes(testResult.testType)) {
    throw new ValidationError('TestResult testType must be a valid TestType', 'testType');
  }

  if (typeof testResult.passed !== 'boolean') {
    throw new ValidationError('TestResult passed must be a boolean', 'passed');
  }

  if (!isValidNumber(testResult.totalTests) || testResult.totalTests < 0) {
    throw new ValidationError('TestResult totalTests must be a non-negative number', 'totalTests');
  }

  if (!isValidNumber(testResult.passedTests) || testResult.passedTests < 0) {
    throw new ValidationError('TestResult passedTests must be a non-negative number', 'passedTests');
  }

  if (!isValidNumber(testResult.failedTests) || testResult.failedTests < 0) {
    throw new ValidationError('TestResult failedTests must be a non-negative number', 'failedTests');
  }

  if (!isValidNumber(testResult.executionTime) || testResult.executionTime < 0) {
    throw new ValidationError('TestResult executionTime must be a non-negative number', 'executionTime');
  }

  if (!isValidArray(testResult.details)) {
    throw new ValidationError('TestResult details must be an array', 'details');
  }

  // Validate test details
  testResult.details.forEach((detail: any, index: number) => {
    if (!detail || typeof detail !== 'object') {
      throw new ValidationError(`TestDetail at index ${index} must be an object`, `details[${index}]`);
    }

    if (!isNonEmptyString(detail.name)) {
      throw new ValidationError(`TestDetail name at index ${index} must be a non-empty string`, `details[${index}].name`);
    }

    if (typeof detail.passed !== 'boolean') {
      throw new ValidationError(`TestDetail passed at index ${index} must be a boolean`, `details[${index}].passed`);
    }

    if (detail.error !== undefined && typeof detail.error !== 'string') {
      throw new ValidationError(`TestDetail error at index ${index} must be a string or undefined`, `details[${index}].error`);
    }

    if (!isValidNumber(detail.duration) || detail.duration < 0) {
      throw new ValidationError(`TestDetail duration at index ${index} must be a non-negative number`, `details[${index}].duration`);
    }
  });

  return testResult as TestResult;
};

// WorkResult validation
export const validateWorkResult = (workResult: any): WorkResult => {
  if (!workResult || typeof workResult !== 'object') {
    throw new ValidationError('WorkResult must be an object');
  }

  if (!isNonEmptyString(workResult.taskId)) {
    throw new ValidationError('WorkResult taskId must be a non-empty string', 'taskId');
  }

  if (!isNonEmptyString(workResult.agentId)) {
    throw new ValidationError('WorkResult agentId must be a non-empty string', 'agentId');
  }

  if (!isValidArray(workResult.codeChanges)) {
    throw new ValidationError('WorkResult codeChanges must be an array', 'codeChanges');
  }

  // Validate each code change
  workResult.codeChanges.forEach((codeChange: any, index: number) => {
    try {
      validateCodeChange(codeChange);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ValidationError(`Invalid codeChange at index ${index}: ${errorMessage}`, `codeChanges[${index}]`);
    }
  });

  try {
    validateTestResult(workResult.testResults);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new ValidationError(`Invalid testResults: ${errorMessage}`, 'testResults');
  }

  if (!isValidDate(workResult.completionTime)) {
    throw new ValidationError('WorkResult completionTime must be a valid Date', 'completionTime');
  }

  return workResult as WorkResult;
};

// LogEntry validation
export const validateLogEntry = (logEntry: any): LogEntry => {
  if (!logEntry || typeof logEntry !== 'object') {
    throw new ValidationError('LogEntry must be an object');
  }

  if (!isNonEmptyString(logEntry.id)) {
    throw new ValidationError('LogEntry ID must be a non-empty string', 'id');
  }

  if (!isValidDate(logEntry.timestamp)) {
    throw new ValidationError('LogEntry timestamp must be a valid Date', 'timestamp');
  }

  if (!Object.values(LogLevel).includes(logEntry.level)) {
    throw new ValidationError('LogEntry level must be a valid LogLevel', 'level');
  }

  if (!isNonEmptyString(logEntry.agentId)) {
    throw new ValidationError('LogEntry agentId must be a non-empty string', 'agentId');
  }

  if (!isNonEmptyString(logEntry.message)) {
    throw new ValidationError('LogEntry message must be a non-empty string', 'message');
  }

  if (logEntry.metadata !== undefined && (typeof logEntry.metadata !== 'object' || logEntry.metadata === null)) {
    throw new ValidationError('LogEntry metadata must be an object or undefined', 'metadata');
  }

  return logEntry as LogEntry;
};

// AgentStatusCard validation
export const validateAgentStatusCard = (card: any): AgentStatusCard => {
  if (!card || typeof card !== 'object') {
    throw new ValidationError('AgentStatusCard must be an object');
  }

  if (!isNonEmptyString(card.agentId)) {
    throw new ValidationError('AgentStatusCard agentId must be a non-empty string', 'agentId');
  }

  const validAgentTypes = ['boss', 'subordinate'];
  if (!validAgentTypes.includes(card.agentType)) {
    throw new ValidationError('AgentStatusCard agentType must be boss or subordinate', 'agentType');
  }

  const validStatuses = ['idle', 'working', 'error'];
  if (!validStatuses.includes(card.status)) {
    throw new ValidationError('AgentStatusCard status must be idle, working, or error', 'status');
  }

  if (card.currentTask !== undefined && !isNonEmptyString(card.currentTask)) {
    throw new ValidationError('AgentStatusCard currentTask must be a non-empty string or undefined', 'currentTask');
  }

  if (!isValidNumber(card.progress) || card.progress < 0 || card.progress > 100) {
    throw new ValidationError('AgentStatusCard progress must be a number between 0 and 100', 'progress');
  }

  if (!isValidNumber(card.executionTime) || card.executionTime < 0) {
    throw new ValidationError('AgentStatusCard executionTime must be a non-negative number', 'executionTime');
  }

  if (!isValidDate(card.lastActivity)) {
    throw new ValidationError('AgentStatusCard lastActivity must be a valid Date', 'lastActivity');
  }

  if (!card.performanceMetrics || typeof card.performanceMetrics !== 'object') {
    throw new ValidationError('AgentStatusCard performanceMetrics must be an object', 'performanceMetrics');
  }

  const metrics = card.performanceMetrics;
  if (!isValidNumber(metrics.tasksCompleted) || metrics.tasksCompleted < 0) {
    throw new ValidationError('AgentStatusCard performanceMetrics.tasksCompleted must be a non-negative number', 'performanceMetrics.tasksCompleted');
  }

  if (!isValidNumber(metrics.averageExecutionTime) || metrics.averageExecutionTime < 0) {
    throw new ValidationError('AgentStatusCard performanceMetrics.averageExecutionTime must be a non-negative number', 'performanceMetrics.averageExecutionTime');
  }

  if (!isValidNumber(metrics.successRate) || metrics.successRate < 0 || metrics.successRate > 100) {
    throw new ValidationError('AgentStatusCard performanceMetrics.successRate must be a number between 0 and 100', 'performanceMetrics.successRate');
  }

  return card as AgentStatusCard;
};

// Utility function to validate arrays of objects
export const validateArray = <T>(
  items: any[],
  validator: (item: any) => T,
  fieldName: string
): T[] => {
  if (!isValidArray(items)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  return items.map((item, index) => {
    try {
      return validator(item);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ValidationError(`Invalid item at index ${index} in ${fieldName}: ${errorMessage}`, `${fieldName}[${index}]`);
    }
  });
};

// Export all validation functions
export const validators = {
  validateTask,
  validateAgent,
  validateProject,
  validateWorkResult,
  validateTestResult,
  validateCodeChange,
  validateLogEntry,
  validateAgentStatusCard,
  validateArray
};