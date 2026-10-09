import express from 'express';
import { PERSONAS, generateVoiceResponse } from '../services/geminiService.js';
import { sessionStore } from '../services/sessionStore.js';
import { broadcastMetrics } from '../ws/voiceSocket.js';

const router = express.Router();

// GET /api/personas
router.get('/personas', (req, res) => {
  res.json({
    personas: Object.values(PERSONAS),
  });
});

// GET /api/metrics
router.get('/metrics', (req, res) => {
  const metrics = sessionStore.getMetrics();
  res.json(metrics);
});

// GET /api/sessions
router.get('/sessions', (req, res) => {
  const sessions = sessionStore.getAllSessions();
  res.json(sessions);
});

// GET /api/sessions/:id
router.get('/sessions/:id', (req, res) => {
  const session = sessionStore.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

// POST /api/sessions/start
router.post('/sessions/start', (req, res) => {
  const { personaId = 'gemini_assistant', customSystemPrompt } = req.body;
  const session = sessionStore.createSession({ personaId, customSystemPrompt });
  broadcastMetrics();
  res.status(201).json(session);
});

// POST /api/sessions/:id/message
router.post('/sessions/:id/message', async (req, res) => {
  const { id } = req.params;
  const { message, audioInputSeconds = 2 } = req.body;

  const session = sessionStore.getSession(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  try {
    // Generate Gemini voice response
    const geminiResult = await generateVoiceResponse({
      userMessage: message,
      history: session.transcript,
      personaId: session.persona.id,
      customSystemPrompt: session.persona.systemPrompt,
    });

    // Approximate audio output duration from word count (~150 words per minute => ~2.5 words/sec)
    const wordCount = geminiResult.text.split(/\s+/).length;
    const audioOutputSeconds = Math.max(1, Math.round(wordCount / 2.5));

    // Record interaction in session
    const updatedSession = sessionStore.addInteraction(id, {
      userText: message,
      agentText: geminiResult.text,
      inputTokens: geminiResult.inputTokens,
      outputTokens: geminiResult.outputTokens,
      audioInputSeconds: Number(audioInputSeconds) || 2,
      audioOutputSeconds,
    });

    broadcastMetrics();

    res.json({
      agentText: geminiResult.text,
      audioOutputSeconds,
      model: geminiResult.model,
      isLiveGemini: geminiResult.isLiveGemini,
      session: updatedSession,
    });
  } catch (err) {
    console.error('Error processing voice message:', err);
    res.status(500).json({ error: 'Failed to process message', details: err.message });
  }
});

// POST /api/sessions/:id/end
router.post('/sessions/:id/end', (req, res) => {
  const { id } = req.params;
  const session = sessionStore.endSession(id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  broadcastMetrics();
  res.json(session);
});

export default router;
