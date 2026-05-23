'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  User as UserIcon,
  Calendar,
  Download,
  RefreshCw,
  Binary,
  AlertCircle,
  CheckCircle,
  IndianRupee,
  Clock,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';
import { generatePayslipPDF } from '../../../utils/export';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getCurrentYearRange() {
  const now = new Date();
  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
    years.push(String(y));
  }
  return years;
}

export default function PayslipPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [staffList, setStaffList]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Selections
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth]       = useState(String(new Date().getMonth() + 1));  // 1-12
  const [selectedYear, setSelectedYear]         = useState(String(new Date().getFullYear()));

  // Deduction overrides
  const [tdsPercent, setTdsPercent] = useState(10);
  const [pfPercent,  setPfPercent]  = useState(12);

  // Fetched payslip data
  const [payslipData, setPayslipData] = useState<any>(null);

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    if (usr?.role === 'admin' || usr?.role === 'superadmin') {
      fetchStaff();
    }
  }, []);

  const fetchStaff = async () => {
    try {
      const data = await apiRequest('/users');
      setStaffList(data);
    } catch (err) {
      console.error('Error fetching staff list:', err);
    }
  };

  const handlePreview = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    setPayslipData(null);

    try {
      const data = await apiRequest(
        `/clock/admin/payslip-data?userId=${selectedEmployee}&month=${selectedMonth}&year=${selectedYear}`
      );
      setPayslipData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payslip data.');
    } finally {
      setLoading(false);
    }
  };

  const buildPayslipPayload = useCallback(() => {
    if (!payslipData) return null;
    const { employee, overtimePay, totalMinutes, totalOTMinutes, workingDays } = payslipData;

    // Basic pay is the fixed monthly salary from the employee record
    const basicPay     = employee.basicPay || 0;
    const grossEarnings = basicPay + overtimePay;
    const tds = (grossEarnings * tdsPercent) / 100;
    const pf  = (grossEarnings * pfPercent)  / 100;
    const totalDeductions = tds + pf;
    const netPay = grossEarnings - totalDeductions;

    return {
      employee: {
        fullName:       employee.fullName,
        employeeId:     employee.employeeId,
        jobTitle:       employee.jobTitle || '—',
        employmentType: employee.employmentType,
        email:          employee.email,
        joiningDate:    employee.joiningDate
          ? new Date(employee.joiningDate).toLocaleDateString()
          : '—',
        basicPay,
        overtimeEligible: employee.overtimeEligible,
      },
      period: {
        month: MONTHS[parseInt(selectedMonth) - 1],
        year:  selectedYear,
      },
      earnings: {
        basicPay,
        overtimePay,
        grossEarnings,
      },
      deductions: {
        tds,
        pf,
        totalDeductions,
      },
      netPay,
      workingDays,
      totalHours: totalMinutes   / 60,
      otHours:    totalOTMinutes / 60,
    };
  }, [payslipData, tdsPercent, pfPercent, selectedMonth, selectedYear]);

  const handleDownloadPDF = async () => {
    const payload = buildPayslipPayload();
    if (!payload) return;
    setGenerating(true);
    try {
      await generatePayslipPDF(payload);
      setSuccess('Payslip PDF generated successfully.');
    } catch (err: any) {
      setError('Failed to generate PDF: ' + (err.message || err));
    } finally {
      setGenerating(false);
    }
  };

  if (currentUser && currentUser.role === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4 font-mono select-none">
        <div className="w-16 h-16 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 animate-pulse">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-extrabold tracking-widest text-rose-500 uppercase">// SYS_CORE: ACCESS_DENIED</h2>
        <p className="text-slate-400 text-xs max-w-sm tracking-wide">
          PAYSLIP GENERATION IS RESTRICTED TO SYSTEM ADMINS AND CONTROLLERS ONLY.
        </p>
      </div>
    );
  }

  const preview = buildPayslipPayload();

  return (
    <div className="flex flex-col gap-8 font-mono">

      {/* Alerts */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// FAULT: {error}</span>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <CheckCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// OK: {success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <FileText className="w-5.5 h-5.5" />
            // PAYSLIP_GENERATOR
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            GENERATE OFFICIAL EMPLOYEE PAYSLIPS WITH EARNINGS, DEDUCTIONS AND NET PAY.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* ── Left: Controls Panel ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={springTransition}
          className="xl:col-span-1 card p-0 overflow-hidden relative"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/40 to-transparent" />
          <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // PAYSLIP_CONFIG</div>

          <div className="p-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#ef4444]" />
              PAYSLIP PARAMETERS
            </h2>
          </div>

          <div className="p-6 space-y-5">
            {/* Employee */}
            <div className="form-group">
              <label className="form-label mb-1 flex items-center gap-1.5">
                <UserIcon className="w-3 h-3" /> EMPLOYEE *
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => { setSelectedEmployee(e.target.value); setPayslipData(null); }}
                className="select w-full"
              >
                <option value="">Select Employee…</option>
                {staffList.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>

            {/* Month + Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> MONTH *
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => { setSelectedMonth(e.target.value); setPayslipData(null); }}
                  className="select w-full"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label mb-1">YEAR *</label>
                <select
                  value={selectedYear}
                  onChange={(e) => { setSelectedYear(e.target.value); setPayslipData(null); }}
                  className="select w-full"
                >
                  {getCurrentYearRange().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deductions */}
            <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-3">DEDUCTION RATES</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label mb-1">TDS %</label>
                  <input
                    type="number"
                    min={0} max={50} step={0.5}
                    value={tdsPercent}
                    onChange={(e) => setTdsPercent(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label mb-1">PF %</label>
                  <input
                    type="number"
                    min={0} max={25} step={0.5}
                    value={pfPercent}
                    onChange={(e) => setPfPercent(Number(e.target.value))}
                    className="input font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handlePreview}
                disabled={loading || !selectedEmployee}
                className="w-full btn btn-secondary h-10 text-[10px] font-extrabold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Binary className="w-3.5 h-3.5" />}
                {loading ? 'LOADING DATA…' : 'PREVIEW PAYSLIP'}
              </motion.button>

              {preview && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleDownloadPDF}
                  disabled={generating}
                  className="w-full btn btn-primary h-10 text-[10px] font-extrabold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {generating ? 'GENERATING PDF…' : 'DOWNLOAD PAYSLIP PDF'}
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Right: Payslip Preview ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.06 }}
          className="xl:col-span-2"
        >
          {!payslipData && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center text-slate-600 select-none">
              <FileText className="w-14 h-14 opacity-20" />
              <p className="text-[10px] uppercase tracking-widest">SELECT AN EMPLOYEE AND PERIOD, THEN CLICK PREVIEW PAYSLIP</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-500 text-[10px] select-none">
              <Binary className="w-7 h-7 text-[#ef4444] animate-spin" />
              <p>FETCHING TIMESHEET TELEMETRY…</p>
            </div>
          )}

          {preview && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition}
              className="card overflow-hidden relative"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              {/* Payslip Header */}
              <div className="relative p-6 border-b flex items-center justify-between"
                style={{ background: 'linear-gradient(135deg, #0e0e14 0%, #14141e 100%)', borderColor: 'var(--border)' }}>
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/50 to-transparent" />
                <div>
                  <img
                    src="/images/Markdot logo white.png"
                    alt="Markdot"
                    className="h-7 object-contain mb-2 opacity-90"
                  />
                  <p className="text-[8px] text-slate-500 font-mono uppercase tracking-widest">
                    Human Resource Management System
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-extrabold text-[#ef4444] uppercase tracking-widest block">PAYSLIP</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}
                  </span>
                  <span className="text-[8px] text-slate-600 font-mono block mt-0.5">
                    Generated: {new Date().toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
                {[
                  ['Name', preview.employee.fullName],
                  ['Employee ID', preview.employee.employeeId],
                  ['Designation', preview.employee.jobTitle],
                  ['Email', preview.employee.email],
                  ['Employment Type', preview.employee.employmentType],
                  ['Date of Joining', preview.employee.joiningDate],
                ].map(([label, value], i) => (
                  <div key={label} className={`px-5 py-3 ${i % 2 === 0 ? 'border-r' : ''}`} style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[8px] text-slate-500 block uppercase tracking-widest">{label}</span>
                    <span className="text-[11px] font-semibold text-slate-200">{value}</span>
                  </div>
                ))}
              </div>

              {/* Work Summary */}
              <div className="grid grid-cols-4 gap-0 border-b" style={{ borderColor: 'var(--border)' }}>
                {[
                  { icon: Clock,        label: 'Working Days',  value: String(preview.workingDays),              color: 'text-indigo-400' },
                  { icon: Clock,        label: 'Total Hours',   value: `${preview.totalHours.toFixed(2)} hrs`,  color: 'text-blue-400' },
                  { icon: TrendingUp,   label: 'OT Hours',      value: `${preview.otHours.toFixed(2)} hrs`,    color: 'text-amber-400' },
                  { icon: IndianRupee,  label: 'OT Pay',        value: `₹${preview.earnings.overtimePay.toFixed(2)}`, color: 'text-emerald-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="p-4 text-center border-r last:border-r-0" style={{ borderColor: 'var(--border)' }}>
                    <Icon className={`w-4 h-4 mx-auto mb-1.5 ${color}`} />
                    <span className="text-[8px] text-slate-500 block uppercase tracking-wide">{label}</span>
                    <span className={`text-[12px] font-extrabold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Earnings & Deductions */}
              <div className="grid grid-cols-2 border-b" style={{ borderColor: 'var(--border)' }}>
                {/* Earnings */}
                <div className="border-r" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-5 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.05)' }}>
                    <span className="text-[9px] font-extrabold text-[#ef4444] uppercase tracking-widest">EARNINGS</span>
                  </div>
                  {[
                    ['Basic Pay (Monthly)', preview.earnings.basicPay],
                    ['Overtime Pay', preview.earnings.overtimePay],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex justify-between px-5 py-2.5 border-b last:border-b-0 text-[11px]" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-slate-400">{label}</span>
                      <span className="text-slate-200 font-mono font-semibold">₹{Number(val).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 text-[11px] font-extrabold" style={{ background: 'rgba(52,211,153,0.07)' }}>
                    <span className="text-emerald-400">GROSS EARNINGS</span>
                    <span className="text-emerald-300 font-mono">₹{preview.earnings.grossEarnings.toFixed(2)}</span>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div className="px-5 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.05)' }}>
                    <span className="text-[9px] font-extrabold text-[#ef4444] uppercase tracking-widest">DEDUCTIONS</span>
                  </div>
                  {[
                    [`TDS @ ${tdsPercent}%`, preview.deductions.tds],
                    [`PF @ ${pfPercent}%`, preview.deductions.pf],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex justify-between px-5 py-2.5 border-b last:border-b-0 text-[11px]" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-slate-400">{label}</span>
                      <span className="text-rose-300 font-mono font-semibold">-₹{Number(val).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-5 py-3 text-[11px] font-extrabold" style={{ background: 'rgba(239,68,68,0.07)' }}>
                    <span className="text-rose-400">TOTAL DEDUCTIONS</span>
                    <span className="text-rose-300 font-mono">-₹{preview.deductions.totalDeductions.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay */}
              <div
                className="flex items-center justify-between px-6 py-5"
                style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.06) 100%)' }}
              >
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">NET PAY</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {MONTHS[parseInt(selectedMonth) - 1]} {selectedYear}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-white font-mono tracking-wider">
                    ₹{preview.netPay.toFixed(2)}
                  </span>
                  <span className="text-[8px] text-slate-500 block mt-0.5 font-mono">
                    AFTER TDS & PF DEDUCTIONS
                  </span>
                </div>
              </div>

              {/* Footer note */}
              <div className="px-6 py-3 border-t text-center" style={{ borderColor: 'var(--border)' }}>
                <p className="text-[8px] text-slate-600 font-mono">
                  This is a system-generated payslip. Click "Download Payslip PDF" to save a signed copy.
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
