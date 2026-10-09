import { server } from './src/server.js';

const PORT = process.env.PORT || 5000;
const baseUrl = `http://localhost:${PORT}`;

async function runTests() {
  console.log(`Testing backend on ${baseUrl}...`);

  // Wait 500ms for server to bind
  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    // 1. Health check
    console.log('--- 1. Testing /api/health ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    console.log('Health:', health);
    if (health.status !== 'ok') throw new Error('Health check failed');

    // 2. Personas
    console.log('\n--- 2. Testing /api/personas ---');
    const personasRes = await fetch(`${baseUrl}/api/personas`);
    const { personas } = await personasRes.json();
    console.log(`Retrieved ${personas.length} personas:`, personas.map((p) => p.id));
    if (personas.length === 0) throw new Error('No personas returned');

    // 3. Start Session
    console.log('\n--- 3. Testing /api/sessions/start ---');
    const startRes = await fetch(`${baseUrl}/api/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: 'customer_support' }),
    });
    const session = await startRes.json();
    console.log(`Session created: ${session.id}, status: ${session.status}, persona: ${session.persona.name}`);
    if (!session.id || session.status !== 'active') throw new Error('Session creation failed');

    // 4. Send Message (Gemini interaction)
    console.log('\n--- 4. Testing /api/sessions/:id/message ---');
    const msgRes = await fetch(`${baseUrl}/api/sessions/${session.id}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello, my order arrived damaged and I need a replacement.',
        audioInputSeconds: 3,
      }),
    });
    const msgData = await msgRes.json();
    console.log('Agent Response:', msgData.agentText);
    console.log('Model:', msgData.model);
    console.log('Updated Usage:', msgData.session.usage);
    console.log('Updated Cost:', msgData.session.cost);
    if (!msgData.agentText) throw new Error('No agent response received');

    // 5. End Session
    console.log('\n--- 5. Testing /api/sessions/:id/end ---');
    const endRes = await fetch(`${baseUrl}/api/sessions/${session.id}/end`, {
      method: 'POST',
    });
    const endedSession = await endRes.json();
    console.log(`Session ended: status = ${endedSession.status}, duration = ${endedSession.durationSeconds}s`);
    if (endedSession.status !== 'completed') throw new Error('End session failed');

    // 6. Metrics
    console.log('\n--- 6. Testing /api/metrics ---');
    const metricsRes = await fetch(`${baseUrl}/api/metrics`);
    const metrics = await metricsRes.json();
    console.log('Metrics summary:', metrics);
    if (metrics.totalSessions === 0) throw new Error('Metrics totalSessions is 0');

    console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  server.close();
  process.exit(1);
});
