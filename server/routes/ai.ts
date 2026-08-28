import { Router, Request, Response, NextFunction } from 'express';
import { geminiService } from '../services/geminiService.js';
import { storageService } from '../services/storageService.js';
import { mlService } from '../services/mlService.js';

const router = Router();

/**
 * POST /api/v1/ai/heal
 * Body: { rawJson: string, apiKey?: string, autoSave?: boolean }
 *
 * Full auto-healing pipeline:
 *   1. Runs ML diagnostic scan on the raw input
 *   2. Sends problems + raw content to Gemini AI for correction
 *   3. Optionally saves the correction log to the database
 */
router.post('/heal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rawJson, apiKey, autoSave = true } = req.body;

    if (!rawJson || typeof rawJson !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Request body must include a "rawJson" string field.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Step 1: ML Detection
    const mlResult = mlService.detectProblems(rawJson);

    // Step 2: AI Healing
    const aiResult = await geminiService.correctManifest(rawJson, mlResult.problems, apiKey);

    // Step 3: Optionally save correction log
    let savedRecord = null;
    if (autoSave) {
      savedRecord = storageService.saveCorrection({
        release_id: aiResult.manifest.release_id ?? 'UNKNOWN',
        original_snippet: rawJson.substring(0, 500),
        corrected_manifest: aiResult.manifest,
        problems_found: mlResult.problems.length,
        corrections_count: mlResult.problems.filter((p) => p.autoFixable).length,
        source: aiResult.source,
      });
    }

    res.json({
      success: true,
      data: {
        ml_analysis: {
          health_index: mlResult.healthIndex,
          anomaly_score: mlResult.anomalyScore,
          problems_detected: mlResult.problems.length,
          problems: mlResult.problems,
        },
        ai_correction: {
          manifest: aiResult.manifest,
          source: aiResult.source,
          model: aiResult.model ?? null,
          explanation: aiResult.explanation,
        },
        saved_record: savedRecord,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
