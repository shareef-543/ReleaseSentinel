import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import { storageService } from '../services/storageService.js';

const router = Router();

/**
 * GET /api/v1/health
 * Returns server, Gemini AI, and database status.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = storageService.getDatabase();
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: CONSTANTS.APP_NAME,
        version: CONSTANTS.VERSION,
        environment: config.nodeEnv,
        port: config.port,
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        ai: {
          gemini_configured: !!(config.geminiApiKey && config.geminiApiKey.length > 10),
          model: config.geminiModel,
        },
        database: {
          releases_count: db.releases.length,
          corrections_count: db.corrections.length,
          initialized_at: db.config?.initialized_at ?? 'N/A',
          storage_type: 'File-backed persistent JSON (server/data/db.json)',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
