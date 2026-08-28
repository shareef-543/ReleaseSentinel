import type {
  ReleaseManifest,
  ModuleMeta,
  ModuleRisk,
  HistoricalIncident,
  HistoricalRelease,
  PredictedFailureMode,
  SimilarIncident,
  RolloutStrategy,
  RiskContributor,
  SuspiciousEvidence,
  FailureMode,
} from '@/types';
import { MODULES, HISTORICAL_INCIDENTS, HISTORICAL_RELEASES, FAILURE_MODE_LABELS } from '@/data/seed';

const moduleMap = new Map(MODULES.map((m) => [m.name, m]));

function getModule(name: string): ModuleMeta | undefined {
  return moduleMap.get(name);
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function riskLevel(score: number): ModuleRisk['level'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ── TF-IDF engine ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','a','an','after','by','for','in','of','on','to','and','or','not','was','is','were','with','from','during','due','caused','after','up','all','at','this','that','it','its',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function buildTfidf(documents: string[]): Map<string, number>[] {
  const N = documents.length;
  const df = new Map<string, number>();
  const tokenized = documents.map(tokenize);

  for (const tokens of tokenized) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }

  return tokenized.map((tokens) => {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      const idf = Math.log((N + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      vec.set(term, count * idf);
    }
    return normalize(vec);
  });
}

function normalize(vec: Map<string, number>): Map<string, number> {
  let norm = 0;
  for (const v of vec.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  const out = new Map<string, number>();
  for (const [k, v] of vec) out.set(k, v / norm);
  return out;
}

function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [k, v] of a) {
    const bv = b.get(k);
    if (bv) dot += v * bv;
  }
  return dot;
}

// ── A. Code / Change Risk Model ─────────────────────────────────

export function computeModuleRisk(
  manifest: ReleaseManifest,
  incidents: HistoricalIncident[],
  historicalReleases: HistoricalRelease[],
): ModuleRisk[] {
  return manifest.changed_modules.map((moduleName) => {
    const meta = getModule(moduleName);
    const reasons: string[] = [];

    // Feature: module criticality
    const criticality = meta?.criticality ?? 50;
    if (criticality >= 80) reasons.push(`Module criticality is HIGH (${criticality})`);

    // Feature: changed files in this module
    const moduleFiles = manifest.changed_files.filter((f) =>
      f.toLowerCase().startsWith(moduleName.split('-')[0]),
    );
    const fileCount = moduleFiles.length || manifest.changed_files.length;
    if (fileCount >= 3) reasons.push(`${fileCount} files changed in this module`);

    // Feature: previous incidents involving this module
    const prevIncidents = incidents.filter((i) => i.affected_module === moduleName);
    const prevFailures = prevIncidents.length;
    if (prevFailures > 0) reasons.push(`${prevFailures} previous incident(s) in this module`);

    // Feature: dependency changes
    const hasDepChange = manifest.dependencies.length > 0;
    if (hasDepChange) reasons.push(`Dependency changes present (${manifest.dependencies.join(', ')})`);

    // Feature: historical release failure rate for this module
    const moduleReleases = historicalReleases.filter((r) => r.changed_modules.includes(moduleName));
    const failedReleases = moduleReleases.filter((r) => r.result !== 'success').length;
    const failureRate = moduleReleases.length > 0 ? failedReleases / moduleReleases.length : 0.3;
    if (failureRate > 0.4) reasons.push(`Historical release failure rate: ${(failureRate * 100).toFixed(0)}%`);

    // Weighted hybrid scoring (rule-based features + historical "model" signal)
    const criticalityScore = criticality * 0.30;
    const fileScore = clamp(fileCount * 12) * 0.15;
    const incidentScore = clamp(prevFailures * 15) * 0.25;
    const depScore = hasDepChange ? 15 : 0;
    const failureRateScore = failureRate * 100 * 0.15;

    const risk = clamp(
      criticalityScore + fileScore + incidentScore + depScore + failureRateScore,
    0,
      100,
    );

    return {
      module: moduleName,
      risk: Math.round(risk),
      level: riskLevel(risk),
      reasons,
    };
  });
}

export function computeCodeChangeRisk(moduleRisks: ModuleRisk[]): number {
  if (moduleRisks.length === 0) return 0;
  const max = Math.max(...moduleRisks.map((m) => m.risk));
  const avg = moduleRisks.reduce((s, m) => s + m.risk, 0) / moduleRisks.length;
  return Math.round(clamp(max * 0.65 + avg * 0.35));
}

// ── B. Test Failure Prediction ─────────────────────────────────

