import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';
import { ingestionService } from '../services/ingestion.service';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

/**
 * Upload single or multiple documents and trigger ingestion (Protected)
 */
router.post('/upload', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file attached in request' });
      return;
    }

    const ingested = await ingestionService.processDocument(
      req.file.path,
      req.file.originalname
    );

    res.status(201).json({
      message: 'Document successfully ingested and indexed',
      document: {
        id: ingested.id,
        filename: ingested.filename,
        fileType: ingested.fileType,
        totalChunks: ingested.totalChunks,
        totalTokensApprox: ingested.totalTokensApprox,
        status: ingested.status,
        createdAt: ingested.createdAt,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process document', details: error.message });
  }
});

/**
 * List all indexed documents (Protected)
 */
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const docs = ingestionService.getAllDocuments().map(doc => ({
    id: doc.id,
    filename: doc.filename,
    fileType: doc.fileType,
    totalChunks: doc.totalChunks,
    totalTokensApprox: doc.totalTokensApprox,
    status: doc.status,
    createdAt: doc.createdAt,
  }));

  res.status(200).json({
    total: docs.length,
    documents: docs
  });
});

/**
 * Get document details including chunks (Protected)
 */
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const doc = ingestionService.getDocumentById(docId);
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(200).json({ document: doc });
});

/**
 * Delete a document (Protected)
 */
router.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const docId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = ingestionService.deleteDocument(docId);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(200).json({ message: 'Document deleted successfully' });
});

export default router;
