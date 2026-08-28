import { analyzeFileWithML } from '../../src/ml/fileProblemDetector.js';
import type { FileMLAnalysisResult } from '../../src/types/index.js';

class MlService {
  /**
   * Evaluates raw code, text, or JSON manifest content against the ML diagnostic scanner.
   */
  public detectProblems(rawContent: string, fileName = 'manifest.json'): FileMLAnalysisResult {
    return analyzeFileWithML(rawContent, fileName);
  }
}

export const mlService = new MlService();
