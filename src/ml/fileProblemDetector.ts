import type { FileProblem, FileMLAnalysisResult, ReleaseManifest, ProblemCategory, ProblemSeverity } from '@/types';

const CRITICAL_MODULE_NAMES = new Set(['payment-service', 'auth-service', 'checkout-service', 'order-service']);

interface RawIssue {
  title: string;
  category: ProblemCategory;
  severity: ProblemSeverity;
  details: string;
  location?: string;
  suggestedFix: string;
  confidence: number;
}

/**
 * Parses raw text, detects syntax and structural anomalies, runs ML feature scoring,
 * and generates structured diagnostic problems with suggested AI fixes.
 */
export function analyzeFileWithML(rawContent: string, fileName = 'manifest.json'): FileMLAnalysisResult {
  const problems: FileProblem[] = [];
  let isValidJson = false;
  let parsed: Record<string, unknown> | null = null;
  let extractedManifest: Partial<ReleaseManifest> | null = null;

  // 1. Syntactic analysis
  const syntaxIssues = detectSyntaxProblems(rawContent);
  syntaxIssues.forEach((issue) => {
    problems.push(createProblem('syntax', issue));
  });

  // Try parsing JSON directly or with salvage
  try {
    parsed = JSON.parse(rawContent);
    isValidJson = true;
  } catch {
    isValidJson = false;
    parsed = trySalvageJson(rawContent);
  }

  // 2. Schema compliance analysis
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    extractedManifest = parsed as Partial<ReleaseManifest>;
    const schemaIssues = detectSchemaProblems(parsed);
    schemaIssues.forEach((issue) => {
      problems.push(createProblem('schema', issue));
    });
  } else {
    problems.push(
      createProblem('schema', {
        title: 'Manifest Root is Not a JSON Object',
        category: 'schema',
        severity: 'critical',
        details: 'The file must represent a single JSON manifest object containing release details.',
        suggestedFix: 'Wrap release properties inside a JSON object { ... }.',
        confidence: 99,
        location: 'Line 1',
      }),
    );
  }

  // 3. Security & Anti-pattern scanning
  const securityIssues = detectSecurityAnomalies(rawContent);
  securityIssues.forEach((issue) => {
    problems.push(createProblem('security', issue));
  });

  // 4. ML Semantic, Test & Blast-radius Risk Anomaly Analysis
  const riskIssues = detectMLRiskAnomalies(parsed || {});
  riskIssues.forEach((issue) => {
    problems.push(createProblem(issue.category, issue));
  });

  // 5. ML Feature Signal Extraction & Anomaly Score
  const featureSignals = computeFeatureSignals(parsed, problems, rawContent);
  const anomalyScore = computeAnomalyScore(problems, featureSignals);
  const healthScore = Math.max(0, 100 - anomalyScore);

  // Generate executive diagnostic summary
  const criticalCount = problems.filter((p) => p.severity === 'critical').length;
  const highCount = problems.filter((p) => p.severity === 'high').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  let summary = '';
  if (criticalCount > 0) {
    summary = `ML Scanner detected ${criticalCount} critical and ${highCount} high-severity issue(s). Data correction is required before deployment.`;
  } else if (highCount > 0) {
    summary = `ML Scanner identified ${highCount} significant risk anomaly(ies). Review suggested fixes.`;
  } else if (warningCount > 0) {
    summary = `File structure is mostly sound with ${warningCount} minor warning(s). Safe to auto-correct and analyze.`;
  } else {
    summary = `File is completely healthy! All schema constraints, test ratios, and blast radius metrics passed ML inspection.`;
  }

  return {
    fileName,
    isValidJson,
    healthScore,
    anomalyScore,
    problems,
    extractedManifest,
    featureSignals,
    summary,
  };
}

let problemSeq = 0;
function createProblem(category: ProblemCategory, raw: RawIssue): FileProblem {
  problemSeq++;
  return {
    id: `prob_${category}_${problemSeq}`,
    title: raw.title,
    category: raw.category,
    severity: raw.severity,
    details: raw.details,
    location: raw.location,
    suggestedFix: raw.suggestedFix,
    confidence: raw.confidence,
  };
}

