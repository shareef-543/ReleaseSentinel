import { Router, Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storageService.js';

const router = Router();

/**
 * GET /api/v1/corrections
 * Returns all stored AI auto-healing correction logs.
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const corrections = storageService.getAllCorrections();
    res.json({
      success: true,
      data: corrections,
      count: corrections.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/corrections/:id
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = storageService.deleteCorrection(req.params.id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: `Correction "${req.params.id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      message: `Correction "${req.params.id}" deleted.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
