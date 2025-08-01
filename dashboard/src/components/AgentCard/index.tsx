import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Agent, AgentStatus } from '../../types';
import { useDashboardStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';

interface AgentCardProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
}

const statusConfig = {
  idle: {
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-800 dark:text-gray-200',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: PauseIcon,
    label: 'Idle'
  },
  working: {
    color: 'blue',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    textColor: 'text-blue-800 dark:text-blue-200',
    borderColor: 'border-blue-200 dark:border-blue-700',
    icon: PlayIcon,
    label: 'Working'
  },
  error: {
    color: 'red',
    bgColor: 'bg-red-100 dark:bg-red-900',
    textColor: 'text-red-800 dark:text-red-200',
    borderColor: 'border-red-200 dark:border-red-700',
    icon: ExclamationCircleIcon,
    label: 'Error'
  },
  offline: {
    color: 'gray',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-800 dark:text-gray-200',
    borderColor: 'border-gray-300 dark:border-gray-600',
    icon: ArrowPathIcon,
    label: 'Offline'
  }
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { setSelectedAgent } = useDashboardStore();
  
  const config = statusConfig[agent.status];
  const StatusIcon = config.icon;

  const handleClick = () => {
    setSelectedAgent(agent);
    onClick?.(agent);
  };

  const progressPercentage = agent.currentTask 
    ? Math.min((agent.performance.tasksCompleted / (agent.performance.tasksCompleted + 1)) * 100, 100)
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleClick}
      className={clsx(
        'relative overflow-hidden rounded-lg border-2 transition-all duration-200 cursor-pointer',
        'bg-white dark:bg-gray-800 shadow-sm hover:shadow-md',
        config.borderColor,
        isHovered && 'shadow-lg ring-2 ring-primary-500 ring-opacity-20'
      )}
    >
      {/* Status indicator stripe */}
      <div className={clsx(
        'absolute top-0 left-0 right-0 h-1',
        agent.status === 'working' && 'bg-blue-500',
        agent.status === 'idle' && 'bg-gray-400',
        agent.status === 'error' && 'bg-red-500',
        agent.status === 'offline' && 'bg-gray-300'
      )} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={clsx(
              'flex items-center justify-center w-10 h-10 rounded-full',
              config.bgColor
            )}>
              <StatusIcon className={clsx('w-5 h-5', config.textColor)} />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                {agent.type} Agent
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span className={clsx(
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            config.bgColor,
            config.textColor
          )}>
            {config.label}
          </span>
        </div>

        {/* Current task or status */}
        <div className="mb-4">
          {agent.currentTask ? (
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Current Task
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                {agent.currentTask.title}
              </p>
              
              {/* Progress bar */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Progress</span>
                  <span>{progressPercentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <motion.div 
                    className="bg-primary-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {agent.status === 'idle' ? 'Waiting for tasks...' : 
                 agent.status === 'error' ? 'Agent encountered an error' :
                 'Agent is offline'}
              </p>
            </div>
          )}
        </div>

        {/* Performance metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.performance.tasksCompleted}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Completed
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <ClockIcon className="w-4 h-4 text-blue-500" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {agent.performance.successRate.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Success Rate
            </p>
          </div>
        </div>

        {/* Resource usage */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center space-x-1">
              <CpuChipIcon className="w-3 h-3" />
              <span>CPU</span>
            </span>
            <span>{agent.performance.cpuUsage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div 
              className="bg-yellow-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(agent.performance.cpuUsage, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Memory</span>
            <span>{agent.performance.memoryUsage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div 
              className="bg-purple-500 h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(agent.performance.memoryUsage, 100)}%` }}
            />
          </div>
        </div>

        {/* Last activity */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Last active: {formatDistanceToNow(agent.lastActivity, { addSuffix: true })}
          </p>
        </div>

        {/* Animated pulse for working status */}
        {agent.status === 'working' && (
          <motion.div
            className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full"
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      {/* Hover overlay */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-primary-500 bg-opacity-5 pointer-events-none"
        />
      )}
    </motion.div>
  );
};

export default AgentCard;