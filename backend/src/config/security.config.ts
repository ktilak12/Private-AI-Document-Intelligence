import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PAIDI Enterprise Security Configuration & Guardrails
 */

// Cryptographically secure JWT Secret Resolution
let resolvedJwtSecret = process.env.JWT_SECRET;

if (!resolvedJwtSecret || resolvedJwtSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be configured with at least 32 characters in production.');
    process.exit(1);
  } else {
    // Generate secure ephemeral 256-bit key for local development
    resolvedJwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[SECURITY WARNING] No valid JWT_SECRET found in environment. Generated secure ephemeral key for session.');
  }
}

export const JWT_SECRET = resolvedJwtSecret;

/**
 * Advanced Prompt Injection & Jailbreak Guardrail Signatures
 */
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules|commands|constraints)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules)/i,
  /system\s+(prompt|override|command|directive|level|message)/i,
  /you\s+are\s+now\s+in\s+(developer|dan|jailbreak|unrestricted|god)\s+mode/i,
  /reveal\s+(your|the|all)\s+(system\s+prompt|hidden\s+rules|secret\s+key|api\s+key|instructions)/i,
  /print\s+(your|the)\s+(system\s+prompt|initial\s+prompt|instructions)/i,
  /bypass\s+(safety|security|content\s+filter|guardrails)/i,
  /roleplay\s+as\s+(an\s+unfiltered|an\s+unrestricted|a\s+hacked)/i,
  /\bbase64\b.*decode\s+and\s+execute/i,
];

/**
 * Scans input text for adversarial prompt injection attempts
 */
export function detectPromptInjection(input: string): { isMalicious: boolean; reason?: string } {
  if (!input || typeof input !== 'string') return { isMalicious: false };

  // Sanitize unicode control characters & zero-width spaces
  const normalized = input
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\0/g, '')
    .trim();

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isMalicious: true,
        reason: `Matched restricted security pattern: ${pattern.source}`,
      };
    }
  }

  return { isMalicious: false };
}

/**
 * Redacts sensitive PII & Secrets from logged telemetry
 */
export function sanitizeTelemetry(text: string): string {
  if (!text) return '';
  return text
    // Redact potential credit card numbers
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[REDACTED_PAYMENT_CARD]')
    // Redact US SSN patterns
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    // Redact Bearer tokens & API Keys
    .replace(/(Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/gi, '[REDACTED_TOKEN]')
    .replace(/(AIza[0-9A-Za-z-_]{35})/g, '[REDACTED_API_KEY]');
}