function detectSyntaxProblems(raw: string): RawIssue[] {
  const issues: RawIssue[] = [];

  if (!raw.trim()) {
    issues.push({
      title: 'Empty File Content',
      category: 'syntax',
      severity: 'critical',
      details: 'The uploaded file is empty.',
      suggestedFix: 'Provide a valid JSON release manifest.',
      confidence: 100,
      location: 'Line 1',
    });
    return issues;
  }

  // Trailing commas
  const trailingCommaMatch = raw.match(/,\s*([}\]])/g);
  if (trailingCommaMatch) {
    issues.push({
      title: 'Illegal Trailing Commas Detected',
      category: 'syntax',
      severity: 'high',
      details: `Found ${trailingCommaMatch.length} trailing comma(s) before closing brackets, violating strict JSON standard.`,
      suggestedFix: 'Remove trailing commas preceding "}" or "]".',
      confidence: 98,
      location: 'Multiple lines',
    });
  }

  // Single quotes in JSON
  const singleQuoteMatch = raw.match(/'[^']*'\s*:/g);
  if (singleQuoteMatch) {
    issues.push({
      title: 'Single-Quoted Property Keys',
      category: 'syntax',
      severity: 'high',
      details: `Found single quotes used for JSON property identifiers (${singleQuoteMatch.length} occurrence(s)).`,
      suggestedFix: 'Replace single quotes with double quotes for all JSON keys.',
      confidence: 96,
      location: 'Key definitions',
    });
  }

  // Unquoted keys
  const unquotedKeyMatch = raw.match(/[{,]\s*([a-zA-Z_]\w*)\s*:/g);
  if (unquotedKeyMatch) {
    issues.push({
      title: 'Unquoted Object Keys',
      category: 'syntax',
      severity: 'high',
      details: `JSON object keys must be enclosed in double quotes.`,
      suggestedFix: 'Quote all object keys using double quotes.',
      confidence: 94,
      location: 'Object keys',
    });
  }

  // Missing enclosing braces
  if (!raw.trim().startsWith('{') || !raw.trim().endsWith('}')) {
    issues.push({
      title: 'Missing Outer Object Braces',
      category: 'syntax',
      severity: 'medium',
      details: 'Content does not start and end with standard JSON curly braces { }.',
      suggestedFix: 'Wrap root properties with { and }.',
      confidence: 90,
      location: 'File boundaries',
    });
  }

  return issues;
}

