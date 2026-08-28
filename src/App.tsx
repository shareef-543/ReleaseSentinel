import { useState, useCallback, useRef } from 'react';
import type { ReleaseManifest, AnalysisResult, RolloutSimulation, Reassessment } from '@/types';
import { SAMPLE_MANIFEST } from '@/data/seed';
import { analyzeRelease, simulateRollout, reassess } from '@/agent/releaseAgent';
import { Header } from '@/components/Header';
import { ManifestSelector } from '@/components/ManifestSelector';
import { RiskSummary } from '@/components/RiskSummary';
import { ModuleRiskChart } from '@/components/ModuleRiskChart';
import { FailureModes } from '@/components/FailureModes';
import { HistoricalIncidents } from '@/components/HistoricalIncidents';
import { RolloutStrategies } from '@/components/RolloutStrategies';
import { Recommendation } from '@/components/Recommendation';
import { SimulationPanel } from '@/components/SimulationPanel';
import { EarlyDetection } from '@/components/EarlyDetection';

function App() {
  const [manifest, setManifest] = useState<ReleaseManifest>(SAMPLE_MANIFEST);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [simulation, setSimulation] = useState<RolloutSimulation | null>(null);
  const [reassessment, setReassessment] = useState<Reassessment | null>(null);
  const [showResults, setShowResults] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const handleAnalyze = useCallback(() => {
    clearTimers();
    setAnalyzing(true);
    setShowResults(false);
    setSimulation(null);
    setReassessment(null);
    setProgressStep(0);

    const steps = 8;
    const stepDelay = 350;

    for (let i = 1; i < steps; i++) {
      const t = setTimeout(() => setProgressStep(i), i * stepDelay);
      timersRef.current.push(t);
    }

    const finalTimer = setTimeout(() => {
      const result = analyzeRelease(manifest);
      setAnalysis(result);
      setAnalyzing(false);
      setShowResults(true);
    }, steps * stepDelay);
    timersRef.current.push(finalTimer);
  }, [manifest]);

  const handleSimulate = useCallback(
    (pct: number) => {
      if (!analysis) return;
      const sim = simulateRollout(manifest, analysis, pct);
      setSimulation(sim);
      setReassessment(null);
    },
    [analysis, manifest],
  );

  const handleReassess = useCallback(() => {
    if (!analysis || !simulation) return;
    const result = reassess(analysis, simulation);
    setReassessment(result);
  }, [analysis, simulation]);

  const handleReset = useCallback(() => {
    setSimulation(null);
    setReassessment(null);
  }, []);

  const handleSelectManifest = useCallback((m: ReleaseManifest) => {
    setManifest(m);
    setAnalysis(null);
    setSimulation(null);
    setReassessment(null);
    setShowResults(false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header
        releaseId={manifest.release_id}
        analysis={analysis}
        analyzing={analyzing}
        progressStep={progressStep}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {!showResults && !analyzing && (
          <div className="mb-6">
            <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/50 p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Autonomous Release Risk Analysis</h2>
              <p className="text-sm text-slate-400 max-w-2xl mx-auto">
                ReleaseSentinel inspects a release manifest, calculates risk across six intelligence components,
                compares rollout strategies, and recommends a release policy — then simulates production feedback
                and reassesses its decision in real time.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: manifest selector + risk summary */}
          <div className="space-y-6">
            <ManifestSelector
              selectedManifest={manifest}
              onSelectManifest={handleSelectManifest}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              hasAnalysis={!!analysis}
            />
            {showResults && analysis && <RiskSummary analysis={analysis} />}
          </div>

          {/* Middle column: module risk, failure modes, incidents */}
          <div className="space-y-6">
            {showResults && analysis && (
              <>
                <ModuleRiskChart moduleRisks={analysis.module_risks} />
                <FailureModes
                  failureModes={analysis.failure_modes}
                  predictedProbability={analysis.predicted_failure_probability}
                />
                <HistoricalIncidents incidents={analysis.similar_incidents} />
              </>
            )}
            {!showResults && !analyzing && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-sm text-slate-500">
                Select a sample release and click "Run Risk Analysis" to begin.
              </div>
            )}
          </div>

          {/* Right column: recommendation, rollout, simulation, early detection */}
          <div className="space-y-6">
            {showResults && analysis && (
              <>
                <Recommendation analysis={analysis} />
                <RolloutStrategies strategies={analysis.rollout_strategies} />
                <SimulationPanel
                  simulation={simulation}
                  reassessment={reassessment}
                  onSimulate={handleSimulate}
                  onReassess={handleReassess}
                  onReset={handleReset}
                />
                <EarlyDetection analysis={analysis} />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-800 pt-4 text-center text-xs text-slate-600">
          ReleaseSentinel — Autonomous Software Release Risk Planner
          {' • '}
          TF-IDF + Cosine Similarity • Logistic Test Prediction • Hybrid Risk Scoring • Deterministic Agent
        </footer>
      </main>
    </div>
  );
}

export default App;
