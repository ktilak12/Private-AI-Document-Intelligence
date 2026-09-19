import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// 1. Security Headers via Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Customized for API Gateway
}));

// 2. Strict CORS Configuration (Restrict allowed origins in production)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5500', 'http://localhost:8080'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy: Origin not permitted.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 3. Rate Limiting Protection (Anti-DDoS & Brute Force)
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again after 15 minutes.'
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter limit for auth endpoints to prevent brute-forcing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

app.use(express.json({ limit: '10mb' })); // Limit body payload to prevent memory overflow
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limits
app.use('/api/', globalApiLimiter);
app.use('/api/auth/', authLimiter);

import authRoutes from './routes/auth.routes';
import documentsRoutes from './routes/documents.routes';
import chatRoutes from './routes/chat.routes';

// Basic health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'PAIDI AI Document Intelligence',
    timestamp: new Date().toISOString(),
    security: {
      headersSecured: true,
      rateLimitingEnabled: true,
      authEnforced: true,
    }
  });
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/chat', chatRoutes);

// 4. Centralized Error Handler (Prevent Stack Trace Leakage)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Log server-side only
  console.error(`[SECURITY ERROR LOG] ${new Date().toISOString()} - ${req.method} ${req.url} - Error:`, err.message);

  const statusCode = err.status || (err.message.includes('Security Alert') ? 400 : 500);

  res.status(statusCode).json({
    error: statusCode === 400 ? 'Security Violation' : 'Internal Server Error',
    message: err.message || 'An unexpected error occurred. Request has been safely aborted.',
  });
});

export default app;
