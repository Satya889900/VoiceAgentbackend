import { WebSocketServer, WebSocket } from 'ws';
import { sessionStore } from '../services/sessionStore.js';

let wss = null;

export function setupWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    // Send immediate initial state
    try {
      const initialMetrics = sessionStore.getMetrics();
      const sessions = sessionStore.getAllSessions();
      ws.send(JSON.stringify({ type: 'INIT', metrics: initialMetrics, sessions }));
    } catch (err) {
      console.warn('Error sending initial WS state:', err.message);
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        // Ignore malformed WS frames
      }
    });
  });

  return wss;
}

export function broadcastMetrics() {
  if (!wss) return;
  try {
    const metrics = sessionStore.getMetrics();
    const sessions = sessionStore.getAllSessions();
    const payload = JSON.stringify({ type: 'METRICS_UPDATE', metrics, sessions });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.warn('Error broadcasting WS metrics:', err.message);
  }
}
