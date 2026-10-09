import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

export const PERSONAS = {
  customer_support: {
    id: 'customer_support',
    name: 'Customer Support Representative',
    description: 'Empathetic, helpful, and concise customer support agent.',
    systemPrompt: `You are Nova, a friendly and empathetic customer support representative for CloudTech Solutions.
Keep your spoken responses natural, conversational, polite, and concise (under 2-3 sentences), since this is a real-time voice conversation.
Acknowledge the user's issue directly, provide clear steps, and offer further assistance.`,
  },
  sales_rep: {
    id: 'sales_rep',
    name: 'Product Sales Executive',
    description: 'Persuasive, energetic, and value-focused sales advisor.',
    systemPrompt: `You are Alex, an energetic and knowledgeable sales consultant for Apex AI.
Keep your responses engaging, persuasive, and under 2-3 sentences for spoken audio.
Highlight product benefits, address objections warmly, and encourage booking a live demo.`,
  },
  technical_support: {
    id: 'technical_support',
    name: 'Technical Solutions Specialist',
    description: 'Analytical, clear, and troubleshooting-oriented technical engineer.',
    systemPrompt: `You are Taylor, a senior technical support engineer.
Deliver direct, troubleshooting-focused answers in 2-3 short sentences suited for spoken voice conversation.
Clarify error states, diagnose root causes concisely, and give actionable next steps.`,
  },
  custom: {
    id: 'custom',
    name: 'Custom Persona',
    description: 'User-defined persona with configurable system prompt.',
    systemPrompt: `You are a helpful and responsive AI voice assistant. Respond concisely in 2 sentences.`,
  },
};

let genAIClient = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return null;
  }
  if (!genAIClient) {
    try {
      genAIClient = new GoogleGenAI({ apiKey });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenAI client:', err.message);
      return null;
    }
  }
  return genAIClient;
}

/**
 * Estimates token count for text (~4 characters per token heuristic)
 */
export function estimateTokens(text = '') {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/**
 * Generates an agent voice response using Gemini or intelligent demo simulator.
 */
export async function generateVoiceResponse({
  userMessage,
  history = [],
  personaId = 'customer_support',
  customSystemPrompt = null,
}) {
  const selectedPersona = PERSONAS[personaId] || PERSONAS.customer_support;
  const systemInstruction = customSystemPrompt?.trim() || selectedPersona.systemPrompt;
  const client = getClient();

  if (client) {
    try {
      const contents = history.map((item) => ({
        role: item.role === 'agent' ? 'model' : 'user',
        parts: [{ text: item.text }],
      }));
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });

      const response = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          temperature: 0.7,
          maxOutputTokens: 250,
        },
      });

      const agentText = response.text ? response.text.trim() : 'I received your message.';
      const usageMetadata = response.usageMetadata || {};

      const inputTokens = usageMetadata.promptTokenCount || (estimateTokens(systemInstruction) + estimateTokens(userMessage));
      const outputTokens = usageMetadata.candidatesTokenCount || estimateTokens(agentText);

      return {
        text: agentText,
        inputTokens,
        outputTokens,
        model: 'gemini-2.0-flash',
        isLiveGemini: true,
      };
    } catch (apiError) {
      console.warn('Gemini API call failed, falling back to simulated engine:', apiError.message);
    }
  }

  // Intelligent fallback simulator for instant demo/testing without API key
  const fallbackResponses = {
    customer_support: [
      `Thank you for reaching out! I understand completely. Let me pull up your account details right away to assist you with this.`,
      `I apologize for that inconvenience. I can definitely help resolve this for you today. Could you confirm your account ID or email?`,
      `All set! I've logged that request and our team will follow up within the hour. Is there anything else I can help with?`,
    ],
    sales_rep: [
      `That is an excellent question! Our AI voice agent automates up to 80% of customer interactions with near-zero latency.`,
      `We'd love to show you a customized walkthrough. Would Tuesday or Thursday afternoon work better for a brief 10-minute demo?`,
      `By integrating Gemini into your workflow, companies typically see a 4x reduction in response overhead and improved customer satisfaction!`,
    ],
    technical_support: [
      `Understood. Let's inspect the error logs first. Could you check if the status code returned was a 400 or 500 series?`,
      `That typically happens when the connection timeout is exceeded. Verify that your WebSocket endpoint is reachable on the configured port.`,
      `I've noted the traceback. Let's restart the process with watch mode enabled so we can verify if the service binds to the port properly.`,
    ],
    custom: [
      `I hear you clearly! As your assistant, I'm ready to handle this task with you right now.`,
      `Understood. Let's proceed with that step right away.`,
    ],
  };

  const pool = fallbackResponses[personaId] || fallbackResponses.customer_support;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const agentText = `${picked} (Demo Mode)`;

  const inputTokens = estimateTokens(systemInstruction) + estimateTokens(userMessage);
  const outputTokens = estimateTokens(agentText);

  return {
    text: agentText,
    inputTokens,
    outputTokens,
    model: 'gemini-2.0-flash (simulated)',
    isLiveGemini: false,
  };
}
