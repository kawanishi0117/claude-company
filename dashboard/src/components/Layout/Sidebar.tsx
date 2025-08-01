import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon,
  UserGroupIcon,
  ListBulletIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useDashboardStore } from '../../store';
import clsx from 'clsx';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count?: number;
}

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { 
    sidebarOpen, 
    toggleSidebar, 
    systemStats,
    tasks,
    agents,
    logs
  } = useDashboardStore();

  const navigation: NavigationItem[] = [
    { 
      name: 'Dashboard', 
      href: '/', 
      icon: HomeIcon, 
      count: systemStats.activeTasks
    },
    { 
      name: 'Analytics', 
      href: '/analytics', 
      icon: ChartBarIcon 
    },
    { 
      name: 'AI Agents', 
      href: '#agents', 
      icon: UserGroupIcon, 
      count: agents.length 
    },
    { 
      name: 'Tasks', 
      href: '#tasks', 
      icon: ListBulletIcon, 
      count: systemStats.activeTasks 
    },
    { 
      name: 'Projects', 
      href: '#projects', 
      icon: FolderIcon, 
      count: 0 
    },
    { 
      name: 'Logs', 
      href: '#logs', 
      icon: DocumentTextIcon, 
      count: logs.length 
    },
  ];

  const errorCount = logs.filter(log => log.level === 'error').length;

  return (
    <>
      {/* Desktop sidebar */}
      <div className={clsx(
        'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0',
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700'
      )}>
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Logo section */}
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-600 dark:bg-primary-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-sm">CC</span>
                </div>
              </div>
              <div className="ml-3">
                <h2 className="text-white font-semibold text-sm">
                  Claude Company
                </h2>
                <p className="text-primary-200 text-xs">
                  AI System
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = item.href.startsWith('/') ? location.pathname === item.href : false;
              const isHashLink = item.href.startsWith('#');
              
              const linkContent = (
                <>
                  <item.icon 
                    className={clsx(
                      'mr-3 flex-shrink-0 h-5 w-5',
                      isActive
                        ? 'text-primary-500 dark:text-primary-400'
                        : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                    )}
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.count !== undefined && (
                    <span className={clsx(
                      'ml-3 inline-block py-0.5 px-2 text-xs rounded-full',
                      isActive
                        ? 'bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    )}>
                      {item.count}
                    </span>
                  )}
                </>
              );
              
              const className = clsx(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                isActive
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              );

              return isHashLink ? (
                <a
                  key={item.name}
                  href={item.href}
                  className={className}
                >
                  {linkContent}
                </a>
              ) : (
                <Link
                  key={item.name}
                  to={item.href}
                  className={className}
                >
                  {linkContent}
                </Link>
              );
            })}
          </nav>

          {/* System status section */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-3">
              
              {/* Error alerts */}
              {errorCount > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        {errorCount} Error{errorCount > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400">
                        Check logs for details
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* System metrics */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Memory</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {systemStats.memoryUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                    <div 
                      className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(systemStats.memoryUsage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Uptime */}
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Uptime: {Math.floor(systemStats.systemUptime / 3600)}h {Math.floor((systemStats.systemUptime % 3600) / 60)}m
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar */}
      <div className={clsx(
        'lg:hidden fixed inset-0 flex z-50',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800">
          
          {/* Close button */}
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              onClick={toggleSidebar}
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>

          {/* Mobile navigation content - same as desktop */}
          <div className="flex-1 flex flex-col min-h-0">
            
            {/* Logo section */}
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-primary-600 dark:bg-primary-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                    <span className="text-primary-600 font-bold text-sm">CC</span>
                  </div>
                </div>
                <div className="ml-3">
                  <h2 className="text-white font-semibold text-sm">
                    Claude Company
                  </h2>
                  <p className="text-primary-200 text-xs">
                    AI System
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const isActive = item.href.startsWith('/') ? location.pathname === item.href : false;
                const isHashLink = item.href.startsWith('#');
                
                const linkContent = (
                  <>
                    <item.icon 
                      className={clsx(
                        'mr-3 flex-shrink-0 h-5 w-5',
                        isActive
                          ? 'text-primary-500 dark:text-primary-400'
                          : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                      )}
                    />
                    <span className="flex-1">{item.name}</span>
                    {item.count !== undefined && (
                      <span className={clsx(
                        'ml-3 inline-block py-0.5 px-2 text-xs rounded-full',
                        isActive
                          ? 'bg-primary-200 dark:bg-primary-800 text-primary-800 dark:text-primary-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      )}>
                        {item.count}
                      </span>
                    )}
                  </>
                );
                
                const className = clsx(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200',
                  isActive
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                );

                return isHashLink ? (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={toggleSidebar}
                    className={className}
                  >
                    {linkContent}
                  </a>
                ) : (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={toggleSidebar}
                    className={className}
                  >
                    {linkContent}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;