'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-mono flex flex-col justify-between py-12 px-6 relative select-text">
      
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{
        backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)`,
        backgroundSize: '24px 24px'
      }} />

      <div className="max-w-7xl mx-auto w-full relative z-10 py-6 px-4 md:px-12">
        
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors mb-8 cursor-pointer select-none">
          <ArrowLeft className="w-4 h-4" />
          <span>BACK TO LOGIN GATEWAY</span>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-8 select-none">
          <div className="p-3 bg-red-50 text-red-500 rounded-xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">// TERMS_OF_SERVICE</h1>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Markdot Intellect Operator Deck</p>
          </div>
        </div>

        {/* Content body */}
        <div className="space-y-6 text-xs text-slate-600 leading-relaxed font-mono">
          <div>
            <span className="text-[10px] font-bold text-slate-900 block uppercase mb-1">// Effective Date</span>
            <p className="text-slate-800 font-bold">June 28, 2026</p>
          </div>

          <p>
            By accessing and logging into the Markdot Dotcore Console, you agree to comply with and be bound by these Terms of Service.
          </p>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 1. Authorized Console Access Only</h2>
            <p>
              This command console is restricted to registered operators and system administrators. You are responsible for safeguarding your credentials. Sharing operator codes or logging in under another operator's identity is strictly prohibited.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 2. Telemetry & Clock-In Restrictions</h2>
            <p>
              Shift records, break durations, and leave logs must represent truthful, real-time metrics. Falsification of attendance parameters or circumventing early shift boundary controls is a violation of operating rules.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 3. System Limitation of Liability</h2>
            <p>
              Files saved from the document processor are written directly to your local storage. We are not responsible for any file loss or corruption resulting from filesystem permissions or browser cache clearance.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 4. Governing Law</h2>
            <p>
              These terms are governed by the IT Act and the laws applicable in Coimbatore, Tamil Nadu, India.
            </p>
          </div>
        </div>

      </div>

      {/* Footer copyright */}
      <footer className="text-center text-[9px] uppercase tracking-wider text-slate-400 mt-12 relative z-10 select-none">
        &copy; 2026 Markdot Intellect. Coimbatore, Tamil Nadu, India.
      </footer>

    </div>
  );
}
