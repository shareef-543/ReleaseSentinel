import type {
  ReleaseManifest,
  AnalysisResult,
  ReleaseDecision,
  RolloutStrategy,
  SimulatedMetric,
  RolloutSimulation,
  Reassessment,
  RiskComponent,
} from '@/types';
import {
  computeModuleRisk,
  computeCodeChangeRisk,
  computeTestRisk,
  computePropagationRisk,
  findSimilarIncidents,
  computeHistoricalRisk,
  predictFailureModes,
  computeProductionImpact,
  generateRolloutStrategies,
  detectSuspiciousEvidence,
  buildRiskContributors,
} from '@/ml/models';
import { HISTORICAL_INCIDENTS, HISTORICAL_RELEASES, MODULES } from '@/data/seed';

const RISK_WEIGHTS = {
  code_change: 0.30,
  test: 0.20,
  historical: 0.20,
  propagation: 0.15,
  production_impact: 0.15,
};

export function analyzeRelease(manifest: ReleaseManifest): AnalysisResult {
  // ── Run all intelligence components ──
  const moduleRisks = computeModuleRisk(manifest, HISTORICAL_INCIDENTS, HISTORICAL_RELEASES);
  const codeChangeRisk = computeCodeChangeRisk(moduleRisks);

  const testResult = computeTestRisk(manifest);

  const propagation = computePropagationRisk(manifest, moduleRisks);

  const similarIncidents = findSimilarIncidents(manifest, moduleRisks, 3);
  const historicalRisk = computeHistoricalRisk(similarIncidents);

  const failureModes = predictFailureModes(manifest, moduleRisks, similarIncidents);

  const productionImpact = computeProductionImpact(manifest, moduleRisks, testResult.probability, similarIncidents);

  // ── Overall risk score (weighted, explainable) ──
  const riskComponents: RiskComponent = {
    code_change_risk: codeChangeRisk,
    test_risk: testResult.score,
    historical_risk: historicalRisk.score,
    propagation_risk: propagation.score,
    production_impact: productionImpact.score,
  };

  const overallRisk = Math.round(
    codeChangeRisk * RISK_WEIGHTS.code_change +
      testResult.score * RISK_WEIGHTS.test +
      historicalRisk.score * RISK_WEIGHTS.historical +
      propagation.score * RISK_WEIGHTS.propagation +
      productionImpact.score * RISK_WEIGHTS.production_impact,
  );

  // ── Max affected users for rollout calc ──
  const maxAffectedUsers = Math.max(
    ...manifest.changed_modules.map((m) => MODULES.find((mod) => mod.name === m)?.avg_users ?? 10000),
  );

  // ── Rollout strategies ──
  const rolloutStrategies = generateRolloutStrategies(
    overallRisk,
    productionImpact.score,
    maxAffectedUsers,
    testResult.probability,
  );

  // ── Suspicious evidence ──
  const suspiciousEvidence = detectSuspiciousEvidence(manifest, moduleRisks, similarIncidents, testResult);

  // ── Risk contributors ──
  const contributors = buildRiskContributors(moduleRisks, manifest, similarIncidents, testResult, productionImpact.score);

  // ── Traditional CI comparison ──
  const ciPass = manifest.tests.failed === 0;
  const traditionalCi = {
    decision: (ciPass ? 'RELEASE' : 'HOLD') as ReleaseDecision,
    reason: ciPass
      ? 'All tests passed — traditional CI has no signal to block the release.'
      : `${manifest.tests.failed} test(s) failed — traditional CI blocks the release.`,
  };

  // ── AI agent decision ──
  const recommendedStrategy = rolloutStrategies.find((s) => s.recommended) ?? rolloutStrategies[0];
  const decision = makeDecision(overallRisk, testResult.probability, similarIncidents, suspiciousEvidence, recommendedStrategy);

  // ── Early detection: ReleaseSentinel catches risk CI misses ──
  const earlyDetection = ciPass && (decision === 'STAGED_RELEASE' || decision === 'HOLD' || decision === 'ROLLBACK_PREPARATION');

  // ── Impact reduction ──
  const traditionalUsers = maxAffectedUsers;
  const sentinelUsers = recommendedStrategy.estimated_affected_users;
  const reductionPct = traditionalUsers > 0 ? Math.round((1 - sentinelUsers / traditionalUsers) * 100) : 0;

  // ── Reasoning (generated from actual evidence, not hardcoded) ──
  const reasoning = generateReasoning(manifest, decision, overallRisk, moduleRisks, testResult, similarIncidents, suspiciousEvidence, recommendedStrategy, productionImpact);

  // ── ML notes ──
  const mlNotes = [
    { component: 'Code Change Risk', note: 'Hybrid: rule-based features (criticality, file count, dependency changes) + historical release-failure-rate signal. Labeled as deterministic risk signals.' },
    { component: 'Test Failure Prediction', note: 'Logistic regression trained at runtime on historical release outcomes using failed-test rate, flaky-test rate, coverage, dependency changes, file count, and module count.' },
    { component: 'Incident Similarity', note: 'TF-IDF vectorization + cosine similarity over incident corpus. Real NLP computation, not a lookup table.' },
    { component: 'Failure Mode Prediction', note: 'Weighted combination of incident similarity scores and module-risk-derived probabilities.' },
    { component: 'Production Impact', note: 'Weighted scoring over module criticality, affected users, transaction importance, and historical severity.' },
    { component: 'Rollout Optimizer', note: 'Exposure-scaled risk calculation across 10%/50%/100% strategies with safety-threshold-based recommendation.' },
  ];

  return {
    release_id: manifest.release_id,
    overall_risk: overallRisk,
    risk_components: riskComponents,
    module_risks: moduleRisks,
    predicted_failure_probability: testResult.probability,
    failure_modes: failureModes,
    similar_incidents: similarIncidents,
    rollout_strategies: rolloutStrategies,
    suspicious_evidence: suspiciousEvidence,
    contributors,
    decision,
    recommended_rollout: recommendedStrategy.percentage,
    reasoning,
    ml_notes: mlNotes,
    traditional_ci: traditionalCi,
    early_detection: earlyDetection,
    impact_reduction: { traditional_users: traditionalUsers, sentinel_users: sentinelUsers, reduction_pct: reductionPct },
  };
}

