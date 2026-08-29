import { Router, Response, NextFunction } from 'express';
import fs from 'fs';
import { storageService } from '../services/storageService.js';
import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import { authenticateToken, requireRole, type AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import type { UpdateUserRequest, UserRole, UserStatus } from '../types/serverTypes.js';

const router = Router();

// Protect ALL admin routes: require valid token and 'admin' or 'lead' role
router.use(authenticateToken);

/**
 * GET /api/v1/admin/stats
 * Overview analytics for the Admin dashboard.
 */
router.get('/stats', requireRole('admin', 'lead'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const db = storageService.getDatabase();
    const users = db.users || [];
    const activeUsers = users.filter((u) => u.status === 'active').length;

    let dbSize = 0;
    try {
      if (fs.existsSync(config.dbFilePath)) {
        dbSize = fs.statSync(config.dbFilePath).size;
      }
    } catch (e) {}

    const stats = {
      total_users: users.length,
      active_users: activeUsers,
      suspended_users: users.length - activeUsers,
      total_releases: (db.releases || []).length,
      total_corrections: (db.corrections || []).length,
      total_audit_logs: (db.auditLogs || []).length,
      system_health: 'Optimal',
      gemini_model: db.systemConfig?.geminiModel || config.geminiModel,
      maintenance_mode: !!db.systemConfig?.maintenanceMode,
      database_size_bytes: dbSize,
      uptime_seconds: Math.floor(process.uptime()),
    };

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/users
 * List all users with filtering.
 */
router.get('/users', requireRole('admin', 'lead'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const users = storageService.getAllUsers({ role, status, search });
    res.json({
      success: true,
      data: users,
      count: users.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/users
 * Admin creates a new user with chosen role and status.
 */
router.post('/users', requireRole('admin'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role, status } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'Please provide name, email, and password.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const newUser = storageService.createUser({
      name,
      email,
      password,
      role: (role as UserRole) || 'user',
      status: (status as UserStatus) || 'active',
    });

    storageService.logAudit(req.user!.id, req.user!.email, 'ADMIN_CREATE_USER', {
      created_user_id: newUser.id,
      created_email: newUser.email,
      role: newUser.role,
    });

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully by admin.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      res.status(409).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/users/:id
 * Update user role, status, or reset password.
 */
router.patch('/users/:id', requireRole('admin'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, role, status, password } = req.body as UpdateUserRequest;

    // Prevent admin from accidentally demoting or suspending their own account
    if (req.user?.id === id && status === 'suspended') {
      res.status(400).json({
        success: false,
        error: 'You cannot suspend your own active admin account.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updated = storageService.updateUser(
      id,
      { name, role, status, password },
      req.user?.email,
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        error: `User with id "${id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: `User ${updated.email} updated successfully.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/admin/users/:id
 * Permanently delete a user.
 */
router.delete('/users/:id', requireRole('admin'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        error: 'You cannot delete your own account while logged in.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const deleted = storageService.deleteUser(id, req.user?.email);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: `User with id "${id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      message: 'User deleted successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/audit-logs
 * Fetch system audit logs.
 */
router.get('/audit-logs', requireRole('admin', 'lead'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt((req.query.limit as string) || '100', 10);
    const logs = storageService.getAuditLogs(limit);
    res.json({
      success: true,
      data: logs,
      count: logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/system-config
 * Fetch current system configuration.
 */
router.get('/system-config', requireRole('admin', 'lead'), (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const configData = storageService.getSystemConfig();
    res.json({
      success: true,
      data: configData,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/admin/system-config
 * Update system parameters (Gemini model, risk limits, maintenance mode).
 */
router.patch('/system-config', requireRole('admin'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { geminiModel, maxStoredReleases, autoApprovalThreshold, maintenanceMode } = req.body;

    const updatedConfig = storageService.updateSystemConfig(
      {
        geminiModel,
        maxStoredReleases,
        autoApprovalThreshold,
        maintenanceMode,
      },
      req.user?.email,
    );

    res.json({
      success: true,
      data: updatedConfig,
      message: 'System configuration updated successfully.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/purge-data
 * Maintenance database purge.
 */
router.post('/purge-data', requireRole('admin'), (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { releases, corrections, auditLogs } = req.body;

    const result = storageService.purgeData({ releases, corrections, auditLogs }, req.user?.email);

    res.json({
      success: true,
      data: result,
      message: 'Purge operation completed.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
