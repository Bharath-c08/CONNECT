'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  X,
  Check,
  AlertCircle,
  UserCheck,
  Binary,
  Sliders,
  Edit2,
  Activity,
  Users,
  Download,
  FileText
} from 'lucide-react';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';
import { exportToCSV, exportToPDF } from '../../../utils/export';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

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
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function LeavesPlannerPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [personalRequests, setPersonalRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [myAllowances, setMyAllowances] = useState<any>({ limits: {}, usage: {} });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'admin_pending' | 'admin_history' | 'admin_limits'>('my');

  // Request Modal Form states
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Limit Customize Modal states (Admins)
  const [limitsModalOpen, setLimitsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [customLimits, setCustomLimits] = useState({
    sick: 10,
    casual: 10,
    annual: 15,
    unpaid: 365,
    other: 10
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Export Modal states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportTypeFilter, setExportTypeFilter] = useState('all');
  const [exportStatusFilter, setExportStatusFilter] = useState('all');
  const [exportUserFilter, setExportUserFilter] = useState('all');

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    
    if (usr) {
      if (usr.role === 'admin' || usr.role === 'superadmin') {
        setTab('admin_pending');
        fetchAdminData();
      } else {
        setTab('my');
        fetchPersonalData();
      }
    }

    // Connect to global socket for real-time leave status adjustments
    const socket = io(getSocketUrl());
    socket.on('connect', () => {
      if (usr) {
        socket.emit('join-room', usr._id || usr.id);
      }
    });

    socket.on('leave-updated', () => {
      // Re-fetch allowances and logs instantly in real time
      if (usr) {
        if (usr.role === 'admin' || usr.role === 'superadmin') {
          fetchAdminData();
        } else {
          fetchPersonalData();
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchPersonalData = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/leaves/my');
      setPersonalRequests(data);

      const allowances = await apiRequest('/leaves/my-limits');
      setMyAllowances(allowances);
    } catch (err) {
      console.error('Error fetching leave history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const pending = await apiRequest('/leaves/pending');
      setPendingRequests(pending);

      const allHistory = await apiRequest('/leaves/all');
      setAllRequests(allHistory);

      const employees = await apiRequest('/users');
      setStaffList(employees);
    } catch (err) {
      console.error('Error fetching company leaves logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openRequestModal = () => {
    setFormData({
      leaveType: 'sick',
      startDate: '',
      endDate: '',
      reason: '',
    });
    setError('');
    setSuccess('');
    setRequestModalOpen(true);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await apiRequest('/leaves', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setSuccess('DEPARTURE PROTOCOL SUBMITTED SUCCESSFULLY FOR APPROVAL.');
      setRequestModalOpen(false);
      fetchPersonalData();
    } catch (err: any) {
      setError(err.message || 'DEPARTURE REQUEST TRANSACTION FAILURE.');
    }
  };

  const handleProcessRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/leaves/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });

      setSuccess(`DEPARTURE REQUEST HAS BEEN STATUS_${status.toUpperCase()} SUCCESSFULLY.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'STATUS RE-WRITE FAULT ALARM.');
    }
  };

  const openLimitsModal = (emp: any) => {
    setSelectedUser(emp);
    
    // Fallbacks for limits
    const defaults = { sick: 10, casual: 10, annual: 15, unpaid: 365, other: 10 };
    const sickVal = emp.leaveLimits?.sick ?? defaults.sick;
    const casualVal = emp.leaveLimits?.casual ?? defaults.casual;
    const annualVal = emp.leaveLimits?.annual ?? defaults.annual;
    const unpaidVal = emp.leaveLimits?.unpaid ?? defaults.unpaid;
    const otherVal = emp.leaveLimits?.other ?? defaults.other;

    setCustomLimits({
      sick: Number(sickVal),
      casual: Number(casualVal),
      annual: Number(annualVal),
      unpaid: Number(unpaidVal),
      other: Number(otherVal)
    });
    setError('');
    setSuccess('');
    setLimitsModalOpen(true);
  };

  const handleLimitsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/leaves/limits/${selectedUser._id}`, {
        method: 'PUT',
        body: JSON.stringify({ limits: customLimits }),
      });

      setSuccess(`LEAVE CATEGORIES CUSTOMIZED SUCCESSFULLY FOR ${selectedUser.fullName.toUpperCase()}.`);
      setLimitsModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'COULD NOT CUSTOMIZE OPERATOR BALANCES.');
    }
  };

  const handleLimitInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomLimits(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleResetLeave = async (leaveType: string) => {
    if (!confirm(`CONFIRM RESET OF "${leaveType.toUpperCase()}" LEAVE LOGS AND USAGE FOR ${selectedUser.fullName.toUpperCase()} BACK TO 0?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await apiRequest(`/leaves/reset/${selectedUser._id}`, {
        method: 'POST',
        body: JSON.stringify({ leaveType }),
      });
      setSuccess(res.message || `RESET USAGE SUCCESSFULLY.`);
      setLimitsModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'COULD NOT RESET LEAVE BALANCE.');
    }
  };

  const handleExportLeaves = async () => {
    const sourceRequests = tab === 'my' ? personalRequests : (tab === 'admin_pending' ? pendingRequests : allRequests);
    
    const filtered = sourceRequests.filter((r) => {
      const matchType = exportTypeFilter === 'all' || r.leaveType === exportTypeFilter;
      const matchStatus = exportStatusFilter === 'all' || r.status === exportStatusFilter;
      const matchUser = exportUserFilter === 'all' || (r.userId?._id === exportUserFilter || r.userId === exportUserFilter);
      return matchType && matchStatus && matchUser;
    });

    const columns = [
      { header: 'Operator Name', key: 'operatorName' },
      { header: 'Employee ID', key: 'employeeId' },
      { header: 'Leave Category', key: 'leaveType' },
      { header: 'Start Date', key: 'startDate' },
      { header: 'End Date', key: 'endDate' },
      { header: 'Duration (Days)', key: 'duration' },
      { header: 'Status', key: 'status' },
      { header: 'Reason', key: 'reason' },
    ];

    const rows = filtered.map((r) => {
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      return {
        operatorName: r.userId?.fullName || currentUser?.fullName || '',
        employeeId: r.userId?.employeeId || currentUser?.employeeId || '',
        leaveType: r.leaveType || '',
        startDate: r.startDate ? new Date(r.startDate).toLocaleDateString() : '',
        endDate: r.endDate ? new Date(r.endDate).toLocaleDateString() : '',
        duration: duration || 0,
        status: r.status || '',
        reason: r.reason || '',
      };
    });

    const filename = `leave_logs_${new Date().toISOString().split('T')[0]}`;
    if (exportFormat === 'csv') {
      exportToCSV(rows, columns, filename);
    } else {
      await exportToPDF(rows, columns, 'Leave Roster Report', filename);
    }
    setExportModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 text-[8px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-sm badge uppercase">PENDING</span>;
      case 'approved':
        return <span className="px-2 py-0.5 text-[8px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-sm badge uppercase">APPROVED</span>;
      default:
        return <span className="px-2 py-0.5 text-[8px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-sm badge uppercase">DENIED</span>;
    }
  };

  const getLeaveTypeTag = (type: string) => {
    switch (type) {
      case 'sick':
        return <span className="text-rose-400 uppercase text-[9px] font-extrabold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-sm select-none shrink-0">SICK_OFF</span>;
      case 'casual':
        return <span className="text-indigo-400 uppercase text-[9px] font-extrabold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-sm select-none shrink-0">CASUAL_OFF</span>;
      case 'annual':
        return <span className="text-emerald-400 uppercase text-[9px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm select-none shrink-0">ANNUAL_OFF</span>;
      case 'unpaid':
        return <span className="text-slate-400 uppercase text-[9px] font-extrabold bg-white/5 border border-white/10 px-2 py-0.5 rounded-sm select-none shrink-0">UNPAID_OFF</span>;
      default:
        return <span className="text-amber-400 uppercase text-[9px] font-extrabold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-sm select-none shrink-0">SPECIAL_OFF</span>;
    }
  };

  const getLimitValue = (emp: any, type: string) => {
    const defaults = { sick: 10, casual: 10, annual: 15, unpaid: 365, other: 10 } as any;
    if (!emp?.leaveLimits) return defaults[type];
    // Map vs plain object safe extraction
    if (typeof emp.leaveLimits.get === 'function') {
      return emp.leaveLimits.get(type) ?? defaults[type];
    }
    return emp.leaveLimits[type] ?? defaults[type];
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6 font-mono">
      <AnimatePresence mode="wait">
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <UserCheck className="w-4.5 h-4.5 shrink-0" />
            <span>// PIPELINE: {success}</span>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// FAULT: {error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <Calendar className="w-5.5 h-5.5" />
            // DEPARTURE_TELEMETRY
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            OPERATOR DISCONNECT AND TIMEOFF PROTOCOLS CORE LOGS.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 self-start md:self-auto select-none">
          <div className="tab-bar">
            {isAdmin && (
              <>
                <button
                  onClick={() => { setTab('admin_pending'); fetchAdminData(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_pending' ? 'active' : ''}`}
                >
                  PENDING_OVERRIDE
                </button>
                <button
                  onClick={() => { setTab('admin_history'); fetchAdminData(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_history' ? 'active' : ''}`}
                >
                  COMPANY_HISTORIC
                </button>
                <button
                  onClick={() => { setTab('admin_limits'); fetchAdminData(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_limits' ? 'active' : ''}`}
                >
                  OPERATOR_BALANCES
                </button>
              </>
            )}
            <button
              onClick={() => { setTab('my'); fetchPersonalData(); }}
              className={`tab-btn relative cursor-pointer ${tab === 'my' ? 'active' : ''}`}
            >
              MY_DEPARTURES
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setExportModalOpen(true)}
            className="btn btn-secondary cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={openRequestModal} 
            className="btn btn-primary cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            REQUEST DISCONNECT
          </motion.button>
        </div>
      </motion.div>

      {/* Telemetry Meter Allowances Box (Operators) */}
      {!loading && tab === 'my' && myAllowances?.limits && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="grid grid-cols-2 md:grid-cols-5 gap-4"
        >
          {['sick', 'casual', 'annual', 'unpaid', 'other'].map((type) => {
            const limit = myAllowances.limits[type] || 0;
            const used = myAllowances.usage[type] || 0;
            const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            
            return (
              <div 
                key={type} 
                className="p-3.5 rounded border border-white/5 relative overflow-hidden select-none"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <div className="absolute top-1 left-2 text-[6px] opacity-15 uppercase">{type}_TELEMETRY</div>
                <div className="flex justify-between items-center mb-2.5 mt-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400">{type} balance</span>
                  <span className="text-[10px] font-black text-white">{used} / {limit} D</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className={`h-full transition-all ${
                      percent > 80 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[8px] uppercase tracking-wider text-slate-500">
                  <span>Usage Meter:</span>
                  <span className={percent > 80 ? 'text-rose-400 font-bold' : percent > 50 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    {percent}% LOADED
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-slate-500 text-[10px] select-none">
          <Binary className="w-7 h-7 text-[#ef4444] animate-spin" />
          <p>RETRIEVING LEAVE STREAM DATA...</p>
        </div>
      ) : (
        <>
          {/* Admin Pending Requests */}
          {tab === 'admin_pending' && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {pendingRequests.map((req) => (
                <motion.div
                  key={req._id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  className="card flex flex-col justify-between overflow-hidden relative"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                  <div className="absolute top-1 left-2 text-[6px] opacity-15">STAGE // PENDING_OVERRIDE</div>
                  
                  <div className="pt-2">
                    <div className="flex items-start justify-between gap-3 mb-4 select-none">
                      <div>
                        <h4 className="font-extrabold text-white text-sm tracking-widest">{req.userId?.fullName?.toUpperCase()}</h4>
                        <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wide">{req.userId?.jobTitle} &bull; ID: {req.userId?.employeeId}</p>
                      </div>
                      {getLeaveTypeTag(req.leaveType)}
                    </div>

                    <div className="space-y-2.5 text-[11px] text-slate-400 pt-3 border-t font-mono" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex justify-between select-none">
                        <span className="text-slate-500">OFFLINE_SPAN:</span>
                        <span className="font-bold text-white">
                          {new Date(req.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} to{' '}
                          {new Date(req.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {req.reason && (
                        <div className="mt-2.5 p-2.5 bg-zinc-950/40 border rounded text-slate-400 leading-relaxed italic text-[10px]" style={{ borderColor: 'var(--border)' }}>
                          &ldquo;{req.reason.toUpperCase()}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t flex items-center justify-end gap-2 select-none" style={{ borderColor: 'var(--border)' }}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleProcessRequest(req._id, 'rejected')}
                      className="px-3.5 py-1.5 rounded border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25 text-slate-400 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>DENY</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleProcessRequest(req._id, 'approved')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-extrabold rounded transition-all cursor-pointer flex items-center gap-1 text-[10px] uppercase tracking-wider"
                    >
                      <Check className="w-3.5 h-3.5 font-extrabold" />
                      <span>APPROVE</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}

              {pendingRequests.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500 text-xs italic select-none">
                  NO DEPARTURE REQUEST UNITS PENDING CRITICAL OVERRIDE.
                </div>
              )}
            </motion.div>
          )}

          {/* Admin Limits customization view */}
          {tab === 'admin_limits' && (
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
              <div className="absolute top-1 left-2 text-[6px] opacity-15">DECK // LEAVE_BALANCE_CONFIGURATOR</div>
              <div className="overflow-x-auto pt-4">
                <table className="w-full text-left border-collapse text-[11px] select-none">
                  <thead>
                    <tr className="border-b bg-zinc-950/50 font-extrabold text-slate-400 uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                      <th className="py-3.5 px-5">OPERATOR</th>
                      <th className="py-3.5 px-5 text-center">SICK LIMIT</th>
                      <th className="py-3.5 px-5 text-center">CASUAL LIMIT</th>
                      <th className="py-3.5 px-5 text-center">ANNUAL LIMIT</th>
                      <th className="py-3.5 px-5 text-center">UNPAID LIMIT</th>
                      <th className="py-3.5 px-5 text-center">OTHER LIMIT</th>
                      <th className="py-3.5 px-5 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-300" style={{ borderColor: 'var(--border)' }}>
                    {staffList.map((emp) => (
                      <tr key={emp._id} className="hover:bg-cyan-500/[0.02] transition-all">
                        <td className="py-3 px-5">
                          <div className="font-extrabold text-white flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#ef4444]/65" />
                            <span>{emp.fullName?.toUpperCase()}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 mt-0.5 tracking-wider uppercase">{emp.jobTitle} &bull; ID: {emp.employeeId}</div>
                        </td>
                        <td className="py-3 px-5 text-center font-bold text-rose-400">{getLimitValue(emp, 'sick')} DAYS</td>
                        <td className="py-3 px-5 text-center font-bold text-indigo-400">{getLimitValue(emp, 'casual')} DAYS</td>
                        <td className="py-3 px-5 text-center font-bold text-emerald-400">{getLimitValue(emp, 'annual')} DAYS</td>
                        <td className="py-3 px-5 text-center font-bold text-slate-400">{getLimitValue(emp, 'unpaid')} DAYS</td>
                        <td className="py-3 px-5 text-center font-bold text-amber-400">{getLimitValue(emp, 'other')} DAYS</td>
                        <td className="py-3 px-5 text-right">
                          <button
                            onClick={() => openLimitsModal(emp)}
                            className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-[#ef4444]/10 hover:text-[#ef4444] hover:border-[#ef4444]/25 text-slate-300 font-extrabold rounded text-[9px] cursor-pointer inline-flex items-center gap-1 tracking-widest uppercase transition-colors"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>CUSTOMIZE</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Historical logs table */}
          {tab !== 'admin_pending' && tab !== 'admin_limits' && (
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
              <div className="absolute top-1 left-2 text-[6px] opacity-15">DECK // HISTORICAL_DISCONNECTS</div>
              
              <div className="overflow-x-auto pt-4">
                <table className="w-full text-left border-collapse text-[11px] select-none">
                  <thead>
                    <tr className="border-b bg-zinc-950/50 font-extrabold text-slate-400 uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                      {tab === 'admin_history' && <th className="py-3.5 px-5">OPERATOR</th>}
                      <th className="py-3.5 px-5">CATEGORY</th>
                      <th className="py-3.5 px-5">DISCONNECT_START</th>
                      <th className="py-3.5 px-5">DISCONNECT_END</th>
                      <th className="py-3.5 px-5">REASON_LOG</th>
                      <th className="py-3.5 px-5 text-center">OVERRIDE_STATUS</th>
                      {tab === 'admin_history' && <th className="py-3.5 px-5">CONTROLLER</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-300" style={{ borderColor: 'var(--border)' }}>
                    {(tab === 'my' ? personalRequests : allRequests).map((req) => (
                      <tr key={req._id} className="hover:bg-cyan-500/[0.02] transition-all">
                        {tab === 'admin_history' && (
                          <td className="py-3 px-5">
                            <div className="font-extrabold text-white">{req.userId?.fullName?.toUpperCase()}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5 tracking-wider uppercase">ID: {req.userId?.employeeId}</div>
                          </td>
                        )}
                        <td className="py-3 px-5 font-semibold">
                          {getLeaveTypeTag(req.leaveType)}
                        </td>
                        <td className="py-3 px-5">
                          {new Date(req.startDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="py-3 px-5">
                          {new Date(req.endDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="py-3 px-5 max-w-[200px] truncate text-slate-400 uppercase text-[10px]" title={req.reason}>
                          {req.reason || '-'}
                        </td>
                        <td className="py-3 px-5 text-center">
                          {getStatusBadge(req.status)}
                        </td>
                        {tab === 'admin_history' && (
                          <td className="py-3 px-5 text-slate-400 uppercase text-[10px]">
                            {req.approvedBy?.fullName?.toUpperCase() || '-'}
                          </td>
                        )}
                      </tr>
                    ))}

                    {(tab === 'my' ? personalRequests : allRequests).length === 0 && (
                      <tr>
                        <td colSpan={tab === 'admin_history' ? 7 : 5} className="text-center py-16 text-slate-500 text-xs italic select-none">
                          NO DEPARTURE RECORDS LOGGED IN CURRENT CHANNELS.
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

      {/* Leave Request Form Modal */}
      <AnimatePresence>
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <Calendar className="w-4.5 h-4.5 text-[#ef4444]" />
                  <span>INITIALIZE DISCONNECT REQUEST</span>
                </h3>
                <button
                  onClick={() => setRequestModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRequestSubmit} className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label mb-1">Leave Category Category *</label>
                  <select
                    name="leaveType"
                    value={formData.leaveType}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="sick">SICK LEAVE PROTOCOL</option>
                    <option value="casual">CASUAL DISCONNECT</option>
                    <option value="annual">ANNUAL DEPARTURE (VACATION)</option>
                    <option value="unpaid">UNPAID SLEEP MODE</option>
                    <option value="other">OTHER / EMERGENCY COOLDOWN</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">Disconnect Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="date"
                        required
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className="input pl-9"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">Return Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input
                        type="date"
                        required
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className="input pl-9"
                      />
                    </div>
                  </div>
                </div>


                <div className="form-group">
                  <label className="form-label mb-1">Override Rationale / Reason</label>
                  <textarea
                    name="reason"
                    placeholder="Provide details regarding the shutdown rationale..."
                    value={formData.reason}
                    onChange={handleInputChange}
                    rows={3}
                    className="textarea"
                  />
                </div>

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    ABORT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    COMMIT_DEPARTURE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Limits Customizer Modal */}
      <AnimatePresence>
        {limitsModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <Sliders className="w-4.5 h-4.5 text-[#ef4444]" />
                  <span>CUSTOMIZE LIMITS: {selectedUser.fullName.toUpperCase()}</span>
                </h3>
                <button
                  onClick={() => setLimitsModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleLimitsSubmit} className="modal-body space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label">Sick Leave Limit (Days)</label>
                      <button
                        type="button"
                        onClick={() => handleResetLeave('sick')}
                        className="text-[8px] text-[#ef4444] hover:underline uppercase font-bold cursor-pointer"
                      >
                        [Reset Usage]
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      name="sick"
                      value={customLimits.sick}
                      onChange={handleLimitInputChange}
                      className="input"
                    />
                  </div>
                  <div className="form-group relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label">Casual Leave Limit (Days)</label>
                      <button
                        type="button"
                        onClick={() => handleResetLeave('casual')}
                        className="text-[8px] text-[#ef4444] hover:underline uppercase font-bold cursor-pointer"
                      >
                        [Reset Usage]
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      name="casual"
                      value={customLimits.casual}
                      onChange={handleLimitInputChange}
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label">Annual Leave Limit (Days)</label>
                      <button
                        type="button"
                        onClick={() => handleResetLeave('annual')}
                        className="text-[8px] text-[#ef4444] hover:underline uppercase font-bold cursor-pointer"
                      >
                        [Reset Usage]
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      name="annual"
                      value={customLimits.annual}
                      onChange={handleLimitInputChange}
                      className="input"
                    />
                  </div>
                  <div className="form-group relative">
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label">Unpaid Leave Limit (Days)</label>
                      <button
                        type="button"
                        onClick={() => handleResetLeave('unpaid')}
                        className="text-[8px] text-[#ef4444] hover:underline uppercase font-bold cursor-pointer"
                      >
                        [Reset Usage]
                      </button>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      name="unpaid"
                      value={customLimits.unpaid}
                      onChange={handleLimitInputChange}
                      className="input"
                    />
                  </div>
                </div>

                <div className="form-group relative">
                  <div className="flex justify-between items-center mb-1">
                    <label className="form-label">Other / Emergency Limit (Days)</label>
                    <button
                      type="button"
                      onClick={() => handleResetLeave('other')}
                      className="text-[8px] text-[#ef4444] hover:underline uppercase font-bold cursor-pointer"
                    >
                      [Reset Usage]
                    </button>
                  </div>
                  <input
                    type="number"
                    required
                    min={0}
                    name="other"
                    value={customLimits.other}
                    onChange={handleLimitInputChange}
                    className="input"
                  />
                </div>

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setLimitsModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    ABORT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    SAVE_CONFIG
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Leaves Export Modal ─────────────────────────────── */}
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
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">Export Disconnect Telemetry</h2>
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

                {/* Filters */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Leave Type</label>
                    <select value={exportTypeFilter} onChange={(e) => setExportTypeFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Types</option>
                      <option value="sick">Sick Leave</option>
                      <option value="casual">Casual Leave</option>
                      <option value="annual">Annual Leave</option>
                      <option value="unpaid">Unpaid Leave</option>
                      <option value="other">Other Leave</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Override Status</label>
                    <select value={exportStatusFilter} onChange={(e) => setExportStatusFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Denied</option>
                    </select>
                  </div>
                  {isAdmin && staffList.length > 0 && tab !== 'my' && (
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Operator Filter</label>
                      <select value={exportUserFilter} onChange={(e) => setExportUserFilter(e.target.value)} className="select w-full text-[10px]">
                        <option value="all">All Operators</option>
                        {staffList.map((emp: any) => (
                          <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 pb-5 pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setExportModalOpen(false)} className="btn btn-secondary h-9 text-[10px] cursor-pointer">CANCEL</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExportLeaves}
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