function makeDecision(
  overallRisk: number,
  testProb: number,
  similar: { similarity: number; incident: { severity: number } }[],
  evidence: { severity: string }[],
  recommended: RolloutStrategy,
): ReleaseDecision {
  const criticalCount = evidence.filter((e) => e.severity === 'critical').length;
  const topSim = similar[0]?.similarity ?? 0;
  const topSeverity = similar[0]?.incident.severity ?? 0;

  if (overallRisk >= 80 || (testProb >= 75 && criticalCount >= 2) || (topSim >= 85 && topSeverity >= 4)) {
    return 'ROLLBACK_PREPARATION';
  }
  if (overallRisk >= 65 || testProb >= 60 || criticalCount >= 2 || topSim >= 70) {
    return 'STAGED_RELEASE';
  }
  if (overallRisk >= 45 || testProb >= 40 || criticalCount >= 1) {
    return 'STAGED_RELEASE';
  }
  if (recommended.percentage < 100) {
    return 'STAGED_RELEASE';
  }
  return 'RELEASE';
}

function generateReasoning(
  manifest: ReleaseManifest,
  decision: ReleaseDecision,
  overallRisk: number,
  moduleRisks: { module: string; risk: number }[],
  testResult: { probability: number; reasons: string[] },
  similar: { similarity: number; incident: { incident_id: string; failure_mode: string } }[],
  evidence: { severity: string; label: string }[],
  recommended: RolloutStrategy,
  productionImpact: { score: number },
): string {
  const parts: string[] = [];

  const topModule = moduleRisks.sort((a, b) => b.risk - a.risk)[0];
  const criticalEvidence = evidence.filter((e) => e.severity === 'critical' || e.severity === 'high');

  switch (decision) {
    case 'RELEASE':
      parts.push(`Overall risk is ${overallRisk}/100 — within acceptable bounds.`);
      if (testResult.probability < 30) parts.push(`Test failure probability is low (${testResult.probability}%).`);
      parts.push(`No critical suspicious signals detected. A full rollout is safe.`);
      break;
    case 'STAGED_RELEASE':
      parts.push(`Overall risk is ${overallRisk}/100 — elevated.`);
      if (topModule) parts.push(`The ${topModule.module} has the highest change risk (${topModule.risk}).`);
      if (testResult.probability >= 40) parts.push(`Predicted test failure probability is ${testResult.probability}%.`);
      if (similar.length > 0 && similar[0].similarity >= 60) {
        parts.push(`Strong similarity to historical incident ${similar[0].incident.incident_id} (${similar[0].similarity}% match — ${similar[0].incident.failure_mode.replace(/_/g, ' ')}).`);
      }
      if (manifest.dependencies.length > 0) parts.push(`Dependency changes (${manifest.dependencies.join(', ')}) add uncertainty.`);
      parts.push(`A 100% rollout has high estimated production exposure (impact ${productionImpact.score}/100).`);
      parts.push(`Begin with ${recommended.percentage}% rollout, monitor error rate, and proceed only if metrics remain below threshold.`);
      break;
    case 'HOLD':
      parts.push(`Overall risk is ${overallRisk}/100 — high.`);
      parts.push(`${criticalEvidence.length} suspicious signal(s) detected: ${criticalEvidence.slice(0, 3).map((e) => e.label).join('; ')}.`);
      if (similar.length > 0) parts.push(`Top similar incident ${similar[0].incident.incident_id} at ${similar[0].similarity}% match.`);
      parts.push(`Hold the release until test failures are resolved and risk signals decrease.`);
      break;
    case 'ROLLBACK_PREPARATION':
      parts.push(`Overall risk is ${overallRisk}/100 — critical.`);
      parts.push(`${criticalEvidence.length} critical suspicious signal(s): ${criticalEvidence.slice(0, 3).map((e) => e.label).join('; ')}.`);
      if (testResult.probability >= 70) parts.push(`Predicted failure probability is ${testResult.probability}%.`);
      if (similar.length > 0 && similar[0].similarity >= 80) parts.push(`Very high similarity to severe incident ${similar[0].incident.incident_id}.`);
      parts.push(`Prepare rollback procedures before any rollout attempt. Do not release to production.`);
      break;
  }

  return parts.join(' ');
}

