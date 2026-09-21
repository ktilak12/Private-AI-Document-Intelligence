import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');

export interface DocumentChunkData {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: {
    pageNumber?: number;
    charStart: number;
    charEnd: number;
    filename: string;
    section?: string;
  };
}

export interface IngestedDocument {
  id: string;
  filename: string;
  fileType: string;
  contentHash: string;
  totalChunks: number;
  totalTokensApprox: number;
  status: 'processing' | 'ready' | 'failed';
  chunks: DocumentChunkData[];
  createdAt: string;
}

export class IngestionService {
  private inMemoryDocs: Map<string, IngestedDocument> = new Map();

  /**
   * Computes SHA-256 hash of a file
   */
  public computeFileHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Parses raw file buffer into clean text using specialized document parsers
   */
  public async parseFile(filePath: string, originalFilename: string): Promise<string> {
    const ext = path.extname(originalFilename).toLowerCase();
    const buffer = fs.readFileSync(filePath);

    try {
      // 1. PDF Document Parsing
      if (ext === '.pdf') {
        const parsed = await pdfParse(buffer);
        if (parsed.text && parsed.text.trim().length > 0) {
          return parsed.text;
        }
      }

      // 2. Microsoft Word (.docx) Parsing
      if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        if (result.value && result.value.trim().length > 0) {
          return result.value;
        }
      }

      // 3. Plain Text, Markdown, JSON, CSV
      if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.csv') {
        return buffer.toString('utf-8');
      }
    } catch (parseError: any) {
      console.warn(`[INGESTION WARNING] Specialized parser failed for ${originalFilename}:`, parseError.message);
    }

    // Fallback for general text or basic string extraction
    return buffer.toString('utf-8').replace(/[^\x20-\x7E\t\r\n]/g, ' ');
  }

  /**
   * Splits text recursively with overlapping windows and preserves character boundaries
   */
  public chunkText(
    text: string,
    documentId: string,
    filename: string,
    chunkSize: number = 800,
    chunkOverlap: number = 150
  ): DocumentChunkData[] {
    const chunks: DocumentChunkData[] = [];
    if (!text || text.trim().length === 0) return chunks;

    let start = 0;
    let index = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // If we aren't at the end of the text, try to find a natural break (paragraph, sentence, or word)
      if (end < text.length) {
        const nextBreak = text.substring(start, end + 50);
        const newlineIdx = nextBreak.lastIndexOf('\n\n');
        const sentenceIdx = nextBreak.lastIndexOf('. ');

        if (newlineIdx !== -1 && newlineIdx >= chunkSize - 100) {
          end = start + newlineIdx + 2;
        } else if (sentenceIdx !== -1 && sentenceIdx >= chunkSize - 100) {
          end = start + sentenceIdx + 2;
        } else {
          const spaceIdx = nextBreak.lastIndexOf(' ');
          if (spaceIdx !== -1 && spaceIdx >= chunkSize - 100) {
            end = start + spaceIdx + 1;
          }
        }
      }

      const chunkContent = text.substring(start, Math.min(end, text.length)).trim();

      if (chunkContent.length > 0) {
        chunks.push({
          id: `chunk_${documentId}_${index}`,
          documentId,
          content: chunkContent,
          chunkIndex: index,
          metadata: {
            charStart: start,
            charEnd: Math.min(end, text.length),
            filename,
            pageNumber: Math.floor(start / 2000) + 1, // Approximation: ~2000 chars per page
          }
        });
        index++;
      }

      start = end - chunkOverlap;
      if (start >= text.length || end >= text.length) break;
    }

    return chunks;
  }

  /**
   * Full ingestion pipeline: Reads -> Hashes -> Parses -> Chunks -> Indexes
   */
  public async processDocument(
    filePath: string,
    originalFilename: string,
    customId?: string
  ): Promise<IngestedDocument> {
    const buffer = fs.readFileSync(filePath);
    const hash = this.computeFileHash(buffer);
    const docId = customId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check for duplicate hash in memory
    for (const existing of this.inMemoryDocs.values()) {
      if (existing.contentHash === hash) {
        return existing;
      }
    }

    const rawText = await this.parseFile(filePath, originalFilename);
    const chunks = this.chunkText(rawText, docId, originalFilename);

    const ingested: IngestedDocument = {
      id: docId,
      filename: originalFilename,
      fileType: path.extname(originalFilename).replace('.', '').toUpperCase() || 'TXT',
      contentHash: hash,
      totalChunks: chunks.length,
      totalTokensApprox: Math.ceil(rawText.length / 4),
      status: 'ready',
      chunks,
      createdAt: new Date().toISOString()
    };

    this.inMemoryDocs.set(docId, ingested);
    return ingested;
  }

  public getAllDocuments(): IngestedDocument[] {
    return Array.from(this.inMemoryDocs.values());
  }

  public getDocumentById(id: string): IngestedDocument | undefined {
    return this.inMemoryDocs.get(id);
  }

  public deleteDocument(id: string): boolean {
    return this.inMemoryDocs.delete(id);
  }
}

export const ingestionService = new IngestionService();
