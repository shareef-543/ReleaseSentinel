import { Router, Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storageService.js';
import { verifyPassword, generateToken, toSafeUser } from '../services/authService.js';
import { authenticateToken, type AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import type { RegisterRequest, LoginRequest } from '../types/serverTypes.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, role? }
 */
router.post('/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body as RegisterRequest;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Default regular registration to 'user' role
    const assignedRole = role === 'lead' ? 'lead' : 'user';

    const safeUser = storageService.createUser({
      name,
      email,
      password,
      role: assignedRole,
      status: 'active',
    });

    const token = generateToken(safeUser);

    res.status(201).json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
      message: 'Account registered successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      res.status(409).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Please provide email and password.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const user = storageService.getUserByEmail(email);
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        error: 'Account is suspended. Please contact an administrator.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const isMatch = verifyPassword(password, user.salt, user.passwordHash);
    if (!isMatch) {
      storageService.logAudit(user.id, user.email, 'LOGIN_FAILED', { ip: req.ip });
      res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Update last login
    const updatedUser = storageService.updateUser(user.id, {
      last_login_at: new Date().toISOString(),
    });

    const safeUser = updatedUser || toSafeUser(user);
    const token = generateToken(safeUser);

    storageService.logAudit(safeUser.id, safeUser.email, 'USER_LOGIN', { ip: req.ip });

    res.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
      message: 'Login successful.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/auth/me
 * Headers: Authorization: Bearer <token>
 */
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: req.user,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/auth/logout
 */
router.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user) {
    storageService.logAudit(req.user.id, req.user.email, 'USER_LOGOUT', {});
  }
  res.json({
    success: true,
    message: 'Logged out successfully.',
    timestamp: new Date().toISOString(),
  });
});

export default router;
