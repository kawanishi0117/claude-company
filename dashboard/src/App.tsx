import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useDashboardStore } from './store';
import { webSocketService } from './services/websocket';
import { globalErrorHandler } from './utils/errorHandler';
import { useToast } from './contexts/ToastContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { darkMode } = useDashboardStore();
  const { addToast } = useToast();

  useEffect(() => {
    // Apply dark mode class to document
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    // Initialize WebSocket connection
    console.log('Initializing WebSocket connection...');

    // Cleanup on unmount
    return () => {
      webSocketService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Setup global error handler
    globalErrorHandler.setErrorCallback((error, toast) => {
      console.error('Global error:', error);
      
      if (toast) {
        addToast(toast);
      }
    });
  }, [addToast]);

  return (
    <ErrorBoundary>
      <div className="h-full">
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </Layout>
        </Router>
      </div>
    </ErrorBoundary>
  );
}

export default App;