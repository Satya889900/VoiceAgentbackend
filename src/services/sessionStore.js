import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { calculateCost } from '../config/pricing.js';
import { PERSONAS } from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.initStore();
  }

  initStore() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((s) => this.sessions.set(s.id, s));
        }
      }
    } catch (err) {
      console.warn('Failed to load sessions from disk:', err.message);
    }
  }

  saveStore() {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Failed to save sessions to disk:', err.message);
    }
  }

  createSession({ personaId = 'customer_support', customSystemPrompt = null }) {
    const id = uuidv4();
    const persona = PERSONAS[personaId] || PERSONAS.customer_support;
    const now = new Date().toISOString();

    const newSession = {
      id,
      status: 'active',
      persona: {
        id: persona.id,
        name: persona.name,
        systemPrompt: customSystemPrompt?.trim() || persona.systemPrompt,
      },
      startTime: now,
      endTime: null,
      durationSeconds: 0,
      transcript: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        audioInputSeconds: 0,
        audioOutputSeconds: 0,
        totalTokens: 0,
      },
      cost: {
        totalCost: 0,
        breakdown: {
          textInputCost: 0,
          textOutputCost: 0,
          audioInputCost: 0,
          audioOutputCost: 0,
        },
      },
    };

    this.sessions.set(id, newSession);
    this.saveStore();
    return newSession;
  }

  addInteraction(sessionId, {
    userText,
    agentText,
    inputTokens = 0,
    outputTokens = 0,
    audioInputSeconds = 2,
    audioOutputSeconds = 3,
  }) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();

    // Turn cost
    const turnCost = calculateCost({
      inputTokens,
      outputTokens,
      audioInputSeconds,
      audioOutputSeconds,
    });

    // Add user turn
    session.transcript.push({
      role: 'user',
      text: userText,
      timestamp: now,
      audioSeconds: audioInputSeconds,
    });

    // Add agent turn
    session.transcript.push({
      role: 'agent',
      text: agentText,
      timestamp: now,
      audioSeconds: audioOutputSeconds,
      tokens: { inputTokens, outputTokens },
      turnCost: turnCost.totalCost,
    });

    // Update cumulative session usage
    session.usage.inputTokens += inputTokens;
    session.usage.outputTokens += outputTokens;
    session.usage.audioInputSeconds += audioInputSeconds;
    session.usage.audioOutputSeconds += audioOutputSeconds;

    // Recalculate total session cost
    const sessionCostCalc = calculateCost(session.usage);
    session.usage.totalTokens = sessionCostCalc.totalTokens;
    session.cost = {
      totalCost: sessionCostCalc.totalCost,
      breakdown: {
        textInputCost: sessionCostCalc.textInputCost,
        textOutputCost: sessionCostCalc.textOutputCost,
        audioInputCost: sessionCostCalc.audioInputCost,
        audioOutputCost: sessionCostCalc.audioOutputCost,
      },
    };

    // Update duration
    const startMs = new Date(session.startTime).getTime();
    session.durationSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));

    this.saveStore();
    return session;
  }

  endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    session.status = 'completed';
    session.endTime = new Date().toISOString();
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();
    session.durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));

    this.saveStore();
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    );
  }

  getMetrics() {
    const all = Array.from(this.sessions.values());
    const activeSessions = all.filter((s) => s.status === 'active').length;
    const completedSessions = all.filter((s) => s.status === 'completed').length;

    let totalDurationSeconds = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalAudioSeconds = 0;

    for (const s of all) {
      totalDurationSeconds += s.durationSeconds || 0;
      totalTokens += s.usage?.totalTokens || 0;
      totalCost += s.cost?.totalCost || 0;
      totalInputTokens += s.usage?.inputTokens || 0;
      totalOutputTokens += s.usage?.outputTokens || 0;
      totalAudioSeconds += (s.usage?.audioInputSeconds || 0) + (s.usage?.audioOutputSeconds || 0);
    }

    return {
      totalSessions: all.length,
      activeSessions,
      completedSessions,
      totalDurationSeconds,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalAudioSeconds,
      totalCost: Number(totalCost.toFixed(6)),
    };
  }
}

export const sessionStore = new SessionStore();
