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
      const svg = generateQrSvg(targetVerificationUrl, 120, '#000000', '#ffffff');
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

  const cleanEmpId = (user.employeeId || 'EMPLOYEE').replace(/[^a-zA-Z0-9_-]/g, '');

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    if (typeof window !== 'undefined' && (window as any).AndroidInterface?.downloadBase64File) {
      (window as any).AndroidInterface.downloadBase64File(dataUrl, filename);
      return;
    }
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to ensure all images in elements are fully loaded
  const waitForImages = async (container: HTMLElement | null) => {
    if (!container) return;
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map(
        (img) =>
          img.complete
            ? Promise.resolve(true)
            : new Promise((resolve) => {
                img.onload = () => resolve(true);
                img.onerror = () => resolve(true);
              })
      )
    );
  };

  // ─── DEDICATED ISOLATED PRINT ENGINE ──────────────────────────────────────
  const handlePrint = async (overrideMode?: 'twopage' | 'sidebyside' | 'front' | 'back') => {
    if (typeof window !== 'undefined' && (window as any).AndroidInterface?.printDocument) {
      (window as any).AndroidInterface.printDocument();
      return;
    }
    if (typeof window === 'undefined') return;
    const mode = overrideMode || printLayout;
    setPrintLayout(mode);

    const frontEl = document.getElementById('id-card-front-element');
    const backEl = document.getElementById('id-card-back-element');
    if (!frontEl && !backEl) return;

    // Remove any previous print iframe
    const prevIframe = document.getElementById('id-card-print-iframe');
    if (prevIframe) {
      prevIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'id-card-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const frontClone = frontEl ? (frontEl.cloneNode(true) as HTMLElement) : null;
    const backClone = backEl ? (backEl.cloneNode(true) as HTMLElement) : null;

    [frontClone, backClone].forEach((node) => {
      if (node) {
        node.style.position = 'relative';
        node.style.left = '0';
        node.style.top = '0';
        node.style.opacity = '1';
        node.style.visibility = 'visible';
        node.style.display = 'flex';
        node.style.boxShadow = 'none';
        node.style.border = '1px solid #94a3b8';
        node.style.margin = '0 auto';
        node.style.transform = 'none';
      }
    });

    let contentHtml = '';
    if (mode === 'front' && frontClone) {
      contentHtml = `<div class="print-single-wrapper">${frontClone.outerHTML}</div>`;
    } else if (mode === 'back' && backClone) {
      contentHtml = `<div class="print-single-wrapper">${backClone.outerHTML}</div>`;
    } else if (mode === 'sidebyside' && frontClone && backClone) {
      contentHtml = `
        <div class="print-sidebyside-wrapper">
          ${frontClone.outerHTML}
          ${backClone.outerHTML}
        </div>
      `;
    } else {
      // 'twopage' Duplex (Page 1 Front, Page 2 Back)
      contentHtml = `
        <div class="print-page-wrapper">
          ${frontClone ? frontClone.outerHTML : ''}
        </div>
        <div class="page-break"></div>
        <div class="print-page-wrapper">
          ${backClone ? backClone.outerHTML : ''}
        </div>
      `;
    }

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Markdot ID Card - ${user.fullName} (${user.employeeId})</title>
          <style>
            @page {
              size: auto;
              margin: 10mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            body {
              background: #ffffff !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .print-single-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 94vh;
              padding: 5mm;
            }
            .print-sidebyside-wrapper {
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: center;
              gap: 15mm;
              min-height: 94vh;
              padding: 5mm;
            }
            .print-page-wrapper {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 94vh;
              padding: 5mm;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            .page-break {
              page-break-after: always;
              break-after: page;
              height: 0;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          ${contentHtml}
        </body>
      </html>
    `);
    iframeDoc.close();

    // Wait for images to render inside the iframe before calling print
    setTimeout(() => {
      const images = Array.from(iframeDoc.images);
      Promise.all(
        images.map(
          (img) =>
            img.complete
              ? Promise.resolve(true)
              : new Promise((resolve) => {
                  img.onload = () => resolve(true);
                  img.onerror = () => resolve(true);
                })
        )
      ).then(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          iframe.remove();
        }, 3000);
      });
    }, 250);
  };

  // ─── PDF EXPORT ENGINE (CR80 Standard: 54mm x 85.6mm) ───────────────────
  const exportPDF = async (target: 'front' | 'back' | 'both') => {
    setIsExporting(true);
    setExportDropdownOpen(false);
    setExportStatusText(`Rendering ${target.toUpperCase()} PDF...`);

    const prevActiveSide = activeSide;
    if (activeSide !== 'both') {
      setActiveSide('both');
      await new Promise((r) => setTimeout(r, 120));
    }

    try {
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;

      const frontEl = document.getElementById('id-card-front-element');
      const backEl = document.getElementById('id-card-back-element');

      await waitForImages(frontEl);
      await waitForImages(backEl);

      // CR80 specification standard in mm (Portrait): 54mm width x 85.6mm height
      const badgeW = 54;
      const badgeH = 85.6;

      const canvasOptions = {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 340,
        height: 520,
        logging: false,
        onclone: (clonedDoc: Document) => {
          const cFront = clonedDoc.getElementById('id-card-front-element');
          const cBack = clonedDoc.getElementById('id-card-back-element');
          [cFront, cBack].forEach((el) => {
            if (el) {
              el.style.position = 'relative';
              el.style.left = '0';
              el.style.top = '0';
              el.style.opacity = '1';
              el.style.visibility = 'visible';
              el.style.display = 'flex';
              el.style.boxShadow = 'none';
              el.style.transform = 'none';
            }
          });
        }
      };

      if (target === 'front' && frontEl) {
        const canvas = await html2canvas(frontEl, canvasOptions);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        pdf.addImage(imgData, 'PNG', 0, 0, badgeW, badgeH, undefined, 'FAST');
        pdf.save(`${cleanEmpId}_ID_Card_Front.pdf`);
      } else if (target === 'back' && backEl) {
        const canvas = await html2canvas(backEl, canvasOptions);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        pdf.addImage(imgData, 'PNG', 0, 0, badgeW, badgeH, undefined, 'FAST');
        pdf.save(`${cleanEmpId}_ID_Card_Back.pdf`);
      } else if (target === 'both' && frontEl && backEl) {
        const frontCanvas = await html2canvas(frontEl, canvasOptions);
        const backCanvas = await html2canvas(backEl, canvasOptions);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [badgeW, badgeH] });
        // Page 1: Front
        pdf.addImage(frontCanvas.toDataURL('image/png'), 'PNG', 0, 0, badgeW, badgeH, undefined, 'FAST');
        // Page 2: Back
        pdf.addPage([badgeW, badgeH], 'portrait');
        pdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, badgeW, badgeH, undefined, 'FAST');
        pdf.save(`${cleanEmpId}_ID_Card_Both_Pages.pdf`);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not export ID card as PDF. Please try again or use browser print.');
    } finally {
      if (prevActiveSide !== 'both') {
        setActiveSide(prevActiveSide);
      }
      setIsExporting(false);
      setExportStatusText('');
    }
  };

  // ─── IMAGE EXPORT ENGINE (High-Resolution PNG) ─────────────────────────
  const exportImage = async (target: 'front' | 'back' | 'both') => {
    setIsExporting(true);
    setExportDropdownOpen(false);
    setExportStatusText(`Rendering ${target.toUpperCase()} Image...`);

    const prevActiveSide = activeSide;
    if (activeSide !== 'both') {
      setActiveSide('both');
      await new Promise((r) => setTimeout(r, 120));
    }

    try {
      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const frontEl = document.getElementById('id-card-front-element');
      const backEl = document.getElementById('id-card-back-element');

      await waitForImages(frontEl);
      await waitForImages(backEl);

      const canvasOptions = {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 340,
        height: 520,
        logging: false,
        onclone: (clonedDoc: Document) => {
          const cFront = clonedDoc.getElementById('id-card-front-element');
          const cBack = clonedDoc.getElementById('id-card-back-element');
          [cFront, cBack].forEach((el) => {
            if (el) {
              el.style.position = 'relative';
              el.style.left = '0';
              el.style.top = '0';
              el.style.opacity = '1';
              el.style.visibility = 'visible';
              el.style.display = 'flex';
              el.style.boxShadow = 'none';
              el.style.transform = 'none';
            }
          });
        }
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

        const padding = 48;
        const combined = document.createElement('canvas');
        combined.width = frontCanvas.width + backCanvas.width + padding * 3;
        combined.height = Math.max(frontCanvas.height, backCanvas.height) + padding * 2;
        const ctx = combined.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, combined.width, combined.height);
          ctx.drawImage(frontCanvas, padding, padding);
          ctx.drawImage(backCanvas, frontCanvas.width + padding * 2, padding);
          downloadDataUrl(combined.toDataURL('image/png'), `${cleanEmpId}_ID_Card_Dual.png`);
        }
      }
    } catch (err) {
      console.error('Error exporting image:', err);
      alert('Could not export ID card as image. Please try again.');
    } finally {
      if (prevActiveSide !== 'both') {
        setActiveSide(prevActiveSide);
      }
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
          className={`id-card-badge id-card-front ${activeSide === 'back' ? 'hidden' : 'flex'}`}
          style={{
            width: '340px',
            height: '520px',
            minWidth: '340px',
            maxWidth: '340px',
            minHeight: '520px',
            maxHeight: '520px',
            boxSizing: 'border-box',
            display: activeSide === 'back' ? 'none' : 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            background: 'linear-gradient(155deg, #ffffff 0%, #f8fafc 52%, #e2e8f0 100%)',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
            padding: '30px 20px 16px 20px',
            position: 'relative',
            overflow: 'hidden',
            color: '#0f172a'
          }}
        >
          {/* Top Lanyard Punch Slot Visual Indicator */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '46px',
              height: '5px',
              borderRadius: '9999px',
              background: '#cbd5e1',
              border: '1px solid #94a3b8',
              zIndex: 10
            }}
          />

          {/* Micro-Holographic Security Banner Across Top */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(90deg, #06b6d4 0%, #a855f7 35%, #10b981 70%, #f59e0b 100%)',
              zIndex: 1
            }}
          />

          {/* Header: Company Seal, Name & Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '6px',
              paddingBottom: '10px',
              borderBottom: '1px solid #e2e8f0',
              position: 'relative',
              zIndex: 10
            }}
          >
            {/* Logo + Company Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  minWidth: '38px',
                  maxWidth: '38px',
                  minHeight: '38px',
                  maxHeight: '38px',
                  background: '#09090b',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <img
                  src="/images/Markdot logo white.png"
                  alt="Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 900,
                    letterSpacing: '0.5px',
                    color: '#09090b',
                    textTransform: 'uppercase',
                    lineHeight: '1.2',
                    margin: 0
                  }}
                >
                  MARKDOT INTELLECT
                </h3>
                <span
                  style={{
                    fontSize: '7.5px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    color: '#0369a1',
                    textTransform: 'uppercase',
                    display: 'block',
                    marginTop: '2px'
                  }}
                >
                  OFFICIAL CREDENTIAL
                </span>
              </div>
            </div>

            {/* Employment Status Badge */}
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: '7px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  display: 'block',
                  color: '#94a3b8'
                }}
              >
                STATUS
              </span>
              <span
                style={{
                  fontSize: '8px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  display: 'inline-block',
                  marginTop: '2px'
                }}
              >
                {user.employmentType || 'FULL-TIME'}
              </span>
            </div>
          </div>

          {/* Portrait & Core Identity Block */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              margin: 'auto 0',
              padding: '6px 0',
              gap: '8px'
            }}
          >
            <div style={{ position: 'relative' }}>
              {/* Photo Frame */}
              <div
                style={{
                  width: '114px',
                  height: '144px',
                  minWidth: '114px',
                  maxWidth: '114px',
                  minHeight: '144px',
                  maxHeight: '144px',
                  borderRadius: '12px',
                  border: '2px solid #0891b2',
                  padding: '3px',
                  background: '#ffffff',
                  boxShadow: '0 4px 14px rgba(8, 145, 178, 0.2)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {user.profilePhoto ? (
                  <img
                    src={user.profilePhoto}
                    alt={user.fullName}
                    style={{
                      width: '100%',
                      height: '100%',
                      minWidth: '100%',
                      maxWidth: '100%',
                      minHeight: '100%',
                      maxHeight: '100%',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      display: 'block'
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#f1f5f9',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8'
                    }}
                  >
                    <UserIcon style={{ width: '44px', height: '44px', strokeWidth: 1.5, color: '#cbd5e1' }} />
                    <span style={{ fontSize: '7.5px', fontWeight: 800, marginTop: '4px', textTransform: 'uppercase' }}>
                      NO PHOTO
                    </span>
                  </div>
                )}
              </div>

              {/* Security Shield Icon Pill */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-5px',
                  right: '-5px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#0891b2',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
              >
                <ShieldCheck style={{ width: '15px', height: '15px' }} />
              </div>
            </div>

            {/* Name, Title, and ID */}
            <div style={{ padding: '0 8px' }}>
              <h2
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  color: '#09090b',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  lineHeight: '1.2',
                  margin: 0
                }}
              >
                {user.fullName}
              </h2>
              <p
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: '#0369a1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  margin: '3px 0 0 0'
                }}
              >
                {user.jobTitle || 'TECHNICAL OPERATOR'}
              </p>
              <div
                style={{
                  display: 'inline-block',
                  marginTop: '5px',
                  padding: '2px 10px',
                  borderRadius: '9999px',
                  background: '#e2e8f0',
                  fontSize: '9.5px',
                  fontWeight: 900,
                  color: '#0f172a',
                  letterSpacing: '0.8px',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace"
                }}
              >
                EMP ID: {user.employeeId}
              </div>
            </div>
          </div>

          {/* Key Quick Fields Strip (Blood Group & Joining Date) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '9px',
              boxSizing: 'border-box'
            }}
          >
            <div>
              <span
                style={{
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  display: 'block',
                  fontSize: '7px',
                  letterSpacing: '0.5px'
                }}
              >
                BLOOD GROUP
              </span>
              <strong
                style={{
                  color: '#e11d48',
                  fontWeight: 900,
                  fontSize: '11.5px',
                  display: 'block',
                  marginTop: '1px'
                }}
              >
                {user.bloodGroup || 'O+'}
              </strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  color: '#64748b',
                  textTransform: 'uppercase',
                  fontWeight: 800,
                  display: 'block',
                  fontSize: '7px',
                  letterSpacing: '0.5px'
                }}
              >
                JOINING DATE
              </span>
              <strong
                style={{
                  color: '#334155',
                  fontWeight: 800,
                  fontSize: '9.5px',
                  display: 'block',
                  marginTop: '1px'
                }}
              >
                {formattedJoining}
              </strong>
            </div>
          </div>

          {/* Front Footer: Barcode Simulation & Serial */}
          <div
            style={{
              paddingTop: '8px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '8px',
              color: '#64748b'
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                letterSpacing: '1px',
                fontSize: '7.5px',
                fontWeight: 700,
                color: '#64748b'
              }}
            >
              // CR80-{user.employeeId}-MARKDOT
            </div>
            {/* Barcode lines */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5px',
                height: '18px',
                opacity: 0.8
              }}
            >
              {[3, 1, 4, 1, 5, 2, 4, 1, 3, 2, 5, 1, 4, 2, 1, 3, 5, 2].map((w, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#09090b',
                    height: '100%',
                    width: `${w * 0.8}px`
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* ── CARD BACK (CR80 Standard Detail Verification Side) ── */}
        {/* ======================================================= */}
        <div
          id="id-card-back-element"
          className={`id-card-badge id-card-back ${activeSide === 'front' ? 'hidden' : 'flex'}`}
          style={{
            width: '340px',
            height: '520px',
            minWidth: '340px',
            maxWidth: '340px',
            minHeight: '520px',
            maxHeight: '520px',
            boxSizing: 'border-box',
            display: activeSide === 'front' ? 'none' : 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            background: 'linear-gradient(155deg, #ffffff 0%, #f8fafc 52%, #e2e8f0 100%)',
            borderRadius: '16px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
            padding: '30px 20px 16px 20px',
            position: 'relative',
            overflow: 'hidden',
            color: '#0f172a'
          }}
        >
          {/* Top Lanyard Slot */}
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '46px',
              height: '5px',
              borderRadius: '9999px',
              background: '#cbd5e1',
              border: '1px solid #94a3b8',
              zIndex: 10
            }}
          />

          {/* Micro-Holographic Security Banner */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '8px',
              background: 'linear-gradient(90deg, #f59e0b 0%, #10b981 35%, #a855f7 70%, #06b6d4 100%)',
              zIndex: 1
            }}
          />

          {/* Back Header */}
          <div
            style={{
              paddingTop: '6px',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '8px',
              position: 'relative',
              zIndex: 10
            }}
          >
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: 900,
                color: '#0369a1',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                display: 'block'
              }}
            >
              EMPLOYEE CREDENTIAL & EMERGENCY RECORD
            </span>
            <p
              style={{
                fontSize: '7px',
                color: '#64748b',
                textTransform: 'uppercase',
                fontWeight: 600,
                marginTop: '2px',
                margin: 0
              }}
            >
              Property of Markdot Intellect Inc. • Official Identification
            </p>
          </div>

          {/* Required Detailed Fields (DOB, Phone, Emergency Contact, Address) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              margin: 'auto 0',
              fontSize: '9.5px'
            }}
          >
            {/* Date of Birth */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '5px',
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <Calendar style={{ width: '12px', height: '12px', color: '#0284c7' }} />
              </div>
              <div>
                <span
                  style={{
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    fontSize: '7px',
                    display: 'block',
                    letterSpacing: '0.5px'
                  }}
                >
                  DATE OF BIRTH (DOB)
                </span>
                <span style={{ color: '#09090b', fontWeight: 800, fontSize: '9.5px' }}>{formattedDob}</span>
              </div>
            </div>

            {/* Primary Contact Number */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '5px',
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <Phone style={{ width: '12px', height: '12px', color: '#0284c7' }} />
              </div>
              <div>
                <span
                  style={{
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    fontSize: '7px',
                    display: 'block',
                    letterSpacing: '0.5px'
                  }}
                >
                  PRIMARY CONTACT NUMBER
                </span>
                <span style={{ color: '#09090b', fontWeight: 800, fontSize: '9.5px' }}>
                  {user.phone || '+91 (Not Provided)'}
                </span>
              </div>
            </div>

            {/* Emergency Contact */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '7px 9px',
                borderRadius: '8px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#9f1239'
              }}
            >
              <AlertCircle style={{ width: '14px', height: '14px', color: '#e11d48', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <span
                  style={{
                    color: '#e11d48',
                    textTransform: 'uppercase',
                    fontWeight: 900,
                    fontSize: '7px',
                    display: 'block',
                    letterSpacing: '0.5px'
                  }}
                >
                  IN CASE OF EMERGENCY
                </span>
                <div style={{ fontWeight: 800, fontSize: '9.5px', marginTop: '1px' }}>
                  {user.emergencyContactNumber || 'Not Provided'}
                  {user.emergencyContactName && (
                    <span style={{ color: '#be123c', fontWeight: 600, marginLeft: '4px' }}>
                      ({user.emergencyContactName})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Residential Address */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '5px',
                  background: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px'
                }}
              >
                <MapPin style={{ width: '12px', height: '12px', color: '#0284c7' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span
                  style={{
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    fontSize: '7px',
                    display: 'block',
                    letterSpacing: '0.5px'
                  }}
                >
                  RESIDENTIAL ADDRESS
                </span>
                <span
                  style={{
                    color: '#1e293b',
                    fontWeight: 600,
                    fontSize: '8.5px',
                    lineHeight: '1.3',
                    display: 'block',
                    marginTop: '1px'
                  }}
                >
                  {user.address || 'Address on file with Human Resources department.'}
                </span>
              </div>
            </div>
          </div>

          {/* Verification QR & Authentication Section */}
          <div
            style={{
              padding: '9px 12px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: '7.5px',
                  fontWeight: 900,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  display: 'block'
                }}
              >
                PUBLIC VERIFICATION QR
              </span>
              <span
                style={{
                  fontSize: '8.5px',
                  fontWeight: 800,
                  color: '#09090b',
                  display: 'block',
                  marginTop: '2px'
                }}
              >
                Scan to verify employee identity
              </span>
              <span
                style={{
                  fontSize: '7.5px',
                  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                  color: '#0369a1',
                  fontWeight: 800,
                  display: 'block',
                  marginTop: '3px'
                }}
              >
                EMP ID: {user.employeeId}
              </span>
            </div>
            {/* QR Box - 64px square */}
            <div
              style={{
                width: '64px',
                height: '64px',
                minWidth: '64px',
                maxWidth: '64px',
                minHeight: '64px',
                maxHeight: '64px',
                background: '#ffffff',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>

          {/* Back Footer: Legal Terms & System Verification Note */}
          <div
            style={{
              paddingTop: '8px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              fontSize: '7px',
              color: '#64748b'
            }}
          >
            <div style={{ maxWidth: '150px', lineHeight: '1.25', fontSize: '6.5px' }}>
              If found, please return to: Markdot HQ, Connect HR Dept. Valid until revoked.
            </div>
            {/* System Generated Verification in [siteURL]/verify */}
            <div style={{ textAlign: 'right', maxWidth: '160px' }}>
              <div
                style={{
                  fontSize: '7px',
                  fontWeight: 900,
                  color: '#09090b',
                  lineHeight: '1.2',
                  textTransform: 'uppercase'
                }}
              >
                This is system generated
              </div>
              <div
                style={{
                  fontSize: '6.5px',
                  fontWeight: 800,
                  color: '#0369a1',
                  lineHeight: '1.2',
                  wordBreak: 'break-all',
                  marginTop: '1px'
                }}
              >
                verify in {siteUrl.replace(/^https?:\/\//, '')}/verify
              </div>
              <span
                style={{
                  fontSize: '5.5px',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  display: 'block',
                  marginTop: '2px',
                  letterSpacing: '0.8px'
                }}
              >
                AUTHORIZED ISSUER
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
