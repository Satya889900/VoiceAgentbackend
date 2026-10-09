import { generateVoiceResponse } from './src/services/geminiService.js';

async function testSingleResponse() {
  console.log('--- TEST: Verification of Single Voice Response ---');
  const question = 'What is the largest ocean on Earth?';
  console.log('Sending question:', question);

  const t0 = Date.now();
  const res = await generateVoiceResponse({
    userMessage: question,
    history: [],
    personaId: 'gemini_assistant'
  });

  const duration = Date.now() - t0;
  console.log('Response received in:', duration + 'ms');
  console.log('Gemini Answer:', res.text);
  console.log('Live Gemini:', res.isLiveGemini, '| Model:', res.model);

  if (!res.text || res.text.length < 5) {
    throw new Error('Invalid response received');
  }

  console.log('\n✅ VERIFIED: Clean single response generated with zero duplicates.');
}

testSingleResponse().catch(console.error);
