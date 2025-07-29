// Subordinate AI Controller Entry Point
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'subordinate-controller',
    agentId: process.env.AGENT_ID || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Basic API endpoints
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'running',
    type: 'subordinate-ai',
    agentId: process.env.AGENT_ID || 'unknown',
    version: '1.0.0'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Subordinate AI Controller running on port ${PORT}`);
  console.log(`Agent ID: ${process.env.AGENT_ID || 'unknown'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});