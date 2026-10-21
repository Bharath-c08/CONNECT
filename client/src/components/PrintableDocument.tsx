'use client';

import React, { useState, useEffect } from 'react';
import { Printer, ShieldCheck, Download, CheckCircle, ExternalLink, QrCode } from 'lucide-react';
import { generateQrSvg } from '../utils/qr';

interface PrintableDocumentProps {
  document: {
    _id: string;
    title: string;
    category?: string;
    content: string;
    version: number;
    createdAt?: string | Date;
  };
  signature: {
    _id?: string;
    verificationId: string;
    certificateHash: string;
    signedAt: string | Date;
    ipAddress?: string;
    userAgent?: string;
    status?: string;
  };
  user: {
    fullName: string;
    employeeId: string;
    jobTitle?: string;
    email?: string;
    employmentType?: string;
  };
}

export default function PrintableDocument({
  document,
  signature,
  user
}: PrintableDocumentProps) {
  const [qrSvg, setQrSvg] = useState<string>('');

  const verificationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify?id=${signature.verificationId}`
      : `https://connect.markdot.com/verify?id=${signature.verificationId}`;

  useEffect(() => {
    try {
      const svg = generateQrSvg(verificationUrl, 100, '#020204', '#ffffff');
      setQrSvg(svg);
    } catch (e) {
      console.error('Error generating verification QR code:', e);
    }
  }, [verificationUrl]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const formattedSignDate = new Date(signature.signedAt).toLocaleString([], {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* Top Print Action Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950/80 border border-white/10 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              AUTHENTICATED CERTIFICATE // VERIFICATION ID: {signature.verificationId}
            </h4>
            <p className="text-[9px] text-slate-400">
              Cryptographically verified by Markdot Trust Ledger. Ready for official archiving & export.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="btn btn-primary h-9 px-4 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
          }}
        >
          <Printer className="w-4 h-4" />
          <span>Print Document</span>
        </button>
      </div>

      {/* ── PRINTABLE SHEET CONTAINER (A4 Formal Document Layout) ── */}
      <div
        id="printable-document-sheet"
        className="printable-sheet bg-white text-zinc-950 p-8 sm:p-12 rounded-xl shadow-2xl border border-slate-300 max-w-4xl mx-auto w-full select-text font-sans"
        style={{
          minHeight: '1000px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
        }}
      >
        {/* Document Header with Company Logo */}
        <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-zinc-950 rounded-xl p-2 flex items-center justify-center">
              <img
                src="/images/Markdot logo white.png"
                alt="Markdot Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-zinc-950 uppercase">
                MARKDOT INTELLECT
              </h1>
              <p className="text-xs font-bold text-cyan-700 tracking-wider uppercase font-mono">
                HR COMPLIANCE & LEGAL ATTESTATION LEDGER
              </p>
              <p className="text-[10px] text-zinc-500 font-mono">
                DOCUMENT CODE: {signature.verificationId} &bull; REVISION v{document.version}.0
              </p>
            </div>
          </div>

          {/* Verification Seal Badge */}
          <div className="text-right">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-800 text-[10px] font-black font-mono uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>DIGITALLY SIGNED & VALID</span>
            </div>
            <p className="text-[9px] font-mono text-zinc-400 mt-1">STATUS: COMPLIANT</p>
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-800 uppercase tracking-wider mb-1">
            <span>OFFICIAL AGREEMENT ARCHIVE</span>
            <span>CATEGORY: {document.category || 'TERMS'}</span>
          </div>
          <h2 className="text-lg font-black text-zinc-950 tracking-tight uppercase">
            {document.title}
          </h2>
          <div className="text-xs text-zinc-500 font-mono mt-1">
            Effective Version: v{document.version} &bull; Initial Filing: {new Date(document.createdAt || signature.signedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Document Full Body Content */}
        <div className="mb-10 text-xs sm:text-sm text-zinc-800 leading-relaxed space-y-4 font-sans whitespace-pre-line border-b border-slate-200 pb-8">
          {document.content}
        </div>

        {/* Attestation & Execution Block */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-xl bg-slate-50 border border-slate-200 mb-6 font-mono text-xs">
          {/* Employee Details Block */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase text-zinc-900 border-b border-slate-300 pb-1">
              // SIGNATORY_CREDENTIALS
            </h4>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <span className="text-zinc-500 uppercase">Employee Name:</span>
              <strong className="text-zinc-950 uppercase">{user.fullName}</strong>

              <span className="text-zinc-500 uppercase">Employee ID:</span>
              <strong className="text-zinc-950 uppercase">{user.employeeId}</strong>

              <span className="text-zinc-500 uppercase">Designation:</span>
              <strong className="text-zinc-950 uppercase">{user.jobTitle || 'Operator'}</strong>

              <span className="text-zinc-500 uppercase">Employment Type:</span>
              <strong className="text-zinc-950 uppercase">{user.employmentType || 'Full-time'}</strong>

              <span className="text-zinc-500 uppercase">Sign Timestamp:</span>
              <strong className="text-cyan-800 text-[10px]">{formattedSignDate}</strong>
            </div>
          </div>

          {/* Document Verification & Security Hash */}
          <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
            <div
              className="w-24 h-24 bg-white p-1 rounded-lg border border-slate-300 shrink-0 flex items-center justify-center shadow-sm"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="flex-1 space-y-1">
              <span className="text-[9px] font-extrabold uppercase text-cyan-800 tracking-wider block">
                TAMPER-PROOF VERIFICATION
              </span>
              <p className="text-[9px] text-zinc-500 leading-tight">
                Scan QR code with any mobile camera or enter Verification ID at public portal to confirm validity.
              </p>
              <div className="pt-1">
                <span className="text-[8px] font-bold text-zinc-400 block uppercase">VERIFICATION ID</span>
                <span className="font-mono text-xs font-black text-zinc-950 bg-white px-2 py-0.5 rounded border border-slate-300 inline-block">
                  {signature.verificationId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Proof Footer */}
        <div className="pt-4 border-t border-slate-200 text-[9px] font-mono text-zinc-500 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>CERTIFICATE_HASH (SHA-256):</strong>
            </span>
            <span className="text-[8px] text-zinc-400">STATUS: AUDITED & SECURE</span>
          </div>
          <div className="p-2 rounded bg-white border border-slate-300 font-mono text-[8px] text-zinc-700 break-all select-all">
            {signature.certificateHash}
          </div>
          <div className="flex items-center justify-between text-[8px] text-zinc-400 pt-1">
            <span>CLIENT RECORD: IP {signature.ipAddress || '127.0.0.1'}</span>
            <span>VERIFICATION PORTAL: {verificationUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
