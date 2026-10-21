'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Calendar,
  User as UserIcon,
  Hash,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  Lock
} from 'lucide-react';
import { apiRequest } from '../../utils/api';

function VerificationContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';

  const [verificationId, setVerificationId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const executeLookup = async (idToLookup: string) => {
    const trimmed = idToLookup.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      // Public endpoint
      const data = await apiRequest(`/documents/verify/${encodeURIComponent(trimmed)}`);
      setResult(data);
    } catch (err: any) {
      setResult({
        verified: false,
        status: 'Fake / Invalid',
        message: err.message || 'No official document record matches this Verification ID in the cryptographic registry.',
        verificationId: trimmed
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      executeLookup(initialId);
    }
  }, [initialId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(verificationId);
  };

  return (
    <div className="min-h-screen bg-[#030306] text-white font-mono flex flex-col justify-between select-none relative overflow-x-hidden">
      {/* Background Decorative Cyber Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(6, 182, 212, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.08) 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-white/10 px-6 sm:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-black/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/20 p-1 flex items-center justify-center">
            <img src="/images/Markdot logo white.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase text-white">
              MARKDOT TRUST LEDGER
            </h1>
            <p className="text-[8px] text-cyan-400 font-bold uppercase tracking-widest">
              PUBLIC DOCUMENT VERIFICATION PORTAL
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Operator Login</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-3xl mx-auto w-full">
        {/* Title & Explainer */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-extrabold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 animate-pulse" />
            <span>Cryptographic Proof Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            Verify Document Authenticity
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            Enter the non-sequential Verification ID or certificate hash printed on any official Markdot Intellect agreement, policy, or digital credential to verify its validity.
          </p>
        </div>

        {/* Verification ID Search Box */}
        <form onSubmit={handleSubmit} className="w-full mb-8">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-white/15 shadow-2xl backdrop-blur-lg focus-within:border-cyan-400 transition-all">
            <div className="pl-4 text-cyan-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={verificationId}
              onChange={(e) => setVerificationId(e.target.value)}
              placeholder="e.g. DOC-VER-XXXX-XXXX"
              className="flex-1 bg-transparent h-12 px-2 text-sm sm:text-base font-mono font-extrabold tracking-wider text-white placeholder:text-slate-600 outline-none uppercase"
            />
            <button
              type="submit"
              disabled={loading || !verificationId.trim()}
              className="btn btn-primary h-11 px-6 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
              }}
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Result Card */}
        {searched && result && (
          <div
            className="w-full rounded-2xl border p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden shadow-2xl transition-all"
            style={{
              backgroundColor: result.verified
                ? 'rgba(6, 182, 212, 0.04)'
                : result.status === 'Revoked'
                ? 'rgba(245, 158, 11, 0.04)'
                : 'rgba(239, 68, 68, 0.04)',
              borderColor: result.verified
                ? 'rgba(16, 185, 129, 0.4)'
                : result.status === 'Revoked'
                ? 'rgba(245, 158, 11, 0.4)'
                : 'rgba(239, 68, 68, 0.4)'
            }}
          >
            {/* Top Security Status Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: result.verified
                      ? 'rgba(16, 185, 129, 0.15)'
                      : result.status === 'Revoked'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    borderColor: result.verified
                      ? 'rgba(16, 185, 129, 0.4)'
                      : result.status === 'Revoked'
                      ? 'rgba(245, 158, 11, 0.4)'
                      : 'rgba(239, 68, 68, 0.4)',
                    color: result.verified ? '#10b981' : result.status === 'Revoked' ? '#f59e0b' : '#ef4444'
                  }}
                >
                  {result.verified ? (
                    <CheckCircle2 className="w-6 h-6 animate-pulse" />
                  ) : result.status === 'Revoked' ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: result.verified
                          ? 'rgba(16, 185, 129, 0.1)'
                          : result.status === 'Revoked'
                          ? 'rgba(245, 158, 11, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                        borderColor: result.verified
                          ? 'rgba(16, 185, 129, 0.3)'
                          : result.status === 'Revoked'
                          ? 'rgba(245, 158, 11, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)',
                        color: result.verified ? '#10b981' : result.status === 'Revoked' ? '#f59e0b' : '#ef4444'
                      }}
                    >
                      {result.status === 'Valid'
                        ? 'AUTHENTIC // VALID'
                        : result.status === 'Revoked'
                        ? 'WARNING // REVOKED'
                        : 'REJECTED // FAKE / NOT FOUND'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase mt-1 tracking-wider">
                    {result.verified
                      ? result.documentTitle
                      : result.status === 'Revoked'
                      ? 'REVOKED DOCUMENT'
                      : 'UNAUTHENTICATED IDENTIFIER'}
                  </h3>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest block">CHECK CODE</span>
                <strong className="text-xs font-extrabold text-cyan-400">{result.verificationId}</strong>
              </div>
            </div>

            {/* Verified Details Matrix */}
            {result.verified || result.status === 'Revoked' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-6 text-xs">
                {/* Document Information */}
                <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest block">
                    DOCUMENT REGISTRATION
                  </span>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">DOCUMENT NAME:</span>
                    <strong className="text-white text-xs">{result.documentTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">VERSION ATTESTED:</span>
                    <strong className="text-cyan-400">Version {result.documentVersion}.0</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">CATEGORY:</span>
                    <strong className="text-slate-300">{result.category}</strong>
                  </div>
                </div>

                {/* Signatory & Timestamp */}
                <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest block">
                    SIGNATORY & TIMESTAMPS
                  </span>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">MASKED EMPLOYEE NAME:</span>
                    <strong className="text-white text-xs tracking-wider">{result.maskedEmployeeName}</strong>
                    <span className="text-[8px] text-slate-500 block mt-0.5">
                      ({result.maskedEmployeeId} &bull; Privacy Protected)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">DIGITALLY SIGNED AT:</span>
                    <strong className="text-emerald-400 text-[11px]">
                      {new Date(result.signedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </strong>
                  </div>
                  {result.revokedAt && (
                    <div className="text-rose-400">
                      <span className="text-[9px] uppercase block">REVOCATION REASON:</span>
                      <strong>{result.revocationReason || 'Revoked by administrator'}</strong>
                    </div>
                  )}
                </div>

                {/* Cryptographic Hash Ledger */}
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-[8px] text-slate-400 uppercase">
                    <span className="flex items-center gap-1 text-cyan-400 font-bold">
                      <Lock className="w-3 h-3" />
                      <span>SHA-256 CERTIFICATE HASH</span>
                    </span>
                    <span>IMMUTABLE LEDGER RECORD</span>
                  </div>
                  <div className="p-2 rounded bg-black/60 border border-white/5 font-mono text-[9px] text-slate-300 break-all select-all">
                    {result.certificateHash}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-rose-400 font-bold max-w-md mx-auto leading-relaxed">
                  {result.message}
                </p>
                <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                  Please check the spelling of your Verification ID or contact Markdot Compliance & Legal Department.
                </p>
              </div>
            )}

            {/* Bottom Status Ticker */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-[8px] text-slate-500">
              <span>MARKDOT TRUST VERIFICATION SERVICE // ACTIVE</span>
              <span>TIME CHECKED: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 py-4 text-center text-[9px] text-slate-500">
        &copy; {new Date().getFullYear()} Markdot Intellect Inc. All Rights Reserved. Protected by end-to-end cryptographic verification.
      </footer>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030306] text-white flex items-center justify-center font-mono">LOADING TRUST ENGINE...</div>}>
      <VerificationContent />
    </Suspense>
  );
}
