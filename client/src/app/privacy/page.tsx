'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyPolicyPage() {
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
            <h1 className="text-xl font-black text-slate-900 tracking-tight">// PRIVACY_POLICY</h1>
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
            Markdot Intellect ("we", "our", or "us"), located at <strong>2, Crystal Plaza, Thudiyalur Main Road, Saravanampatti, Coimbatore, Tamil Nadu, India</strong>, is dedicated to protecting the privacy of our platform operators and customers.
          </p>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 1. Information We Collect</h2>
            <p>
              We collect credentials necessary for account establishment and session logging, including usernames, emails, and encrypted password hashes. We also log shift boundaries, leaves, and tasks allocated to your operator identity.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 2. Local File Storage Policy (Operational Notes)</h2>
            <p>
              Documents, memos, and logs composed inside the <strong>Operational Notes (Word-Mode)</strong> editor are processed and written directly on your local system filesystem. We do not store, scan, or transmit these notes to our databases or servers. All notes remain completely offline and under your local control.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 3. Data Residency and Security</h2>
            <p>
              All personal and shift records are stored securely in encrypted databases. We deploy industry-standard RSA and AES encryption suites to prevent unauthorized network interception.
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <h2 className="font-bold text-slate-900 text-sm uppercase">// 4. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding how your data is handled on our gateway, please contact us via email at: <strong>info@markdotintellect.com</strong>.
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