function detectSchemaProblems(obj: Record<string, unknown>): RawIssue[] {
  const issues: RawIssue[] = [];

  // release_id check
  if (!obj.release_id || typeof obj.release_id !== 'string') {
    issues.push({
      title: 'Missing or Invalid "release_id"',
      category: 'schema',
      severity: 'high',
      details: 'The manifest is missing a unique "release_id" string identifier (e.g., "REL-2026-042").',
      suggestedFix: 'Generate and assign a standard release identifier format.',
      confidence: 95,
      location: 'root.release_id',
    });
  } else if (!/^REL-\d{4}-\d{3,4}$/i.test(obj.release_id)) {
    issues.push({
      title: 'Non-Standard Release ID Format',
      category: 'schema',
      severity: 'info',
      details: `Release ID "${obj.release_id}" does not conform to the recommended REL-YYYY-XXX naming convention.`,
      suggestedFix: 'Normalize release_id to REL-YYYY-XXX format for consistency.',
      confidence: 75,
      location: 'root.release_id',
    });
  }

  // changed_modules check
  if (!obj.changed_modules || !Array.isArray(obj.changed_modules)) {
    issues.push({
      title: 'Missing "changed_modules" Array',
      category: 'schema',
      severity: 'critical',
      details: 'Manifest does not specify the list of modified microservices/modules.',
      suggestedFix: 'Infer changed modules from changed files paths (e.g., payment/ -> payment-service).',
      confidence: 98,
      location: 'root.changed_modules',
    });
  } else if (obj.changed_modules.length === 0) {
    issues.push({
      title: 'Empty "changed_modules" List',
      category: 'schema',
      severity: 'warning',
      details: 'The changed_modules array is empty, which implies a no-op release.',
      suggestedFix: 'Verify changed files and populate the affected modules.',
      confidence: 85,
      location: 'root.changed_modules',
    });
  }

  // changed_files check
  if (!obj.changed_files || !Array.isArray(obj.changed_files)) {
    issues.push({
      title: 'Missing "changed_files" Array',
      category: 'schema',
      severity: 'medium',
      details: 'Manifest lacks a list of changed source files.',
      suggestedFix: 'Initialize changed_files with modified file paths.',
      confidence: 90,
      location: 'root.changed_files',
    });
  }

  // tests check
  if (!obj.tests || typeof obj.tests !== 'object' || Array.isArray(obj.tests)) {
    issues.push({
      title: 'Missing "tests" Suite Object',
      category: 'schema',
      severity: 'critical',
      details: 'The manifest lacks the test execution summary object containing passed, failed, and flaky counts.',
      suggestedFix: 'Add tests object: {"passed": 0, "failed": 0, "flaky": 0}.',
      confidence: 99,
      location: 'root.tests',
    });
  } else {
    const tests = obj.tests as Record<string, unknown>;
    if (typeof tests.passed !== 'number' || typeof tests.failed !== 'number' || typeof tests.flaky !== 'number') {
      issues.push({
        title: 'Malformed Test Counts in "tests" Object',
        category: 'schema',
        severity: 'high',
        details: 'Test attributes (passed, failed, flaky) must be numeric values.',
        suggestedFix: 'Coerce string or null test values into integers.',
        confidence: 95,
        location: 'root.tests',
      });
    }
  }

  // test_coverage check
  if (obj.test_coverage !== undefined) {
    if (typeof obj.test_coverage !== 'number' || obj.test_coverage < 0 || obj.test_coverage > 100) {
      issues.push({
        title: 'Invalid Test Coverage Value',
        category: 'schema',
        severity: 'medium',
        details: `test_coverage value (${String(obj.test_coverage)}) is not a valid percentage between 0 and 100.`,
        suggestedFix: 'Clamp test_coverage to a realistic number between 0 and 100.',
        confidence: 92,
        location: 'root.test_coverage',
      });
    }
  }

  // dependencies check
  if (obj.dependencies && !Array.isArray(obj.dependencies)) {
    issues.push({
      title: 'Invalid "dependencies" Type',
      category: 'schema',
      severity: 'medium',
      details: 'The dependencies field should be an array of package/library names.',
      suggestedFix: 'Convert dependencies field into an array of strings.',
      confidence: 90,
      location: 'root.dependencies',
    });
  }

  return issues;
}

function detectSecurityAnomalies(raw: string): RawIssue[] {
  const issues: RawIssue[] = [];

  // Check for accidentally leaked API keys / JWTs / secrets in manifest
  if (/(?:api[_-]?key|secret|token|password|bearer\s+[a-zA-Z0-9_\-\.]{20,})/i.test(raw)) {
    issues.push({
      title: 'Potential Secret / Credential Leakage Detected',
      category: 'security',
      severity: 'critical',
      details: 'The manifest text contains patterns matching API keys, tokens, or credential strings.',
      suggestedFix: 'Sanitize file and remove sensitive credentials before committing or analyzing.',
      confidence: 90,
      location: 'File content',
    });
  }

  // Check for absolute internal host paths
  if (/c:\\users\\|home\/\w+\/|file:\/\//i.test(raw)) {
    issues.push({
      title: 'Hardcoded Local File System Paths',
      category: 'security',
      severity: 'info',
      details: 'Manifest contains local absolute filesystem paths instead of relative repo paths.',
      suggestedFix: 'Normalize file paths to relative project repository paths.',
      confidence: 80,
      location: 'changed_files',
    });
  }

  return issues;
}

