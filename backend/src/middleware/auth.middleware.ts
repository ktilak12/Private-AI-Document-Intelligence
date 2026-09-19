import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'paidi-enterprise-fallback-secret-key-32-chars-min';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Validates JWT Bearer Token and attaches verified user identity
 */
export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication Required',
      message: 'Missing or malformed Authorization header. Please provide a valid Bearer token.'
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role || 'user'
    };
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token Expired', message: 'Your session has expired. Please sign in again.' });
      return;
    }
    res.status(403).json({ error: 'Invalid Token', message: 'Authentication token verification failed.' });
  }
};

/**
 * Role-Based Access Control (RBAC) Guard
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
      });
      return;
    }
    next();
  };
};
