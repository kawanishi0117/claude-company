import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListBulletIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useDashboardStore } from '../../store';
import { Task, TaskStatus } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

const mockTasks: Task[] = [
  {
    id: 'task-001',
    title: 'Implement user authentication',
    description: 'Create secure login and registration system with JWT tokens',
    priority: 8,
    status: 'in_progress',
    assignedTo: 'sub-001',
    dependencies: [],
    createdAt: new Date(Date.now() - 30 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    tags: ['authentication', 'security', 'backend']
  },
  {
    id: 'task-002',
    title: 'Design responsive dashboard layout',
    description: 'Create mobile-first responsive design for the admin dashboard',
    priority: 6,
    status: 'completed',
    assignedTo: 'sub-002',
    dependencies: [],
    createdAt: new Date(Date.now() - 120 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000),
    completedAt: new Date(Date.now() - 15 * 60 * 1000),
    estimatedDuration: 180,
    actualDuration: 165,
    tags: ['frontend', 'design', 'responsive']
  },
  {
    id: 'task-003',
    title: 'Optimize database queries',
    description: 'Improve query performance for user data retrieval',
    priority: 7,
    status: 'pending',
    dependencies: ['task-001'],
    createdAt: new Date(Date.now() - 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 60 * 60 * 1000),
    estimatedDuration: 90,
    tags: ['database', 'performance', 'backend']
  },
  {
    id: 'task-004',
    title: 'Write unit tests for API endpoints',
    description: 'Create comprehensive test suite for REST API endpoints',
    priority: 5,
    status: 'failed',
    assignedTo: 'sub-003',
    dependencies: ['task-001'],
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000),
    tags: ['testing', 'api', 'quality-assurance']
  },
  {
    id: 'task-005',
    title: 'Update documentation',
    description: 'Update API documentation with latest endpoint changes',
    priority: 3,
    status: 'cancelled',
    dependencies: [],
    createdAt: new Date(Date.now() - 180 * 60 * 1000),
    updatedAt: new Date(Date.now() - 90 * 60 * 1000),
    tags: ['documentation', 'api']
  }
];

const statusConfig = {
  pending: {
    icon: ClockIcon,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'Pending'
  },
  in_progress: {
    icon: ArrowPathIcon,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'In Progress'
  },
  completed: {
    icon: CheckCircleIcon,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    label: 'Completed'
  },
  failed: {
    icon: ExclamationCircleIcon,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'Failed'
  },
  cancelled: {
    icon: XCircleIcon,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-900/20',
    border: 'border-gray-200 dark:border-gray-800',
    label: 'Cancelled'
  }
};

const TaskList: React.FC = () => {
  const { tasks, getFilteredTasks, agents, getAgentById } = useDashboardStore();
  const [localFilter, setLocalFilter] = useState<TaskStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Use mock data for development
  const displayTasks = tasks.length > 0 ? getFilteredTasks() : mockTasks;
  
  // Apply local filters
  const filteredTasks = displayTasks.filter(task => {
    if (localFilter !== 'all' && task.status !== localFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600 dark:text-red-400';
    if (priority >= 6) return 'text-orange-600 dark:text-orange-400';
    if (priority >= 4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 8) return 'High';
    if (priority >= 6) return 'Medium';
    if (priority >= 4) return 'Normal';
    return 'Low';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ListBulletIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Tasks ({filteredTasks.length})
            </h3>
          </div>
          
          {/* Filter controls */}
          <div className="flex items-center space-x-2">
            {/* Status filter */}
            <select
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value as TaskStatus | 'all')}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <FunnelIcon className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Task list */}
      <div className="max-h-96 overflow-y-auto">
        <AnimatePresence>
          {filteredTasks.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <ListBulletIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No tasks found
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery || localFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Tasks will appear here when created'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTasks.map((task) => {
                const config = statusConfig[task.status];
                const StatusIcon = config.icon;
                const assignedAgent = task.assignedTo ? getAgentById(task.assignedTo) : null;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start space-x-3">
                      
                      {/* Status icon */}
                      <div className={clsx(
                        'flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0',
                        config.bg
                      )}>
                        <StatusIcon className={clsx('w-4 h-4', config.color)} />
                      </div>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                              {task.title}
                            </h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          </div>

                          {/* Priority badge */}
                          <span className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-2 flex-shrink-0',
                            getPriorityColor(task.priority)
                          )}>
                            {getPriorityLabel(task.priority)}
                          </span>
                        </div>

                        {/* Meta information */}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            
                            {/* Assigned agent */}
                            {assignedAgent && (
                              <span className="flex items-center space-x-1">
                                <span>Assigned to:</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {assignedAgent.name}
                                </span>
                              </span>
                            )}

                            {/* Time info */}
                            <span>
                              {task.status === 'completed' && task.completedAt
                                ? `Completed ${formatDistanceToNow(task.completedAt, { addSuffix: true })}`
                                : `Created ${formatDistanceToNow(task.createdAt, { addSuffix: true })}`
                              }
                            </span>

                            {/* Duration info */}
                            {task.estimatedDuration && (
                              <span>
                                Est: {Math.round(task.estimatedDuration / 60)}min
                                {task.actualDuration && (
                                  <span className="ml-1">
                                    (Actual: {Math.round(task.actualDuration / 60)}min)
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Status badge */}
                          <span className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                            config.bg,
                            config.color
                          )}>
                            {config.label}
                          </span>
                        </div>

                        {/* Tags */}
                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {task.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                              >
                                {tag}
                              </span>
                            ))}
                            {task.tags.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{task.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Progress indicator for in-progress tasks */}
                        {task.status === 'in_progress' && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                              <motion.div
                                className="bg-blue-500 h-1 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: '60%' }} // Mock progress
                                transition={{ duration: 1, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default TaskList;