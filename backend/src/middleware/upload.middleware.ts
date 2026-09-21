import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed extensions and MIME types whitelist
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.json', '.csv', '.xlsx', '.xls']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // Fallback for raw text files
]);

// Sanitize filename to prevent Path Traversal, Null Byte Injections, and dangerous characters
export function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') return 'unnamed-document.txt';
  const baseName = path.basename(originalName);
  // Remove null bytes, path traversal sequences, and special characters
  const cleanName = baseName.replace(/[\0\x00-\x1f\x7f\\/\?%*:|"<>]/g, '').replace(/\.\.+/g, '.');
  return cleanName || 'unnamed-document.txt';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const cleanName = sanitizeFilename(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${cleanName}`);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // Enforce 25MB max file size to prevent memory exhaustion
    files: 5,                  // Maximum 5 files per batch
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Security Alert: File type ${ext} is blocked. Only PDF, DOCX, TXT, MD, JSON, and CSV are allowed.`));
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) && file.mimetype) {
      return cb(new Error(`Security Alert: Invalid MIME type (${file.mimetype}) detected.`));
    }

    cb(null, true);
  }
});
