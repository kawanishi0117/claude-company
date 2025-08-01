import React from 'react';
import { motion } from 'framer-motion';
import { 
  UserGroupIcon,
  ListBulletIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface StatsCardProps {
  title: string;
  value: string | number;
  total?: number;
  icon: 'agents' | 'tasks' | 'success' | 'cpu';
  trend?: number; // Percentage change
  color: 'blue' | 'green' | 'emerald' | 'purple' | 'yellow' | 'red';
  loading?: boolean;
}

const iconMap = {
  agents: UserGroupIcon,
  tasks: ListBulletIcon,
  success: CheckCircleIcon,
  cpu: CpuChipIcon,
};

const colorConfig = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    icon: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    icon: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    icon: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  yellow: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    icon: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
};

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  total,
  icon,
  trend,
  color,
  loading = false
}) => {
  const IconComponent = iconMap[icon];
  const colorClasses = colorConfig[color];

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return MinusIcon;
    return trend > 0 ? ArrowUpIcon : ArrowDownIcon;
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'text-gray-500';
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  const TrendIcon = getTrendIcon();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div className="ml-4 flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-center">
        {/* Icon */}
        <div className={clsx(
          'flex items-center justify-center w-12 h-12 rounded-lg',
          colorClasses.bg
        )}>
          <IconComponent className={clsx('w-6 h-6', colorClasses.icon)} />
        </div>

        {/* Content */}
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
              {value}
            </p>
            
            {total && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                / {total}
              </p>
            )}
          </div>

          {/* Trend indicator */}
          {trend !== undefined && (
            <div className="flex items-center mt-1">
              <TrendIcon className={clsx('w-3 h-3 mr-1', getTrendColor())} />
              <span className={clsx('text-xs font-medium', getTrendColor())}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs last hour</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar for items with totals */}
      {total && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <motion.div
              className={clsx(
                'h-2 rounded-full',
                color === 'blue' && 'bg-blue-500',
                color === 'green' && 'bg-green-500',
                color === 'emerald' && 'bg-emerald-500',
                color === 'purple' && 'bg-purple-500',
                color === 'yellow' && 'bg-yellow-500',
                color === 'red' && 'bg-red-500',
              )}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((Number(value) / total) * 100, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default StatsCard;