import React, { useState, useCallback, useRef } from 'react';
import type {
  ReleaseManifest,
  AnalysisResult,
  RolloutSimulation,
  Reassessment,
  StoredAnalysisRecord,
} from '@/types';
import { SAMPLE_MANIFEST } from '@/data/seed';
import { analyzeRelease, simulateRollout, reassess } from '@/agent/releaseAgent';
import { saveAnalysisRecord, getBackendConfig } from '@/lib/backend/db';
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
import { AICorrectionStudio } from '@/components/AICorrectionStudio';
import { BackendHistory } from '@/components/BackendHistory';
import { SettingsModal } from '@/components/SettingsModal';
import { AutonomousHealingPipeline } from '@/components/AutonomousHealingPipeline';
import { CodeCorrectionPipeline } from '@/components/CodeCorrectionPipeline';
import { Wand2, Database, ShieldCheck, ArrowRight, Zap } from 'lucide-react';

function App() {
  const [activeView, setActiveView] = useState<'pipeline' | 'code' | 'dashboard' | 'studio' | 'history'>('pipeline');
  const [manifest, setManifest] = useState<ReleaseManifest>(SAMPLE_MANIFEST);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [simulation, setSimulation] = useState<RolloutSimulation | null>(null);
  const [reassessment, setReassessment] = useState<Reassessment | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastSource, setLastSource] = useState<StoredAnalysisRecord['source']>('sample');

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const handleAnalyze = useCallback(
    (targetManifest?: ReleaseManifest, sourceOverride?: StoredAnalysisRecord['source']) => {
      clearTimers();
      const currentManifest = targetManifest || manifest;
      const source = sourceOverride || lastSource;

      setAnalyzing(true);
      setShowResults(false);
      setSimulation(null);
      setReassessment(null);
      setProgressStep(0);

      const steps = 8;
      const stepDelay = 300;

      for (let i = 1; i < steps; i++) {
        const t = setTimeout(() => setProgressStep(i), i * stepDelay);
        timersRef.current.push(t);
      }

      const finalTimer = setTimeout(async () => {
        const result = analyzeRelease(currentManifest);
        setAnalysis(result);
        setAnalyzing(false);
        setShowResults(true);

        const config = getBackendConfig();
        if (config.autoSaveAnalyses) {
          try {
            await saveAnalysisRecord(currentManifest, result, undefined, undefined, source);
          } catch (err) {
            console.warn('Auto-save analysis failed:', err);
          }
        }
      }, steps * stepDelay);
      timersRef.current.push(finalTimer);
    },
    [manifest, lastSource],
  );

  const handleSimulate = useCallback(
    async (pct: number) => {
      if (!analysis) return;
      const sim = simulateRollout(manifest, analysis, pct);
      setSimulation(sim);
      setReassessment(null);

      const config = getBackendConfig();
      if (config.autoSaveAnalyses) {
        try {
          await saveAnalysisRecord(manifest, analysis, sim, undefined, lastSource);
        } catch (err) {
          console.warn('Auto-save simulation failed:', err);
        }
      }
    },
    [analysis, manifest, lastSource],
  );

  const handleReassess = useCallback(async () => {
    if (!analysis || !simulation) return;
    const result = reassess(analysis, simulation);
    setReassessment(result);

    const config = getBackendConfig();
    if (config.autoSaveAnalyses) {
      try {
        await saveAnalysisRecord(manifest, analysis, simulation, result, lastSource);
      } catch (err) {
        console.warn('Auto-save reassessment failed:', err);
      }
    }
  }, [analysis, simulation, manifest, lastSource]);

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
    setLastSource('sample');
  }, []);

  const handleApplyFromStudio = useCallback(
    (corrected: ReleaseManifest) => {
      setManifest(corrected);
      setLastSource('ai_corrected');
      setActiveView('dashboard');
      handleAnalyze(corrected, 'ai_corrected');
    },
    [handleAnalyze],
  );

  const handleLoadFromPipeline = useCallback((healedManifest: ReleaseManifest, healedAnalysis: AnalysisResult) => {
    setManifest(healedManifest);
    setAnalysis(healedAnalysis);
    setSimulation(null);
    setReassessment(null);
    setShowResults(true);
    setLastSource('ai_corrected');
    setActiveView('dashboard');
  }, []);

  const handleLoadFromHistory = useCallback((record: StoredAnalysisRecord) => {
    setManifest(record.manifest);
    setAnalysis(record.analysis);
    setSimulation(record.simulation || null);
    setReassessment(record.reassessment || null);
    setShowResults(true);
    setLastSource(record.source);
    setActiveView('dashboard');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Header
        releaseId={manifest.release_id}
        analysis={analysis}
        analyzing={analyzing}
        progressStep={progressStep}
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: AUTONOMOUS 4-STAGE PIPELINE */}
        {activeView === 'pipeline' && (
          <AutonomousHealingPipeline onLoadIntoSentinel={handleLoadFromPipeline} />
        )}

        {/* VIEW 2: FULL SENTINEL RISK DASHBOARD */}
        {activeView === 'dashboard' && (
          <div className="space-y-6">
            {!showResults && !analyzing && (
              <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-950/20 p-8 shadow-xl">
                <div className="max-w-3xl mx-auto text-center space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Autonomous Release Risk Intelligence Engine
                  </div>
                  <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                    Autonomous Release Risk Planner
                  </h2>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Inspect release manifests across 6 ML intelligence components, simulate production traffic telemetry, test failure modes, and evaluate real-time decision reassessments.
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      onClick={() => handleAnalyze()}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all"
                    >
                      <span>Analyze Active Release ({manifest.release_id})</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setActiveView('pipeline')}
                      className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all"
                    >
                      <Zap className="h-4 w-4" />
                      <span>Autonomous ML & AI Pipeline</span>
                    </button>

                    <button
                      onClick={() => setActiveView('history')}
                      className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-all"
                    >
                      <Database className="h-4 w-4" />
                      <span>Backend History</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: manifest selector + risk summary */}
              <div className="space-y-6">
                <ManifestSelector
                  selectedManifest={manifest}
                  onSelectManifest={handleSelectManifest}
                  onAnalyze={() => handleAnalyze()}
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
                    Select a release manifest above or click "Run Risk Analysis" to start evaluation.
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
          </div>
        )}

        {/* VIEW 3: ML DIAGNOSTIC & AI HEALING STUDIO */}
        {activeView === 'code' && (
          <CodeCorrectionPipeline />
        )}

        {/* VIEW 4: ML DIAGNOSTIC & AI HEALING STUDIO */}
        {activeView === 'studio' && (
          <AICorrectionStudio
            onApplyManifest={handleApplyFromStudio}
            onNavigateToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {/* VIEW 4: BACKEND REPOSITORY & HISTORY */}
        {activeView === 'history' && (
          <BackendHistory
            onLoadRelease={handleLoadFromHistory}
            onNavigateToDashboard={() => setActiveView('dashboard')}
          />
        )}

        {/* Settings Modal */}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

        {/* Footer */}
        <footer className="mt-12 border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500 space-y-1">
          <div>
            ReleaseSentinel — Autonomous Software Release Risk Planner & AI Auto-Healing Engine
          </div>
          <div className="text-[11px] text-slate-600">
            Multi-Task Logistic ML • TF-IDF Cosine Similarity • Graph Propagation • Supabase PostgreSQL • Gemini AI Integration
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
