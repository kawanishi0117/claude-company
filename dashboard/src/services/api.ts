import axios, { AxiosResponse } from 'axios';
import { 
  Agent, 
  Task, 
  Project, 
  LogEntry, 
  SystemStats, 
  UserInstruction,
  ApiResponse 
} from '../types';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:8000/api' 
  : '/api';

// Create axios instance with default config
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Agent API
export const agentApi = {
  getAll: (): Promise<Agent[]> =>
    apiClient.get('/agents').then(res => res.data),
    
  getById: (id: string): Promise<Agent> =>
    apiClient.get(`/agents/${id}`).then(res => res.data),
    
  updateAgent: (id: string, data: Partial<Agent>): Promise<Agent> =>
    apiClient.put(`/agents/${id}`, data).then(res => res.data),
    
  getAgentLogs: (id: string, limit = 100): Promise<LogEntry[]> =>
    apiClient.get(`/agents/${id}/logs?limit=${limit}`).then(res => res.data),
    
  restartAgent: (id: string): Promise<ApiResponse> =>
    apiClient.post(`/agents/${id}/restart`).then(res => res.data),
    
  stopAgent: (id: string): Promise<ApiResponse> =>
    apiClient.post(`/agents/${id}/stop`).then(res => res.data),
};

// Task API
export const taskApi = {
  getAll: (): Promise<Task[]> =>
    apiClient.get('/tasks').then(res => res.data),
    
  getById: (id: string): Promise<Task> =>
    apiClient.get(`/tasks/${id}`).then(res => res.data),
    
  create: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> =>
    apiClient.post('/tasks', task).then(res => res.data),
    
  update: (id: string, data: Partial<Task>): Promise<Task> =>
    apiClient.put(`/tasks/${id}`, data).then(res => res.data),
    
  delete: (id: string): Promise<ApiResponse> =>
    apiClient.delete(`/tasks/${id}`).then(res => res.data),
    
  getTasksByAgent: (agentId: string): Promise<Task[]> =>
    apiClient.get(`/agents/${agentId}/tasks`).then(res => res.data),
    
  retryTask: (id: string): Promise<Task> =>
    apiClient.post(`/tasks/${id}/retry`).then(res => res.data),
};

// Project API
export const projectApi = {
  getAll: (): Promise<Project[]> =>
    apiClient.get('/projects').then(res => res.data),
    
  getById: (id: string): Promise<Project> =>
    apiClient.get(`/projects/${id}`).then(res => res.data),
    
  create: (project: Omit<Project, 'id' | 'startDate'>): Promise<Project> =>
    apiClient.post('/projects', project).then(res => res.data),
    
  update: (id: string, data: Partial<Project>): Promise<Project> =>
    apiClient.put(`/projects/${id}`, data).then(res => res.data),
    
  delete: (id: string): Promise<ApiResponse> =>
    apiClient.delete(`/projects/${id}`).then(res => res.data),
};

// System API
export const systemApi = {
  getStats: (): Promise<SystemStats> =>
    apiClient.get('/system/stats').then(res => res.data),
    
  getLogs: (params?: {
    level?: string[];
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LogEntry[]> => {
    const queryParams = new URLSearchParams();
    if (params?.level) queryParams.append('level', params.level.join(','));
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate.toISOString());
    if (params?.endDate) queryParams.append('endDate', params.endDate.toISOString());
    
    return apiClient.get(`/system/logs?${queryParams.toString()}`).then(res => res.data);
  },
  
  clearLogs: (): Promise<ApiResponse> =>
    apiClient.delete('/system/logs').then(res => res.data),
    
  getHealth: (): Promise<{ status: string; uptime: number; version: string }> =>
    apiClient.get('/system/health').then(res => res.data),
};

// User Instruction API
export const instructionApi = {
  submit: (instruction: Omit<UserInstruction, 'id' | 'timestamp' | 'status'>): Promise<UserInstruction> =>
    apiClient.post('/instructions', instruction).then(res => res.data),
    
  getAll: (): Promise<UserInstruction[]> =>
    apiClient.get('/instructions').then(res => res.data),
    
  getById: (id: string): Promise<UserInstruction> =>
    apiClient.get(`/instructions/${id}`).then(res => res.data),
    
  cancel: (id: string): Promise<ApiResponse> =>
    apiClient.post(`/instructions/${id}/cancel`).then(res => res.data),
};

// Export all APIs
export const api = {
  agents: agentApi,
  tasks: taskApi,
  projects: projectApi,
  system: systemApi,
  instructions: instructionApi,
};