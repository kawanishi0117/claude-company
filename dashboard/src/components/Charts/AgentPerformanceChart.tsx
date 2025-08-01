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
import { CpuChipIcon } from '@heroicons/react/24/outline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AgentPerformanceChartProps {
  height?: number;
  metric: 'successRate' | 'tasksCompleted' | 'averageExecutionTime';
}

const AgentPerformanceChart: React.FC<AgentPerformanceChartProps> = ({
  height = 300,
  metric = 'successRate'
}) => {
  const { agents } = useDashboardStore();

  const chartData = useMemo(() => {
    const agentNames = agents.map(agent => agent.name);
    const values = agents.map(agent => {
      switch (metric) {
        case 'successRate':
          return agent.performance.successRate;
        case 'tasksCompleted':
          return agent.performance.tasksCompleted;
        case 'averageExecutionTime':
          return Math.round(agent.performance.averageExecutionTime / 60); // Convert to minutes
        default:
          return 0;
      }
    });

    const getColor = (agentType: string, alpha = 1) => {
      if (agentType === 'boss') {
        return `rgba(139, 69, 19, ${alpha})`; // Brown for boss
      }
      return `rgba(59, 130, 246, ${alpha})`; // Blue for subordinates
    };

    return {
      labels: agentNames,
      datasets: [
        {
          label: getMetricLabel(metric),
          data: values,
          backgroundColor: agents.map(agent => getColor(agent.type, 0.6)),
          borderColor: agents.map(agent => getColor(agent.type, 1)),
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    };
  }, [agents, metric]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
          label: (context) => {
            const value = context.parsed.y;
            switch (metric) {
              case 'successRate':
                return `Success Rate: ${value.toFixed(1)}%`;
              case 'tasksCompleted':
                return `Tasks Completed: ${value}`;
              case 'averageExecutionTime':
                return `Avg Time: ${value} min`;
              default:
                return `${value}`;
            }
          },
        },
      },
    },
    scales: {
      x: {
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
        display: true,
        title: {
          display: true,
          text: getMetricUnit(metric),
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
  }), [metric]);

  // Mock data if no agents available
  const mockData = {
    labels: ['Boss AI', 'Sub AI #1', 'Sub AI #2', 'Sub AI #3'],
    datasets: [
      {
        label: getMetricLabel(metric),
        data: metric === 'successRate' ? [94.2, 89.3, 91.8, 84.2] :
              metric === 'tasksCompleted' ? [45, 28, 33, 19] :
              [20, 30, 25, 35], // execution time in minutes
        backgroundColor: [
          'rgba(139, 69, 19, 0.6)',
          'rgba(59, 130, 246, 0.6)',
          'rgba(59, 130, 246, 0.6)',
          'rgba(59, 130, 246, 0.6)',
        ],
        borderColor: [
          'rgba(139, 69, 19, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(59, 130, 246, 1)',
        ],
        borderWidth: 2,
        borderRadius: 4,
      },
    ],
  };

  const displayData = agents.length > 0 ? chartData : mockData;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <CpuChipIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Agent {getMetricLabel(metric)}
          </h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-amber-600 rounded"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Boss</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-xs text-gray-500 dark:text-gray-400">Subordinate</span>
          </div>
        </div>
      </div>

      <div style={{ height: `${height}px` }}>
        <Bar options={chartOptions} data={displayData} />
      </div>

      {/* Performance insights */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Best Performer
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {getBestPerformer(displayData, metric)}
            </div>
          </div>
          
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Average {getMetricLabel(metric)}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {getAverage(displayData.datasets[0].data, metric)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function getMetricLabel(metric: string): string {
  switch (metric) {
    case 'successRate':
      return 'Success Rate';
    case 'tasksCompleted':
      return 'Tasks Completed';
    case 'averageExecutionTime':
      return 'Execution Time';
    default:
      return 'Performance';
  }
}

function getMetricUnit(metric: string): string {
  switch (metric) {
    case 'successRate':
      return 'Percentage (%)';
    case 'tasksCompleted':
      return 'Number of Tasks';
    case 'averageExecutionTime':
      return 'Time (minutes)';
    default:
      return 'Value';
  }
}

function getBestPerformer(data: any, metric: string): string {
  const maxIndex = data.datasets[0].data.indexOf(Math.max(...data.datasets[0].data));
  return data.labels[maxIndex];
}

function getAverage(data: number[], metric: string): string {
  const avg = data.reduce((sum, val) => sum + val, 0) / data.length;
  switch (metric) {
    case 'successRate':
      return `${avg.toFixed(1)}%`;
    case 'tasksCompleted':
      return Math.round(avg).toString();
    case 'averageExecutionTime':
      return `${avg.toFixed(1)} min`;
    default:
      return avg.toFixed(1);
  }
}

export default AgentPerformanceChart;