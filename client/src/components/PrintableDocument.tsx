'use client';

import React, { useState, useEffect } from 'react';
import { Printer, ShieldCheck, Download, CheckCircle, ExternalLink, QrCode, X, Loader2, FileDown } from 'lucide-react';
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
  onClose?: () => void;
}

export default function PrintableDocument({
  document,
  signature,
  user,
  onClose
}: PrintableDocumentProps) {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const verificationUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify?id=${signature.verificationId}`
      : `https://connect.markdot.com/verify?id=${signature.verificationId}`;

  useEffect(() => {
    try {
      // 84px crisp QR code that fits comfortably without trimming
      const svg = generateQrSvg(verificationUrl, 84, '#020204', '#ffffff');
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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;

      const element = typeof window !== 'undefined' ? window.document.getElementById('printable-document-sheet') : null;
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const imgWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }

      pdf.save(`${signature.verificationId || 'DOC'}_Official_Agreement.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not generate PDF. Please use browser print.');
    } finally {
      setIsExporting(false);
    }
  };

  const formattedSignDate = new Date(signature.signedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <div className="flex flex-col gap-3 font-mono select-none">
      {/* ── TOP ACTION BAR: PRINT, DOWNLOAD PDF, CLOSE ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-950/90 border border-white/15 no-print shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>AUTHENTICATED RECORD // ID: {signature.verificationId}</span>
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AUDITED
              </span>
            </h4>
            <p className="text-[9px] text-slate-400">
              Cryptographically verified by Markdot Trust Ledger. Ready for official archiving.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct PDF Download */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="h-9 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-slate-200 hover:text-white border border-white/15 text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            title="Download clean PDF document"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>{isExporting ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary h-9 px-4 text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
            }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Document</span>
          </button>

          {/* Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white border border-white/15 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
              title="Close viewer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>

      {/* ── PRINTABLE SHEET CONTAINER (A4 Formal Document Layout) ── */}
      <div
        id="printable-document-sheet"
        className="printable-sheet bg-white text-zinc-950 p-6 sm:p-10 rounded-xl shadow-2xl border border-slate-300 max-w-4xl mx-auto w-full select-text font-sans"
        style={{
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)'
        }}
      >
        {/* Document Header with Company Logo */}
        <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-3 mb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-zinc-950 rounded-lg p-2 flex items-center justify-center shrink-0">
              <img
                src="/images/Markdot logo white.png"
                alt="Markdot Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-950 uppercase leading-tight">
                MARKDOT INTELLECT
              </h1>
              <p className="text-[11px] font-bold text-cyan-800 tracking-wider uppercase font-mono leading-none mt-0.5">
                HR COMPLIANCE & LEGAL ATTESTATION LEDGER
              </p>
              <p className="text-[9px] text-zinc-500 font-mono mt-0.5">
                DOCUMENT CODE: {signature.verificationId} &bull; REVISION v{document.version}.0
              </p>
            </div>
          </div>

          {/* Verification Seal Badge */}
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-400 text-emerald-800 text-[9px] font-black font-mono uppercase tracking-wider">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>DIGITALLY SIGNED & VALID</span>
            </div>
            <p className="text-[8px] font-mono text-zinc-400 mt-0.5">STATUS: COMPLIANT</p>
          </div>
        </div>

        {/* Document Title Banner */}
        <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-cyan-800 uppercase tracking-wider mb-0.5">
            <span>OFFICIAL AGREEMENT ARCHIVE</span>
            <span>CATEGORY: {document.category || 'TERMS'}</span>
          </div>
          <h2 className="text-base font-black text-zinc-950 tracking-tight uppercase">
            {document.title}
          </h2>
          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
            Effective Version: v{document.version} &bull; Initial Filing: {new Date(document.createdAt || signature.signedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Document Full Body Content */}
        <div className="mb-4 text-xs text-zinc-800 leading-normal space-y-2 font-sans whitespace-pre-line border-b border-slate-200 pb-3">
          {document.content}
        </div>

        {/* ── ATTESTATION & EXECUTION BLOCK: UNCONDITIONAL 2-COLUMN GRID (PREVENTS CUTOFF) ── */}
        <div
          className="attestation-block grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-3 font-mono text-[10px]"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          {/* Left Column: Signatory Credentials */}
          <div className="space-y-1">
            <h4 className="text-[9.5px] font-black uppercase text-zinc-900 border-b border-slate-300 pb-1 tracking-wider">
              // SIGNATORY_CREDENTIALS
            </h4>
            <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[9.5px]">
              <span className="text-zinc-500 uppercase font-semibold">Employee Name:</span>
              <strong className="text-zinc-950 uppercase">{user.fullName}</strong>

              <span className="text-zinc-500 uppercase font-semibold">Employee ID:</span>
              <strong className="text-zinc-950 uppercase">{user.employeeId}</strong>

              <span className="text-zinc-500 uppercase font-semibold">Designation:</span>
              <strong className="text-zinc-950 uppercase">{user.jobTitle || 'Operator'}</strong>

              <span className="text-zinc-500 uppercase font-semibold">Employment Type:</span>
              <strong className="text-zinc-950 uppercase">{user.employmentType || 'Full-time'}</strong>

              <span className="text-zinc-500 uppercase font-semibold">Sign Timestamp:</span>
              <strong className="text-cyan-800 text-[9px]">{formattedSignDate}</strong>
            </div>
          </div>

          {/* Right Column: Tamper-Proof QR Code & Verification ID */}
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div
              className="attestation-qr-box w-[88px] h-[88px] bg-white p-1 rounded-lg border border-slate-300 shrink-0 flex items-center justify-center shadow-sm"
              style={{
                pageBreakInside: 'avoid',
                breakInside: 'avoid'
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="flex-1 space-y-0.5">
              <span className="text-[8px] font-extrabold uppercase text-cyan-800 tracking-wider block">
                TAMPER-PROOF VERIFICATION
              </span>
              <p className="text-[7.5px] text-zinc-500 leading-tight">
                Scan QR code with any camera or visit public portal to confirm authenticity.
              </p>
              <div className="pt-0.5">
                <span className="text-[7px] font-bold text-zinc-400 block uppercase">VERIFICATION ID</span>
                <span className="font-mono text-[9.5px] font-black text-zinc-950 bg-white px-1.5 py-0.5 rounded border border-slate-300 inline-block tracking-wider">
                  {signature.verificationId}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── CRYPTOGRAPHIC PROOF FOOTER: CERTIFICATE HASH ── */}
        <div
          className="cryptographic-footer pt-2 border-t border-slate-200 text-[8px] font-mono text-zinc-500 flex flex-col gap-0.5"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span>
              <strong>CERTIFICATE_HASH (SHA-256):</strong>
            </span>
            <span className="text-[7.5px] text-zinc-400">STATUS: AUDITED & SECURE</span>
          </div>
          <div className="p-1 rounded bg-slate-50 border border-slate-300 font-mono text-[7px] text-zinc-700 break-all select-all leading-tight">
            {signature.certificateHash}
          </div>
          <div className="flex items-center justify-between text-[7px] text-zinc-400 pt-0.5">
            <span>CLIENT RECORD: IP {signature.ipAddress || '127.0.0.1'}</span>
            <span>VERIFY AT: {verificationUrl}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
