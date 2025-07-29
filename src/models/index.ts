/**
 * Main export file for Claude Company System data models
 */

// Export all types and enums
export * from './types';

// Export all validation functions
export * from './validation';

// Re-export commonly used items for convenience
export {
  Task,
  Agent,
  Project,
  WorkResult,
  TestResult,
  CodeChange,
  LogEntry,
  AgentStatusCard,
  AgentType,
  AgentStatus,
  TaskStatus,
  ProjectStatus,
  TestType,
  LogLevel
} from './types';

export {
  validateTask,
  validateAgent,
  validateProject,
  validateWorkResult,
  validateTestResult,
  validateCodeChange,
  validateLogEntry,
  validateAgentStatusCard,
  ValidationError,
  validators
} from './validation';