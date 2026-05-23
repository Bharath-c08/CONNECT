'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User as UserIcon, RefreshCw, AlertCircle, CheckCircle, Sun, Moon } from 'lucide-react';
import { apiRequest, setAuthToken, setCurrentUser, getAuthToken } from '../utils/api';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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
    // If token exists, skip login page
    const token = getAuthToken();
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      setAuthToken(data.token);
      setCurrentUser(data.user);
      
      setSuccess('Access granted! Connecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSuperadmin = async () => {
    setIsResetting(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiRequest('/auth/reset-superadmin-recovery', {
        method: 'POST',
      });
      setSuccess(data.message || 'Superadmin reset successfully!');
      setUsername('superadmin');
      setPassword('superadmin@123');
    } catch (err: any) {
      setError(err.message || 'Error resetting superadmin credentials.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleQuickFill = (role: 'superadmin' | 'admin' | 'user') => {
    if (role === 'superadmin') {
      setUsername('superadmin');
      setPassword('superadmin@123');
    } else if (role === 'admin') {
      setUsername('admin_demo');
      setPassword('admin123');
    } else {
      setUsername('employee_demo');
      setPassword('user123');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background text-foreground px-4 overflow-hidden select-none">
      {/* Floating Theme Switcher top right */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-all cursor-pointer flex items-center justify-center shadow-lg"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Interactive Background Ambient Glows */}
      <div className="absolute top-[10%] left-[10%] w-[450px] h-[450px] rounded-full bg-radial from-red-500/10 via-red-500/5 to-transparent blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-radial from-indigo-500/10 via-indigo-500/5 to-transparent blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '12s' }}></div>

      {/* Adaptive Blueprint Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none opacity-80"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8 animate-[framer-fade-in_0.75s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-red-500/25 shadow-[0_0_30px_rgba(239,68,68,0.1)] mb-4 w-28 h-28 overflow-hidden select-none">
            <img 
              src={theme === 'dark' ? "/images/Markdot logo white.png" : "/images/Markdot logo black.png"} 
              alt="Markdot Intellect" 
              className="w-full h-full object-contain shrink-0" 
            />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="text-slate-100 font-extrabold">Markdot</span>
            <span className="text-red-500 font-extrabold">Intellect</span>
          </h1>
          <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest font-bold opacity-80">Enterprise Management Console</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-10 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
          
          <h2 className="text-[11px] font-bold text-slate-200 mb-6 text-center uppercase tracking-widest">Secure Authorization Gateway</h2>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-emerald-400 text-xs animate-pulse">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Operator ID</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="framer-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Access Key</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="framer-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="framer-btn bg-gradient-to-r from-red-600 via-red-500 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.25)] hover:shadow-[0_0_30px_rgba(239,68,68,0.45)] cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authorizing Session...</span>
                </>
              ) : (
                <span>Verify & Establish Link</span>
              )}
            </button>
          </form>

          {/* Quick-Seeding Demo Buttons */}
          <div className="mt-8 pt-6 border-t border-white/5 dark:border-slate-800/10">
            <h3 className="text-[9px] font-bold text-slate-500 mb-3.5 uppercase tracking-widest text-center">Quick sandbox profiles</h3>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickFill('superadmin')}
                className="sandbox-pill bg-red-500/10 hover:bg-red-500/20 active:scale-[0.96] text-red-400 border border-red-500/15 hover:border-red-500/30 transition-all cursor-pointer tracking-wider"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="sandbox-pill bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.96] text-amber-400 border border-amber-500/15 hover:border-amber-500/30 transition-all cursor-pointer tracking-wider"
              >
                Administrator
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('user')}
                className="sandbox-pill bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-[0.96] text-indigo-400 border border-indigo-500/15 hover:border-indigo-500/30 transition-all cursor-pointer tracking-wider"
              >
                Employee
              </button>
            </div>
          </div>

          {/* Reset superadmin option */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleResetSuperadmin}
              disabled={isResetting}
              className="text-[10px] text-slate-500 hover:text-red-400 underline underline-offset-4 transition-all cursor-pointer inline-flex items-center gap-1 uppercase tracking-widest font-semibold"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Resetting Console...</span>
                </>
              ) : (
                <span>Forgot password? Recover Console</span>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500 mt-6 tracking-widest uppercase font-semibold animate-[framer-fade-in_0.95s_cubic-bezier(0.16,1,0.3,1)_both]">
          &copy; 2026 MarkdotIntellect. All rights reserved. Secure RSA-256.
        </p>
      </div>
    </div>
  );
}