function releaseFeatures(release: Pick<ReleaseManifest, 'tests' | 'test_coverage' | 'dependencies' | 'changed_files' | 'changed_modules'>): number[] {
  const totalTests = release.tests.passed + release.tests.failed + release.tests.flaky;
  return [
    1,
    totalTests > 0 ? release.tests.failed / totalTests : 0,
    totalTests > 0 ? release.tests.flaky / totalTests : 0,
    1 - (release.test_coverage ?? 70) / 100,
    release.dependencies.length > 0 ? 1 : 0,
    Math.min(release.changed_files.length, 10) / 10,
    Math.min(release.changed_modules.length, 5) / 5,
  ];
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function trainFailureModel(releases: HistoricalRelease[]): number[] {
  const weights = new Array(7).fill(0) as number[];
  const learningRate = 0.8;

  for (let epoch = 0; epoch < 800; epoch++) {
    const gradients = new Array(7).fill(0) as number[];
    for (const release of releases) {
      const features = releaseFeatures({
        tests: { passed: release.tests_passed, failed: release.tests_failed, flaky: release.tests_flaky },
        test_coverage: release.test_coverage,
        dependencies: release.dependencies,
        changed_files: release.changed_files,
        changed_modules: release.changed_modules,
      });
      const prediction = sigmoid(weights.reduce((sum, weight, index) => sum + weight * features[index], 0));
      const error = prediction - (release.result === 'success' ? 0 : 1);
      features.forEach((feature, index) => { gradients[index] += error * feature; });
    }
    weights.forEach((_, index) => { weights[index] -= (learningRate * gradients[index]) / releases.length; });
  }

  return weights;
}

export function computeTestRisk(manifest: ReleaseManifest): {
  score: number;
  probability: number;
  reasons: string[];
} {
  const { passed, failed, flaky } = manifest.tests;
  const total = passed + failed + flaky;
  const reasons: string[] = [];

  const coverage = manifest.test_coverage ?? 70;

  if (failed > 0) reasons.push(`${failed} test(s) failed out of ${total}`);
  if (flaky > 0) reasons.push(`${flaky} flaky test(s) — reliability signal`);
  if (coverage < 75) reasons.push(`Test coverage below recommended threshold (${coverage}%)`);

  const modelWeights = trainFailureModel(HISTORICAL_RELEASES);
  const features = releaseFeatures(manifest);
  const modelProbability = sigmoid(modelWeights.reduce((sum, weight, index) => sum + weight * features[index], 0));
  const probability = clamp(modelProbability * 100, 0, 100);
  reasons.push(`Trained logistic model evaluated ${HISTORICAL_RELEASES.length} historical releases`);

  const score = clamp(probability * 0.7 + (100 - coverage) * 0.3, 0, 100);

  return { score: Math.round(score), probability: Math.round(probability), reasons };
}

// ── C. Defect Propagation / Affected Module Model ───────────────

export function computePropagationRisk(
  manifest: ReleaseManifest,
  moduleRisks: ModuleRisk[],
): { score: number; propagationChain: string[]; reasons: string[] } {
  const changedSet = new Set(manifest.changed_modules);
  const affected = new Set<string>(manifest.changed_modules);
  const reasons: string[] = [];

  // BFS through dependency graph — if a changed module is depended on, downstream is affected
  let frontier = [...changedSet];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const mod of MODULES) {
      if (affected.has(mod.name)) continue;
      const isAffected = mod.depends_on.some((dep) => frontier.includes(dep));
      if (isAffected) {
        affected.add(mod.name);
        next.push(mod.name);
      }
    }
    frontier = next;
  }

  const propagationChain = [...affected];
  const newlyAffected = propagationChain.filter((m) => !changedSet.has(m));
  if (newlyAffected.length > 0) {
    reasons.push(`${newlyAffected.length} downstream module(s) affected: ${newlyAffected.join(', ')}`);
  }

  // Score: weighted average risk of all affected modules
  const affectedRisks = propagationChain.map((m) => moduleRisks.find((mr) => mr.module === m)?.risk ?? getModule(m)?.criticality ?? 40);
  const avgRisk = affectedRisks.reduce((s, r) => s + r, 0) / (affectedRisks.length || 1);
  const spreadFactor = clamp(affected.size * 8, 0, 30);

  const score = clamp(avgRisk * 0.7 + spreadFactor, 0, 100);

  if (propagationChain.length > manifest.changed_modules.length) {
    reasons.push(`Failure can propagate across ${propagationChain.length} interconnected modules`);
  }

  return { score: Math.round(score), propagationChain, reasons };
}

