import { Router, Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storageService.js';

const router = Router();

/**
 * GET /api/v1/releases
 * Query params: ?decision=GO|HOLD|ROLLBACK_PREPARATION|ALL  &search=keyword
 */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const releases = storageService.getAllReleases({
      decision: req.query.decision as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json({
      success: true,
      data: releases,
      count: releases.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/releases/:id
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const release = storageService.getReleaseById(req.params.id);
    if (!release) {
      res.status(404).json({
        success: false,
        error: `Release with id "${req.params.id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ success: true, data: release, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/releases
 * Body: { manifest, analysis, simulation?, reassessment?, notes?, source? }
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { manifest, analysis, simulation, reassessment, notes, source } = req.body;

    if (!manifest || !analysis) {
      res.status(400).json({
        success: false,
        error: 'Request body must include "manifest" and "analysis".',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const record = storageService.saveRelease({
      release_id: manifest.release_id,
      overall_risk: analysis.overall_risk,
      decision: analysis.decision,
      manifest,
      analysis,
      simulation: simulation ?? null,
      reassessment: reassessment ?? null,
      notes: notes ?? null,
      source: source ?? 'api',
    });

    res.status(201).json({ success: true, data: record, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/releases/:id
 * Update notes or source metadata on an existing record.
 */
router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = storageService.getReleaseById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: `Release "${req.params.id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { notes, source } = req.body;
    const updated = storageService.saveRelease({
      ...existing,
      id: existing.id,
      notes: notes !== undefined ? notes : existing.notes,
      source: source !== undefined ? source : existing.source,
    } as any);

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/releases/:id
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = storageService.deleteRelease(req.params.id);
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: `Release "${req.params.id}" not found.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({ success: true, message: `Release "${req.params.id}" deleted.`, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

export default router;
