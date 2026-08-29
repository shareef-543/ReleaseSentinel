import React, { useState, useMemo } from 'react';
import {
  Brain,
  Sliders,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  Layers,
  Cpu,
  RefreshCw,
  Database
} from 'lucide-react';
import {
  MLFeatures,
  DEFAULT_ML_FEATURES,
  runMLInference,
  BENCHMARK_METRICS
} from '@/ml/mlSimulator';

export function MLStudio() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'benchmarks'>('simulator');
  const [features, setFeatures] = useState<MLFeatures>(DEFAULT_ML_FEATURES);

  const prediction = useMemo(() => runMLInference(features), [features]);

  const updateFeature = <K extends keyof MLFeatures>(key: K, value: MLFeatures[K]) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  };

  const loadPreset = (presetName: 'healthy' | 'core_risk' | 'flaky_storm' | 'dependency_drift') => {
    switch (presetName) {
      case 'healthy':
        setFeatures({
          testCoverage: 94,
          failedTests: 0,
          flakyTests: 1,
          changedFilesCount: 6,
          changedModulesCount: 1,
          dependenciesCount: 1,
          coreModuleImpact: false,
          deploymentFrequencyScore: 9,
        });
        break;
      case 'core_risk':
        setFeatures({
          testCoverage: 62,
          failedTests: 3,
          flakyTests: 5,
          changedFilesCount: 42,
          changedModulesCount: 4,
          dependenciesCount: 7,
          coreModuleImpact: true,
          deploymentFrequencyScore: 4,
        });
        break;
      case 'flaky_storm':
        setFeatures({
          testCoverage: 76,
          failedTests: 1,
          flakyTests: 12,
          changedFilesCount: 18,
          changedModulesCount: 2,
          dependenciesCount: 3,
          coreModuleImpact: false,
          deploymentFrequencyScore: 6,
        });
        break;
      case 'dependency_drift':
        setFeatures({
          testCoverage: 71,
          failedTests: 2,
          flakyTests: 3,
          changedFilesCount: 28,
          changedModulesCount: 5,
          dependenciesCount: 16,
          coreModuleImpact: true,
          deploymentFrequencyScore: 5,
        });
        break;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300">
              <Brain className="h-3.5 w-3.5" />
              Machine Learning Inference & Explainability Engine
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Interactive ML Risk Studio
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Explore multi-model ensemble predictions (Random Forest, Gradient Boosting, Logistic Sigmoid), tune feature vectors in real time, and inspect SHAP-style explainability attributions.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'simulator'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>What-If Simulator</span>
            </button>
            <button
              onClick={() => setActiveTab('benchmarks')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'benchmarks'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Model Benchmarks</span>
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5 mr-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            Quick Scenarios:
          </span>
          <button
            onClick={() => loadPreset('healthy')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-slate-700 text-slate-300 hover:text-emerald-300 font-medium transition-all"
          >
            🟢 Clean CI/CD Build
          </button>
          <button
            onClick={() => loadPreset('core_risk')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:border-rose-500/40 border border-slate-700 text-slate-300 hover:text-rose-300 font-medium transition-all"
          >
            🔴 Core Service Blast Hazard
          </button>
          <button
            onClick={() => loadPreset('flaky_storm')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 hover:border-amber-500/40 border border-slate-700 text-slate-300 hover:text-amber-300 font-medium transition-all"
          >
            🟡 Flaky Test Storm
          </button>
          <button
            onClick={() => loadPreset('dependency_drift')}
            className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-500/20 hover:border-indigo-500/40 border border-slate-700 text-slate-300 hover:text-indigo-300 font-medium transition-all"
          >
            🟣 Multi-Service Dependency Drift
          </button>
        </div>
      </div>

      {/* VIEW 1: WHAT-IF SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Feature Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Sliders className="h-4 w-4 text-purple-400" />
                  <span>Feature Vectors (Inputs)</span>
                </div>
                <button
                  onClick={() => setFeatures(DEFAULT_ML_FEATURES)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </button>
              </div>

              {/* Slider 1: Test Coverage */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Test Suite Coverage</span>
                  <span className={`font-mono font-bold ${features.testCoverage >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {features.testCoverage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={features.testCoverage}
                  onChange={(e) => updateFeature('testCoverage', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 2: Failed Tests */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Failed Automated Tests</span>
                  <span className={`font-mono font-bold ${features.failedTests === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {features.failedTests} test(s)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={features.failedTests}
                  onChange={(e) => updateFeature('failedTests', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 3: Flaky Tests */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Flaky / Intermittent Tests</span>
                  <span className={`font-mono font-bold ${features.flakyTests <= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {features.flakyTests} test(s)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={features.flakyTests}
                  onChange={(e) => updateFeature('flakyTests', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 4: Changed Files */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Changed Files</span>
                  <span className="font-mono font-bold text-cyan-400">{features.changedFilesCount} files</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="80"
                  value={features.changedFilesCount}
                  onChange={(e) => updateFeature('changedFilesCount', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 5: Changed Modules Count */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Changed Microservices</span>
                  <span className="font-mono font-bold text-indigo-400">{features.changedModulesCount} services</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={features.changedModulesCount}
                  onChange={(e) => updateFeature('changedModulesCount', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 6: Dependencies Count */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">External Dependencies</span>
                  <span className="font-mono font-bold text-slate-300">{features.dependenciesCount} packages</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={features.dependenciesCount}
                  onChange={(e) => updateFeature('dependenciesCount', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Slider 7: Deployment Cadence */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">Deployment Frequency</span>
                  <span className="font-mono font-bold text-purple-400">{features.deploymentFrequencyScore} / 10</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={features.deploymentFrequencyScore}
                  onChange={(e) => updateFeature('deploymentFrequencyScore', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Toggle: Core Module Impact */}
              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-rose-400" />
                      Core Module Impact
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Touches payment-service, auth, or DB schema
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={features.coreModuleImpact}
                    onChange={(e) => updateFeature('coreModuleImpact', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-purple-600 focus:ring-purple-500"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Prediction & SHAP Breakdown */}
          <div className="lg:col-span-7 space-y-6">
            {/* Top Prediction Summary Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ensemble Failure Probability
                  </span>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      {prediction.riskScore}%
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide ${
                        prediction.decision === 'GO'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : prediction.decision === 'CONDITIONAL_GO'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {prediction.decision === 'GO' && <ShieldCheck className="h-3.5 w-3.5" />}
                      {prediction.decision === 'CONDITIONAL_GO' && <AlertTriangle className="h-3.5 w-3.5" />}
                      {prediction.decision === 'HOLD' && <ShieldAlert className="h-3.5 w-3.5" />}
                      DECISION: {prediction.decision.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400">Model Confidence</span>
                  <div className="text-lg font-bold text-purple-300 font-mono">
                    {Math.round(prediction.confidenceScore * 100)}%
                  </div>
                </div>
              </div>

              {/* Multi-Model Comparison Bar */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/80 text-center">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Random Forest</div>
                  <div className="text-base font-bold font-mono text-cyan-400 mt-0.5">
                    {prediction.modelPredictions.randomForest}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Gradient Boosting</div>
                  <div className="text-base font-bold font-mono text-purple-400 mt-0.5">
                    {prediction.modelPredictions.gradientBoosting}%
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-medium">Logistic Sigmoid</div>
                  <div className="text-base font-bold font-mono text-indigo-400 mt-0.5">
                    {prediction.modelPredictions.logisticRegression}%
                  </div>
                </div>
              </div>
            </div>

            {/* SHAP Feature Attribution Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Layers className="h-4 w-4 text-purple-400" />
                  <span>SHAP-Style Feature Attribution & Impact</span>
                </div>
                <span className="text-xs text-slate-400">Explainable AI (XAI)</span>
              </div>

              <div className="space-y-3">
                {prediction.shapAttributions.map((attr, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {attr.isRiskIncreasing ? (
                          <TrendingUp className="h-3.5 w-3.5 text-rose-400" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {attr.label}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          attr.isRiskIncreasing ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {attr.isRiskIncreasing ? `+${attr.impact}% Risk` : `-${attr.impact}% Protection`}
                      </span>
                    </div>

                    <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          attr.isRiskIncreasing ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(attr.impact * 2.5, 100)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {attr.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MODEL BENCHMARKS & EVALUATION */}
      {activeTab === 'benchmarks' && (
        <div className="space-y-6">
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">Accuracy</div>
              <div className="text-2xl font-extrabold text-white font-mono mt-1">
                {(BENCHMARK_METRICS.accuracy * 100).toFixed(1)}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">Precision</div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                {(BENCHMARK_METRICS.precision * 100).toFixed(1)}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">Recall</div>
              <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">
                {(BENCHMARK_METRICS.recall * 100).toFixed(1)}%
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">F1-Score</div>
              <div className="text-2xl font-extrabold text-purple-400 font-mono mt-1">
                {BENCHMARK_METRICS.f1Score.toFixed(3)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">ROC-AUC</div>
              <div className="text-2xl font-extrabold text-indigo-400 font-mono mt-1">
                {BENCHMARK_METRICS.rocAuc.toFixed(3)}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-center">
              <div className="text-xs text-slate-400">Training Samples</div>
              <div className="text-2xl font-extrabold text-slate-300 font-mono mt-1">
                {BENCHMARK_METRICS.totalTrainedSamples}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Confusion Matrix */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Database className="h-4 w-4 text-purple-400" />
                  <span>Confusion Matrix (N = {BENCHMARK_METRICS.totalTrainedSamples})</span>
                </div>
                <span className="text-xs text-slate-400">Validation Set</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <span className="text-xs text-emerald-300 font-semibold block">True Negative (Safe Releases)</span>
                  <span className="text-3xl font-extrabold font-mono text-emerald-400 mt-1 block">
                    {BENCHMARK_METRICS.confusionMatrix.trueNegative}
                  </span>
                  <span className="text-[11px] text-emerald-300/70">Correctly passed</span>
                </div>

                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center">
                  <span className="text-xs text-rose-300 font-semibold block">False Positive (False Alarms)</span>
                  <span className="text-3xl font-extrabold font-mono text-rose-400 mt-1 block">
                    {BENCHMARK_METRICS.confusionMatrix.falsePositive}
                  </span>
                  <span className="text-[11px] text-rose-300/70">Held safe releases</span>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                  <span className="text-xs text-amber-300 font-semibold block">False Negative (Missed Defect)</span>
                  <span className="text-3xl font-extrabold font-mono text-amber-400 mt-1 block">
                    {BENCHMARK_METRICS.confusionMatrix.falseNegative}
                  </span>
                  <span className="text-[11px] text-amber-300/70">Critical defect slipped</span>
                </div>

                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                  <span className="text-xs text-purple-300 font-semibold block">True Positive (Caught Defects)</span>
                  <span className="text-3xl font-extrabold font-mono text-purple-400 mt-1 block">
                    {BENCHMARK_METRICS.confusionMatrix.truePositive}
                  </span>
                  <span className="text-[11px] text-purple-300/70">Outages prevented</span>
                </div>
              </div>
            </div>

            {/* Architecture Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
                <Brain className="h-4 w-4 text-purple-400" />
                <span>Ensemble Architecture Details</span>
              </div>

              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white">1. Random Forest (40% Weight)</div>
                  <p className="text-slate-400">
                    A 10-tree decision ensemble evaluating non-linear feature interactions between flaky test ratios, test suite coverage thresholds, and core microservice blast radius.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white">2. Gradient Boosting (35% Weight)</div>
                  <p className="text-slate-400">
                    Sequential residual error reduction minimizing false-negative escapes on critical payment and authentication modules.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white">3. Calibrated Logistic Sigmoid (25% Weight)</div>
                  <p className="text-slate-400">
                    Multivariate logistic distribution providing smoothly calibrated continuous probabilities for real-time release gating thresholds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