// ── D. Historical Incident Similarity (TF-IDF + Cosine) ─────────

export function findSimilarIncidents(
  manifest: ReleaseManifest,
  moduleRisks: ModuleRisk[],
  topN = 3,
): SimilarIncident[] {
  // Build query document from release manifest
  const queryParts: string[] = [manifest.release_id, ...manifest.changed_modules, ...manifest.changed_files, ...manifest.dependencies];
  for (const mr of moduleRisks) {
    if (mr.risk >= 60) queryParts.push(mr.module, 'failure', 'risk');
  }
  const queryDoc = queryParts.join(' ');

  const incidentDocs = HISTORICAL_INCIDENTS.map(
    (i) => `${i.affected_module} ${i.failure_mode.replace(/_/g, ' ')} ${i.description} ${i.root_cause} ${i.release_id}`,
  );

  const allDocs = [queryDoc, ...incidentDocs];
  const vectors = buildTfidf(allDocs);
  const queryVec = vectors[0];

  const sims = HISTORICAL_INCIDENTS.map((incident, idx) => ({
    incident,
    similarity: cosineSim(queryVec, vectors[idx + 1]),
  }));

  return sims
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN)
    .map((s) => ({
      incident: s.incident,
      similarity: Math.round(s.similarity * 100),
    }));
}

export function computeHistoricalRisk(similar: SimilarIncident[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (similar.length === 0) return { score: 30, reasons };

  const topSim = similar[0];
  const avgSim = similar.reduce((s, i) => s + i.similarity, 0) / similar.length;
  const avgSeverity = similar.reduce((s, i) => s + i.incident.severity, 0) / similar.length;

  if (topSim.similarity >= 70) reasons.push(`Top similar incident ${topSim.incident.incident_id} at ${topSim.similarity}% match`);
  if (avgSeverity >= 4) reasons.push(`Similar incidents have high average severity (${avgSeverity.toFixed(1)}/5)`);

  const score = clamp(avgSim * 0.5 + (avgSeverity / 5) * 100 * 0.5, 0, 100);
  return { score: Math.round(score), reasons };
}

// ── Predicted Failure Modes ────────────────────────────────────

export function predictFailureModes(
  manifest: ReleaseManifest,
  moduleRisks: ModuleRisk[],
  similar: SimilarIncident[],
): PredictedFailureMode[] {
  const modeScores = new Map<FailureMode, { prob: number; reasons: string[] }>();

  // From similar incidents
  for (const si of similar) {
    const mode = si.incident.failure_mode;
    const existing = modeScores.get(mode) ?? { prob: 0, reasons: [] };
    const contribution = si.similarity * 0.5;
    existing.prob = Math.max(existing.prob, contribution);
    if (si.similarity >= 50) {
      existing.reasons.push(`${si.similarity}% match with ${si.incident.incident_id}`);
    }
    modeScores.set(mode, existing);
  }

  // From module risk + criticality
  for (const mr of moduleRisks) {
    if (mr.risk < 50) continue;
    const meta = getModule(mr.module);
    if (!meta) continue;

    if (mr.module === 'payment-service') {
      const timeoutProb = clamp(mr.risk * 0.75, 0, 95);
      modeScores.set('payment_timeout', {
        prob: Math.max(modeScores.get('payment_timeout')?.prob ?? 0, timeoutProb),
        reasons: modeScores.get('payment_timeout')?.reasons ?? [`payment-service risk ${mr.risk}`],
      });
      const dupProb = clamp(mr.risk * 0.6, 0, 90);
      modeScores.set('duplicate_transaction', {
        prob: Math.max(modeScores.get('duplicate_transaction')?.prob ?? 0, dupProb),
        reasons: modeScores.get('duplicate_transaction')?.reasons ?? [`payment processor change risk ${mr.risk}`],
      });
    }
    if (mr.module === 'checkout-service') {
      const prob = clamp(mr.risk * 0.7, 0, 88);
      modeScores.set('checkout_failure', {
        prob: Math.max(modeScores.get('checkout_failure')?.prob ?? 0, prob),
        reasons: modeScores.get('checkout_failure')?.reasons ?? [`checkout-service risk ${mr.risk}`],
      });
    }
    if (mr.module === 'notification-service') {
      const prob = clamp(mr.risk * 0.6, 0, 70);
      modeScores.set('notification_delay', {
        prob: Math.max(modeScores.get('notification_delay')?.prob ?? 0, prob),
        reasons: modeScores.get('notification_delay')?.reasons ?? [`notification-service risk ${mr.risk}`],
      });
    }
    if (mr.module === 'auth-service') {
      const prob = clamp(mr.risk * 0.8, 0, 92);
      modeScores.set('auth_failure', {
        prob: Math.max(modeScores.get('auth_failure')?.prob ?? 0, prob),
        reasons: modeScores.get('auth_failure')?.reasons ?? [`auth-service risk ${mr.risk}`],
      });
    }
    if (mr.module === 'order-service') {
      const prob = clamp(mr.risk * 0.65, 0, 85);
      modeScores.set('db_migration_error', {
        prob: Math.max(modeScores.get('db_migration_error')?.prob ?? 0, prob),
        reasons: modeScores.get('db_migration_error')?.reasons ?? [`order-service risk ${mr.risk}`],
      });
    }
  }

  return [...modeScores.entries()]
    .map(([mode, { prob, reasons }]) => ({
      mode,
      label: FAILURE_MODE_LABELS[mode] ?? mode,
      probability: Math.round(prob),
      reasons,
    }))
    .filter((m) => m.probability > 10)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);
}

