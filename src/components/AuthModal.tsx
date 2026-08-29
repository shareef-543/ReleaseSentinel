import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  KeyRound,
  ArrowRight,
  Sparkles,
  AlertCircle,
  X,
  UserCheck,
  Zap,
} from 'lucide-react';

export function AuthModal() {
  const { authModalOpen, closeAuthModal, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || 'Invalid credentials');
        }
      } else {
        if (!name.trim()) {
          setError('Please enter your full name');
          setLoading(false);
          return;
        }
        const res = await register(name, email, password);
        if (!res.success) {
          setError(res.error || 'Registration failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    login(demoEmail, demoPass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10">
        {/* Top gradient banner */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-600" />

        {/* Close button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 space-y-6">
          {/* Header & Logo */}
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20 mb-1">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Sign in to ReleaseSentinel' : 'Create Sentinel Account'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'login'
                ? 'Access AI release risk intelligence and auto-healing pipelines'
                : 'Join your engineering team to monitor and auto-heal releases'}
            </p>
          </div>

          {/* Quick Demo Logins */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>⚡ Quick Demo Credentials</span>
              <span className="text-cyan-400 font-mono text-[10px]">1-Click Login</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@sentinel.ai', 'admin123')}
                className="flex flex-col items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 p-2 text-center hover:bg-purple-500/20 transition-all"
              >
                <span className="text-[11px] font-bold text-purple-300">Admin</span>
                <span className="text-[9px] text-slate-400 font-mono">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('lead@sentinel.ai', 'lead123')}
                className="flex flex-col items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2 text-center hover:bg-cyan-500/20 transition-all"
              >
                <span className="text-[11px] font-bold text-cyan-300">Lead</span>
                <span className="text-[9px] text-slate-400 font-mono">Release Ops</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('developer@sentinel.ai', 'dev123')}
                className="flex flex-col items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 p-2 text-center hover:bg-blue-500/20 transition-all"
              >
                <span className="text-[11px] font-bold text-blue-300">Developer</span>
                <span className="text-[9px] text-slate-400 font-mono">Pipelines</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Work Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-indigo-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 transition-all mt-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="font-semibold text-cyan-400 hover:underline"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className="font-semibold text-cyan-400 hover:underline"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
