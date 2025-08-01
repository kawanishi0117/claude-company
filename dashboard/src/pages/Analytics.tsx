import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  CpuChipIcon,
  FolderIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  TaskCompletionChart,
  AgentPerformanceChart,
  SystemResourceChart,
  ProjectProgressChart
} from '../components/Charts';

const Analytics: React.FC = () => {
  const [selectedMetric, setSelectedMetric] = useState<'successRate' | 'tasksCompleted' | 'averageExecutionTime'>('successRate');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const metricOptions = [
    { value: 'successRate', label: 'Success Rate', icon: ChartBarIcon },
    { value: 'tasksCompleted', label: 'Tasks Completed', icon: ClockIcon },
    { value: 'averageExecutionTime', label: 'Execution Time', icon: CpuChipIcon },
  ] as const;

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detailed insights into system performance and agent metrics
          </p>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`-ml-1 mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Task Completion Trends */}
      <TaskCompletionChart height={350} />

      {/* Agent Performance and System Resources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Agent Performance Chart */}
        <div className="space-y-4">
          {/* Metric Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Performance Metric
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {metricOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => setSelectedMetric(option.value)}
                    className={`flex flex-col items-center p-3 rounded-lg text-xs font-medium transition-colors ${
                      selectedMetric === option.value
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 mb-1" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          
          <AgentPerformanceChart height={300} metric={selectedMetric} />
        </div>

        {/* System Resources */}
        <div className="space-y-4">
          <SystemResourceChart height={200} resource="cpu" />
          <SystemResourceChart height={200} resource="memory" />
        </div>
      </div>

      {/* Project Progress */}
      <ProjectProgressChart height={350} />

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Performance Insights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <ChartBarIcon className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Performance Insights
            </h3>
          </div>
          
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                High Success Rate
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                System maintaining 91.2% average success rate across all agents
              </div>
            </div>
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Optimal Load Distribution
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Tasks are evenly distributed among available subordinate agents
              </div>
            </div>
            
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Memory Usage Rising
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                Consider scaling resources if usage exceeds 80%
              </div>
            </div>
          </div>
        </motion.div>

        {/* Resource Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <CpuChipIcon className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Resource Recommendations
            </h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  CPU Usage Normal
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Current usage at 34.2% - within optimal range
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Monitor Memory
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Current usage at 56.7% - approaching threshold
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Scale Subordinates
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Consider adding 1-2 more agents for better load distribution
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center space-x-3 mb-4">
            <FolderIcon className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Health
            </h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">24h 0m</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Error Rate</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">2.1%</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">1.2s</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Queue Length</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">12</span>
            </div>
            
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse-slow"></div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  System Healthy
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;