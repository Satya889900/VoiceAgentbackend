import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import sessionRoutes from './routes/sessionRoutes.js';
import { setupWebSocket } from './ws/voiceSocket.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Voice Agent Backend API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'),
  });
});

// Session & Voice Agent Routes
app.use('/api', sessionRoutes);

// Create HTTP server & bind WebSocket
const server = http.createServer(app);
setupWebSocket(server);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Voice Agent server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint ready at ws://localhost:${PORT}/ws`);
});

export { app, server };