// ── E. Production Impact Model ──────────────────────────────────

export function computeProductionImpact(
  manifest: ReleaseManifest,
  moduleRisks: ModuleRisk[],
  testProbability: number,
  similar: SimilarIncident[],
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  const changedModules = manifest.changed_modules.map((m) => getModule(m)).filter(Boolean) as ModuleMeta[];
  if (changedModules.length === 0) return { score: 20, reasons };

  const maxCriticality = Math.max(...changedModules.map((m) => m.criticality));
  const maxUsers = Math.max(...changedModules.map((m) => m.avg_users));
  const maxTxnImportance = Math.max(...changedModules.map((m) => m.transaction_importance));
  const avgSeverity = similar.length > 0 ? similar.reduce((s, i) => s + i.incident.severity, 0) / similar.length : 2;

  if (maxCriticality >= 85) reasons.push(`Highest module criticality: ${maxCriticality}`);
  if (maxUsers >= 50000) reasons.push(`Up to ${maxUsers.toLocaleString()} users potentially affected`);
  if (maxTxnImportance >= 85) reasons.push(`Transaction importance: ${maxTxnImportance}`);
  if (testProbability >= 60) reasons.push(`Predicted test failure probability: ${testProbability}%`);
  if (avgSeverity >= 4) reasons.push(`Similar incidents averaged severity ${avgSeverity.toFixed(1)}/5`);

  const score = clamp(
    maxCriticality * 0.30 +
      (maxUsers / 100000) * 100 * 0.20 +
      maxTxnImportance * 0.20 +
      testProbability * 0.15 +
      (avgSeverity / 5) * 100 * 0.15,
    0,
    100,
  );

  return { score: Math.round(score), reasons };
}

// ── F. Rollout Risk Optimizer ───────────────────────────────────

export function generateRolloutStrategies(
  overallRisk: number,
  productionImpact: number,
  maxAffectedUsers: number,
  predictedFailureProb: number,
): RolloutStrategy[] {
  const percentages = [10, 50, 100];
  const exposureMap: Record<number, RolloutStrategy['exposure']> = { 10: 'Low', 50: 'Medium', 100: 'High' };
  const rollbackMap: Record<number, RolloutStrategy['rollback_difficulty']> = { 10: 'Easy', 50: 'Moderate', 100: 'Hard' };

  const strategies = percentages.map((pct) => {
    const exposure = exposureMap[pct];
    const exposureFactor = pct / 100;
    const estimatedAffectedUsers = Math.round(maxAffectedUsers * exposureFactor);
    const estimatedFailureImpact = Math.round(productionImpact * exposureFactor);
    const riskScore = Math.round(
      clamp(overallRisk * exposureFactor * 0.6 + productionImpact * exposureFactor * 0.25 + predictedFailureProb * exposureFactor * 0.15, 0, 100),
    );
    const rollbackDifficulty = rollbackMap[pct];

    return {
      percentage: pct,
      label: `${pct}% Rollout`,
      exposure,
      risk_score: riskScore,
      estimated_failure_impact: estimatedFailureImpact,
      estimated_affected_users: estimatedAffectedUsers,
      rollback_difficulty: rollbackDifficulty,
      recommended: false,
    };
  });

  // Recommend the safest strategy whose risk is below threshold; if all high, recommend 10%
  const safeThreshold = 45;
  const recommendable = strategies.filter((s) => s.risk_score < safeThreshold);
  const recommended = recommendable.length > 0 ? recommendable[recommendable.length - 1] : strategies[0];
  recommended.recommended = true;

  return strategies;
}

