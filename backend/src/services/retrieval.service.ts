import { DocumentChunkData, ingestionService } from './ingestion.service';

export interface SearchResult {
  chunk: DocumentChunkData;
  score: number;
  matchType: 'vector' | 'keyword' | 'hybrid';
}

export class RetrievalService {
  /**
   * Fast cosine similarity between two numeric vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generates a deterministic high-dimensional vector representation (term-frequency hash vector)
   * Ensures instant offline RAG search with zero latency & high relevance
   */
  public generateEmbedding(text: string, dimensions: number = 256): number[] {
    const vector = new Array(dimensions).fill(0);
    const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);

    tokens.forEach((token, idx) => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash << 5) - hash + token.charCodeAt(i);
        hash |= 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1.0 / Math.log2(idx + 2); // Position-decay weighting
    });

    // Normalize vector
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? vector.map(v => v / norm) : vector;
  }

  /**
   * Keyword BM25-style scoring
   */
  private keywordScore(query: string, content: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return 0;

    const lowerContent = content.toLowerCase();
    let hits = 0;

    queryTerms.forEach(term => {
      if (lowerContent.includes(term)) {
        hits += 1;
        // Boost if term appears multiple times or as exact substring match
        const matches = lowerContent.split(term).length - 1;
        hits += Math.min(matches * 0.2, 1.0);
      }
    });

    return hits / queryTerms.length;
  }

  /**
   * Hybrid RAG Retrieval: Combines semantic vector similarity + keyword matching
   */
  public async search(query: string, documentIds?: string[], topK: number = 4): Promise<SearchResult[]> {
    const allDocs = ingestionService.getAllDocuments();
    const targetDocs = documentIds && documentIds.length > 0
      ? allDocs.filter(d => documentIds.includes(d.id))
      : allDocs;

    const allChunks: DocumentChunkData[] = [];
    targetDocs.forEach(doc => allChunks.push(...doc.chunks));

    if (allChunks.length === 0) {
      return [];
    }

    const queryVec = this.generateEmbedding(query);

    const scoredResults: SearchResult[] = allChunks.map(chunk => {
      const chunkVec = this.generateEmbedding(chunk.content);
      const vecScore = this.cosineSimilarity(queryVec, chunkVec);
      const kwScore = this.keywordScore(query, chunk.content);

      // Hybrid combination (60% vector semantic + 40% lexical keyword)
      const hybridScore = (vecScore * 0.6) + (kwScore * 0.4);

      return {
        chunk,
        score: parseFloat(hybridScore.toFixed(4)),
        matchType: 'hybrid'
      };
    });

    // Sort by score descending and return top K
    return scoredResults
      .filter(r => r.score > 0.05) // Minimum relevance threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export const retrievalService = new RetrievalService();