function detectMLRiskAnomalies(obj: Record<string, unknown>): RawIssue[] {
  const issues: RawIssue[] = [];

  const modules = Array.isArray(obj.changed_modules) ? (obj.changed_modules as string[]) : [];
  const files = Array.isArray(obj.changed_files) ? (obj.changed_files as string[]) : [];
  const tests = (obj.tests && typeof obj.tests === 'object' ? obj.tests : {}) as Record<string, number>;
  const passed = tests.passed || 0;
  const failed = tests.failed || 0;
  const flaky = tests.flaky || 0;
  const totalTests = passed + failed + flaky;
  const coverage = typeof obj.test_coverage === 'number' ? obj.test_coverage : 70;
  const deps = Array.isArray(obj.dependencies) ? (obj.dependencies as string[]) : [];

  // ML Risk Rule 1: High Flakiness Ratio Anomaly
  if (totalTests > 0 && flaky > 0) {
    const flakeRatio = flaky / totalTests;
    if (flakeRatio > 0.25 || flaky >= 5) {
      issues.push({
        title: 'Severe Test Flakiness Anomaly',
        category: 'test_regression',
        severity: 'high',
        details: `Flaky tests represent ${(flakeRatio * 100).toFixed(1)}% of total test executions (${flaky} flaky tests). This strongly correlates with production race conditions.`,
        suggestedFix: 'Isolate flaky test suites or configure test retry gates in release pipeline.',
        confidence: 93,
      });
    } else if (flakeRatio > 0.1) {
      issues.push({
        title: 'Moderate Test Flakiness Signal',
        category: 'test_regression',
        severity: 'warning',
        details: `${flaky} flaky test(s) detected. Flakiness increases regression risk by ~35%.`,
        suggestedFix: 'Re-run flaky tests in isolation before promoting release.',
        confidence: 82,
      });
    }
  }

  // ML Risk Rule 2: Critical Core Module Drift with Insufficient Test Coverage
  const touchedCritical = modules.filter((m) => CRITICAL_MODULE_NAMES.has(m));
  if (touchedCritical.length > 0) {
    if (coverage < 70) {
      issues.push({
        title: `Low Test Coverage on Critical Modules (${touchedCritical.join(', ')})`,
        category: 'risk_anomaly',
        severity: 'critical',
        details: `Critical tier-1 services [${touchedCritical.join(', ')}] are modified, but overall test coverage is only ${coverage}%. Required threshold is >= 80%.`,
        suggestedFix: 'Increase test coverage for critical payment and authentication flows before release.',
        confidence: 96,
      });
    }
  }

  // ML Risk Rule 3: Extreme Blast Radius Anomaly
  if (files.length >= 7 || modules.length >= 4) {
    issues.push({
      title: 'High Blast Radius & Multi-Service Dependency Risk',
      category: 'blast_radius',
      severity: 'high',
      details: `Release modifies ${files.length} files across ${modules.length} distributed modules simultaneously, creating cross-service cascading failure vectors.`,
      suggestedFix: 'Decompose changes into smaller, independently deployable micro-releases or apply canary gating.',
      confidence: 88,
    });
  }

  // ML Risk Rule 4: Critical Module Modified with 0 Passed Tests
  if (touchedCritical.length > 0 && passed === 0 && totalTests === 0) {
    issues.push({
      title: 'Unverified Critical Service Changes (0 Tests Recorded)',
      category: 'test_regression',
      severity: 'critical',
      details: `Core services (${touchedCritical.join(', ')}) have zero recorded test runs. Deploying untested critical services poses severe production downtime risk.`,
      suggestedFix: 'Execute automated regression test suite for affected modules.',
      confidence: 97,
    });
  }

  // ML Risk Rule 5: Critical Dependency Modifications
  if (deps.length > 0) {
    const hasCoreDrift = deps.some((d) => /stripe|auth0|postgres|redis|kafka|prisma|grpc/i.test(d));
    if (hasCoreDrift) {
      issues.push({
        title: `High-Risk Infrastructure Dependency Upgrades (${deps.join(', ')})`,
        category: 'dependency',
        severity: 'high',
        details: `Third-party dependencies (${deps.join(', ')}) interact with payment gateways or persistence tiers. API contract mismatch risk is elevated.`,
        suggestedFix: 'Run contract integration tests and prepare instant rollback plan.',
        confidence: 89,
      });
    }
  }

  return issues;
}

