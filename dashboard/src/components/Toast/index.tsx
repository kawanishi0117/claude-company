import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export interface Toast {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const toastConfig = {
  success: {
    icon: CheckCircleIcon,
    colors: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200',
    iconColor: 'text-green-400',
  },
  warning: {
    icon: ExclamationTriangleIcon,
    colors: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-400',
  },
  error: {
    icon: ExclamationCircleIcon,
    colors: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200',
    iconColor: 'text-red-400',
  },
  info: {
    icon: InformationCircleIcon,
    colors: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-400',
  },
};

const ToastComponent: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.3 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.5 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={clsx(
        'relative rounded-lg p-4 shadow-lg border max-w-sm w-full',
        config.colors
      )}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={clsx('h-5 w-5', config.iconColor)} />
        </div>

        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium">{toast.title}</h4>
          {toast.message && (
            <p className="mt-1 text-sm opacity-90">{toast.message}</p>
          )}

          {toast.action && (
            <div className="mt-3">
              <button
                onClick={toast.action.onClick}
                className={clsx(
                  'text-sm font-medium underline hover:no-underline focus:outline-none',
                  toast.type === 'success' && 'text-green-700 dark:text-green-300',
                  toast.type === 'warning' && 'text-yellow-700 dark:text-yellow-300',
                  toast.type === 'error' && 'text-red-700 dark:text-red-300',
                  toast.type === 'info' && 'text-blue-700 dark:text-blue-300'
                )}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={() => onDismiss(toast.id)}
            className="rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-10 rounded-b-lg overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: toast.duration / 1000, ease: 'linear' }}
            className={clsx(
              'h-full',
              toast.type === 'success' && 'bg-green-500',
              toast.type === 'warning' && 'bg-yellow-500',
              toast.type === 'error' && 'bg-red-500',
              toast.type === 'info' && 'bg-blue-500'
            )}
          />
        </div>
      )}
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  return (
    <div className="fixed top-4 right-4 z-70 space-y-4 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastComponent toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastComponent;