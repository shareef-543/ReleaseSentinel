import { Router, Request, Response, NextFunction } from 'express';
import { mlService } from '../services/mlService.js';

const router = Router();

/**
 * POST /api/v1/ml/detect
 * Body: { content: string, fileName?: string }
 *
 * Runs the full ML diagnostic scanner against raw code or JSON content.
 * Returns identified anomalies, severity matrix, health index, and anomaly score.
 */
router.post('/detect', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, fileName } = req.body;

    if (!content || typeof content !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Request body must include a "content" string field.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = mlService.detectProblems(content, fileName);

    res.json({
      success: true,
      data: result,
      summary: {
        total_problems: result.problems.length,
        health_index: result.healthIndex,
        anomaly_score: result.anomalyScore,
        critical_count: result.problems.filter((p) => p.severity === 'critical').length,
        high_count: result.problems.filter((p) => p.severity === 'high').length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
