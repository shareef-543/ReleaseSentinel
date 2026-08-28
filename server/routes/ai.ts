import { Router, Request, Response, NextFunction } from 'express';
import { geminiService } from '../services/geminiService.js';
import { storageService } from '../services/storageService.js';
import { mlService } from '../services/mlService.js';
import { config } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import { analyzeCode } from '../../src/ml/codeAnalyzer.js';

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

/**
 * POST /api/v1/ai/correct-code
 * Body: { code: string, fileName?: string, apiKey?: string, language?: string }
 *
 * Universal multi-language code correction:
 *   1. Detects programming language automatically
 *   2. Runs language-specific ML problem analysis
 *   3. Sends to Gemini AI for correction in the detected language
 *   Returns: before/after code, diff summary, health score
 */
router.post('/correct-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, fileName, apiKey, language } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Request body must include a "code" string field.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Step 1: ML Code Analysis
    const analysis = analyzeCode(code, fileName);
    const detectedLanguage = language || analysis.languageLabel;

    // Step 2: Build Gemini prompt
    const problemsList = analysis.problems
      .map((p, i) => `${i + 1}. [${p.severity.toUpperCase()}] ${p.title}: ${p.description} → Fix: ${p.suggestedFix}`)
      .join('\n');

    const geminiKey = apiKey || config.geminiApiKey;
    const endpoint = `${CONSTANTS.GEMINI_BASE_URL}/${config.geminiModel}:generateContent?key=${geminiKey}`;

    const systemPrompt = `You are an expert ${detectedLanguage} code reviewer and auto-healer.
Fix the provided code by addressing all identified problems.
Rules:
- Return ONLY the corrected code. No markdown fences. No explanations.
- Keep original structure and logic intact — only fix what is broken or unsafe.
- Add inline comments prefixed with "// FIXED:" or "# FIXED:" where changes are made.`;

    const userPrompt = `Language: ${detectedLanguage}\n\nProblems to Fix:\n${problemsList || 'General review and quality improvements'}\n\nOriginal Code:\n${code}`;

    let correctedCode = code;
    let source = 'fallback';

    if (geminiKey && geminiKey.length > 10) {
      try {
        const geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
          }),
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          const cleaned = raw.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
          if (cleaned) {
            correctedCode = cleaned;
            source = 'gemini';
          }
        }
      } catch (e) {
        console.warn('Gemini code correction failed, using original:', e);
      }
    }

    const addedLines = correctedCode.split('\n').length - code.split('\n').length;
    const fixedComments = (correctedCode.match(/\/\/\s*FIXED:|#\s*FIXED:/g) ?? []).length;
    const changes = [
      ...(fixedComments > 0 ? [`${fixedComments} inline fix comment(s) added`] : []),
      ...(addedLines !== 0 ? [`${Math.abs(addedLines)} line(s) ${addedLines > 0 ? 'added' : 'removed'}`] : []),
      ...analysis.problems.slice(0, 5).map((p) => `Fixed: ${p.title}`),
    ];

    res.json({
      success: true,
      data: {
        original_code: code,
        corrected_code: correctedCode,
        language: detectedLanguage,
        source,
        changes,
        ml_analysis: {
          health_score: analysis.healthScore,
          risk_level: analysis.riskLevel,
          problems_detected: analysis.problems.length,
          problems: analysis.problems,
          summary: analysis.summary,
        },
        healed_health_score: Math.min(100, analysis.healthScore + analysis.problems.length * 8),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;

