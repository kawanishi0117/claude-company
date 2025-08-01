import React, { useState } from 'react';
import { 
  Bars3Icon, 
  MoonIcon, 
  SunIcon,
  BellIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useDashboardStore } from '../../store';
import { useWebSocket } from '../../services/websocket';

const Header: React.FC = () => {
  const { 
    darkMode, 
    toggleDarkMode, 
    toggleSidebar, 
    systemStats,
    filters,
    setFilters 
  } = useDashboardStore();
  
  const { isConnected } = useWebSocket();
  const [searchQuery, setSearchQuery] =useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setFilters({ searchQuery: query });
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle button */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Claude Company System
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                AI Agent Management Dashboard
              </p>
            </div>
          </div>

          {/* Center section - Search */}
          <div className="flex-1 max-w-lg mx-8">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search agents, tasks, logs..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            
            {/* System status */}
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-gray-500 dark:text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* System stats */}
            <div className="hidden lg:flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <span>
                Agents: <span className="text-gray-900 dark:text-white font-medium">
                  {systemStats.activeAgents}/{systemStats.totalAgents}
                </span>
              </span>
              <span>
                Tasks: <span className="text-gray-900 dark:text-white font-medium">
                  {systemStats.activeTasks}
                </span>
              </span>
              <span>
                CPU: <span className="text-gray-900 dark:text-white font-medium">
                  {systemStats.cpuUsage.toFixed(1)}%
                </span>
              </span>
            </div>

            {/* Notifications */}
            <button className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 relative">
              <BellIcon className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white dark:ring-gray-800" />
            </button>

            {/* Settings */}
            <button className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
              <Cog6ToothIcon className="h-5 w-5" />
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;