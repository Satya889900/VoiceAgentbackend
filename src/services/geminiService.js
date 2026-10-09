import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const PERSONAS = {
  gemini_assistant: {
    id: 'gemini_assistant',
    name: 'Gemini Voice Assistant',
    description: 'Intelligent, helpful voice assistant ready to answer any question.',
    systemPrompt: `You are Gemini, a helpful, friendly, and highly intelligent conversational voice assistant.
Respond naturally to any question the user asks.
Keep your spoken responses concise, engaging, and direct (typically 1-3 natural sentences) so it flows smoothly in real-time voice conversations.
Do not use markdown formatting like asterisks, bullet points, or code blocks, since your words will be spoken out loud.`,
  },
  customer_support: {
    id: 'customer_support',
    name: 'Customer Support Representative',
    description: 'Empathetic, helpful, and concise customer support agent.',
    systemPrompt: `You are Nova, a friendly and empathetic customer support representative for CloudTech Solutions.
Respond naturally to any inquiry or issue the user raises.
Keep your spoken responses natural, polite, and under 2-3 sentences.
Do not use markdown formatting like asterisks or bullet points since your response is spoken out loud.`,
  },
  sales_rep: {
    id: 'sales_rep',
    name: 'Product Sales Executive',
    description: 'Persuasive, energetic, and value-focused sales advisor.',
    systemPrompt: `You are Alex, an energetic sales consultant for Apex AI.
Highlight benefits, answer questions enthusiastically, and keep your responses under 2-3 spoken sentences.
Do not use markdown formatting since your response will be spoken out loud.`,
  },
  technical_support: {
    id: 'technical_support',
    name: 'Technical Solutions Specialist',
    description: 'Analytical, clear, and troubleshooting-oriented technical engineer.',
    systemPrompt: `You are Taylor, a senior technical support engineer.
Deliver direct, troubleshooting-focused answers to any technical questions in 2-3 short spoken sentences.
Do not use markdown formatting since your response will be spoken out loud.`,
  },
  custom: {
    id: 'custom',
    name: 'Custom Persona',
    description: 'User-defined persona with configurable system prompt.',
    systemPrompt: `You are a helpful and responsive AI voice assistant. Answer the user's questions concisely in 1-2 spoken sentences.`,
  },
};

// Models in order of latency and availability preference (Lite models first for ultra-low latency)
const MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

/**
 * Gather all configured API keys from environment
 */
function getKeyPool() {
  const pool = [];

  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== 'YOUR_GEMINI_API_KEY_HERE') {
    pool.push(process.env.GEMINI_API_KEY.trim());
  }

  for (let i = 1; i <= 20; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim() && !pool.includes(k.trim())) {
      pool.push(k.trim());
    }
  }

  if (process.env.GEMINI_API_KEYS) {
    process.env.GEMINI_API_KEYS.split(',').forEach((k) => {
      const clean = k.trim();
      if (clean && !pool.includes(clean)) pool.push(clean);
    });
  }

  return pool;
}

let keyIndex = 0;

function getNextClient() {
  const keys = getKeyPool();
  if (keys.length === 0) return null;

  const key = keys[keyIndex % keys.length];
  keyIndex = (keyIndex + 1) % keys.length;

  try {
    return { client: new GoogleGenAI({ apiKey: key }), key };
  } catch (err) {
    console.warn('Failed to initialize GoogleGenAI with key:', err.message);
    return null;
  }
}

/**
 * Clean spoken text: remove asterisks, hash headers, and code block formatting
 */
function cleanSpokenText(text = '') {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold **text** -> text
    .replace(/\*(.*?)\*/g, '$1')     // Italic *text* -> text
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Inline code/blocks
    .replace(/^#+\s+/gm, '')         // Headers #
    .replace(/^\s*[-*•]\s+/gm, '')   // Bullet points
    .replace(/\n+/g, ' ')            // Normalize newlines to spaces
    .trim();
}

/**
 * Estimates token count for text (~4 characters per token heuristic)
 */
export function estimateTokens(text = '') {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/**
 * Format conversation history to strictly alternate between user and model
 */
function formatHistory(history = [], userMessage) {
  const contents = [];

  for (const item of history) {
    if (!item.text || !item.text.trim()) continue;
    const role = item.role === 'agent' ? 'model' : 'user';

    // Must alternate roles
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      // Append text if same role
      contents[contents.length - 1].parts[0].text += ` ${item.text.trim()}`;
    } else {
      contents.push({
        role,
        parts: [{ text: item.text.trim() }],
      });
    }
  }

  // Ensure first item is 'user' if history exists
  if (contents.length > 0 && contents[0].role === 'model') {
    contents.shift();
  }

  // Append latest user message
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += ` ${userMessage.trim()}`;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: userMessage.trim() }],
    });
  }

  return contents;
}

/**
 * Generates an agent voice response using Gemini live API with auto-rotation.
 */
export async function generateVoiceResponse({
  userMessage,
  history = [],
  personaId = 'gemini_assistant',
  customSystemPrompt = null,
}) {
  const selectedPersona = PERSONAS[personaId] || PERSONAS.gemini_assistant;
  const baseSystemPrompt = customSystemPrompt?.trim() || selectedPersona.systemPrompt;

  // Inject current date and time so Gemini can answer time-related questions
  const now = new Date();
  const dateTimeInfo = `\n\nCurrent date and time: ${now.toLocaleString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })} (IST, India Standard Time). Use this to answer any questions about the current time or date.`;

  const systemInstruction = baseSystemPrompt + dateTimeInfo;
  const keys = getKeyPool();

  if (keys.length > 0) {
    const contents = formatHistory(history, userMessage);

    // Try up to 3 keys and models with automatic rotation
    const maxRetries = Math.min(keys.length * 2, 4);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { client } = getNextClient() || {};
      if (!client) continue;

      for (const model of MODELS) {
        try {
          const response = await client.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: { parts: [{ text: systemInstruction }] },
              temperature: 0.6,
              maxOutputTokens: 100,
            },
          });

          const rawText = response.text ? response.text.trim() : '';
          const cleanedText = cleanSpokenText(rawText) || "I'm listening, could you say that again?";

          const usageMetadata = response.usageMetadata || {};
          const inputTokens =
            usageMetadata.promptTokenCount ||
            (estimateTokens(systemInstruction) + estimateTokens(userMessage));
          const outputTokens = usageMetadata.candidatesTokenCount || estimateTokens(cleanedText);

          return {
            text: cleanedText,
            inputTokens,
            outputTokens,
            model,
            isLiveGemini: true,
          };
        } catch (err) {
          // If rate limited or model busy, continue to next model/key
          const msg = err.message || '';
          if (msg.includes('404') || msg.includes('NOT_FOUND')) {
            continue; // try next model
          }
          if (msg.includes('429') || msg.includes('503') || msg.includes('quota')) {
            break; // rotate to next key
          }
        }
      }
    }
  }

  // Graceful conversational response if no keys reachable
  const fallbackText = `I heard your question: "${userMessage}". To enable real-time Gemini answers, please ensure your GEMINI_API_KEY is active in the environment.`;
  return {
    text: fallbackText,
    inputTokens: estimateTokens(userMessage),
    outputTokens: estimateTokens(fallbackText),
    model: 'fallback-responder',
    isLiveGemini: false,
  };
}
