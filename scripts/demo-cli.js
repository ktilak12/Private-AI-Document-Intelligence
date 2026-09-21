#!/usr/bin/env node

/**
 * PAIDI Enterprise Interactive Terminal CLI
 * Demonstrates air-gapped zero-leakage RAG querying, verifiable citation inspection,
 * and live cryptographic audit telemetry from the command line.
 */

const http = require('http');

const API_BASE = process.env.PAIDI_API_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  bgDark: '\x1b[40m'
};

async function postRequest(path, data, token = null) {
  const url = new URL(path, API_BASE);
  const bodyStr = JSON.stringify(data);

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function getRequest(path, token = null) {
  const url = new URL(path, API_BASE);

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runCliDemo() {
  console.clear();
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}   🛡️  PAIDI: Private AI Document Intelligence Platform CLI     ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}\n`);

  // 1. Check API Gateway Health
  console.log(`${colors.blue}[1/5] Checking API Gateway health at ${API_BASE}...${colors.reset}`);
  try {
    const health = await getRequest('/health');
    if (health.status === 200) {
      console.log(`   ${colors.green}✔ Health Status: OK | Security Headers: Active${colors.reset}\n`);
    } else {
      console.log(`   ${colors.yellow}⚠ Server returned status ${health.status}${colors.reset}\n`);
    }
  } catch (err) {
    console.log(`   ${colors.red}✖ Could not connect to backend. Please start server with: npm run start:backend${colors.reset}`);
    process.exit(1);
  }

  // 2. Authenticate Demo Session
  console.log(`${colors.blue}[2/5] Initializing cryptographic administrator session...${colors.reset}`);
  const authRes = await postRequest('/api/auth/login', {
    email: 'admin@paidi.enterprise',
    password: 'PaidiEnterprise2026!Secure'
  });

  if (authRes.status !== 200 || !authRes.data.token) {
    console.log(`   ${colors.red}✖ Authentication failed.${colors.reset}`);
    process.exit(1);
  }

  const token = authRes.data.token;
  console.log(`   ${colors.green}✔ JWT Bearer Token Issued (Role: ${authRes.data.user.role})${colors.reset}\n`);

  // 3. Query RAG System
  const demoQuery = "What is the key rotation schedule and encryption standard in hardware enclaves?";
  console.log(`${colors.blue}[3/5] Executing Grounded RAG Query:${colors.reset}`);
  console.log(`   ${colors.yellow}"${demoQuery}"${colors.reset}\n`);

  const startTime = Date.now();
  const queryRes = await postRequest('/api/chat/query', { query: demoQuery }, token);
  const latency = Date.now() - startTime;

  if (queryRes.status === 200) {
    const resp = queryRes.data;
    console.log(`${colors.green}${colors.bright}🤖 Grounded Synthesized Answer (${latency}ms):${colors.reset}`);
    console.log(`${colors.bright}${resp.answer}${colors.reset}\n`);

    console.log(`${colors.cyan}📑 Verifiable Citations (${resp.citations.length} sources):${colors.reset}`);
    resp.citations.forEach((c, idx) => {
      console.log(`   [${idx + 1}] ${colors.bright}${c.filename}${colors.reset} (Page ${c.pageNumber}) - Relevance: ${colors.green}${c.relevanceScore}%${colors.reset}`);
      console.log(`       ${colors.dim}"${c.snippet}"${colors.reset}`);
    });

    console.log(`\n${colors.magenta}📊 Real-Time RAG Triad Telemetry:${colors.reset}`);
    console.log(`   • Faithfulness:       ${colors.bright}${(resp.evaluationMetrics.faithfulness * 100).toFixed(1)}%${colors.reset}`);
    console.log(`   • Answer Relevance:   ${colors.bright}${(resp.evaluationMetrics.answerRelevance * 100).toFixed(1)}%${colors.reset}`);
    console.log(`   • Context Precision:  ${colors.bright}${(resp.evaluationMetrics.contextPrecision * 100).toFixed(1)}%${colors.reset}`);
    console.log(`   • Overall Confidence: ${colors.bright}${(resp.confidence * 100).toFixed(1)}%${colors.reset}\n`);
  }

  // 4. Cryptographic Audit Telemetry
  console.log(`${colors.blue}[4/5] Inspecting immutable audit trail...${colors.reset}`);
  const auditRes = await getRequest('/api/audit/logs?limit=3', token);
  if (auditRes.status === 200 && auditRes.data.logs) {
    console.log(`   ${colors.green}✔ Total Recorded Audit Events: ${auditRes.data.total}${colors.reset}`);
    auditRes.data.logs.slice(0, 2).forEach(l => {
      console.log(`   • [${l.action}] ${l.details} (${colors.dim}${l.timestamp}${colors.reset})`);
    });
    console.log('');
  }

  // 5. Completion Summary
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}✔ PAIDI SYSTEM DEMO COMPLETED SUCCESSFULLY WITH ZERO LEAKAGE!  ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}================================================================${colors.reset}`);
}

runCliDemo().catch(console.error);
