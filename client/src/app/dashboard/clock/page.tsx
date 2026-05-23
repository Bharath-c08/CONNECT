'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Filter,
  TrendingUp,
  UserCheck,
  Binary,
  Layers,
  Activity,
  Maximize2,
  Download,
  FileText
} from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../../utils/export';
import { apiRequest, getCurrentUser } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function TimesheetsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'personal' | 'admin_history' | 'admin_live'>('personal');

  // Filters state (Admin)
  const [selectedStaff, setSelectedStaff] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportStatusFilter, setExportStatusFilter] = useState('all');

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    
    if (usr) {
      if (usr.role === 'admin' || usr.role === 'superadmin') {
        setTab('admin_live'); // Default to live roster for admins
        fetchAdminData();
      } else {
        setTab('personal');
        fetchPersonalData();
      }
    }
  }, []);

  const fetchPersonalData = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/clock/history');
      setSessions(data);
    } catch (err) {
      console.error('Error fetching personal shift history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch live clocked in users
      const liveData = await apiRequest('/clock/admin/live');
      setLiveSessions(liveData);

      // 2. Fetch full historical roster
      const rosterData = await apiRequest('/clock/admin/roster');
      setSessions(rosterData);

      // 3. Fetch staff list for dropdown filtering
      const employees = await apiRequest('/users');
      setStaffList(employees);
    } catch (err) {
      console.error('Error fetching administrator timesheet reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    setLoading(true);
    try {
      let query = '';
      const params = [];
      if (selectedStaff) params.push(`userId=${selectedStaff}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      
      if (params.length > 0) {
        query = `?${params.join('&')}`;
      }

      const rosterData = await apiRequest(`/clock/admin/roster${query}`);
      setSessions(rosterData);
    } catch (err) {
      console.error('Error applying filters:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedStaff('');
    setStartDate('');
    setEndDate('');
    fetchAdminData();
  };

  // Aggregates calculation helper
  const getAggregates = () => {
    let totalMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalRegularPay = 0;
    let totalOvertimePay = 0;

    sessions.forEach(session => {
      if (session.status === 'completed') {
        totalMinutes += session.duration || 0;
        totalOvertimeMinutes += session.overtimeMinutes || 0;
        totalRegularPay += session.regularPay || 0;
        totalOvertimePay += session.overtimePay || 0;
      }
    });

    const totalHours = totalMinutes / 60;
    const totalOTHours = totalOvertimeMinutes / 60;
    const grossPay = totalRegularPay + totalOvertimePay;

    return {
      hours: totalHours.toFixed(2),
      otHours: totalOTHours.toFixed(2),
      regularPay: totalRegularPay.toFixed(2),
      otPay: totalOvertimePay.toFixed(2),
      grossPay: grossPay.toFixed(2)
    };
  };

  const handleExportTimesheets = async () => {
    const filtered = sessions.filter((s) => {
      if (exportStatusFilter === 'all') return true;
      return s.status === exportStatusFilter;
    });

    const columns = [
      { header: 'Employee', key: 'employee' },
      { header: 'Employee ID', key: 'employeeId' },
      { header: 'Date', key: 'date' },
      { header: 'Clock In', key: 'clockIn' },
      { header: 'Clock Out', key: 'clockOut' },
      { header: 'Duration (hrs)', key: 'duration' },
      { header: 'OT (hrs)', key: 'overtime' },
      { header: 'Regular Pay (₹)', key: 'regularPay' },
      { header: 'OT Pay (₹)', key: 'otPay' },
      { header: 'Gross Pay (₹)', key: 'grossPay' },
      { header: 'Status', key: 'status' },
    ];

    const rows = filtered.map((s) => ({
      employee: s.userId?.fullName || '',
      employeeId: s.userId?.employeeId || '',
      date: new Date(s.clockIn).toLocaleDateString(),
      clockIn: new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      clockOut: s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      duration: s.status === 'completed' ? (s.duration / 60).toFixed(2) : '',
      overtime: s.overtimeMinutes ? (s.overtimeMinutes / 60).toFixed(2) : '0',
      regularPay: s.regularPay?.toFixed(2) ?? '',
      otPay: s.overtimePay?.toFixed(2) ?? '',
      grossPay: s.status === 'completed' ? ((s.regularPay || 0) + (s.overtimePay || 0)).toFixed(2) : '',
      status: s.status || '',
    }));

    const filename = `timesheets_${new Date().toISOString().split('T')[0]}`;
    if (exportFormat === 'csv') {
      exportToCSV(rows, columns, filename);
    } else {
      await exportToPDF(rows, columns, 'Timesheet Report', filename);
    }
    setExportModalOpen(false);
  };

  const stats = getAggregates();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="flex flex-col gap-8 font-mono">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <Clock className="w-5.5 h-5.5 animate-pulse" />
            // TIMESHEETS_ROSTER
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            OPERATOR SHIFT TELEMETRY, LOGISTICS READOUTS, AND CONTRACT WAGES AUDIT.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto select-none">
          <div className="tab-bar">
            {isAdmin && (
              <>
                <button
                  onClick={() => { setTab('admin_live'); fetchAdminData(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_live' ? 'active' : ''}`}
                >
                  LIVE MONITOR
                </button>
                <button
                  onClick={() => { setTab('admin_history'); fetchAdminData(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_history' ? 'active' : ''}`}
                >
                  ROSTER HISTORIC
                </button>
              </>
            )}
            <button
              onClick={() => { setTab('personal'); fetchPersonalData(); }}
              className={`tab-btn relative cursor-pointer ${tab === 'personal' ? 'active' : ''}`}
            >
              OPERATOR LOGS
            </button>
          </div>

          {/* Export button — shown only on history tabs, not live monitor */}
          {isAdmin && tab !== 'admin_live' && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setExportModalOpen(true)}
              className="btn btn-secondary h-9 px-3 text-[10px] cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Export timesheet data"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT
            </motion.button>
          )}
        </div>
      </motion.div>


      {/* Aggregate telemetry capsules */}
      {tab !== 'admin_live' && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none"
        >
          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // LOAD_HRS</div>
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Regular Hours</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{stats.hours} hrs</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // OT_HRS</div>
            <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Overtime Hours</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{stats.otHours} hrs</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // OT_VAL</div>
            <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <span className="text-emerald-400 font-bold text-sm">₹</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">OT Wages</span>
              <strong className="text-base font-extrabold text-emerald-400 mt-0.5 block font-mono">₹{stats.otPay}</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5" style={{ borderColor: 'var(--border-strong)' }}>
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // GROSS</div>
            <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
              <span className="text-[#ef4444] font-bold text-sm">₹</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Gross Earnings</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">₹{stats.grossPay}</strong>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Admin Filters Row */}
      {tab === 'admin_history' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 rounded bg-zinc-950/40 select-none"
          style={{ border: '1px solid var(--border)' }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">FILTER OPERATOR</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="select"
            >
              <option value="">ALL REGISTERED STAFF</option>
              {staffList.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.fullName.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">FROM TIMESTAMP</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">TO TIMESTAMP</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>

          <div className="flex items-end gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleApplyFilters}
              className="flex-1 btn btn-primary text-xs flex items-center justify-center gap-2 h-11 border-0"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>APPLY FILTERS</span>
            </motion.button>
            <button
              onClick={handleClearFilters}
              className="btn btn-secondary h-11 px-4 text-xs cursor-pointer"
              title="Reset configuration filters"
            >
              RESET
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-slate-500 text-[10px] select-none">
          <Binary className="w-7 h-7 text-cyan-400 animate-spin" />
          <p>DECODING STREAM TELEMETRY...</p>
        </div>
      ) : (
        <>
          {/* Live Monitor Panel */}
          {tab === 'admin_live' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3 select-none" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>ACTIVE_OPERATORS_ONLINE ({liveSessions.length})</span>
                </h3>
              </div>

              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {liveSessions.map((session) => (
                  <motion.div
                    key={session._id}
                    variants={itemVariants}
                    whileHover={{ y: -2 }}
                    className="card flex flex-col justify-between relative overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border)'
                    }}
                  >
                    <div className="absolute top-2 right-2 shrink-0 select-none">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div className="absolute top-1 left-2 text-[6px] opacity-20">UPLINK // NODE_STREAM</div>

                    <div>
                      <div className="mb-4 select-none pt-1">
                        <h4 className="font-extrabold text-white text-sm tracking-widest">{session.userId?.fullName.toUpperCase()}</h4>
                        <p className="text-slate-400 text-[10px] mt-0.5 tracking-wider uppercase">{session.userId?.jobTitle || 'UNASSIGNED ROLE'}</p>
                      </div>

                      <div className="space-y-2 text-[11px] text-slate-400 pt-3 border-t font-mono" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex justify-between">
                          <span className="text-slate-500">OPERATOR_ID:</span>
                          <span className="text-white font-bold">{session.userId?.employeeId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">INITIATE_TIME:</span>
                          <span className="text-white">{new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        {session.location?.address && (
                          <div className="flex justify-between border-t pt-2 mt-2" style={{ borderColor: 'var(--border)' }}>
                            <span className="text-slate-500">COORDINATES:</span>
                            <span className="text-[10px] text-right truncate max-w-[150px] text-emerald-400">{session.location.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {liveSessions.length === 0 && (
                  <div className="col-span-full text-center py-16 text-slate-500 text-xs italic select-none">
                    NO OPERATORS ARE CURRENTLY TRANSMITTING ACTIVE SHIFT LOGS.
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* Historical Timesheets Telemetry Logs */}
          {tab !== 'admin_live' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition}
              className="card overflow-hidden p-0 relative"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)'
              }}
            >
              <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // HISTORIC_LOGS_STREAM</div>
              
              <div className="overflow-x-auto pt-4">
                <table className="w-full text-left border-collapse text-[11px] select-none">
                  <thead>
                    <tr className="border-b bg-zinc-950/50 font-extrabold text-slate-400 uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                      {tab === 'admin_history' && <th className="py-3.5 px-5">OPERATOR</th>}
                      <th className="py-3.5 px-5">SYS_DATE</th>
                      <th className="py-3.5 px-5">SHIFT_IN</th>
                      <th className="py-3.5 px-5">SHIFT_OUT</th>
                      <th className="py-3.5 px-5">DURATION</th>
                      <th className="py-3.5 px-5">OVERTIME_MINS</th>
                      <th className="py-3.5 px-5 text-right">CREDITS_EARNED</th>
                      <th className="py-3.5 px-5 text-center">LINK_STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-300" style={{ borderColor: 'var(--border)' }}>
                    {sessions.map((session) => (
                      <tr key={session._id} className="hover:bg-cyan-500/[0.02] transition-all">
                        {tab === 'admin_history' && (
                          <td className="py-3 px-5">
                            <div className="font-extrabold text-white">{session.userId?.fullName.toUpperCase()}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5 tracking-wider uppercase">{session.userId?.employeeId} &bull; {session.userId?.jobTitle}</div>
                          </td>
                        )}
                        <td className="py-3 px-5 font-semibold">
                          {new Date(session.clockIn).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="py-3 px-5">
                          {new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-5">
                          {session.clockOut
                             ? new Date(session.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                             : '--:--'}
                        </td>
                        <td className="py-3 px-5">
                          {session.status === 'completed'
                             ? `${Math.floor(session.duration / 60)}h ${(session.duration % 60)}m`
                             : 'ACTIVE'}
                        </td>
                        <td className="py-3 px-5 text-amber-400">
                          {session.overtimeMinutes || 0}
                        </td>
                        <td className="py-3 px-5 text-right text-emerald-400 font-bold">
                          {session.status === 'completed'
                             ? `₹${(session.regularPay + session.overtimePay).toFixed(2)}`
                             : 'STREAMING...'}
                        </td>
                        <td className="py-3 px-5 text-center">
                          {session.status === 'completed' ? (
                            <span className="px-2 py-0.5 text-[8px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-sm badge uppercase">SOLVED</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[8px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-sm badge uppercase animate-pulse">STREAMING</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={tab === 'admin_history' ? 8 : 7} className="text-center py-16 text-slate-500 text-xs italic select-none">
                          NO SHIFT DATA DECODED IN CURRENT SPECIFIED TIMELINE.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* ── Export Modal ───────────────────────────────── */}
      <AnimatePresence>
        {exportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={springTransition}
              className="relative w-full max-w-md rounded-xl overflow-hidden font-mono"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/40 to-transparent" />

              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-[#ef4444]" />
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">Export Timesheet Report</h2>
                </div>
                <button onClick={() => setExportModalOpen(false)} className="btn-icon w-7 h-7 cursor-pointer">
                  <span className="text-slate-400 hover:text-white transition-colors text-sm">✕</span>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Format */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Export Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['csv', 'pdf'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-extrabold uppercase border transition-all cursor-pointer ${
                          exportFormat === fmt
                            ? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status filter */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Session Status</label>
                  <select value={exportStatusFilter} onChange={(e) => setExportStatusFilter(e.target.value)} className="select w-full text-[10px]">
                    <option value="all">All Sessions</option>
                    <option value="completed">Completed Only</option>
                    <option value="active">Active Only</option>
                  </select>
                </div>

                <p className="text-[9px] text-slate-600 tracking-wider">
                  {sessions.filter(s => exportStatusFilter === 'all' || s.status === exportStatusFilter).length} SESSION RECORDS WILL BE EXPORTED
                </p>
                <p className="text-[9px] text-slate-700 tracking-wider -mt-3">
                  (Applies current staff + date filters already set above)
                </p>
              </div>

              <div className="px-6 pb-5 pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setExportModalOpen(false)} className="btn btn-secondary h-9 text-[10px] cursor-pointer">CANCEL</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExportTimesheets}
                  className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  GENERATE {exportFormat.toUpperCase()}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
