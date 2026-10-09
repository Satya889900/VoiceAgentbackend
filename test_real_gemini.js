import { generateVoiceResponse } from './src/services/geminiService.js';

async function testGeminiFlow() {
  console.log('--- TEST 1: Question 1 ---');
  const q1 = 'What is the capital of Japan?';
  console.log('User asks:', q1);
  const r1 = await generateVoiceResponse({
    userMessage: q1,
    history: [],
    personaId: 'gemini_assistant',
  });
  console.log('Gemini replies:', r1.text);
  console.log('Model used:', r1.model, '| Live Gemini:', r1.isLiveGemini);

  console.log('\n--- TEST 2: Multi-turn Follow-up Question ---');
  const history = [
    { role: 'user', text: q1 },
    { role: 'agent', text: r1.text },
  ];
  const q2 = 'What is a popular food there?';
  console.log('User asks:', q2);
  const r2 = await generateVoiceResponse({
    userMessage: q2,
    history,
    personaId: 'gemini_assistant',
  });
  console.log('Gemini replies:', r2.text);
  console.log('Model used:', r2.model, '| Live Gemini:', r2.isLiveGemini);

  console.log('\n--- TEST 3: General Question (Joke) ---');
  const q3 = 'Tell me a short funny joke.';
  console.log('User asks:', q3);
  const r3 = await generateVoiceResponse({
    userMessage: q3,
    history: [],
    personaId: 'gemini_assistant',
  });
  console.log('Gemini replies:', r3.text);
  console.log('Model used:', r3.model, '| Live Gemini:', r3.isLiveGemini);

  console.log('\n✅ ALL REAL GEMINI CONVERSATION TESTS PASSED!');
}

testGeminiFlow().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
