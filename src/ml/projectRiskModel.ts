import type { ModuleRisk, ReleaseManifest } from '@/types';

export type ProjectRiskLabel = 'schedule_risk' | 'budget_risk' | 'resource_risk' | 'quality_risk';

export interface RiskPrediction {
  score: number;
  level: 'Low' | 'Medium' | 'High';
}

export type ProjectRiskPrediction = Record<ProjectRiskLabel, RiskPrediction>;

const CATEGORY_WEIGHTS: Record<ProjectRiskLabel, number[]> = {
  schedule_risk: [0.15, 1.2, 0.65, 0.2, 0.4, -0.9, 0.25, 0.2],
  budget_risk: [1.1, 0.4, 0.25, 0.35, 0.55, -0.15, 0.35, 0.2],
  resource_risk: [0.15, 0.35, 0.2, 1.1, 0.25, -0.45, 0.15, 0.4],
  quality_risk: [0.25, 0.35, 1.0, 0.15, 0.35, -0.2, 1.2, 0.1],
};

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function levelFor(score: number): RiskPrediction['level'] {
  if (score > 0.66) return 'High';
  if (score > 0.33) return 'Medium';
  return 'Low';
}

function extractFeatures(manifest: ReleaseManifest, moduleRisks: ModuleRisk[]): number[] {
  const totalTests = manifest.tests.passed + manifest.tests.failed + manifest.tests.flaky;
  const failedRate = totalTests > 0 ? manifest.tests.failed / totalTests : 0;
  const averageModuleRisk = moduleRisks.length > 0
    ? moduleRisks.reduce((sum, module) => sum + module.risk, 0) / moduleRisks.length
    : 30;

  return [
    (manifest.dependencies.length * 8 + manifest.changed_files.length * 1.5) / 100,
    (failedRate * 20 + manifest.tests.flaky * 1.5) / 30,
    (manifest.tests.failed * 3 + manifest.tests.flaky + manifest.changed_files.length) / 50,
    (manifest.changed_modules.length > 2 ? 12 : 5) / 100,
    Math.min(5, manifest.changed_modules.length + manifest.dependencies.length) / 5,
    -failedRate - manifest.tests.flaky / Math.max(totalTests, 1),
    (manifest.tests.failed + Math.round(averageModuleRisk / 25)) / 10,
    (manifest.dependencies.length > 0 ? 2 : 0) / 5,
  ];
}

export function predictProjectRisks(manifest: ReleaseManifest, moduleRisks: ModuleRisk[]): ProjectRiskPrediction {
  const features = extractFeatures(manifest, moduleRisks);
  const predictions = {} as ProjectRiskPrediction;

  (Object.keys(CATEGORY_WEIGHTS) as ProjectRiskLabel[]).forEach((label) => {
    const signal = features.reduce((sum, feature, index) => sum + feature * CATEGORY_WEIGHTS[label][index], 0);
    const score = Math.round(sigmoid(signal - 1.15) * 100) / 100;
    predictions[label] = { score, level: levelFor(score) };
  });

  return predictions;
}
