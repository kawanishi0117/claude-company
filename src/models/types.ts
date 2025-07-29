/**
 * Core type definitions for the Claude Company System
 */

// Enums for type safety
export enum AgentType {
  BOSS = 'BOSS',
  SUBORDINATE = 'SUBORDINATE'
}

export enum AgentStatus {
  IDLE = 'IDLE',
  WORKING = 'WORKING',
  ERROR = 'ERROR'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum ProjectStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED'
}

export enum TestType {
  UNIT = 'UNIT',
  INTEGRATION = 'INTEGRATION'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Core interfaces
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  dependencies: string[];
  assignedTo?: string;
  status: TaskStatus;
  createdAt: Date;
  deadline?: Date;
}

export interface Agent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  currentTask?: string;
  lastActivity: Date;
  performanceMetrics: Record<string, any>;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  repositoryPath: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
}

export interface TestDetail {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestResult {
  testType: TestType;
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  executionTime: number;
  details: TestDetail[];
}

export interface CodeChange {
  filePath: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  content?: string;
  diff?: string;
}

export interface WorkResult {
  taskId: string;
  agentId: string;
  codeChanges: CodeChange[];
  testResults: TestResult;
  completionTime: Date;
}

// Dashboard-specific interfaces
export interface AgentStatusCard {
  agentId: string;
  agentType: 'boss' | 'subordinate';
  status: 'idle' | 'working' | 'error';
  currentTask?: string;
  progress: number;
  executionTime: number;
  lastActivity: Date;
  performanceMetrics: {
    tasksCompleted: number;
    averageExecutionTime: number;
    successRate: number;
  };
}

export interface TimelineItem {
  id: string;
  timestamp: Date;
  agentId: string;
  action: string;
  description: string;
  status: 'success' | 'error' | 'warning' | 'info';
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }[];
}

export interface ActivityItem {
  id: string;
  timestamp: Date;
  agentId: string;
  message: string;
  type: 'task_started' | 'task_completed' | 'error' | 'info';
}

export interface ProgressDashboard {
  overallProgress: {
    completedTasks: number;
    totalTasks: number;
    estimatedCompletion: Date;
  };
  taskTimeline: TimelineItem[];
  performanceCharts: ChartData[];
  recentActivity: ActivityItem[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  agentId: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface LogViewer {
  logs: LogEntry[];
  filters: {
    level: LogLevel[];
    agentId: string[];
    timeRange: DateRange;
  };
  searchQuery: string;
  syntaxHighlighting: boolean;
  autoScroll: boolean;
}

// Component interfaces
export interface HeaderComponent {
  title: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export interface SidebarComponent {
  projects: Project[];
  selectedProject?: string;
  onSelectProject: (projectId: string) => void;
}

export interface MainContentComponent {
  project?: Project;
  agents: Agent[];
  tasks: Task[];
}

export interface FooterComponent {
  systemStatus: 'online' | 'offline' | 'error';
  lastUpdate: Date;
}

export interface DashboardLayout {
  header: HeaderComponent;
  sidebar: SidebarComponent;
  mainContent: MainContentComponent;
  footer: FooterComponent;
}