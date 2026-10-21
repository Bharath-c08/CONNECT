'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  ShieldCheck,
  CreditCard,
  Phone,
  AlertCircle,
  MapPin,
  Calendar,
  User as UserIcon,
  Download,
  FileDown,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { generateQrSvg } from '../utils/qr';

interface DigitalIdCardProps {
  user: {
    _id?: string;
    fullName: string;
    employeeId: string;
    jobTitle?: string;
    dob?: string | Date;
    phone?: string;
    emergencyContactNumber?: string;
    emergencyContactName?: string;
    address?: string;
    profilePhoto?: string;
    bloodGroup?: string;
    employmentType?: string;
    joiningDate?: string | Date;
    email?: string;
  };
  verificationUrl?: string;
}

export default function DigitalIdCard({ user, verificationUrl }: DigitalIdCardProps) {
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>('both');
  const [printLayout, setPrintLayout] = useState<'twopage' | 'sidebyside' | 'front' | 'back'>('twopage');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatusText, setExportStatusText] = useState('');
  const [qrSvg, setQrSvg] = useState<string>('');
  const [siteUrl, setSiteUrl] = useState<string>('https://connect.markdot.com');

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSiteUrl(window.location.origin);
    }
  }, []);

  const targetVerificationUrl =
    verificationUrl ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/verify?id=EMP-${user.employeeId || 'CONNECT'}`
      : `https://connect.markdot.com/verify?id=EMP-${user.employeeId || 'CONNECT'}`);

  useEffect(() => {
    try {
      const svg = generateQrSvg(targetVerificationUrl, 90, '#000000', '#ffffff');
      setQrSvg(svg);
    } catch (e) {
      console.error('Error generating badge QR code:', e);
    }
  }, [targetVerificationUrl]);

  // Click outside to close export menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Standard Print Engine trigger
  const handlePrint = (overrideMode?: 'twopage' | 'sidebyside' | 'front' | 'back') => {
    if (typeof window === 'undefined') return;
    const mode = overrideMode || printLayout;
    setPrintLayout(mode);

    document.body.classList.add('printing-id-card');
    
    // Add print cleanup listener
    const cleanup = () => {
      document.body.classList.remove('printing-id-card');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    window.print();

    // Fallback timeout in case afterprint does not fire
    setTimeout(() => {
      document.body.classList.remove('printing-id-card');
    }, 1500);
  };

  const cleanEmpId = (user.employeeId || 'EMPLOYEE').replace(/[^a-zA-Z0-9_-]/g, '');

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── PDF EXPORT ENGINE (Standard CR80 54mm x 85.6mm) ───────────────────
  const exportPDF = async (target: 'front' | 'back' | 'both') => {
    setIsExporting(true);
    setExportDropdownOpen(false);
    setExportStatusText(`Rendering ${target.toUpperCase()} PDF...`);

    try {
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;

      const frontEl = document.getElementById('id-card-front-element');
      const backEl = document.getElementById('id-card-back-element');

      // CR80 specification standard in mm (Portrait): 54mm width x 85.6mm height
      const badgeW = 54;
      const badgeH = 85.6;

      const canvasOptions = {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      };

      if (target === 'front' && frontEl) {
        const canvas = await html2canvas(frontEl, canvasOptions);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        pdf.addImage(imgData, 'PNG', 0, 0, badgeW, badgeH);
        pdf.save(`${cleanEmpId}_ID_Card_Front.pdf`);
      } else if (target === 'back' && backEl) {
        const canvas = await html2canvas(backEl, canvasOptions);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        pdf.addImage(imgData, 'PNG', 0, 0, badgeW, badgeH);
        pdf.save(`${cleanEmpId}_ID_Card_Back.pdf`);
      } else if (target === 'both' && frontEl && backEl) {
        const frontCanvas = await html2canvas(frontEl, canvasOptions);
        const backCanvas = await html2canvas(backEl, canvasOptions);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        // Page 1: Front
        pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, badgeW, badgeH);
        // Page 2: Back
        pdf.addPage([badgeW, badgeH], 'portrait');
        pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, badgeW, badgeH);
        pdf.save(`${cleanEmpId}_ID_Card_Both_Pages.pdf`);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not export ID card as PDF. Please try again or use browser print.');
    } finally {
      setIsExporting(false);
      setExportStatusText('');
    }
  };

  // ─── IMAGE EXPORT ENGINE (High-Resolution PNG) ─────────────────────────
  const exportImage = async (target: 'front' | 'back' | 'both') => {
    setIsExporting(true);
    setExportDropdownOpen(false);
    setExportStatusText(`Rendering ${target.toUpperCase()} Image...`);

    try {
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const frontEl = document.getElementById('id-card-front-element');
      const backEl = document.getElementById('id-card-back-element');

      const canvasOptions = {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      };

      if (target === 'front' && frontEl) {
        const canvas = await html2canvas(frontEl, canvasOptions);
        downloadDataUrl(canvas.toDataURL('image/png'), `${cleanEmpId}_ID_Front.png`);
      } else if (target === 'back' && backEl) {
        const canvas = await html2canvas(backEl, canvasOptions);
        downloadDataUrl(canvas.toDataURL('image/png'), `${cleanEmpId}_ID_Back.png`);
      } else if (target === 'both' && frontEl && backEl) {
        const frontCanvas = await html2canvas(frontEl, canvasOptions);
        const backCanvas = await html2canvas(backEl, canvasOptions);

        const gap = 36;
        const combined = document.createElement('canvas');
        combined.width = frontCanvas.width + backCanvas.width + gap;
        combined.height = Math.max(frontCanvas.height, backCanvas.height);
        const ctx = combined.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, combined.width, combined.height);
          ctx.drawImage(frontCanvas, 0, 0);
          ctx.drawImage(backCanvas, frontCanvas.width + gap, 0);
          downloadDataUrl(combined.toDataURL('image/png'), `${cleanEmpId}_ID_Card_Dual.png`);
        }
      }
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Could not export ID card as image. Please try again.');
    } finally {
      setIsExporting(false);
      setExportStatusText('');
    }
  };

  const formattedDob = user.dob
    ? new Date(user.dob).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Not Recorded';

  const formattedJoining = user.joiningDate
    ? new Date(user.joiningDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active';

  return (
    <div className="flex flex-col gap-5 select-none font-mono">
      {/* ── ACTION HEADER / CONTROLS TOOLBAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-950/70 border border-white/10 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>DIGITAL EMPLOYEE ID CARD // CR80 WALLET SPEC</span>
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ACTIVE_CREDENTIAL
              </span>
            </h4>
            <p className="text-[9px] text-slate-500">Dual-sided standardized layout with verification micro-QR</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Screen Side View Switcher */}
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-[9px] font-bold">
            <button
              type="button"
              onClick={() => setActiveSide('both')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'both' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400 hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'front' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400 hover:text-white'
              }`}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'back' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400 hover:text-white'
              }`}
            >
              Back
            </button>
          </div>

          {/* Print Layout Mode Toggle */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-white/10 text-[9px]">
            <span className="text-slate-500 font-bold uppercase text-[8px]">PRINT:</span>
            <select
              value={printLayout}
              onChange={(e) => setPrintLayout(e.target.value as any)}
              className="bg-transparent text-cyan-400 font-bold outline-none cursor-pointer"
            >
              <option value="twopage" className="bg-zinc-900 text-white">2 Pages (Duplex)</option>
              <option value="sidebyside" className="bg-zinc-900 text-white">1 Page (Side-by-Side)</option>
              <option value="front" className="bg-zinc-900 text-white">Front Side Only</option>
              <option value="back" className="bg-zinc-900 text-white">Back Side Only</option>
            </select>
          </div>

          {/* Export Dropdown Menu (PDF & Image Options) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting}
              className="h-9 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-[10px] font-bold text-white flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isExporting ? exportStatusText || 'Exporting...' : 'Export'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-zinc-950 border border-white/15 shadow-2xl backdrop-blur-xl p-2 z-50 text-left font-mono text-[10px]">
                {/* PDF Options */}
                <div className="px-2 py-1 text-[8px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-white/5 pb-1 mb-1">
                  <FileDown className="w-3 h-3" />
                  <span>EXPORT AS PDF (CR80 SPEC)</span>
                </div>
                <button
                  type="button"
                  onClick={() => exportPDF('both')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold">Both Pages (2-Page PDF)</span>
                  <span className="text-[8px] text-cyan-400 font-extrabold px-1 rounded bg-cyan-500/10">DUAL</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPDF('front')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Front Page Only (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportPDF('back')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Back Page Only (PDF)</span>
                </button>

                {/* Image Options */}
                <div className="px-2 py-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-t border-b border-white/5 mt-2 pt-1.5 pb-1 mb-1">
                  <ImageIcon className="w-3 h-3" />
                  <span>EXPORT AS IMAGE (HIGH-RES PNG)</span>
                </div>
                <button
                  type="button"
                  onClick={() => exportImage('both')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold">Both Pages (Combined PNG)</span>
                  <span className="text-[8px] text-emerald-400 font-extrabold px-1 rounded bg-emerald-500/10">PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportImage('front')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Front Page Only (PNG)</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportImage('back')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>Back Page Only (PNG)</span>
                </button>
              </div>
            )}
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => handlePrint()}
            className="btn btn-primary h-9 px-4 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
            }}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print ID Card</span>
          </button>
        </div>
      </div>

      {/* ── PRINT ZONE: CR80 WALLET SPEC BADGES ── */}
      <div
        id="printable-id-card-zone"
        className={`print-badge-container flex flex-wrap items-center justify-center gap-8 py-4 print-mode-${printLayout}`}
      >
        {/* ======================================================== */}
        {/* ── CARD FRONT (CR80 Standard Proportion 85.6mm x 54mm) ── */}
        {/* ======================================================== */}
        <div
          id="id-card-front-element"
          className={`id-card-badge id-card-front w-[340px] h-[520px] rounded-2xl relative overflow-hidden flex flex-col justify-between p-5 border shadow-2xl text-slate-900 select-text transition-all ${
            activeSide === 'back'
              ? 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none print:static print:opacity-100'
              : 'relative'
          }`}
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 55%, #e2e8f0 100%)',
            borderColor: '#cbd5e1',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)'
          }}
        >
          {/* Top Lanyard Punch Slot Visual Indicator */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-slate-300 border border-slate-400/50" />

          {/* Micro-Holographic Security Banner */}
          <div
            className="absolute top-0 left-0 right-0 h-2"
            style={{
              background: 'linear-gradient(90deg, #06b6d4 0%, #d946ef 35%, #10b981 70%, #f59e0b 100%)'
            }}
          />

          {/* Header: Company Seal & Name */}
          <div className="flex items-center justify-between pt-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-zinc-950 flex items-center justify-center p-1.5 border border-slate-300">
                <img
                  src="/images/Markdot logo white.png"
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-tight text-slate-950 uppercase leading-none">
                  MARKDOT INTELLECT
                </h3>
                <span className="text-[8px] font-bold text-cyan-700 tracking-widest uppercase">
                  OFFICIAL CREDENTIAL
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[7px] font-black uppercase tracking-widest block text-slate-400">STATUS</span>
              <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                {user.employmentType || 'FULL-TIME'}
              </span>
            </div>
          </div>

          {/* Portrait & Core Identity Block */}
          <div className="flex flex-col items-center text-center my-auto gap-3 py-2">
            <div className="relative">
              {/* Photo frame with security corner accents */}
              <div className="w-28 h-36 rounded-xl border-2 border-cyan-600 p-1 bg-white shadow-md relative overflow-hidden">
                {user.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user.fullName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-400">
                    <UserIcon className="w-12 h-12 stroke-1 text-slate-300" />
                    <span className="text-[8px] font-bold mt-1 text-slate-400 uppercase">NO PHOTO</span>
                  </div>
                )}
              </div>
              {/* Hologram badge icon */}
              <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center border-2 border-white shadow">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Name & Title */}
            <div className="space-y-0.5 px-2">
              <h2 className="text-base font-black text-slate-950 tracking-wide uppercase leading-snug">
                {user.fullName}
              </h2>
              <p className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider">
                {user.jobTitle || 'TECHNICAL OPERATOR'}
              </p>
              <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-black text-slate-800 tracking-wider">
                EMP ID: {user.employeeId}
              </div>
            </div>
          </div>

          {/* Key Quick Fields Strip */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[9px]">
            <div>
              <span className="text-slate-400 uppercase font-bold block text-[7px]">BLOOD GROUP</span>
              <strong className="text-rose-600 font-extrabold text-[10px]">{user.bloodGroup || 'O+'}</strong>
            </div>
            <div className="text-right">
              <span className="text-slate-400 uppercase font-bold block text-[7px]">JOINING DATE</span>
              <strong className="text-slate-700 font-bold text-[9px]">{formattedJoining}</strong>
            </div>
          </div>

          {/* Front Footer: Barcode Simulation & Serial */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-400">
            <div className="font-mono tracking-widest text-[7px] text-slate-500">
              // CR80-{user.employeeId}-MARKDOT
            </div>
            {/* Barcode representation */}
            <div className="flex items-center gap-[2px] h-5 opacity-70">
              {[3, 1, 4, 1, 5, 2, 4, 1, 3, 2, 5, 1, 4, 2, 1, 3, 5, 2].map((w, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950 h-full"
                  style={{ width: `${w * 0.8}px` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── PRINT SEPARATOR (Ensures Clean Page Break for Duplex Mode) ── */}
        <div className="id-card-page-break print-only hidden" />

        {/* ======================================================= */}
        {/* ── CARD BACK (CR80 Standard Detail Verification Side) ── */}
        {/* ======================================================= */}
        <div
          id="id-card-back-element"
          className={`id-card-badge id-card-back w-[340px] h-[520px] rounded-2xl relative overflow-hidden flex flex-col justify-between p-5 border shadow-2xl text-slate-900 select-text transition-all ${
            activeSide === 'front'
              ? 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none print:static print:opacity-100'
              : 'relative'
          }`}
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 55%, #e2e8f0 100%)',
            borderColor: '#cbd5e1',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)'
          }}
        >
          {/* Top Lanyard Slot */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-slate-300 border border-slate-400/50" />

          {/* Back Header */}
          <div className="pt-2 border-b border-slate-200 pb-2">
            <span className="text-[8px] font-black text-cyan-800 tracking-widest uppercase block">
              EMPLOYEE CREDENTIAL & EMERGENCY RECORD
            </span>
            <p className="text-[7px] text-slate-400 uppercase font-semibold">
              This credential is the property of Markdot Intellect Inc.
            </p>
          </div>

          {/* Required Detailed Fields */}
          <div className="space-y-2.5 my-auto text-[9.5px]">
            {/* DOB */}
            <div className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 uppercase font-bold text-[7px] block">DATE OF BIRTH (DOB)</span>
                <span className="text-slate-900 font-extrabold">{formattedDob}</span>
              </div>
            </div>

            {/* Contact Phone */}
            <div className="flex items-start gap-2">
              <Phone className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 uppercase font-bold text-[7px] block">PRIMARY CONTACT NUMBER</span>
                <span className="text-slate-900 font-extrabold">{user.phone || '+91 (Not Provided)'}</span>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-950">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-rose-500 uppercase font-bold text-[7px] block">IN CASE OF EMERGENCY</span>
                <div className="font-extrabold text-[9px]">
                  {user.emergencyContactNumber || 'Not Provided'}
                  {user.emergencyContactName && (
                    <span className="text-rose-700 font-medium ml-1">({user.emergencyContactName})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Residential Address */}
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-cyan-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 uppercase font-bold text-[7px] block">RESIDENTIAL ADDRESS</span>
                <span className="text-slate-800 font-semibold leading-relaxed block text-[8.5px]">
                  {user.address || 'Address on file with Human Resources department.'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification QR & Authentication Section */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex-1">
              <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider block">
                PUBLIC VERIFICATION QR
              </span>
              <span className="text-[8px] font-extrabold text-slate-900 block mt-0.5">
                Scan to verify identity
              </span>
              <span className="text-[6.5px] font-mono text-cyan-800 break-all block mt-1">
                EMP ID: {user.employeeId}
              </span>
            </div>
            <div
              className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-300 shrink-0 flex items-center justify-center shadow-sm"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>

          {/* Back Footer: Legal Terms & System Verification Note */}
          <div className="pt-2 border-t border-slate-200 flex items-end justify-between text-[7px] text-slate-500">
            <div className="max-w-[170px] leading-tight">
              If found, please return to: Markdot HQ, Connect HR Dept. Valid until revoked.
            </div>
            {/* System Generated Verification in [siteURL]/verify */}
            <div className="text-right max-w-[155px]">
              <div className="text-[7px] font-black text-slate-900 leading-tight uppercase">
                This is system generated
              </div>
              <div className="text-[6.5px] font-bold text-cyan-700 leading-tight break-all">
                verify in {siteUrl}/verify
              </div>
              <span className="text-[5.5px] font-extrabold uppercase text-slate-400 block mt-0.5 tracking-wider">
                AUTHORIZED ISSUER
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
