import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from '../store';
import { useWebSocket } from '../services/websocket';
import { api } from '../services/api';
import AgentCard from '../components/AgentCard';
import AgentDetailModal from '../components/AgentDetailModal';
import StatsCard from '../components/StatsCard';
import UserInstructionForm from '../components/UserInstructionForm';
import TaskList from '../components/TaskList';
import LogViewer from '../components/LogViewer';
import { 
  Agent, 
  Task, 
  LogEntry, 
  SystemStats,
  AgentStatus 
} from '../types';

// Mock data for development
const mockAgents: Agent[] = [
  {
    id: 'boss-001',
    name: 'Boss AI Controller',
    type: 'boss',
    status: 'working',
    lastActivity: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    performance: {
      tasksCompleted: 45,
      tasksFailed: 3,
      successRate: 94.2,
      averageExecutionTime: 1200,
      memoryUsage: 68.5,
      cpuUsage: 23.1,
      errorCount: 2
    },
    capabilities: ['Task Management', 'Code Review', 'Project Planning'],
    configuration: {
      maxConcurrentTasks: 10,
      timeout: 300000,
      retryAttempts: 3,
      workspacePath: '/workspace'
    },
    currentTask: {
      id: 'task-001',
      title: 'Reviewing subordinate work results',
      description: 'Analyzing code changes and test results from subordinate agents',
      priority: 8,
      status: 'in_progress',
      assignedTo: 'boss-001',
      dependencies: [],
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      tags: ['review', 'management']
    }
  },
  {
    id: 'sub-001',
    name: 'Subordinate AI #1',
    type: 'subordinate',
    status: 'working',
    lastActivity: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    performance: {
      tasksCompleted: 28,
      tasksFailed: 2,
      successRate: 89.3,
      averageExecutionTime: 1800,
      memoryUsage: 45.2,
      cpuUsage: 67.8,
      errorCount: 1
    },
    capabilities: ['Frontend Development', 'Testing', 'Documentation'],
    configuration: {
      maxConcurrentTasks: 3,
      timeout: 600000,
      retryAttempts: 2,
      workspacePath: '/workspace/sub-001'
    },
    currentTask: {
      id: 'task-002',
      title: 'Implementing React dashboard components',
      description: 'Creating responsive UI components for the AI agent dashboard',
      priority: 7,
      status: 'in_progress',
      assignedTo: 'sub-001',
      dependencies: ['task-003'],
      createdAt: new Date(Date.now() - 120 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 1000),
      tags: ['frontend', 'react', 'ui']
    }
  },
  {
    id: 'sub-002',
    name: 'Subordinate AI #2',
    type: 'subordinate',
    status: 'idle',
    lastActivity: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    performance: {
      tasksCompleted: 33,
      tasksFailed: 1,
      successRate: 91.8,
      averageExecutionTime: 1500,
      memoryUsage: 32.1,
      cpuUsage: 12.5,
      errorCount: 0
    },
    capabilities: ['Backend Development', 'Database Management', 'API Design'],
    configuration: {
      maxConcurrentTasks: 5,
      timeout: 450000,
      retryAttempts: 3,
      workspacePath: '/workspace/sub-002'
    }
  },
  {
    id: 'sub-003',
    name: 'Subordinate AI #3',
    type: 'subordinate',
    status: 'error',
    lastActivity: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
    performance: {
      tasksCompleted: 19,
      tasksFailed: 5,
      successRate: 84.2,
      averageExecutionTime: 2100,
      memoryUsage: 78.9,
      cpuUsage: 15.3,
      errorCount: 4
    },
    capabilities: ['Testing', 'Quality Assurance', 'Performance Optimization'],
    configuration: {
      maxConcurrentTasks: 2,
      timeout: 300000,
      retryAttempts: 1,
      workspacePath: '/workspace/sub-003'
    }
  }
];

const mockSystemStats: SystemStats = {
  totalAgents: 4,
  activeAgents: 3,
  totalTasks: 128,
  activeTasks: 12,
  completedTasks: 98,
  failedTasks: 18,
  systemUptime: 86400, // 24 hours in seconds
  memoryUsage: 56.7,
  cpuUsage: 34.2
};

const Dashboard: React.FC = () => {
  const {
    agents,
    setAgents,
    systemStats,
    setSystemStats,
    selectedAgent,
    setSelectedAgent,
    getFilteredAgents
  } = useDashboardStore();
  
  const { isConnected } = useWebSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize dashboard data
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        
        // In development, use mock data
        if (process.env.NODE_ENV === 'development') {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
          setAgents(mockAgents);
          setSystemStats(mockSystemStats);
        } else {
          // In production, fetch real data
          const [agentsData, statsData] = await Promise.all([
            api.agents.getAll(),
            api.system.getStats()
          ]);
          
          setAgents(agentsData);
          setSystemStats(statsData);
        }
      } catch (err) {
        console.error('Failed to initialize dashboard:', err);
        setError('Failed to load dashboard data');
        
        // Fallback to mock data
        setAgents(mockAgents);
        setSystemStats(mockSystemStats);
      } finally {
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [setAgents, setSystemStats]);

  // Filtered agents for display
  const filteredAgents = getFilteredAgents();

  // Handle agent card click
  const handleAgentClick = (agent: Agent) => {
    setSelectedAgent(agent);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
        <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor and manage your AI agent ecosystem
          </p>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-500 animate-pulse-slow' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {isConnected ? 'Real-time updates active' : 'Disconnected from server'}
          </span>
        </div>
      </div>

      {/* System Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Agents"
          value={systemStats.activeAgents}
          total={systemStats.totalAgents}
          icon="agents"
          trend={2}
          color="blue"
        />
        <StatsCard
          title="Active Tasks"
          value={systemStats.activeTasks}
          total={systemStats.totalTasks}
          icon="tasks"
          trend={-1}
          color="green"
        />
        <StatsCard
          title="Success Rate"
          value={`${(systemStats.completedTasks / (systemStats.completedTasks + systemStats.failedTasks) * 100).toFixed(1)}%`}
          icon="success"
          trend={0.5}
          color="emerald"
        />
        <StatsCard
          title="System Load"
          value={`${systemStats.cpuUsage.toFixed(1)}%`}
          icon="cpu"
          trend={-2.1}
          color="purple"
        />
      </div>

      {/* User Instruction Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Submit New Instruction
        </h2>
        <UserInstructionForm />
      </div>

      {/* AI Agents Grid */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            AI Agents ({filteredAgents.length})
          </h2>
          
          {/* Agent status filter */}
          <div className="flex space-x-2">
            {(['idle', 'working', 'error', 'offline'] as AgentStatus[]).map((status) => {
              const count = agents.filter(agent => agent.status === status).length;
              return (
                <span
                  key={status}
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    status === 'idle' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' :
                    status === 'working' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                    status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  }`}
                >
                  {status} ({count})
                </span>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            layout
          >
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={handleAgentClick}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Task List and Log Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <TaskList />
        </div>
        <div>
          <LogViewer />
        </div>
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(undefined)}
        />
      )}
    </div>
  );
};

export default Dashboard;