// ── Rollout Simulation ──────────────────────────────────────────

export function simulateRollout(
  manifest: ReleaseManifest,
  analysis: AnalysisResult,
  percentage: number,
): RolloutSimulation {
  const baseRequests = 124300;
  const requests = Math.round(baseRequests * (percentage / 100));

  const baselineErrorRate = 0.9;
  const baselineLatency = 120;
  const baselinePaymentFailure = 1.1;

  // Risk-driven simulation: higher risk → higher deviation from baseline
  const riskFactor = analysis.overall_risk / 100;
  const paymentModule = analysis.module_risks.find((m) => m.module === 'payment-service');
  const paymentRisk = paymentModule ? paymentModule.risk / 100 : 0.3;

  // Deterministic pseudo-random based on release_id + percentage for reproducibility
  const seed = hashString(`${manifest.release_id}-${percentage}`);
  const jitter = ((seed % 100) / 100 - 0.5) * 0.4; // ±20% jitter

  const errorMultiplier = 1 + riskFactor * 1.8 + jitter;
  const errorRate = baselineErrorRate * errorMultiplier;

  const latencyMultiplier = 1 + riskFactor * 0.6 + jitter * 0.5;
  const latency = Math.round(baselineLatency * latencyMultiplier);

  const paymentFailureMultiplier = 1 + paymentRisk * 2.2 + jitter;
  const paymentFailureRate = baselinePaymentFailure * paymentFailureMultiplier;

  const affectedUsers = Math.round(
    analysis.impact_reduction.traditional_users * (percentage / 100) * Math.min(1, errorRate / 3),
  );

  const cpuUsage = Math.round(35 + percentage * 0.4 + riskFactor * 15 + jitter * 10);

  const rollbackThreshold = 3.0;

  let status: RolloutSimulation['status'] = 'ok';
  if (errorRate >= rollbackThreshold || paymentFailureRate >= rollbackThreshold) {
    status = 'critical';
  } else if (errorRate >= baselineErrorRate * 2 || paymentFailureRate >= baselinePaymentFailure * 2) {
    status = 'warning';
  }

  // Predicted error rate (what the model predicted before rollout)
  const predictedErrorRate = baselineErrorRate * (1 + riskFactor * 0.8);
  const predictionDeviation = errorRate - predictedErrorRate;

  const metrics: SimulatedMetric[] = [
    { label: 'Request Volume', value: requests.toLocaleString(), baseline: baseRequests.toLocaleString(), status: 'ok' },
    {
      label: 'Error Rate',
      value: `${errorRate.toFixed(1)}%`,
      baseline: `${baselineErrorRate}%`,
      status: errorRate >= rollbackThreshold ? 'critical' : errorRate >= baselineErrorRate * 2 ? 'warning' : 'ok',
      delta: `${errorRate > baselineErrorRate ? '+' : ''}${(errorRate - baselineErrorRate).toFixed(1)}%`,
    },
    {
      label: 'Latency (p95)',
      value: `${latency}ms`,
      baseline: `${baselineLatency}ms`,
      status: latency >= baselineLatency * 1.8 ? 'critical' : latency >= baselineLatency * 1.4 ? 'warning' : 'ok',
      delta: `${latency > baselineLatency ? '+' : ''}${latency - baselineLatency}ms`,
    },
    {
      label: 'Payment Failure Rate',
      value: `${paymentFailureRate.toFixed(1)}%`,
      baseline: `${baselinePaymentFailure}%`,
      status: paymentFailureRate >= rollbackThreshold ? 'critical' : paymentFailureRate >= baselinePaymentFailure * 2 ? 'warning' : 'ok',
      delta: `${paymentFailureRate > baselinePaymentFailure ? '+' : ''}${(paymentFailureRate - baselinePaymentFailure).toFixed(1)}%`,
    },
    { label: 'Affected Users', value: affectedUsers.toLocaleString(), baseline: '0', status: affectedUsers > 500 ? 'critical' : affectedUsers > 100 ? 'warning' : 'ok' },
    { label: 'CPU Usage', value: `${cpuUsage}%`, baseline: '35%', status: cpuUsage >= 85 ? 'critical' : cpuUsage >= 70 ? 'warning' : 'ok' },
    { label: 'Rollback Threshold', value: `${rollbackThreshold.toFixed(1)}%`, baseline: '—', status: 'ok' },
  ];

  return {
    percentage,
    requests,
    error_rate: errorRate,
    baseline_error_rate: baselineErrorRate,
    latency_ms: latency,
    baseline_latency_ms: baselineLatency,
    payment_failure_rate: paymentFailureRate,
    baseline_payment_failure_rate: baselinePaymentFailure,
    affected_users: affectedUsers,
    cpu_usage: cpuUsage,
    rollback_threshold: rollbackThreshold,
    status,
    metrics,
    predicted_error_rate: predictedErrorRate,
    prediction_deviation: predictionDeviation,
  };
}

