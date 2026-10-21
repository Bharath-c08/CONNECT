'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  ShieldCheck,
  CreditCard,
  Phone,
  AlertCircle,
  MapPin,
  Calendar,
  User as UserIcon,
  RotateCw,
  QrCode,
  Sparkles,
  Download
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
  const [qrSvg, setQrSvg] = useState<string>('');

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

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
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
      {/* Action Header / Controls Toolbar */}
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

        <div className="flex items-center gap-2">
          {/* Side Toggle */}
          <div className="hidden sm:flex rounded-lg border border-white/10 overflow-hidden text-[9px] font-bold">
            <button
              type="button"
              onClick={() => setActiveSide('both')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'both' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('front')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'front' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400'
              }`}
            >
              Front Only
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('back')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                activeSide === 'back' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-900 text-slate-400'
              }`}
            >
              Back Only
            </button>
          </div>

          {/* Single-Click Print Action */}
          <button
            type="button"
            onClick={handlePrint}
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

      {/* ── PRINT CONTAINER: CR80 BADGES ── */}
      <div id="printable-id-card-zone" className="print-badge-container flex flex-wrap items-center justify-center gap-8 py-4">
        {/* ======================================================== */}
        {/* ── CARD FRONT (CR80 Standard Proportion 85.6mm x 54mm) ── */}
        {/* ======================================================== */}
        {(activeSide === 'both' || activeSide === 'front') && (
          <div
            className="id-card-badge id-card-front w-[340px] h-[520px] rounded-2xl relative overflow-hidden flex flex-col justify-between p-5 border shadow-2xl text-slate-900 select-text"
            style={{
              background: 'linear-gradient(145deg, #ffffff 0%, #f1f5f9 55%, #e2e8f0 100%)',
              borderColor: '#cbd5e1',
              boxShadow: '0 20px 45px rgba(0,0,0,0.35)'
            }}
          >
            {/* Top Lanyard Punch Slot Visual indicator */}
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
        )}

        {/* ======================================================= */}
        {/* ── CARD BACK (CR80 Standard Detail Verification Side) ── */}
        {/* ======================================================= */}
        {(activeSide === 'both' || activeSide === 'back') && (
          <div
            className="id-card-badge id-card-back w-[340px] h-[520px] rounded-2xl relative overflow-hidden flex flex-col justify-between p-5 border shadow-2xl text-slate-900 select-text"
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
                  Scan to confirm authenticity
                </span>
                <span className="text-[6.5px] font-mono text-cyan-800 break-all block mt-1">
                  ID: EMP-{user.employeeId}
                </span>
              </div>
              <div
                className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-300 shrink-0 flex items-center justify-center shadow-sm"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>

            {/* Back Footer: Legal Terms & Authorized Signatory */}
            <div className="pt-2 border-t border-slate-200 flex items-end justify-between text-[7px] text-slate-500">
              <div className="max-w-[180px] leading-tight">
                If found, please return to: Markdot HQ, Connect HR Dept. Valid until revoked.
              </div>
              <div className="text-center">
                <div className="font-script text-[11px] text-slate-800 italic underline">Auth Signatory</div>
                <span className="text-[6px] font-bold uppercase text-slate-400 block">AUTHORIZED ISSUER</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