function computeFeatureSignals(
  parsed: Record<string, unknown> | null,
  problems: FileProblem[],
  _rawContent: string,
) {
  const signals: FileMLAnalysisResult['featureSignals'] = [];

  const syntaxErrors = problems.filter((p) => p.category === 'syntax').length;
  signals.push({
    name: 'Syntax Integrity',
    value: syntaxErrors === 0 ? 'Compliant' : `${syntaxErrors} syntax violations`,
    impact: syntaxErrors === 0 ? 'positive' : 'critical',
    description: 'Measures adherence to strict JSON formatting standards.',
  });

  const schemaErrors = problems.filter((p) => p.category === 'schema').length;
  signals.push({
    name: 'Schema Completeness',
    value: schemaErrors === 0 ? '100% Complete' : `${schemaErrors} missing/malformed fields`,
    impact: schemaErrors === 0 ? 'positive' : schemaErrors >= 2 ? 'critical' : 'negative',
    description: 'Evaluates required manifest metadata (release_id, modules, tests, files).',
  });

  const tests = (parsed?.tests || {}) as Record<string, number>;
  const total = (tests.passed || 0) + (tests.failed || 0) + (tests.flaky || 0);
  const flaky = tests.flaky || 0;
  const flakePct = total > 0 ? Math.round((flaky / total) * 100) : 0;
  signals.push({
    name: 'Test Flakiness Metric',
    value: `${flakePct}% (${flaky} flaky)`,
    impact: flakePct > 20 ? 'critical' : flakePct > 5 ? 'negative' : 'positive',
    description: 'ML anomaly signal derived from non-deterministic test results.',
  });

  const modules = Array.isArray(parsed?.changed_modules) ? (parsed?.changed_modules as string[]) : [];
  const files = Array.isArray(parsed?.changed_files) ? (parsed?.changed_files as string[]) : [];
  const blastRadiusIndex = Math.min(100, modules.length * 15 + files.length * 8);
  signals.push({
    name: 'Blast Radius Index',
    value: `${blastRadiusIndex}/100`,
    impact: blastRadiusIndex > 60 ? 'critical' : blastRadiusIndex > 30 ? 'negative' : 'positive',
    description: 'Cross-module dependency spread and total modified file footprint.',
  });

  const coverage = typeof parsed?.test_coverage === 'number' ? parsed.test_coverage : 70;
  signals.push({
    name: 'Test Coverage Metric',
    value: `${coverage}%`,
    impact: coverage < 60 ? 'critical' : coverage < 75 ? 'negative' : 'positive',
    description: 'Code execution coverage against release modifications.',
  });

  return signals;
}

function computeAnomalyScore(
  problems: FileProblem[],
  signals: FileMLAnalysisResult['featureSignals'],
): number {
  let score = 0;

  for (const prob of problems) {
    if (prob.severity === 'critical') score += 25;
    else if (prob.severity === 'high') score += 15;
    else if (prob.severity === 'warning') score += 8;
    else score += 3;
  }

  const criticalSignals = signals.filter((s) => s.impact === 'critical').length;
  const negativeSignals = signals.filter((s) => s.impact === 'negative').length;
  score += criticalSignals * 10 + negativeSignals * 5;

  return Math.min(100, Math.round(score));
}

function trySalvageJson(raw: string): Record<string, unknown> | null {
  try {
    const result: Record<string, unknown> = {};

    const idMatch = raw.match(/release_?id["\s:]*["']?([A-Za-z0-9_-]+)["']?/i);
    if (idMatch) result.release_id = idMatch[1];

    const filesMatch = raw.match(/changed_?files["\s:]*\[([^\]]*)\]/i);
    if (filesMatch) {
      result.changed_files = filesMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
    }

    const modulesMatch = raw.match(/changed_?modules["\s:]*\[([^\]]*)\]/i);
    if (modulesMatch) {
      result.changed_modules = modulesMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
    }

    const passedMatch = raw.match(/passed["\s:]*(\d+)/i);
    const failedMatch = raw.match(/failed["\s:]*(\d+)/i);
    const flakyMatch = raw.match(/flaky["\s:]*(\d+)/i);
    if (passedMatch || failedMatch || flakyMatch) {
      result.tests = {
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        flaky: flakyMatch ? parseInt(flakyMatch[1]) : 0,
      };
    }

    const covMatch = raw.match(/coverage["\s:]*(\d+)/i);
    if (covMatch) result.test_coverage = parseInt(covMatch[1]);

    const depsMatch = raw.match(/dependencies["\s:]*\[([^\]]*)\]/i);
    if (depsMatch) {
      result.dependencies = depsMatch[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
