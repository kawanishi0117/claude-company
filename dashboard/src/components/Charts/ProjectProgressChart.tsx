import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../../store';
import { FolderIcon } from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ProjectProgressChartProps {
  height?: number;
}

const ProjectProgressChart: React.FC<ProjectProgressChartProps> = ({
  height = 300
}) => {
  const { projects, tasks } = useDashboardStore();

  const chartData = useMemo(() => {
    // Mock project data for development
    const mockProjects = [
      { id: '1', name: 'User Authentication', totalTasks: 8, completedTasks: 6, progress: 75 },
      { id: '2', name: 'Dashboard UI', totalTasks: 12, completedTasks: 9, progress: 75 },
      { id: '3', name: 'API Development', totalTasks: 15, completedTasks: 11, progress: 73 },
      { id: '4', name: 'Testing Suite', totalTasks: 6, completedTasks: 2, progress: 33 },
      { id: '5', name: 'Documentation', totalTasks: 4, completedTasks: 1, progress: 25 },
    ];

    const projectData = projects.length > 0 ? projects : mockProjects;

    return {
      labels: projectData.map(p => p.name),
      datasets: [
        {
          label: 'Completed Tasks',
          data: projectData.map(p => p.completedTasks || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.6)',
          borderColor: 'rgb(34, 197, 94)',
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: 'Remaining Tasks',
          data: projectData.map(p => (p.totalTasks || 0) - (p.completedTasks || 0)),
          backgroundColor: 'rgba(229, 231, 235, 0.6)',
          borderColor: 'rgb(229, 231, 235)',
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    };
  }, [projects, tasks]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: 'rgb(107, 114, 128)',
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        callbacks: {
          footer: (tooltipItems) => {
            const dataIndex = tooltipItems[0].dataIndex;
            const completed = chartData.datasets[0].data[dataIndex] as number;
            const remaining = chartData.datasets[1].data[dataIndex] as number;
            const total = completed + remaining;
            const progress = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
            return `Progress: ${progress}%`;
          },
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        stacked: true,
        display: true,
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
          maxRotation: 45,
        },
      },
      y: {
        stacked: true,
        display: true,
        title: {
          display: true,
          text: 'Number of Tasks',
          color: 'rgb(107, 114, 128)',
        },
        grid: {
          color: 'rgba(107, 114, 128, 0.1)',
        },
        ticks: {
          color: 'rgb(107, 114, 128)',
          beginAtZero: true,
          stepSize: 1,
        },
      },
    },
  }), [chartData]);

  // Calculate overall statistics
  const totalTasks = chartData.datasets[0].data.reduce((sum, val) => sum + (val as number), 0) +
                    chartData.datasets[1].data.reduce((sum, val) => sum + (val as number), 0);
  const completedTasks = chartData.datasets[0].data.reduce((sum, val) => sum + (val as number), 0);
  const overallProgress = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <FolderIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Project Progress
          </h3>
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {chartData.labels.length} Projects
        </div>
      </div>

      <div style={{ height: `${height}px` }}>
        <Bar options={chartOptions} data={chartData} />
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {completedTasks}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tasks Completed
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {totalTasks - completedTasks}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tasks Remaining
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {overallProgress}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Overall Progress
          </div>
        </div>
      </div>

      {/* Progress bars for each project */}
      <div className="mt-4 space-y-2">
        {chartData.labels.slice(0, 3).map((label, index) => {
          const completed = chartData.datasets[0].data[index] as number;
          const remaining = chartData.datasets[1].data[index] as number;
          const total = completed + remaining;
          const progress = total > 0 ? (completed / total) * 100 : 0;
          
          return (
            <div key={label} className="flex items-center space-x-3">
              <div className="w-20 text-xs text-gray-600 dark:text-gray-400 truncate">
                {label}
              </div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <motion.div
                  className="bg-green-500 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-white w-10 text-right">
                {progress.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ProjectProgressChart;