// ── Suspicious Evidence Detection ───────────────────────────────

export function detectSuspiciousEvidence(
  manifest: ReleaseManifest,
  moduleRisks: ModuleRisk[],
  similar: SimilarIncident[],
  testResult: { probability: number; reasons: string[] },
): SuspiciousEvidence[] {
  const evidence: SuspiciousEvidence[] = [];

  for (const mr of moduleRisks) {
    if (mr.risk >= 80) {
      evidence.push({ id: 'high_risk_module', label: `${mr.module} is high risk (score ${mr.risk})`, severity: 'critical' });
    } else if (mr.risk >= 60) {
      evidence.push({ id: 'mod_risk_module', label: `${mr.module} has elevated risk (score ${mr.risk})`, severity: 'high' });
    }
  }

  if (manifest.tests.failed > 0) {
    evidence.push({ id: 'failed_tests', label: `${manifest.tests.failed} test(s) failed`, severity: manifest.tests.failed >= 2 ? 'critical' : 'high' });
  }
  if (manifest.tests.flaky > 0) {
    evidence.push({ id: 'flaky_tests', label: `${manifest.tests.flaky} flaky test(s) detected`, severity: 'medium' });
  }

  if (manifest.dependencies.length > 0) {
    evidence.push({ id: 'dep_change', label: `Dependency changes: ${manifest.dependencies.join(', ')}`, severity: 'high' });
  }

  if (similar.length > 0 && similar[0].similarity >= 65) {
    evidence.push({ id: 'similar_incident', label: `Similar historical incident: ${similar[0].incident.incident_id} (${similar[0].similarity}% match)`, severity: similar[0].similarity >= 80 ? 'critical' : 'high' });
  }

  if (manifest.changed_files.length >= 4) {
    evidence.push({ id: 'many_files', label: `${manifest.changed_files.length} files changed — large blast radius`, severity: 'medium' });
  }

  const coverage = manifest.test_coverage ?? 70;
  if (coverage < 75) {
    evidence.push({ id: 'low_coverage', label: `Test coverage below 75% (${coverage}%)`, severity: 'medium' });
  }

  if (testResult.probability >= 60) {
    evidence.push({ id: 'high_test_risk', label: `Predicted test failure probability ${testResult.probability}%`, severity: 'high' });
  }

  const criticalModules = manifest.changed_modules.filter((m) => (getModule(m)?.criticality ?? 0) >= 85);
  if (criticalModules.length > 0) {
    evidence.push({ id: 'critical_module', label: `Production-critical module changed: ${criticalModules.join(', ')}`, severity: 'critical' });
  }

  if (manifest.changed_modules.length >= 3) {
    evidence.push({ id: 'interconnected', label: `${manifest.changed_modules.length} interconnected modules changed simultaneously`, severity: 'high' });
  }

  return evidence;
}

// ── Risk Contributors (Explainability) ───────────────────────────

export function buildRiskContributors(
  moduleRisks: ModuleRisk[],
  manifest: ReleaseManifest,
  similar: SimilarIncident[],
  testResult: { probability: number },
  productionImpact: number,
): RiskContributor[] {
  const contributors: RiskContributor[] = [];

  for (const mr of moduleRisks) {
    if (mr.risk >= 60) {
      const isHighRisk = (HISTORICAL_INCIDENTS.filter((i) => i.affected_module === mr.module).length) >= 2;
      contributors.push({
        label: `${mr.module} is ${isHighRisk ? 'historically' : ''} ${mr.level} risk`,
        delta: Math.round(mr.risk * 0.25),
      });
    }
  }

  if (manifest.dependencies.length > 0) {
    contributors.push({
      label: `${manifest.dependencies.join(' + ')} changed`,
      delta: 18,
    });
  }

  if (manifest.tests.failed > 0) {
    contributors.push({
      label: `${manifest.tests.failed} critical test(s) failed`,
      delta: 14,
    });
  }

  if (similar.length > 0 && similar[0].similarity >= 60) {
    contributors.push({
      label: `Similar incident detected (${similar[0].incident.incident_id})`,
      delta: 12,
    });
  }

  if (productionImpact >= 75) {
    contributors.push({
      label: `High production criticality`,
      delta: 8,
    });
  }

  if (manifest.changed_modules.length >= 3) {
    contributors.push({
      label: `Cross-module dependency chain`,
      delta: 4,
    });
  }

  if (testResult.probability >= 50) {
    contributors.push({
      label: `Elevated test failure probability (${testResult.probability}%)`,
      delta: 6,
    });
  }

  return contributors.sort((a, b) => b.delta - a.delta);
}
