'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User as UserIcon, RefreshCw, AlertCircle, CheckCircle, Sun, Moon, Cpu, Binary, KeyRound, Send } from 'lucide-react';
import { apiRequest, setAuthToken, setCurrentUser, getAuthToken } from '../utils/api';
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

  // Shared login helper — does NOT populate the password <input> to avoid Chrome breach warnings
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
      setSuccess('DECRYPTION SUCCESSFUL // ESTABLISHING NODE...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'CREDENTIALS REJECTED. OPERATION TERMINATED.');
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
      setError(err.message || 'REQUEST FAILED. TRY AGAIN.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground px-4 overflow-hidden select-none scanlines cyber-grid-bg" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Floating Theme Switcher top right */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="absolute top-6 right-6 z-20"
      >
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-[#08080c] border hover:bg-cyan-500/10 hover:text-cyan-400 transition-all cursor-pointer flex items-center justify-center shadow-lg font-mono text-[10px] font-bold"
          style={{ borderColor: 'var(--border)' }}
          title={theme === 'dark' ? 'DECK_MODE_LIGHT' : 'DECK_MODE_DARK'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-cyan-400" /> : <Moon className="w-4 h-4 text-teal-500" />}
        </button>
      </motion.div>

      {/* Sci-Fi Decorative Corner Accents */}
      <div className="absolute top-6 left-6 font-mono text-[8px] opacity-40 select-none hidden md:block">
        <div>SYS_OPERATIONAL: OK</div>
        <div>NET_LINK: ENCRYPTED</div>
        <div>CORE_TEMP: 42°C</div>
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-[8px] opacity-40 select-none hidden md:block text-right">
        <div>NODE_SECURE: RSA_4096</div>
        <div>CONSOLE_LOC: SECURE_CORE_01</div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={springTransition}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] mb-4 w-24 h-24 overflow-hidden select-none">
            <img 
              src={theme === 'dark' ? "/images/Markdot logo white.png" : "/images/Markdot logo black.png"} 
              alt="Markdot Dotcore" 
              className="w-full h-full object-contain shrink-0" 
            />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight font-mono" style={{ letterSpacing: '-1.5px' }}>
            <span className="opacity-60 font-bold">// MARKDOT_</span>
            <span className="text-[#ef4444] font-black">DOTCORE</span>
          </h1>
          <p className="text-[9px] mt-2 uppercase tracking-widest font-mono font-bold opacity-60">TACTICAL DECK SECURITY GATEWAY</p>
        </motion.div>

        {/* Login Card */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springTransition, delay: 0.1 }}
          className="card p-8 rounded-2xl relative overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)'
          }}
        >
          <div className="absolute top-2 left-2 text-[8px] font-mono opacity-25">OPERATOR_CONSOLE</div>
          <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-cyan-400 opacity-60 flex items-center gap-1">
            <Binary className="w-3 h-3 animate-pulse" />
            <span>SECURE_LINK</span>
          </div>
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
          
          <h2 className="text-[10px] font-bold font-mono mb-6 text-center uppercase tracking-widest pt-2" style={{ color: 'var(--text-secondary)' }}>ENTER CREDENTIALS</h2>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-rose-400 font-mono text-[10px] overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-400 font-mono text-[10px] animate-pulse overflow-hidden"
              >
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5" autoComplete="off" data-form-type="other">
            <div>
              <label className="block text-[9px] font-bold font-mono uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>OPERATOR_ID_CODE</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <UserIcon className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="USERNAME"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="framer-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] font-bold font-mono uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>ACCESS_KEYPASS</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="framer-input"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="framer-btn w-full h-11 bg-[#ef4444] text-[#020204] hover:bg-[#dc2626] font-mono text-[11px] font-extrabold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 border-0"
              style={{
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-btn)'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>AUTHORIZING LINK...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>ESTABLISH UPLINK</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Forgot Password */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <AnimatePresence mode="wait">
              {!forgotOpen && !forgotSent && (
                <motion.div
                  key="forgot-link"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-[9px] hover:text-cyan-400 underline underline-offset-4 transition-all cursor-pointer inline-flex items-center gap-1.5 uppercase tracking-widest font-bold font-mono"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Forgot Password? Request Reset</span>
                  </button>
                </motion.div>
              )}

              {forgotOpen && !forgotSent && (
                <motion.form
                  key="forgot-form"
                  onSubmit={handleForgotPassword}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 overflow-hidden"
                >
                  <p className="text-[9px] font-mono uppercase tracking-widest text-center font-bold" style={{ color: 'var(--text-secondary)' }}>
                    Enter your username — a reset request will be sent to the administrator
                  </p>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                      <UserIcon className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="YOUR USERNAME"
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      autoComplete="off"
                      className="framer-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={forgotLoading}
                      className="framer-btn flex-1 h-9 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-mono text-[9px] font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40"
                      style={{ borderRadius: 'var(--radius)' }}
                    >
                      {forgotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {forgotLoading ? 'SENDING...' : 'SEND REQUEST'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => { setForgotOpen(false); setForgotUsername(''); }}
                      className="framer-btn h-9 px-4 bg-white/5 hover:bg-white/10 border font-mono text-[9px] font-bold tracking-wider transition-all cursor-pointer flex items-center justify-center"
                      style={{ borderRadius: 'var(--radius)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      CANCEL
                    </motion.button>
                  </div>
                </motion.form>
              )}

              {forgotSent && (
                <motion.div
                  key="forgot-sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-start gap-2.5 font-mono text-[10px] text-cyan-400"
                >
                  <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>REQUEST TRANSMITTED — The administrator has been notified. Please wait for assistance.</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.2 }}
          className="text-center text-[9px] mt-6 tracking-widest uppercase font-mono"
          style={{ color: 'var(--text-muted)' }}
        >
          &copy; 2026 Markdot Dotcore. secure core operator link established.
        </motion.p>
      </div>
    </div>
  );
}
