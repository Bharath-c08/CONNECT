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
  Layers,
  Activity
} from 'lucide-react';
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
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function LeavesPlannerPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [personalRequests, setPersonalRequests] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'my' | 'admin_pending' | 'admin_history'>('my');

  // Request Modal Form states
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    leaveType: 'sick',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  }, []);

  const fetchPersonalData = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/leaves/my');
      setPersonalRequests(data);
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
      default:
        return <span className="text-slate-400 uppercase text-[9px] font-extrabold bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-sm select-none shrink-0">SPECIAL_OFF</span>;
    }
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
            onClick={openRequestModal} 
            className="btn btn-primary cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            REQUEST DISCONNECT
          </motion.button>
        </div>
      </motion.div>

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

          {/* Historical logs table */}
          {tab !== 'admin_pending' && (
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
                    <input
                      type="date"
                      required
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">Return Date *</label>
                    <input
                      type="date"
                      required
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="input"
                    />
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
    </div>
  );
}
