import React, { useMemo } from 'react';
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
import { Line } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../../store';
import { ChartBarIcon } from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Mock data for development
const mockChartData = {
  labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
  datasets: [
    {
      label: 'Tasks Completed',
      data: [12, 19, 24, 31, 38, 42, 45],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
    },
    {
      label: 'Tasks Failed',
      data: [1, 2, 2, 3, 4, 5, 6],
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.4,
    },
  ],
};

interface TaskCompletionChartProps {
  height?: number;
  showLegend?: boolean;
}

const TaskCompletionChart: React.FC<TaskCompletionChartProps> = ({
  height = 300,
  showLegend = true
}) => {
  const { tasks } = useDashboardStore();

  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: 'rgb(107, 114, 128)', // gray-500
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
          color: 'rgb(107, 114, 128)',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Tasks',
          color: 'rgb(107, 114, 128)',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
          beginAtZero: true,
        },
      },
    },
  }), [showLegend]);

  // Use real data if available, otherwise use mock data
  const chartData = tasks.length > 0 ? mockChartData : mockChartData; // TODO: Process real data

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <ChartBarIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Task Completion Trends
          </h3>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Last 24 hours
        </div>
      </div>

      <div style={{ height: `${height}px` }}>
        <Line options={chartOptions} data={chartData} />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {mockChartData.datasets[0].data[mockChartData.datasets[0].data.length - 1]}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Completed Today
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {mockChartData.datasets[1].data[mockChartData.datasets[1].data.length - 1]}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Failed Today
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {(
              (mockChartData.datasets[0].data[mockChartData.datasets[0].data.length - 1] / 
              (mockChartData.datasets[0].data[mockChartData.datasets[0].data.length - 1] + 
               mockChartData.datasets[1].data[mockChartData.datasets[1].data.length - 1])) * 100
            ).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Success Rate
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskCompletionChart;