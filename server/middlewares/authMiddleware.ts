import { Request, Response, NextFunction } from 'express';
import { verifyToken, toSafeUser } from '../services/authService.js';
import { storageService } from '../services/storageService.js';
import type { SafeUser, UserRole } from '../types/serverTypes.js';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired authentication token.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const userEntity = storageService.getUserById(payload.sub);
  if (!userEntity) {
    res.status(403).json({
      success: false,
      error: 'User associated with token no longer exists.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (userEntity.status === 'suspended') {
    res.status(403).json({
      success: false,
      error: 'Your account has been suspended. Please contact an administrator.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  req.user = toSafeUser(userEntity);
  next();
}

export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const userEntity = storageService.getUserById(payload.sub);
      if (userEntity && userEntity.status === 'active') {
        req.user = toSafeUser(userEntity);
      }
    }
  }

  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}. Current role: ${req.user.role}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
