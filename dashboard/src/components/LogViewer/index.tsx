import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentTextIcon,
  FunnelIcon,
  ArrowDownIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  BugAntIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useDashboardStore } from '../../store';
import { LogEntry, LogLevel } from '../../types';
import { formatDistanceToNow, format } from 'date-fns';
import { useWebSocket } from '../../services/websocket';
import clsx from 'clsx';

// Mock log data for development
const mockLogs: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    level: 'info',
    source: 'BossController',
    message: 'Task decomposition completed successfully for instruction: create-user-auth',
    agentId: 'boss-001',
    taskId: 'task-001',
    metadata: { 
      instruction: 'create-user-auth', 
      tasksCreated: 3,
      estimatedDuration: 180 
    }
  },
  {
    id: 'log-002',
    timestamp: new Date(Date.now() - 8 * 60 * 1000),
    level: 'warn',
    source: 'SubordinateController',
    message: 'Task execution took longer than expected',
    agentId: 'sub-001',
    taskId: 'task-002',
    metadata: { 
      expectedDuration: 120,
      actualDuration: 185,
      performance: 'degraded' 
    }
  },
  {
    id: 'log-003',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    level: 'error',
    source: 'ClaudeCommandExecutor',
    message: 'Claude Code CLI command failed: timeout after 30000ms',
    agentId: 'sub-003',
    taskId: 'task-004',
    metadata: { 
      command: 'claude -p "write unit tests"',
      timeout: 30000,
      exitCode: null 
    }
  },
  {
    id: 'log-004',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    level: 'debug',
    source: 'TaskQueue',
    message: 'New task added to queue with priority 8',
    taskId: 'task-005',
    metadata: { 
      queueLength: 12,
      priority: 8,
      estimatedWaitTime: 45 
    }
  },
  {
    id: 'log-005',
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    level: 'info',
    source: 'GitManager',
    message: 'Auto-commit completed successfully',
    agentId: 'sub-002',
    taskId: 'task-002',
    metadata: { 
      files: ['src/components/Dashboard.tsx', 'src/styles/dashboard.css'],
      commitHash: 'a1b2c3d4',
      branch: 'feature/dashboard-update' 
    }
  },
  {
    id: 'log-006',
    timestamp: new Date(Date.now() - 22 * 60 * 1000),
    level: 'error',
    source: 'RedisConnection',
    message: 'Failed to connect to Redis server: ECONNREFUSED',
    metadata: { 
      host: 'localhost',
      port: 6379,
      retryAttempt: 3 
    }
  }
];

const logLevelConfig = {
  debug: {
    icon: BugAntIcon,
    color: 'text-gray-600 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    label: 'DEBUG'
  },
  info: {
    icon: InformationCircleIcon,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'INFO'
  },
  warn: {
    icon: ExclamationTriangleIcon,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    label: 'WARN'
  },
  error: {
    icon: ExclamationCircleIcon,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    label: 'ERROR'
  }
};

const LogViewer: React.FC = () => {
  const { logs, getFilteredLogs, agents, getAgentById } = useDashboardStore();
  const { subscribeToLogs, unsubscribeFromLogs } = useWebSocket();
  
  const [localFilter, setLocalFilter] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Use mock data for development
  const displayLogs = logs.length > 0 ? getFilteredLogs() : mockLogs;

  // Apply local filters
  const filteredLogs = displayLogs.filter(log => {
    if (localFilter !== 'all' && log.level !== localFilter) return false;
    if (searchQuery && 
        !log.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.source.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Subscribe to log updates
  useEffect(() => {
    subscribeToLogs();
    return () => unsubscribeFromLogs();
  }, [subscribeToLogs, unsubscribeFromLogs]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const scrollToBottom = () => {
    setAutoScroll(true);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const getLogCount = (level: LogLevel) => {
    return displayLogs.filter(log => log.level === level).length;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-96 flex flex-col">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              System Logs ({filteredLogs.length})
            </h3>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={clsx(
                'p-1 rounded text-xs font-medium transition-colors',
                autoScroll
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              Auto-scroll
            </button>

            {/* Scroll to bottom */}
            {!autoScroll && (
              <button
                onClick={scrollToBottom}
                className="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowDownIcon className="w-4 h-4" />
              </button>
            )}

            {/* Refresh */}
            <button
              className="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3">
          {/* Level filter */}
          <select
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value as LogLevel | 'all')}
            className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug ({getLogCount('debug')})</option>
            <option value="info">Info ({getLogCount('info')})</option>
            <option value="warn">Warn ({getLogCount('warn')})</option>
            <option value="error">Error ({getLogCount('error')})</option>
          </select>

          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-3 w-3 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-7 pr-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Log entries */}
      <div 
        ref={logContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs"
      >
        <AnimatePresence>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No logs found
              </h4>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery || localFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Logs will appear here as the system runs'}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const config = logLevelConfig[log.level];
              const LevelIcon = config.icon;
              const isExpanded = expandedLog === log.id;
              const agent = log.agentId ? getAgentById(log.agentId) : null;

              return (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={clsx(
                    'border rounded-lg p-3 transition-colors cursor-pointer hover:shadow-sm',
                    config.bg,
                    config.border,
                    isExpanded && 'ring-2 ring-primary-500 ring-opacity-20'
                  )}
                  onClick={() => toggleLogExpansion(log.id)}
                >
                  <div className="flex items-start space-x-2">
                    
                    {/* Level icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <LevelIcon className={clsx('w-3 h-3', config.color)} />
                    </div>

                    {/* Log content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={clsx('text-xs font-bold', config.color)}>
                          {config.label}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {format(log.timestamp, 'HH:mm:ss')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">
                          [{log.source}]
                        </span>
                        {agent && (
                          <span className="text-primary-600 dark:text-primary-400">
                            {agent.name}
                          </span>
                        )}
                      </div>

                      <p className="text-gray-900 dark:text-white break-words">
                        {log.message}
                      </p>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600"
                          >
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
                                <span className="ml-2 text-gray-900 dark:text-white">
                                  {format(log.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                                </span>
                              </div>
                              
                              {log.taskId && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Task ID:</span>
                                  <span className="ml-2 text-gray-900 dark:text-white">
                                    {log.taskId}
                                  </span>
                                </div>
                              )}

                              {log.agentId && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Agent ID:</span>
                                  <span className="ml-2 text-gray-900 dark:text-white">
                                    {log.agentId}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Metadata */}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="mt-2">
                                <span className="text-gray-500 dark:text-gray-400 text-xs">Metadata:</span>
                                <div className="mt-1 bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">
                                  <pre className="whitespace-pre-wrap text-gray-900 dark:text-white">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Time ago */}
                    <div className="flex-shrink-0 text-right">
                      <span className="text-gray-400 text-xs">
                        {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>

        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogViewer;