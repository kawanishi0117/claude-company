import { Toast } from '../components/Toast';

export interface ErrorDetails {
  message: string;
  stack?: string;
  code?: string | number;
  context?: Record<string, any>;
  timestamp: Date;
  userAgent?: string;
  url?: string;
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: ErrorDetails[] = [];
  private onError?: (error: ErrorDetails, toast?: Omit<Toast, 'id'>) => void;

  private constructor() {
    this.setupGlobalHandlers();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  setErrorCallback(callback: (error: ErrorDetails, toast?: Omit<Toast, 'id'>) => void) {
    this.onError = callback;
    
    // Process any queued errors
    this.errorQueue.forEach(error => {
      this.onError?.(error);
    });
    this.errorQueue = [];
  }

  private setupGlobalHandlers() {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        message: event.message,
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: {
          type: 'unhandledrejection',
          reason: event.reason,
        }
      });
    });
  }

  handleError(errorDetails: Partial<ErrorDetails>, showToast = true) {
    const error: ErrorDetails = {
      message: errorDetails.message || 'An unknown error occurred',
      stack: errorDetails.stack,
      code: errorDetails.code,
      context: errorDetails.context,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...errorDetails,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Global Error Handler:', error);
    }

    // Create toast notification
    const toast: Omit<Toast, 'id'> | undefined = showToast ? {
      type: 'error',
      title: 'Error Occurred',
      message: this.getUserFriendlyMessage(error.message),
      duration: 7000,
      action: {
        label: 'View Details',
        onClick: () => this.showErrorDetails(error),
      },
    } : undefined;

    // Call error callback if set, otherwise queue
    if (this.onError) {
      this.onError(error, toast);
    } else {
      this.errorQueue.push(error);
    }

    // Send to logging service in production
    if (process.env.NODE_ENV === 'production') {
      this.logToService(error);
    }
  }

  private getUserFriendlyMessage(message: string): string {
    // Convert technical error messages to user-friendly ones
    const errorMap: Record<string, string> = {
      'NetworkError': 'Network connection problem. Please check your internet connection.',
      'ECONNREFUSED': 'Cannot connect to server. Please try again later.',
      'Timeout': 'Request timed out. Please try again.',
      'Unauthorized': 'You are not authorized to perform this action.',
      'Forbidden': 'Access denied. Please check your permissions.',
      'Not Found': 'The requested resource was not found.',
      'Internal Server Error': 'Server error. Please try again later.',
    };

    for (const [key, friendlyMessage] of Object.entries(errorMap)) {
      if (message.includes(key)) {
        return friendlyMessage;
      }
    }

    return 'An unexpected error occurred. Please try again.';
  }

  private showErrorDetails(error: ErrorDetails) {
    const details = `
Error: ${error.message}
Time: ${error.timestamp.toISOString()}
URL: ${error.url}
${error.stack ? `\nStack:\n${error.stack}` : ''}
${error.context ? `\nContext:\n${JSON.stringify(error.context, null, 2)}` : ''}
    `;

    // Create a modal or console log with details
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Details');
      console.error(details);
      console.groupEnd();
    } else {
      // In production, you might want to show a modal or redirect to an error page
      alert('Error details have been logged. Please contact support if this problem persists.');
    }
  }

  private async logToService(error: ErrorDetails) {
    try {
      // Example: Send to error tracking service
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error),
      });
    } catch (logError) {
      console.error('Failed to log error to service:', logError);
    }
  }

  // Specific error handling methods
  handleApiError(error: any, context?: Record<string, any>) {
    let message = 'API request failed';
    let code = error.status || error.code;

    if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    }

    this.handleError({
      message,
      code,
      stack: error.stack,
      context: {
        type: 'api_error',
        url: error.config?.url,
        method: error.config?.method,
        ...context,
      },
    });
  }

  handleWebSocketError(error: any, context?: Record<string, any>) {
    this.handleError({
      message: `WebSocket error: ${error.message || 'Connection failed'}`,
      code: error.code,
      context: {
        type: 'websocket_error',
        ...context,
      },
    });
  }

  handleValidationError(errors: Record<string, string[]>, context?: Record<string, any>) {
    const errorMessages = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');

    this.handleError({
      message: `Validation failed: ${errorMessages}`,
      context: {
        type: 'validation_error',
        errors,
        ...context,
      },
    }, false); // Don't show toast for validation errors by default
  }
}

// Export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// React hook for using error handler
export const useErrorHandler = () => {
  return {
    handleError: (error: Partial<ErrorDetails>, showToast = true) => 
      globalErrorHandler.handleError(error, showToast),
    handleApiError: (error: any, context?: Record<string, any>) => 
      globalErrorHandler.handleApiError(error, context),
    handleWebSocketError: (error: any, context?: Record<string, any>) => 
      globalErrorHandler.handleWebSocketError(error, context),
    handleValidationError: (errors: Record<string, string[]>, context?: Record<string, any>) => 
      globalErrorHandler.handleValidationError(errors, context),
  };
};