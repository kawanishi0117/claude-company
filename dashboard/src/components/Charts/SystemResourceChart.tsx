import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { useDashboardStore } from '../../store';
import { ServerIcon } from '@heroicons/react/24/outline';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SystemResourceChartProps {
  height?: number;
  resource: 'cpu' | 'memory';
}

const SystemResourceChart: React.FC<SystemResourceChartProps> = ({
  height = 200,
  resource = 'cpu'
}) => {
  const { systemStats, agents } = useDashboardStore();

  const chartData = useMemo(() => {
    const usage = resource === 'cpu' ? systemStats.cpuUsage : systemStats.memoryUsage;
    const remaining = 100 - usage;

    const getColor = () => {
      if (usage < 50) return ['rgb(34, 197, 94)', 'rgb(229, 231, 235)']; // Green/Gray
      if (usage < 80) return ['rgb(251, 191, 36)', 'rgb(229, 231, 235)']; // Yellow/Gray
      return ['rgb(239, 68, 68)', 'rgb(229, 231, 235)']; // Red/Gray
    };

    const [usedColor, remainingColor] = getColor();

    return {
      labels: [`Used ${resource.toUpperCase()}`, `Available ${resource.toUpperCase()}`],
      datasets: [
        {
          data: [usage, remaining],
          backgroundColor: [usedColor, remainingColor],
          borderColor: [usedColor, remainingColor],
          borderWidth: 2,
          cutout: '65%',
        },
      ],
    };
  }, [systemStats, resource]);

  const chartOptions: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
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
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
  }), []);

  // Mock data if no system stats available
  const mockCpuUsage = 34.2;
  const mockMemoryUsage = 56.7;
  
  const displayUsage = resource === 'cpu' ? 
    (systemStats.cpuUsage || mockCpuUsage) : 
    (systemStats.memoryUsage || mockMemoryUsage);

  // Agent resource breakdown
  const agentResourceUsage = agents.map(agent => ({
    name: agent.name,
    usage: resource === 'cpu' ? agent.performance.cpuUsage : agent.performance.memoryUsage,
    type: agent.type
  })).sort((a, b) => b.usage - a.usage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <ServerIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            System {resource.toUpperCase()} Usage
          </h3>
        </div>
      </div>

      <div className="flex items-center justify-between">
        {/* Chart */}
        <div className="relative" style={{ width: `${height}px`, height: `${height}px` }}>
          <Doughnut options={chartOptions} data={chartData} />
          
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {displayUsage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                {resource}
              </div>
            </div>
          </div>
        </div>

        {/* Agent breakdown */}
        <div className="flex-1 ml-6">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Agent Breakdown
          </h4>
          
          <div className="space-y-2">
            {agentResourceUsage.slice(0, 4).map((agent) => (
              <div key={agent.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    agent.type === 'boss' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-24">
                    {agent.name.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="w-12 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        agent.usage < 50 ? 'bg-green-500' :
                        agent.usage < 80 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(agent.usage, 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-900 dark:text-white w-8 text-right">
                    {agent.usage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resource status */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${
                displayUsage < 50 ? 'text-green-600 dark:text-green-400' :
                displayUsage < 80 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {displayUsage < 50 ? 'Optimal' :
                 displayUsage < 80 ? 'Moderate' : 'High'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SystemResourceChart;