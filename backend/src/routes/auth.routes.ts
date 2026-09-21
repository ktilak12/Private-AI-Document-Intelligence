import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { JWT_SECRET } from '../config/security.config';
import { recordAuditLog } from './audit.routes';

const router = Router();

// In-memory secure user store (until PostgreSQL sync)
interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'auditor' | 'user';
  createdAt: string;
}

const usersDb: Map<string, StoredUser> = new Map();

// Seed initial default demo admin securely if empty
(async () => {
  const adminEmail = 'admin@paidi.enterprise';
  if (!usersDb.has(adminEmail)) {
    const defaultPasswordHash = await bcrypt.hash('PaidiEnterprise2026!Secure', 12);
    usersDb.set(adminEmail, {
      id: 'usr_admin_default_01',
      email: adminEmail,
      passwordHash: defaultPasswordHash,
      role: 'admin',
      createdAt: new Date().toISOString()
    });
  }
})();

/**
 * Register User with password complexity check and bcrypt hashing
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid Email', message: 'Please provide a valid email address.' });
      return;
    }

    // Password strength requirement: Min 8 chars, 1 uppercase, 1 lowercase, 1 number
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      res.status(400).json({
        error: 'Weak Password',
        message: 'Password must be at least 8 characters long and contain uppercase, lowercase, and a number.'
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (usersDb.has(normalizedEmail)) {
      res.status(409).json({ error: 'Conflict', message: 'User already exists with this email address.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const assignedRole = role === 'admin' || role === 'auditor' ? role : 'user';

    const newUser: StoredUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      createdAt: new Date().toISOString()
    };

    usersDb.set(normalizedEmail, newUser);

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    recordAuditLog(
      newUser.id,
      newUser.email,
      'AUTH_REGISTER',
      `User account created with role [${newUser.role}]`,
      req.ip || '127.0.0.1',
      'SUCCESS',
      newUser.id
    );

    res.status(201).json({
      message: 'Registration successful',
      user: { id: newUser.id, email: newUser.email, role: newUser.role },
      token
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * Login User with timing-attack resistant password check
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = usersDb.get(normalizedEmail);

    if (!user) {
      // Execute dummy hash comparison to mitigate timing attacks
      await bcrypt.compare(password, '$2a$12$dummyHashToPreventTimingAttacksXXXXXXXXXXXXXXXXXX');
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    recordAuditLog(
      user.id,
      user.email,
      'AUTH_LOGIN',
      `User logged in successfully (Role: ${user.role})`,
      req.ip || '127.0.0.1',
      'SUCCESS',
      user.id
    );

    res.status(200).json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, role: user.role },
      token
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

/**
 * Get Current User Identity (Protected)
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.status(200).json({ user: req.user });
});

export default router;
