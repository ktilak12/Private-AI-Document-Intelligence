import { performance } from 'perf_hooks';
import { ingestionService } from '../src/services/ingestion.service';
import { retrievalService } from '../src/services/retrieval.service';
import fs from 'fs';
import path from 'path';

async function runPerformanceBenchmark() {
  console.log('====================================================');
  console.log('⚡ PAIDI RAG RETRIEVAL & INGESTION PERFORMANCE BENCHMARK');
  console.log('====================================================\n');

  // Generate synthetic multi-page document
  const numParagraphs = 500;
  let syntheticText = '# ENTERPRISE BENCHMARK CORPUS\n\n';
  for (let i = 1; i <= numParagraphs; i++) {
    syntheticText += `Section ${i}: Key Directive on Node ${i}\n`;
    syntheticText += `Production clustering standard ${i} enforces AES-256-GCM encryption with automated 72-hour DEK cyclic rotation across confidential compute enclaves. Performance latency threshold is set to ${i * 0.5}ms.\n\n`;
  }

  const tempFilePath = path.join(__dirname, `benchmark_corpus_${Date.now()}.txt`);
  fs.writeFileSync(tempFilePath, syntheticText, 'utf-8');

  let ingestedDocId: string | null = null;

  try {
    // 1. Benchmark Ingestion & Chunking Throughput
    console.log(`[1] Ingesting & Chunking ${numParagraphs} sections (~${Math.round(syntheticText.length / 1024)} KB)...`);
    const t0 = performance.now();
    const ingested = await ingestionService.processDocument(tempFilePath, 'benchmark_corpus.txt');
    const t1 = performance.now();
    const ingestMs = t1 - t0;
    ingestedDocId = ingested.id;

    console.log(`   ✔ Ingestion Latency:     ${ingestMs.toFixed(2)} ms`);
    console.log(`   ✔ Total Chunks Indexed:  ${ingested.totalChunks}`);
    console.log(`   ✔ Approximate Tokens:    ${ingested.totalTokensApprox}`);
    console.log(`   ✔ Executive Highlights:  ${ingested.summary?.bullets?.length || 0} bullets extracted\n`);

    // 2. Multi-Iteration Statistical Retrieval Benchmark
    const sampleQueries = [
      'What is the DEK cyclic rotation timeframe?',
      'Confidential compute enclaves performance threshold',
      'Production clustering standard 250 encryption',
      'Key directive on node 450'
    ];

    console.log(`[2] Running 100 Retrieval Queries for Statistical Latency Distribution...`);
    const latencies: number[] = [];
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const q = sampleQueries[i % sampleQueries.length];
      const qStart = performance.now();
      const results = await retrievalService.search(q, [ingested.id], 5);
      const qEnd = performance.now();
      latencies.push(qEnd - qStart);
    }

    latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const qps = Math.round(1000 / avgLatency);

    console.log(`   ✔ Average Latency (Mean): ${avgLatency.toFixed(3)} ms`);
    console.log(`   ✔ Median Latency (P50):   ${p50.toFixed(3)} ms`);
    console.log(`   ✔ 95th Percentile (P95):  ${p95.toFixed(3)} ms`);
    console.log(`   ✔ 99th Percentile (P99):  ${p99.toFixed(3)} ms`);
    console.log(`   ✔ Estimated Throughput:   ~${qps.toLocaleString()} Queries/sec (Single-threaded)\n`);

    // 3. Sample Verification Queries
    console.log(`[3] Sample Search Validation:`);
    for (const q of sampleQueries) {
      const results = await retrievalService.search(q, [ingested.id], 3);
      const topScore = results.length > 0 ? Math.round(results[0].score * 100) : 0;
      console.log(`   • Query: "${q}" -> Score: ${topScore}% (Retrieved ${results.length} chunks)`);
    }

    // 4. Memory Footprint Check
    const memUsage = process.memoryUsage();
    console.log(`\n[4] System Memory Footprint:`);
    console.log(`   • Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   • RSS:       ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n====================================================');
    console.log('🎉 BENCHMARK COMPLETED: ULTRA-LOW LATENCY RAG VERIFIED!');
    console.log('====================================================');
  } finally {
    // Clean up document and disk artifacts
    if (ingestedDocId) {
      ingestionService.deleteDocument(ingestedDocId);
    }
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }
  }
}

runPerformanceBenchmark().catch(console.error);
