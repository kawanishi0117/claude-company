// AI Agent Types
export interface Agent {
  id: string;
  name: string;
  type: 'boss' | 'subordinate';
  status: AgentStatus;
  currentTask?: Task;
  lastActivity: Date;
  performance: PerformanceMetrics;
  capabilities: string[];
  configuration: AgentConfig;
}

export type AgentStatus = 'idle' | 'working' | 'error' | 'offline';

export interface PerformanceMetrics {
  tasksCompleted: number;
  successRate: number;
  averageExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
}

export interface AgentConfig {
  maxConcurrentTasks: number;
  timeout: number;
  retryAttempts: number;
  workspacePath: string;
}

// Task Types
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: TaskStatus;
  assignedTo?: string;
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  tags: string[];
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  tasks: Task[];
  startDate: Date;
  endDate?: Date;
  estimatedCompletion: Date;
}

export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

// Log Types
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  metadata?: Record<string, any>;
  agentId?: string;
  taskId?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// System Stats Types
export interface SystemStats {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  systemUptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Dashboard State Types
export interface DashboardState {
  agents: Agent[];
  tasks: Task[];
  projects: Project[];
  logs: LogEntry[];
  systemStats: SystemStats;
  selectedAgent?: Agent;
  selectedProject?: Project;
  filters: FilterState;
  darkMode: boolean;
  sidebarOpen: boolean;
}

export interface FilterState {
  agentStatus: AgentStatus[];
  taskStatus: TaskStatus[];
  logLevel: LogLevel[];
  dateRange: {
    start: Date;
    end: Date;
  };
  searchQuery: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: MessageType;
  payload: any;
  timestamp: Date;
}

export type MessageType = 
  | 'agent_status_update'
  | 'task_update'
  | 'log_entry'
  | 'system_stats'
  | 'project_update';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

// User Instruction Types
export interface UserInstruction {
  id: string;
  content: string;
  priority: number;
  timestamp: Date;
  userId?: string;
  projectId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Chart Data Types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  label?: string;
}