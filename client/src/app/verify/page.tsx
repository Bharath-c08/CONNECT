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
  CreditCard,
  Calendar,
  User as UserIcon,
  Hash,
  ExternalLink,
  ArrowLeft,
  RefreshCw,
  Lock,
  Heart,
  Briefcase,
  Building
} from 'lucide-react';
import { apiRequest } from '../../utils/api';

function VerificationContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('id') || '';
  const initialType = searchParams.get('type') || (initialId.startsWith('EMP-') ? 'idcard' : 'document');

  const [verifyType, setVerifyType] = useState<'idcard' | 'document'>(
    initialType === 'idcard' || initialId.startsWith('EMP-') ? 'idcard' : 'document'
  );
  const [verificationId, setVerificationId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('https://connect.markdot.com');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  const executeLookup = async (idToLookup: string, forcedType?: 'idcard' | 'document') => {
    const trimmed = idToLookup.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    setSearched(true);
    const activeType = forcedType || verifyType;

    try {
      let data;
      // If explicit ID card mode or starts with EMP-
      if (activeType === 'idcard') {
        const cleanEmpId = trimmed.replace(/^EMP-/, '');
        // Try dedicated ID card verify endpoint first, fallback to generic
        try {
          data = await apiRequest(`/documents/verify-idcard/${encodeURIComponent(cleanEmpId)}`);
        } catch {
          data = await apiRequest(`/documents/verify/${encodeURIComponent(`EMP-${cleanEmpId}`)}`);
        }
      } else {
        // Document or universal verify
        data = await apiRequest(`/documents/verify/${encodeURIComponent(trimmed)}`);
      }

      setResult(data);
    } catch (err: any) {
      setResult({
        verified: false,
        type: activeType,
        status: 'Fake / Invalid',
        message:
          activeType === 'idcard'
            ? `No authentic employee record exists for ID '${trimmed}' in the official personnel registry.`
            : err.message || 'No official document record matches this Verification ID in the cryptographic registry.',
        verificationId: trimmed
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      const mode = initialId.startsWith('EMP-') ? 'idcard' : 'document';
      setVerifyType(mode);
      executeLookup(initialId, mode);
    }
  }, [initialId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(verificationId);
  };

  const handleTypeChange = (newType: 'idcard' | 'document') => {
    setVerifyType(newType);
    setResult(null);
    setSearched(false);
  };

  const isIdCardResult = result?.type === 'idcard' || Boolean(result?.employeeId);

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
          <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-white/20 p-1 flex items-center justify-center">
            <img src="/images/Markdot logo white.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase text-white">
              MARKDOT TRUST LEDGER
            </h1>
            <p className="text-[8px] text-cyan-400 font-bold uppercase tracking-widest">
              PUBLIC VERIFICATION & CREDENTIAL PORTAL
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
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-10 max-w-3xl mx-auto w-full">
        {/* Title & Explainer */}
        <div className="text-center space-y-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-extrabold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 animate-pulse" />
            <span>Cryptographic Proof Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
            {verifyType === 'idcard' ? 'Verify Employee ID Card' : 'Verify Document Authenticity'}
          </h2>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            {verifyType === 'idcard'
              ? 'Enter an Employee ID number or scan the QR code from the back of an official Markdot ID card to verify credential validity, active employment status, and authorized identity.'
              : 'Enter the non-sequential Verification ID or certificate hash printed on any official Markdot Intellect agreement, policy, or digital credential to verify its validity.'}
          </p>
        </div>

        {/* Verification Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900/90 border border-white/10 mb-6 w-full max-w-md shadow-lg">
          <button
            type="button"
            onClick={() => handleTypeChange('idcard')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              verifyType === 'idcard'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Employee ID Card</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('document')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              verifyType === 'document'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Legal Document</span>
          </button>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSubmit} className="w-full mb-8">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/90 border border-white/15 shadow-2xl backdrop-blur-lg focus-within:border-cyan-400 transition-all">
            <div className="pl-4 text-cyan-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={verificationId}
              onChange={(e) => setVerificationId(e.target.value)}
              placeholder={
                verifyType === 'idcard'
                  ? 'e.g. MDPA005 or EMP-MDPA005'
                  : 'e.g. DOC-VER-XXXX-XXXX'
              }
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

        {/* ── RESULT CARD ── */}
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
            {/* Top Status Banner */}
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
                      {result.verified
                        ? isIdCardResult
                          ? 'AUTHENTIC // ACTIVE EMPLOYEE CREDENTIAL'
                          : 'AUTHENTIC // VALID DOCUMENT'
                        : result.status === 'Revoked'
                        ? 'WARNING // REVOKED CREDENTIAL'
                        : 'REJECTED // RECORD NOT FOUND'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase mt-1 tracking-wider">
                    {result.verified
                      ? isIdCardResult
                        ? result.fullName
                        : result.documentTitle
                      : result.status === 'Revoked'
                      ? 'REVOKED RECORD'
                      : 'UNAUTHENTICATED IDENTIFIER'}
                  </h3>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest block">CHECK CODE</span>
                <strong className="text-xs font-extrabold text-cyan-400">
                  {result.employeeId ? `EMP-${result.employeeId}` : result.verificationId}
                </strong>
              </div>
            </div>

            {/* ── CONDITIONAL RENDERING: ID CARD vs DOCUMENT ── */}
            {result.verified && isIdCardResult ? (
              /* ======================================================== */
              /* ── VERIFIED EMPLOYEE IDENTIFICATION CARD DETAILS ── */
              /* ======================================================== */
              <div className="py-6 space-y-6">
                {/* Employee Main Profile Header Strip */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-zinc-950/80 border border-white/10">
                  <div className="w-20 h-24 rounded-lg border-2 border-cyan-500/60 overflow-hidden bg-slate-900 shrink-0 shadow-md">
                    {result.profilePhoto ? (
                      <img
                        src={result.profilePhoto}
                        alt={result.fullName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                        <UserIcon className="w-8 h-8 stroke-1" />
                        <span className="text-[7px] font-bold uppercase mt-1">NO PHOTO</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-center sm:text-left flex-1">
                    <div className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-extrabold uppercase">
                      ACTIVE {result.employmentType || 'FULLTIME'}
                    </div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">{result.fullName}</h2>
                    <p className="text-xs font-bold text-cyan-400 uppercase">{result.jobTitle || 'Technical Operator'}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      OFFICIAL EMPLOYEE ID: <strong className="text-white">{result.employeeId}</strong>
                    </p>
                  </div>
                </div>

                {/* Identity Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Heart className="w-3 h-3 text-rose-500" />
                      <span>BLOOD GROUP</span>
                    </span>
                    <strong className="text-rose-400 font-black text-sm block">
                      {result.bloodGroup || 'O+'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-cyan-400" />
                      <span>JOINING DATE</span>
                    </span>
                    <strong className="text-white text-xs block">
                      {result.joiningDate
                        ? new Date(result.joiningDate).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'Active Record'}
                    </strong>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Building className="w-3 h-3 text-emerald-400" />
                      <span>ISSUER AUTHORITY</span>
                    </span>
                    <strong className="text-slate-300 text-[10px] block leading-tight">
                      Markdot Intellect Inc.
                    </strong>
                  </div>
                </div>

                {/* System Generated Verification Box */}
                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between gap-3 text-[9px]">
                  <div>
                    <span className="font-extrabold text-cyan-300 block uppercase">
                      SYSTEM GENERATED CREDENTIAL ATTRIBUTED
                    </span>
                    <span className="text-slate-400 text-[8px] block mt-0.5">
                      Verified at {currentOrigin}/verify &bull; Governed by Connect Enterprise Security Ledger
                    </span>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black text-[8px] shrink-0 uppercase">
                    STATUS // AUTHENTIC
                  </div>
                </div>
              </div>
            ) : result.verified || result.status === 'Revoked' ? (
              /* ======================================================== */
              /* ── VERIFIED LEGAL DOCUMENT DETAILS ── */
              /* ======================================================== */
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
                      {result.signedAt
                        ? new Date(result.signedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Active Attestation'}
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
                    {result.certificateHash || 'VERIFIED-HASH-RECORD-VALID'}
                  </div>
                </div>
              </div>
            ) : (
              /* Invalid / Rejected Notice */
              <div className="py-8 text-center space-y-3">
                <p className="text-xs text-rose-400 font-bold max-w-md mx-auto leading-relaxed">
                  {result.message}
                </p>
                <p className="text-[10px] text-slate-500 max-w-sm mx-auto">
                  Please verify the identification number or contact Markdot Legal & HR Department.
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030306] text-white flex items-center justify-center font-mono">
          LOADING TRUST ENGINE...
        </div>
      }
    >
      <VerificationContent />
    </Suspense>
  );
}
