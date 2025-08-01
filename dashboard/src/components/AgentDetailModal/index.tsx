import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { Agent, Task, LogEntry } from '../../types';
import { useDashboardStore } from '../../store';
import { useWebSocket } from '../../services/websocket';
import { format, formatDistanceToNow } from 'date-fns';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import clsx from 'clsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AgentDetailModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'overview' | 'performance' | 'history' | 'logs';

const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  agent,
  isOpen,
  onClose
}) => {
  const { tasks, logs, getFilteredLogs } = useDashboardStore();
  const { subscribeToAgent, unsubscribeFromAgent } = useWebSocket();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [performanceData, setPerformanceData] = useState<any[]>([]);

  // Mock performance data for development
  const mockPerformanceData = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000),
    cpuUsage: Math.random() * 80 + 10,
    memoryUsage: Math.random() * 70 + 15,
    tasksCompleted: Math.floor(Math.random() * 5),
  }));

  const agentTasks = tasks.filter(task => task.assignedTo === agent.id);
  const agentLogs = logs.filter(log => log.agentId === agent.id);

  useEffect(() => {
    if (isOpen) {
      subscribeToAgent(agent.id);
      setPerformanceData(mockPerformanceData);
    }
    return () => {
      if (isOpen) {
        unsubscribeFromAgent(agent.id);
      }
    };
  }, [isOpen, agent.id, subscribeToAgent, unsubscribeFromAgent]);

  const handleExportData = () => {
    const exportData = {
      agent,
      tasks: agentTasks,
      logs: agentLogs,
      performance: performanceData,
      exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-${agent.id}-data-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const performanceChartData = {
    labels: performanceData.map(d => format(d.timestamp, 'HH:mm')),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: performanceData.map(d => d.cpuUsage),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Memory Usage (%)',
        data: performanceData.map(d => d.memoryUsage),
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: 'rgb(107, 114, 128)',
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(107, 114, 128, 0.1)' },
        ticks: { color: 'rgb(107, 114, 128)' },
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: { color: 'rgba(107, 114, 128, 0.1)' },
        ticks: { color: 'rgb(107, 114, 128)' },
      },
    },
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: CogIcon },
    { id: 'performance', label: 'Performance', icon: ChartBarIcon },
    { id: 'history', label: 'Task History', icon: ClockIcon },
    { id: 'logs', label: 'Logs', icon: DocumentTextIcon },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:w-full sm:max-w-4xl"
          >
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className={clsx(
                    'flex items-center justify-center w-12 h-12 rounded-full',
                    agent.status === 'working' && 'bg-blue-100 dark:bg-blue-900',
                    agent.status === 'idle' && 'bg-gray-100 dark:bg-gray-800',
                    agent.status === 'error' && 'bg-red-100 dark:bg-red-900',
                    agent.status === 'offline' && 'bg-gray-100 dark:bg-gray-800'
                  )}>
                    <CpuChipIcon className={clsx(
                      'w-6 h-6',
                      agent.status === 'working' && 'text-blue-600 dark:text-blue-400',
                      agent.status === 'idle' && 'text-gray-600 dark:text-gray-400',
                      agent.status === 'error' && 'text-red-600 dark:text-red-400',
                      agent.status === 'offline' && 'text-gray-600 dark:text-gray-400'
                    )} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {agent.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {agent.type} Agent • {agent.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportData}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                    Export
                  </button>
                  
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="mt-4">
                <nav className="flex space-x-8">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as TabType)}
                        className={clsx(
                          'flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm',
                          isActive
                            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Current Status */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Current Status
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {agent.performance.tasksCompleted}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Tasks Completed
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                          {agent.performance.successRate.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Success Rate
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Task */}
                  {agent.currentTask && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Current Task
                      </h4>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h5 className="font-medium text-blue-900 dark:text-blue-100">
                          {agent.currentTask.title}
                        </h5>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {agent.currentTask.description}
                        </p>
                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                          Started: {formatDistanceToNow(agent.currentTask.createdAt, { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resource Usage */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Resource Usage
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300">CPU Usage</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {agent.performance.cpuUsage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(agent.performance.cpuUsage, 100)}%` }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 dark:text-gray-300">Memory Usage</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {agent.performance.memoryUsage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(agent.performance.memoryUsage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Performance Over Time (24 hours)
                    </h4>
                    <div style={{ height: '300px' }}>
                      <Line data={performanceChartData} options={chartOptions} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {agent.performance.averageExecutionTime?.toFixed(0) || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Avg Execution Time (min)
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {agent.performance.tasksCompleted}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Total Tasks
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {agent.performance.tasksFailed || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Failed Tasks
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Task History ({agentTasks.length} tasks)
                  </h4>
                  
                  {agentTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No tasks found for this agent</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {agentTasks.slice(0, 10).map((task) => (
                        <div
                          key={task.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 dark:text-white">
                                {task.title}
                              </h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {task.description}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <span className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                task.status === 'completed' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
                                task.status === 'in_progress' && 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
                                task.status === 'failed' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
                                task.status === 'pending' && 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                              )}>
                                {task.status.replace('_', ' ')}
                              </span>
                              
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {agentTasks.length > 10 && (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                          ... and {agentTasks.length - 10} more tasks
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    Agent Logs ({agentLogs.length} entries)
                  </h4>
                  
                  {agentLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No logs found for this agent</p>
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-xs max-h-64 overflow-y-auto">
                      {agentLogs.slice(0, 20).map((log) => (
                        <div
                          key={log.id}
                          className={clsx(
                            'border rounded p-2',
                            log.level === 'error' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
                            log.level === 'warn' && 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
                            log.level === 'info' && 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
                            log.level === 'debug' && 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                          )}
                        >
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={clsx(
                              'text-xs font-bold',
                              log.level === 'error' && 'text-red-600 dark:text-red-400',
                              log.level === 'warn' && 'text-yellow-600 dark:text-yellow-400',
                              log.level === 'info' && 'text-blue-600 dark:text-blue-400',
                              log.level === 'debug' && 'text-gray-600 dark:text-gray-400'
                            )}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {format(log.timestamp, 'HH:mm:ss')}
                            </span>
                          </div>
                          <p className="text-gray-900 dark:text-white break-words">
                            {log.message}
                          </p>
                        </div>
                      ))}
                      
                      {agentLogs.length > 20 && (
                        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                          ... and {agentLogs.length - 20} more log entries
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default AgentDetailModal;