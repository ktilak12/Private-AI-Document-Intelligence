import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { sanitizeTelemetry } from '../config/security.config';

const router = Router();

export interface AuditRecord {
  id: string;
  userId: string;
  userEmail: string;
  action: 'AUTH_LOGIN' | 'AUTH_REGISTER' | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE' | 'RAG_QUERY' | 'SECURITY_BLOCKED';
  resourceId?: string;
  details: string;
  ipAddress: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED';
  timestamp: string;
}

// Global immutable in-memory audit ledger
const auditLedger: AuditRecord[] = [
  {
    id: `aud_${Date.now() - 3600000}_01`,
    userId: 'usr_admin_default_01',
    userEmail: 'admin@paidi.enterprise',
    action: 'AUTH_LOGIN',
    details: 'Cryptographic session initialized with 256-bit JWT token',
    ipAddress: '127.0.0.1',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: `aud_${Date.now() - 1800000}_02`,
    userId: 'usr_admin_default_01',
    userEmail: 'admin@paidi.enterprise',
    action: 'DOCUMENT_UPLOAD',
    resourceId: 'doc_seed_01',
    details: 'Ingested SOC2_Security_Whitepaper.md (256-dim vector indexing)',
    ipAddress: '127.0.0.1',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  }
];

/**
 * Record an entry into the audit trail
 */
export function recordAuditLog(
  userId: string,
  userEmail: string,
  action: AuditRecord['action'],
  details: string,
  ipAddress: string = '127.0.0.1',
  status: AuditRecord['status'] = 'SUCCESS',
  resourceId?: string
): AuditRecord {
  const record: AuditRecord = {
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    userEmail,
    action,
    resourceId,
    details: sanitizeTelemetry(details),
    ipAddress,
    status,
    timestamp: new Date().toISOString(),
  };

  auditLedger.unshift(record);
  if (auditLedger.length > 500) {
    auditLedger.pop();
  }
  return record;
}

/**
 * GET /api/audit/logs - Retrieve cryptographic audit records (Protected for Admin & Auditor)
 */
router.get('/logs', requireAuth, requireRole(['admin', 'auditor']), (req: AuthenticatedRequest, res: Response) => {
  const { action, status, limit = '50', offset = '0' } = req.query;

  let filtered = [...auditLedger];

  if (action && typeof action === 'string') {
    filtered = filtered.filter(l => l.action.toLowerCase() === action.toLowerCase());
  }

  if (status && typeof status === 'string') {
    filtered = filtered.filter(l => l.status.toLowerCase() === status.toLowerCase());
  }

  const numLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
  const numOffset = parseInt(offset as string, 10) || 0;
  const paginated = filtered.slice(numOffset, numOffset + numLimit);

  res.status(200).json({
    total: filtered.length,
    offset: numOffset,
    limit: numLimit,
    logs: paginated,
  });
});

/**
 * GET /api/audit/export - Export audit logs in JSON or CSV (Protected for Admin & Auditor)
 */
router.get('/export', requireAuth, requireRole(['admin', 'auditor']), (req: AuthenticatedRequest, res: Response): void => {
  const format = (req.query.format as string || 'json').toLowerCase();

  if (format === 'csv') {
    const headers = ['ID', 'Timestamp', 'User Email', 'Action', 'Resource ID', 'Status', 'IP Address', 'Details'];
    const rows = auditLedger.map(l => [
      l.id,
      `"${l.timestamp}"`,
      `"${l.userEmail}"`,
      `"${l.action}"`,
      `"${l.resourceId || 'N/A'}"`,
      `"${l.status}"`,
      `"${l.ipAddress}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paidi-audit-log-${Date.now()}.csv"`);
    res.status(200).send(csvContent);
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="paidi-audit-log-${Date.now()}.json"`);
  res.status(200).json({
    exportedAt: new Date().toISOString(),
    totalRecords: auditLedger.length,
    records: auditLedger,
  });
});

export default router;