// ── Reassessment (Feedback Loop) ─────────────────────────────────

export function reassess(
  analysis: AnalysisResult,
  simulation: RolloutSimulation,
): Reassessment {
  const previousDecision = analysis.decision;
  const thresholdBreached =
    simulation.error_rate >= simulation.rollback_threshold ||
    simulation.payment_failure_rate >= simulation.rollback_threshold;

  const deviationPct = simulation.prediction_deviation;
  const significantDeviation = Math.abs(deviationPct) > 0.5;

  let newDecision: ReleaseDecision;
  const reasoningParts: string[] = [];

  if (thresholdBreached) {
    newDecision = 'ROLLBACK_PREPARATION';
    reasoningParts.push(
      `Observed error rate ${simulation.error_rate.toFixed(1)}% exceeded the rollback threshold of ${simulation.rollback_threshold.toFixed(1)}%.`,
    );
    if (simulation.payment_failure_rate >= simulation.rollback_threshold) {
      reasoningParts.push(`Payment failure rate ${simulation.payment_failure_rate.toFixed(1)}% also breached threshold.`);
    }
    reasoningParts.push('Initiate rollback immediately and halt further rollout.');
  } else if (significantDeviation && deviationPct > 0) {
    newDecision = 'HOLD';
    reasoningParts.push(
      `Observed error rate ${simulation.error_rate.toFixed(1)}% is ${deviationPct.toFixed(1)}% above the predicted ${simulation.predicted_error_rate.toFixed(1)}%.`,
    );
    reasoningParts.push('Prediction deviation is significant and positive — hold rollout and investigate before proceeding.');
  } else if (simulation.status === 'warning') {
    newDecision = 'HOLD';
    reasoningParts.push(
      `Metrics are in warning range (error rate ${simulation.error_rate.toFixed(1)}% vs baseline ${simulation.baseline_error_rate}%).`,
    );
    reasoningParts.push('Hold at current rollout percentage and monitor before expanding.');
  } else if (simulation.percentage < 100 && (previousDecision === 'STAGED_RELEASE' || previousDecision === 'RELEASE')) {
    newDecision = 'STAGED_RELEASE';
    reasoningParts.push(
      `Metrics are within safe bounds at ${simulation.percentage}% rollout (error rate ${simulation.error_rate.toFixed(1)}%).`,
    );
    reasoningParts.push(`Prediction deviation is ${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}% — within tolerance. Proceed to next rollout stage.`);
  } else {
    newDecision = 'RELEASE';
    reasoningParts.push(
      `All metrics nominal at ${simulation.percentage}% rollout. Prediction deviation ${deviationPct >= 0 ? '+' : ''}${deviationPct.toFixed(1)}% is within tolerance.`,
    );
    reasoningParts.push('Safe to proceed to full rollout.');
  }

  return {
    previous_decision: previousDecision,
    new_decision: newDecision,
    reasoning: reasoningParts.join(' '),
    observed_error_rate: simulation.error_rate,
    predicted_error_rate: simulation.predicted_error_rate,
    prediction_deviation: deviationPct,
    threshold_breached: thresholdBreached,
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
