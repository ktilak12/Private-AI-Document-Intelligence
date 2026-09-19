import { Router, Request, Response } from 'express';
import { retrievalService } from '../services/retrieval.service';
import { llmService } from '../services/llm.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

// Store query history in memory for quick audit & evaluation
interface ChatHistoryItem {
  id: string;
  userId: string;
  query: string;
  answer: string;
  citations: any[];
  confidence: number;
  evaluationMetrics: any;
  timestamp: string;
}

const chatHistory: ChatHistoryItem[] = [];

// Basic Prompt Injection & Jailbreak Guardrail Detector
function containsPromptInjection(text: string): boolean {
  const dangerousPatterns = [
    /ignore (all )?(previous|prior) (instructions|prompts|rules)/i,
    /system (prompt|override|command)/i,
    /you are now in (developer|dan|jailbreak) mode/i,
    /reveal (your|the) (system prompt|hidden rules|secret key)/i,
  ];

  return dangerousPatterns.some(pattern => pattern.test(text));
}

/**
 * Perform Grounded RAG Query (Protected)
 */
router.post('/query', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { query, documentIds, topK } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'Validation Error', message: 'Query parameter is required and cannot be empty.' });
      return;
    }

    // Input length limitation to prevent token buffer overflow
    if (query.length > 1000) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Query is too long. Please restrict questions to under 1000 characters.'
      });
      return;
    }

    // Check Prompt Injection Guardrails
    if (containsPromptInjection(query)) {
      res.status(400).json({
        error: 'Security Alert: Prompt Injection Detected',
        message: 'Your query contains restricted prompt injection instructions and has been blocked by PAIDI Security Guardrails.'
      });
      return;
    }

    // 1. Hybrid Retrieval
    const searchResults = await retrievalService.search(query, documentIds, Math.min(topK || 4, 10));

    // 2. Grounded Answer Synthesis with Exact Citations
    const ragResponse = await llmService.generateGroundedAnswer(query, searchResults);

    // 3. Record History with User Identity
    const historyItem: ChatHistoryItem = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user?.id || 'anonymous',
      query,
      answer: ragResponse.answer,
      citations: ragResponse.citations,
      confidence: ragResponse.confidence,
      evaluationMetrics: ragResponse.evaluationMetrics,
      timestamp: new Date().toISOString(),
    };

    chatHistory.unshift(historyItem);

    res.status(200).json({
      id: historyItem.id,
      query,
      answer: ragResponse.answer,
      citations: ragResponse.citations,
      confidence: ragResponse.confidence,
      evaluationMetrics: ragResponse.evaluationMetrics,
      retrievedCount: ragResponse.retrievedCount,
      timestamp: historyItem.timestamp,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process RAG query', details: error.message });
  }
});

/**
 * Retrieve Query History (Protected)
 */
router.get('/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  // Filter history by user unless user is admin
  const userHistory = req.user?.role === 'admin'
    ? chatHistory
    : chatHistory.filter(h => h.userId === req.user?.id);

  res.status(200).json({
    total: userHistory.length,
    history: userHistory.slice(0, 50)
  });
});

export default router;
