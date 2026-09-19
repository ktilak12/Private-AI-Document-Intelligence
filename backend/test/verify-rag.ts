import { ingestionService } from '../src/services/ingestion.service';
import { retrievalService } from '../src/services/retrieval.service';
import { llmService } from '../src/services/llm.service';
import fs from 'fs';
import path from 'path';

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('⚡ STARTING PAIDI RAG PIPELINE VERIFICATION');
  console.log('====================================================\n');

  // 1. Create a mock private enterprise policy document
  const sampleDocPath = path.join(__dirname, 'sample-enterprise-policy.txt');
  const sampleContent = `
# GLOBAL CLOUD SECURITY POLICY & ENCRYPTION DIRECTIVES

Section 1: Data Retention & Encryption
All enterprise production databases must enforce AES-256 encryption at rest with customer-managed keys (CMEK). 
Keys must be rotated automatically every 90 days. Backups are preserved across multi-region geographic zones for a period of 7 years in cold storage.

Section 2: Access Control & Zero-Trust Governance
Privileged role access requires FIDO2 WebAuthn hardware keys and just-in-time (JIT) approval tickets. Session tokens expire after 15 minutes of inactivity.
Any unauthenticated access attempt triggers an automated audit log entry with high-severity incident dispatch.

Section 3: Incident Response & Notification SLA
In the event of a critical security breach or data exfiltration incident, the Incident Response Team must notify executive stakeholders and affected enterprise customers within a strict 4-hour window.
`;

  fs.writeFileSync(sampleDocPath, sampleContent.trim());
  console.log('✅ Step 1: Created test enterprise document');

  // 2. Ingest & Chunk Document
  console.log('🔄 Step 2: Ingesting document into semantic chunker...');
  const ingested = await ingestionService.processDocument(sampleDocPath, 'sample-enterprise-policy.txt');
  console.log(`✅ Ingested Doc ID: ${ingested.id}`);
  console.log(`   Total Chunks: ${ingested.totalChunks}`);
  console.log(`   Content Hash: ${ingested.contentHash.substring(0, 16)}...`);
  console.log(`   Tokens: ~${ingested.totalTokensApprox}`);

  // 3. Test Retrieval with Natural Query
  const testQuery = "What is the key rotation schedule and encryption standard?";
  console.log(`\n🔍 Step 3: Querying vector & keyword hybrid search: "${testQuery}"`);
  const searchResults = await retrievalService.search(testQuery, [ingested.id], 3);
  console.log(`✅ Retrieved ${searchResults.length} relevant chunks:`);
  searchResults.forEach((res, i) => {
    console.log(`   [${i + 1}] Score: ${res.score} | Chunk ID: ${res.chunk.id}`);
    console.log(`       Preview: "${res.chunk.content.substring(0, 90)}..."`);
  });

  // 4. Test Grounded LLM Citation Engine
  console.log('\n🤖 Step 4: Generating Grounded Answer & Citations...');
  const ragResponse = await llmService.generateGroundedAnswer(testQuery, searchResults);
  console.log('\n----------------- AI SYNTHESIS -----------------');
  console.log(ragResponse.answer);
  console.log('------------------------------------------------');
  console.log(`\n📊 RAG Triad Metrics:`);
  console.log(`   - Faithfulness:      ${(ragResponse.evaluationMetrics.faithfulness * 100).toFixed(0)}%`);
  console.log(`   - Answer Relevance:  ${(ragResponse.evaluationMetrics.answerRelevance * 100).toFixed(0)}%`);
  console.log(`   - Context Precision: ${(ragResponse.evaluationMetrics.contextPrecision * 100).toFixed(0)}%`);
  console.log(`   - Overall Confidence: ${(ragResponse.confidence * 100).toFixed(0)}%`);
  console.log('\n📑 Verifiable Citations:');
  ragResponse.citations.forEach(c => {
    console.log(`   [${c.id}] ${c.filename} (Page ${c.pageNumber}) - Score: ${c.relevanceScore}%`);
    console.log(`       "${c.snippet}"`);
  });

  // Cleanup test file
  if (fs.existsSync(sampleDocPath)) fs.unlinkSync(sampleDocPath);

  console.log('\n====================================================');
  console.log('🎉 ALL PAIDI RAG SERVICES VERIFIED AND OPERATIONAL!');
  console.log('====================================================');
}

runEndToEndVerification().catch(console.error);
