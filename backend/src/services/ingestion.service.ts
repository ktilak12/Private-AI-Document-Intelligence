import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

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

export interface DocumentExecutiveSummary {
  bullets: string[];
  keyEntities: {
    monetary: string[];
    dates: string[];
    percentages: string[];
  };
  estimatedReadingMinutes: number;
}

export interface IngestedDocument {
  id: string;
  filename: string;
  fileType: string;
  contentHash: string;
  totalChunks: number;
  totalTokensApprox: number;
  status: 'processing' | 'ready' | 'failed';
  summary?: DocumentExecutiveSummary;
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
   * Generates automated executive summary and entity highlights from document text
   */
  public generateExecutiveSummary(text: string): DocumentExecutiveSummary {
    if (!text || text.trim().length === 0) {
      return {
        bullets: ['Empty document with no extractable text content.'],
        keyEntities: { monetary: [], dates: [], percentages: [] },
        estimatedReadingMinutes: 0,
      };
    }

    // 1. Extract Key Sentences / Bullets
    const sentences = text
      .split(/(?<=[.?!])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 25 && !s.startsWith('#'));

    const bullets: string[] = [];
    if (sentences.length > 0) bullets.push(sentences[0]);
    if (sentences.length > 3) bullets.push(sentences[Math.floor(sentences.length / 2)]);
    if (sentences.length > 6) bullets.push(sentences[sentences.length - 1]);
    if (bullets.length === 0) {
      bullets.push(text.substring(0, 150) + '...');
    }

    // 2. Extract Entities via Regex
    const monetaryMatches = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:Million|Billion|USD|EUR|k|M|B))?/gi) || [];
    const dateMatches = text.match(/\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|Q[1-4]\s+\d{4})\b/gi) || [];
    const percentMatches = text.match(/\b\d+(?:\.\d+)?%/g) || [];

    const uniqueMonetary = Array.from(new Set(monetaryMatches)).slice(0, 5);
    const uniqueDates = Array.from(new Set(dateMatches)).slice(0, 5);
    const uniquePercents = Array.from(new Set(percentMatches)).slice(0, 5);

    // 3. Estimated Reading Time (approx. 200 words per minute)
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return {
      bullets: bullets.slice(0, 3),
      keyEntities: {
        monetary: uniqueMonetary,
        dates: uniqueDates,
        percentages: uniquePercents,
      },
      estimatedReadingMinutes,
    };
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

      // 3. Excel Spreadsheet (.xlsx, .xls) Parsing
      if (ext === '.xlsx' || ext === '.xls') {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetTexts: string[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          if (csvText && csvText.trim().length > 0) {
            sheetTexts.push(`### Sheet: ${sheetName}\n${csvText}`);
          }
        });

        if (sheetTexts.length > 0) {
          return sheetTexts.join('\n\n');
        }
      }

      // 4. Plain Text, Markdown, JSON, CSV
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

      // If we aren't at the end of the text, try to find a natural break
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
   * Full ingestion pipeline: Reads -> Hashes -> Parses -> Chunks -> Indexes -> Summarizes
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
    const summary = this.generateExecutiveSummary(rawText);

    const ingested: IngestedDocument = {
      id: docId,
      filename: originalFilename,
      fileType: path.extname(originalFilename).replace('.', '').toUpperCase() || 'TXT',
      contentHash: hash,
      totalChunks: chunks.length,
      totalTokensApprox: Math.ceil(rawText.length / 4),
      status: 'ready',
      summary,
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
