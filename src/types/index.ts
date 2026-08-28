export interface ReleaseManifest {
  release_id: string;
  changed_files: string[];
  changed_modules: string[];
  tests: {
    passed: number;
    failed: number;
    flaky: number;
  };
  dependencies: string[];
  test_coverage?: number;
}

export type FailureMode =
  | 'payment_timeout'
  | 'duplicate_transaction'
  | 'checkout_failure'
  | 'notification_delay'
  | 'auth_failure'
  | 'db_migration_error'
  | 'latency_spike'
  | 'data_loss'
  | 'service_unavailable'
  | 'memory_leak';

export interface ModuleMeta {
  name: string;
  criticality: number; // 0-100
  owner: string;
  description: string;
  depends_on: string[];
  avg_users: number;
  transaction_importance: number; // 0-100
}

export interface HistoricalIncident {
  incident_id: string;
  affected_module: string;
  release_id: string;
  failure_mode: FailureMode;
  severity: number; // 1-5
  description: string;
  root_cause: string;
  resolution: string;
  date: string;
  affected_users: number;
}

export interface HistoricalRelease {
  release_id: string;
  changed_modules: string[];
  changed_files: string[];
  dependencies: string[];
  tests_passed: number;
  tests_failed: number;
  tests_flaky: number;
  test_coverage: number;
  result: 'success' | 'incident' | 'rollback';
  incident_id?: string;
  date: string;
}

export interface ModuleRisk {
  module: string;
  risk: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
}

export interface PredictedFailureMode {
  mode: FailureMode;
  label: string;
  probability: number;
  reasons: string[];
}

export interface SimilarIncident {
  incident: HistoricalIncident;
  similarity: number;
}

export interface RolloutStrategy {
  percentage: number;
  label: string;
  exposure: 'Low' | 'Medium' | 'High';
  risk_score: number;
  estimated_failure_impact: number;
  estimated_affected_users: number;
  rollback_difficulty: 'Easy' | 'Moderate' | 'Hard';
  recommended: boolean;
}

export interface RiskContributor {
  label: string;
  delta: number;
}

export interface SuspiciousEvidence {
  id: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export type ReleaseDecision =
  | 'RELEASE'
  | 'STAGED_RELEASE'
  | 'HOLD'
  | 'ROLLBACK_PREPARATION';

export interface RiskComponent {
  code_change_risk: number;
  test_risk: number;
  historical_risk: number;
  propagation_risk: number;
  production_impact: number;
}

export interface AnalysisResult {
  release_id: string;
  overall_risk: number;
  risk_components: RiskComponent;
  module_risks: ModuleRisk[];
  predicted_failure_probability: number;
  failure_modes: PredictedFailureMode[];
  similar_incidents: SimilarIncident[];
  rollout_strategies: RolloutStrategy[];
  suspicious_evidence: SuspiciousEvidence[];
  contributors: RiskContributor[];
  decision: ReleaseDecision;
  recommended_rollout: number;
  reasoning: string;
  ml_notes: { component: string; note: string }[];
  traditional_ci: { decision: ReleaseDecision; reason: string };
  early_detection: boolean;
  impact_reduction: { traditional_users: number; sentinel_users: number; reduction_pct: number };
  project_risk: {
    schedule_risk: { score: number; level: 'Low' | 'Medium' | 'High' };
    budget_risk: { score: number; level: 'Low' | 'Medium' | 'High' };
    resource_risk: { score: number; level: 'Low' | 'Medium' | 'High' };
    quality_risk: { score: number; level: 'Low' | 'Medium' | 'High' };
  };
}

export interface SimulatedMetric {
  label: string;
  value: string;
  baseline: string;
  status: 'ok' | 'warning' | 'critical';
  delta?: string;
}

export interface RolloutSimulation {
  percentage: number;
  requests: number;
  error_rate: number;
  baseline_error_rate: number;
  latency_ms: number;
  baseline_latency_ms: number;
  payment_failure_rate: number;
  baseline_payment_failure_rate: number;
  affected_users: number;
  cpu_usage: number;
  rollback_threshold: number;
  status: 'ok' | 'warning' | 'critical';
  metrics: SimulatedMetric[];
  predicted_error_rate: number;
  prediction_deviation: number;
}

export interface Reassessment {
  previous_decision: ReleaseDecision;
  new_decision: ReleaseDecision;
  reasoning: string;
  observed_error_rate: number;
  predicted_error_rate: number;
  prediction_deviation: number;
  threshold_breached: boolean;
}
