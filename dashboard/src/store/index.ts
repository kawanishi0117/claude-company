import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { 
  Agent, 
  Task, 
  Project, 
  LogEntry, 
  SystemStats, 
  DashboardState,
  FilterState,
  UserInstruction
} from '../types';

interface DashboardStore extends DashboardState {
  // Actions
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agent: Agent) => void;
  addAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  
  setTasks: (tasks: Task[]) => void;
  updateTask: (task: Task) => void;
  addTask: (task: Task) => void;
  removeTask: (taskId: string) => void;
  
  setProjects: (projects: Project[]) => void;
  updateProject: (project: Project) => void;
  addProject: (project: Project) => void;
  
  setLogs: (logs: LogEntry[]) => void;
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;
  
  setSystemStats: (stats: SystemStats) => void;
  
  setSelectedAgent: (agent: Agent | undefined) => void;
  setSelectedProject: (project: Project | undefined) => void;
  
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  
  // User Instructions
  addUserInstruction: (instruction: UserInstruction) => void;
  updateUserInstruction: (instruction: UserInstruction) => void;
  
  // Utilities
  getAgentById: (id: string) => Agent | undefined;
  getTaskById: (id: string) => Task | undefined;
  getFilteredLogs: () => LogEntry[];
  getFilteredTasks: () => Task[];
  getFilteredAgents: () => Agent[];
}

const initialFilters: FilterState = {
  agentStatus: [],
  taskStatus: [],
  logLevel: [],
  dateRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    end: new Date(),
  },
  searchQuery: '',
};

const initialSystemStats: SystemStats = {
  totalAgents: 0,
  activeAgents: 0,
  totalTasks: 0,
  activeTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  systemUptime: 0,
  memoryUsage: 0,
  cpuUsage: 0,
};

export const useDashboardStore = create<DashboardStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        agents: [],
        tasks: [],
        projects: [],
        logs: [],
        systemStats: initialSystemStats,
        selectedAgent: undefined,
        selectedProject: undefined,
        filters: initialFilters,
        darkMode: false,
        sidebarOpen: true,

        // Agent actions
        setAgents: (agents) => set({ agents }),
        updateAgent: (updatedAgent) =>
          set((state) => ({
            agents: state.agents.map((agent) =>
              agent.id === updatedAgent.id ? updatedAgent : agent
            ),
          })),
        addAgent: (agent) =>
          set((state) => ({ agents: [...state.agents, agent] })),
        removeAgent: (agentId) =>
          set((state) => ({
            agents: state.agents.filter((agent) => agent.id !== agentId),
          })),

        // Task actions
        setTasks: (tasks) => set({ tasks }),
        updateTask: (updatedTask) =>
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === updatedTask.id ? updatedTask : task
            ),
          })),
        addTask: (task) =>
          set((state) => ({ tasks: [...state.tasks, task] })),
        removeTask: (taskId) =>
          set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== taskId),
          })),

        // Project actions
        setProjects: (projects) => set({ projects }),
        updateProject: (updatedProject) =>
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === updatedProject.id ? updatedProject : project
            ),
          })),
        addProject: (project) =>
          set((state) => ({ projects: [...state.projects, project] })),

        // Log actions
        setLogs: (logs) => set({ logs }),
        addLog: (log) =>
          set((state) => ({
            logs: [log, ...state.logs].slice(0, 1000), // Keep only latest 1000 logs
          })),
        clearLogs: () => set({ logs: [] }),

        // System stats actions
        setSystemStats: (systemStats) => set({ systemStats }),

        // Selection actions
        setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
        setSelectedProject: (selectedProject) => set({ selectedProject }),

        // Filter actions
        setFilters: (newFilters) =>
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          })),
        resetFilters: () => set({ filters: initialFilters }),

        // UI actions
        toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        // User instruction actions
        addUserInstruction: (instruction) => {
          // Add user instruction logic here
          console.log('Adding user instruction:', instruction);
        },
        updateUserInstruction: (instruction) => {
          // Update user instruction logic here
          console.log('Updating user instruction:', instruction);
        },

        // Utility functions
        getAgentById: (id) => get().agents.find((agent) => agent.id === id),
        getTaskById: (id) => get().tasks.find((task) => task.id === id),
        
        getFilteredLogs: () => {
          const { logs, filters } = get();
          return logs.filter((log) => {
            // Filter by level
            if (filters.logLevel.length > 0 && !filters.logLevel.includes(log.level)) {
              return false;
            }
            
            // Filter by date range
            if (log.timestamp < filters.dateRange.start || log.timestamp > filters.dateRange.end) {
              return false;
            }
            
            // Filter by search query
            if (filters.searchQuery && !log.message.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
              return false;
            }
            
            return true;
          });
        },
        
        getFilteredTasks: () => {
          const { tasks, filters } = get();
          return tasks.filter((task) => {
            // Filter by status
            if (filters.taskStatus.length > 0 && !filters.taskStatus.includes(task.status)) {
              return false;
            }
            
            // Filter by search query
            if (filters.searchQuery && 
                !task.title.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
                !task.description.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
              return false;
            }
            
            return true;
          });
        },
        
        getFilteredAgents: () => {
          const { agents, filters } = get();
          return agents.filter((agent) => {
            // Filter by status
            if (filters.agentStatus.length > 0 && !filters.agentStatus.includes(agent.status)) {
              return false;
            }
            
            // Filter by search query
            if (filters.searchQuery && !agent.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
              return false;
            }
            
            return true;
          });
        },
      }),
      {
        name: 'dashboard-storage',
        partialize: (state) => ({
          darkMode: state.darkMode,
          sidebarOpen: state.sidebarOpen,
          filters: state.filters,
        }),
      }
    ),
    { name: 'dashboard-store' }
  )
);