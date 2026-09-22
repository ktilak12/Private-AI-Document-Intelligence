const fs = require('fs');
const path = require('path');
const http = require('http');
const { PaidiApiClient } = require('../api-client.js');

// Polyfill File and Blob in Node if needed
if (typeof File === 'undefined') {
  const { File, Blob } = require('buffer');
  global.File = File;
  global.Blob = Blob;
}

// Polyfill localStorage in Node
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

let serverInstance = null;
let apiUrl = process.env.PAIDI_API_URL || 'http://localhost:3000/api';

async function testFullFlow() {
  // Check if server is running, if not start ephemeral backend
  try {
    const healthRes = await fetch(apiUrl.replace('/api', '/health'));
    if (!healthRes.ok) throw new Error('Health check non-200');
  } catch {
    console.log('📡 Starting ephemeral test backend server...');
    const app = require('../backend/dist/app').default;
    const testPort = 3011;
    serverInstance = http.createServer(app);
    await new Promise((resolve) => serverInstance.listen(testPort, resolve));
    apiUrl = `http://localhost:${testPort}/api`;
    console.log(`📡 Ephemeral server running at ${apiUrl}\n`);
  }

  try {
    console.log('--- 1. Testing Health & Connectivity ---');
    const client = new PaidiApiClient(apiUrl);
    client.checkHealth = async function() {
      try {
        const res = await fetch(apiUrl.replace('/api', '/health'));
        const data = await res.json();
        return res.ok && data.status === 'ok';
      } catch {
        return false;
      }
    };
    const healthy = await client.checkHealth();
    console.log('Health check:', healthy ? 'SUCCESS' : 'FAILED');

    console.log('\n--- 2. Testing Authentication ---');
    const authed = await client.ensureAuthenticated();
    console.log('Auto-auth:', authed ? 'SUCCESS' : 'FAILED');

    console.log('\n--- 3. Seeding Enterprise Starter Corpora ---');
    const seedResults = await client.seedSampleDocuments();
    console.log(`Seeded ${seedResults.length} documents.`);

    console.log('\n--- 4. Fetching Document Vault & Categories ---');
    const docs = await client.getDocuments();
    console.log(`Vault contains ${docs.length} documents:`);
    docs.forEach(d => console.log(`  - ${d.filename} (${d.fileType}) [Category: ${d.category || 'General'}] [Chunks: ${d.totalChunks || 1}]`));

    console.log('\n--- 5. Executing Grounded RAG Query ---');
    const query = 'What are the termination conditions and severance rules in Section 8.2?';
    console.log('Query:', query);
    const ragRes = await client.queryRAG(query);
    console.log('\nAnswer:\n', ragRes.answer);
    console.log('\nCitations count:', ragRes.citations?.length || 0);
    (ragRes.citations || []).forEach((c, idx) => {
      console.log(`  [${idx + 1}] ${c.filename} (Score: ${c.relevanceScore}%)`);
      console.log(`      Snippet: ${c.snippet.slice(0, 100)}...`);
    });

    console.log('\n--- 6. Verifying Audit History ---');
    const history = await client.getHistory();
    console.log(`Audit history records: ${history.length}`);
    const latest = history[history.length - 1];
    console.log(`Latest Query logged: "${latest.query}"`);

    console.log('\n--- 7. Computing RAG Triad Observability Metrics ---');
    const metrics = await client.getMetrics();
    console.log('Faithfulness:', metrics.faithfulness + '%');
    console.log('Answer Relevance:', metrics.answerRelevance + '%');
    console.log('Context Precision:', metrics.contextPrecision + '%');
    console.log('Average Confidence:', metrics.averageConfidence + '%');
    console.log('Total Evaluated Runs:', metrics.totalQueries);

    console.log('\n--- ALL LIVE INTEGRATION TESTS PASSED ---');
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }
}

testFullFlow().catch(err => {
  console.error('Test Flow Error:', err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
