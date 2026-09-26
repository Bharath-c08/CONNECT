'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, User as UserIcon, RefreshCw, AlertCircle, CheckCircle, Sun, Moon, Cpu, Binary, KeyRound, Send, Shield, FileText, Smartphone } from 'lucide-react';
import { apiRequest, setAuthToken, setCurrentUser, getAuthToken, getSocketUrl } from '../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Live Telemetry states
  const [utcTime, setUtcTime] = useState('');
  const [sessionHash, setSessionHash] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.body.classList.add('light');
      } else {
        document.body.classList.remove('light');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  };

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    // Generate random session hash like 65/Y19KB
    const chars = '0123456789ABCDEFGHJKLMNOPQRSTUVWXYZ';
    let hash = '';
    for (let i = 0; i < 2; i++) hash += chars[Math.floor(Math.random() * chars.length)];
    hash += '/';
    for (let i = 0; i < 5; i++) hash += chars[Math.floor(Math.random() * chars.length)];
    setSessionHash(hash);

    // Live UTC Time ticker
    const updateUtcTime = () => {
      const now = new Date();
      const hrs = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hrs}:${mins}:${secs} UTC`);
    };
    updateUtcTime();
    const interval = setInterval(updateUtcTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const loginWithCredentials = async (u: string, p: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p }),
      });
      setAuthToken(data.token);
      setCurrentUser(data.user);
      setSuccess('Authorization granted // Synchronizing operator deck...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Credentials rejected. Operation terminated.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithCredentials(username, password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotLoading(true);
    setError('');
    try {
      await apiRequest('/auth/forgot-password-request', {
        method: 'POST',
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message || 'Request failed. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row relative select-none font-mono" style={{ backgroundColor: theme === 'dark' ? '#020204' : '#ffffff' }}>
      
      {/* ── LEFT PANEL: Application details ── */}
      <div 
        className="w-full lg:w-[58%] px-8 sm:px-12 lg:px-24 py-16 flex flex-col justify-between min-h-screen border-r relative overflow-hidden select-text"
        style={{
          background: theme === 'dark' ? 'linear-gradient(135deg, #09090e 0%, #030306 100%)' : 'linear-gradient(135deg, #fbfbfa 0%, #f4f7f4 100%)',
          borderColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#e2e8f0'
        }}
      >
        {/* Fine grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{
          backgroundImage: theme === 'dark' 
            ? `linear-gradient(to right, rgba(239, 68, 68, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(239, 68, 68, 0.04) 1px, transparent 1px)`
            : `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }} />

        {/* Logo at the top left */}
        <div className="relative z-10 select-none self-start">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 overflow-hidden select-none shrink-0">
              <img 
                src={theme === 'dark' ? "/images/Markdot logo white.png" : "/images/Markdot logo black.png"} 
                alt="Markdot" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-black tracking-tight uppercase" style={{ color: theme === 'dark' ? '#f8fafc' : '#0f172a' }}>
                MARKDOT_DOTCORE
              </span>
              <span className="text-[8px] tracking-widest text-slate-500 font-bold uppercase">OPERATOR CONSOLE</span>
            </div>
          </div>
        </div>

        {/* Huge Heading & Descriptions */}
        <div className="my-12 lg:my-auto relative z-10 max-w-2xl text-left select-none">
          <h1 
            className="text-3xl lg:text-4xl font-extrabold tracking-widest uppercase leading-snug"
            style={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}
          >
            // MARKDOT_DOTCORE
          </h1>
          <p 
            className="mt-6 text-xs leading-relaxed max-w-xl"
            style={{ color: theme === 'dark' ? '#94a3b8' : '#57606a' }}
          >
            A secure ERP command deck designed for platform operations. Clock shifts, manage leave approvals, track real-time task logs, log encrypted team chats, and author structured documents—all from one secure operator gateway.
          </p>

          <div className="mt-8">
            <a
              href={`${getSocketUrl()}/Dotcore.apk`}
              download="Dotcore.apk"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 shadow-sm"
              style={{
                borderColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.25)' : '#cbd5e1',
                backgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : '#f8fafc',
                color: theme === 'dark' ? '#f8fafc' : '#0f172a'
              }}
            >
              <Smartphone className="w-4 h-4 text-[#ef4444]" />
              <span>Download Android App</span>
            </a>
          </div>
        </div>

        {/* Spaced 2x2 Features Grid (Pushed to bottom, just above footer) */}
        <div className="relative z-10 max-w-2xl text-left select-none mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0 mt-0.5" style={{ backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.05)', color: '#ef4444' }}>
                <Shield className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: theme === 'dark' ? '#f8fafc' : '#334155' }}>Shift Telemetry</span>
                <span className="text-[11px] mt-0.5 leading-snug" style={{ color: theme === 'dark' ? '#64748b' : '#57606a' }}>Clock logs, early clock-in boundary locks, and break limits.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0 mt-0.5" style={{ backgroundColor: theme === 'dark' ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)', color: '#6366f1' }}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: theme === 'dark' ? '#f8fafc' : '#334155' }}>Secure Memos</span>
                <span className="text-[11px] mt-0.5 leading-snug" style={{ color: theme === 'dark' ? '#64748b' : '#57606a' }}>Rich-text notes that compile valid Word-compatible docx archives.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0 mt-0.5" style={{ backgroundColor: theme === 'dark' ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.05)', color: '#10b981' }}>
                <Cpu className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: theme === 'dark' ? '#f8fafc' : '#334155' }}>Task Registry</span>
                <span className="text-[11px] mt-0.5 leading-snug" style={{ color: theme === 'dark' ? '#64748b' : '#57606a' }}>Real-time Kanban boards and operational logs.</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl shrink-0 mt-0.5" style={{ backgroundColor: theme === 'dark' ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.05)', color: '#f59e0b' }}>
                <Binary className="w-4 h-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold" style={{ color: theme === 'dark' ? '#f8fafc' : '#334155' }}>Colleague Logs</span>
                <span className="text-[11px] mt-0.5 leading-snug" style={{ color: theme === 'dark' ? '#64748b' : '#57606a' }}>Operator calendars and shared communication registries.</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer info bottom left */}
        <div className="relative z-10 select-none self-start">
          <span className="text-[9px] tracking-widest text-slate-400 uppercase font-semibold">
            // Powered by Markdot Intellect
          </span>
        </div>

      </div>

      {/* ── RIGHT PANEL: Sign In Card ── */}
      <div 
        className="w-full lg:w-[42%] flex flex-col justify-center items-center p-8 lg:p-12 relative"
        style={{ backgroundColor: theme === 'dark' ? '#020204' : '#ffffff' }}
      >
        {/* Floating Theme Switcher top right */}
        <div className="absolute top-8 right-8 z-20">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full border hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center shadow-sm"
            style={{ 
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
              backgroundColor: theme === 'dark' ? '#0f0f15' : '#ffffff',
              color: theme === 'dark' ? '#38bdf8' : '#475569'
            }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Centered Sign In card with extra padding & spacing */}
        <div 
          className="w-full max-w-[440px] rounded-3xl border relative overflow-hidden flex flex-col"
          style={{
            backgroundColor: theme === 'dark' ? 'rgba(12, 8, 8, 0.85)' : '#ffffff',
            borderColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#f1f1eb',
            boxShadow: theme === 'dark' ? '0 0 25px rgba(239, 68, 68, 0.06)' : '0 20px 50px rgba(0,0,0,0.06)',
            padding: '3rem 2.5rem'
          }}
        >
          {/* Top border line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-[#ef4444]" />

          <h2 className="text-2xl font-black tracking-tight mt-2" style={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}>
            Operator Portal
          </h2>
          <span className="text-[9px] font-bold tracking-widest text-[#ef4444] uppercase mt-2.5 block">
            🔒 OPERATOR SECURE LINK
          </span>

          {/* Feedback alerts */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5 animate-pulse"
              >
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login Form with extra spacing */}
          <form onSubmit={handleLogin} className="space-y-6 mt-8" autoComplete="off">
            <div className="flex flex-col gap-2.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">OPERATOR USERNAME</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                  <UserIcon className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="operator_1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="w-full h-12 pr-4 outline-none rounded-xl text-xs font-semibold transition-all shadow-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? 'var(--bg-input)' : '#ffffff',
                    borderColor: theme === 'dark' ? 'var(--border)' : '#cbd5e1',
                    color: theme === 'dark' ? 'var(--text-primary)' : '#0f172a',
                    paddingLeft: '3rem'
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">GATE PASSWORD</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 pointer-events-none">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full h-12 pr-4 outline-none rounded-xl text-xs font-semibold transition-all shadow-sm"
                  style={{
                    backgroundColor: theme === 'dark' ? 'var(--bg-input)' : '#ffffff',
                    borderColor: theme === 'dark' ? 'var(--border)' : '#cbd5e1',
                    color: theme === 'dark' ? 'var(--text-primary)' : '#0f172a',
                    paddingLeft: '3rem'
                  }}
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={loading}
              className="w-full h-12 text-white text-xs font-bold tracking-widest rounded-xl hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2 mt-10 border-0 shadow-sm"
              style={{
                backgroundColor: theme === 'dark' ? 'var(--brand)' : '#6366f1',
                boxShadow: theme === 'dark' ? 'var(--shadow-btn)' : '0 4px 12px rgba(99, 102, 241, 0.2)'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>AUTHORIZING GATE...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Authorize Login</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Request reset */}
          <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f1eb' }}>
            <AnimatePresence mode="wait">
              {!forgotOpen && !forgotSent && (
                <motion.button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-[9px] hover:text-[#ef4444] underline underline-offset-4 transition-all cursor-pointer inline-flex items-center gap-1.5 uppercase tracking-widest font-bold"
                  style={{ color: theme === 'dark' ? 'var(--text-muted)' : '#94a3b8' }}
                >
                  <KeyRound className="w-3 h-3" />
                  <span>Forgot Password? Request Reset</span>
                </motion.button>
              )}

              {forgotOpen && !forgotSent && (
                <motion.form
                  onSubmit={handleForgotPassword}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden text-left"
                >
                  <p className="text-[9px] uppercase tracking-widest text-center font-bold text-slate-400">
                    Enter username to request reset from administrator
                  </p>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                      <UserIcon className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="YOUR USERNAME"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      autoComplete="off"
                      className="w-full h-9 pl-10 pr-4 outline-none rounded-xl text-[11px] font-semibold transition-all shadow-sm"
                      style={{
                        backgroundColor: theme === 'dark' ? 'var(--bg-input)' : '#ffffff',
                        borderColor: theme === 'dark' ? 'var(--border)' : '#cbd5e1',
                        color: theme === 'dark' ? 'var(--text-primary)' : '#0f172a'
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="flex-1 h-8 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-[9px] font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 rounded-lg"
                    >
                      {forgotLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      SEND
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForgotOpen(false); setForgotUsername(''); }}
                      className="h-8 px-4 bg-white/5 hover:bg-white/10 border text-[9px] font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center rounded-lg"
                      style={{ borderColor: theme === 'dark' ? 'var(--border)' : '#cbd5e1', color: '#94a3b8' }}
                    >
                      CANCEL
                    </button>
                  </div>
                </motion.form>
              )}

              {forgotSent && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2.5 text-[10px] text-cyan-400 text-left"
                >
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Request sent to administrator. Please wait.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Separate public pages footer links below card */}
        <div className="mt-8 flex gap-6 text-[9px] font-bold tracking-widest uppercase text-slate-400 select-none">
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white underline underline-offset-4 transition-colors cursor-pointer">
            PRIVACY POLICY
          </Link>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white underline underline-offset-4 transition-colors cursor-pointer">
            TERMS OF SERVICE
          </Link>
        </div>

      </div>

    </div>
  );
}
