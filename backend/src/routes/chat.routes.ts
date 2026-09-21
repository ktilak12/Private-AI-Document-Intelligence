import { Router, Response } from 'express';
import { retrievalService } from '../services/retrieval.service';
import { llmService } from '../services/llm.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { detectPromptInjection, sanitizeTelemetry } from '../config/security.config';
import { recordAuditLog } from './audit.routes';
import { recordEvaluationMetric } from './evaluation.routes';

const router = Router();

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: any[];
  timestamp: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// In-memory conversation store
const conversations: Map<string, ConversationSession> = new Map();

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

/**
 * POST /api/chat/conversations - Create a new conversation thread
 */
router.post('/conversations', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user?.id || 'usr_anonymous';
  const { title } = req.body;

  const session: ConversationSession = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: title ? sanitizeTelemetry(title) : 'New Document Intelligence Session',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  conversations.set(session.id, session);
  res.status(201).json({ conversation: session });
});

/**
 * GET /api/chat/conversations - List user's conversation threads
 */
router.get('/conversations', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user?.id;
  const userConvs = Array.from(conversations.values())
    .filter(c => req.user?.role === 'admin' || c.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  res.status(200).json({ conversations: userConvs });
});

/**
 * GET /api/chat/conversations/:id - Get specific conversation messages
 */
router.get('/conversations/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const convId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = conversations.get(convId);

  if (!session) {
    res.status(404).json({ error: 'Conversation session not found' });
    return;
  }

  if (req.user?.role !== 'admin' && session.userId !== req.user?.id) {
    res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to view this conversation' });
    return;
  }

  res.status(200).json({ conversation: session });
});

/**
 * POST /api/chat/query - Perform Grounded RAG Query (Protected)
 */
router.post('/query', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const userId = req.user?.id || 'anonymous';
  const userEmail = req.user?.email || 'anonymous@paidi.local';

  try {
    const { query, documentIds, topK, conversationId } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'Validation Error', message: 'Query parameter is required and cannot be empty.' });
      return;
    }

    // Input length limitation to prevent token buffer overflow
    if (query.length > 2000) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Query is too long. Please restrict questions to under 2000 characters.'
      });
      return;
    }

    // Check Advanced Prompt Injection & Jailbreak Guardrails
    const injectionCheck = detectPromptInjection(query);
    if (injectionCheck.isMalicious) {
      recordAuditLog(
        userId,
        userEmail,
        'SECURITY_BLOCKED',
        `Prompt injection blocked: ${injectionCheck.reason}`,
        req.ip || '127.0.0.1',
        'BLOCKED'
      );

      res.status(400).json({
        error: 'Security Alert: Prompt Injection Detected',
        message: 'Your query contains restricted adversarial prompt injection patterns and has been blocked by PAIDI Security Guardrails.'
      });
      return;
    }

    // 1. Hybrid Retrieval
    const searchResults = await retrievalService.search(query, documentIds, Math.min(topK || 4, 10));

    // 2. Grounded Answer Synthesis with Exact Citations
    const ragResponse = await llmService.generateGroundedAnswer(query, searchResults);
    const latencyMs = Date.now() - startTime;

    // 3. Record History & Telemetry
    const sanitizedQuery = sanitizeTelemetry(query);
    const sanitizedAnswer = sanitizeTelemetry(ragResponse.answer);

    const historyItem: ChatHistoryItem = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      query: sanitizedQuery,
      answer: sanitizedAnswer,
      citations: ragResponse.citations,
      confidence: ragResponse.confidence,
      evaluationMetrics: ragResponse.evaluationMetrics,
      timestamp: new Date().toISOString(),
    };

    chatHistory.unshift(historyItem);

    // Record Evaluation Metric
    recordEvaluationMetric(
      sanitizedQuery,
      sanitizedAnswer,
      ragResponse.evaluationMetrics,
      ragResponse.confidence,
      ragResponse.retrievedCount,
      latencyMs
    );

    // Record Audit Trail
    recordAuditLog(
      userId,
      userEmail,
      'RAG_QUERY',
      `Query executed with ${ragResponse.citations.length} citations (Confidence: ${Math.round(ragResponse.confidence * 100)}%)`,
      req.ip || '127.0.0.1',
      'SUCCESS',
      historyItem.id
    );

    // 4. Update Conversation Thread if provided
    if (conversationId && conversations.has(conversationId)) {
      const session = conversations.get(conversationId)!;
      session.messages.push({
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: sanitizedQuery,
        timestamp: new Date().toISOString(),
      });
      session.messages.push({
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: sanitizedAnswer,
        citations: ragResponse.citations,
        timestamp: new Date().toISOString(),
      });
      session.updatedAt = new Date().toISOString();
    }

    res.status(200).json({
      id: historyItem.id,
      query,
      answer: ragResponse.answer,
      citations: ragResponse.citations,
      confidence: ragResponse.confidence,
      evaluationMetrics: ragResponse.evaluationMetrics,
      retrievedCount: ragResponse.retrievedCount,
      latencyMs,
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
