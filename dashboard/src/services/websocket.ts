import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, Agent, Task, LogEntry, SystemStats } from '../types';
import { useDashboardStore } from '../store';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:8000' 
      : 'http://localhost:8000';

    this.socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      autoConnect: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('connection_status', { connected: false, reason });
      
      if (reason === 'io server disconnect') {
        // The disconnection was initiated by the server, reconnect manually
        this.reconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      this.emit('connection_status', { connected: false, error: error.message });
      this.reconnect();
    });

    // Agent status updates
    this.socket.on('agent_status_update', (data: Agent) => {
      console.log('Agent status update:', data);
      const store = useDashboardStore.getState();
      store.updateAgent(data);
      this.emit('agent_updated', data);
    });

    // Task updates
    this.socket.on('task_update', (data: Task) => {
      console.log('Task update:', data);
      const store = useDashboardStore.getState();
      store.updateTask(data);
      this.emit('task_updated', data);
    });

    // New log entries
    this.socket.on('log_entry', (data: LogEntry) => {
      const store = useDashboardStore.getState();
      store.addLog(data);
      this.emit('log_added', data);
    });

    // System stats updates
    this.socket.on('system_stats', (data: SystemStats) => {
      const store = useDashboardStore.getState();
      store.setSystemStats(data);
      this.emit('stats_updated', data);
    });

    // Project updates
    this.socket.on('project_update', (data: any) => {
      console.log('Project update:', data);
      const store = useDashboardStore.getState();
      store.updateProject(data);
      this.emit('project_updated', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('websocket_error', error);
    });
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  // Event emitter for component subscriptions
  private eventListeners: { [key: string]: Function[] } = {};

  public on(event: string, callback: Function) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  public off(event: string, callback: Function) {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data?: any) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
  }

  // Public methods
  public isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public sendMessage(type: string, payload: any) {
    if (this.socket && this.isConnected) {
      this.socket.emit(type, payload);
    } else {
      console.warn('WebSocket not connected. Message not sent:', { type, payload });
    }
  }

  // Specific message senders
  public requestAgentUpdate(agentId: string) {
    this.sendMessage('request_agent_update', { agentId });
  }

  public requestSystemStats() {
    this.sendMessage('request_system_stats', {});
  }

  public subscribeToAgent(agentId: string) {
    this.sendMessage('subscribe_agent', { agentId });
  }

  public unsubscribeFromAgent(agentId: string) {
    this.sendMessage('unsubscribe_agent', { agentId });
  }

  public subscribeToLogs(filters?: any) {
    this.sendMessage('subscribe_logs', { filters });
  }

  public unsubscribeFromLogs() {
    this.sendMessage('unsubscribe_logs', {});
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// React hook for using WebSocket in components
export const useWebSocket = () => {
  return {
    isConnected: webSocketService.isSocketConnected(),
    sendMessage: webSocketService.sendMessage.bind(webSocketService),
    on: webSocketService.on.bind(webSocketService),
    off: webSocketService.off.bind(webSocketService),
    requestAgentUpdate: webSocketService.requestAgentUpdate.bind(webSocketService),
    requestSystemStats: webSocketService.requestSystemStats.bind(webSocketService),
    subscribeToAgent: webSocketService.subscribeToAgent.bind(webSocketService),
    unsubscribeFromAgent: webSocketService.unsubscribeFromAgent.bind(webSocketService),
    subscribeToLogs: webSocketService.subscribeToLogs.bind(webSocketService),
    unsubscribeFromLogs: webSocketService.unsubscribeFromLogs.bind(webSocketService),
  };
};