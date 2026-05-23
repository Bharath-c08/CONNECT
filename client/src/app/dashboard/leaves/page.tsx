'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  X,
  Check,
  ClipboardList,
  AlertCircle,
  FileText,
  UserCheck
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';

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

      setSuccess('Leave request submitted successfully for approval.');
      setRequestModalOpen(false);
      fetchPersonalData();
    } catch (err: any) {
      setError(err.message || 'Error submitting leave request.');
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

      setSuccess(`Leave request has been ${status} successfully.`);
      fetchAdminData();
    } catch (err: any) {
      setError(err.message || 'Failed to update leave request status.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">Pending</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">Approved</span>;
      default:
        return <span className="px-2.5 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 rounded-md">Rejected</span>;
    }
  };

  const getLeaveTypeTag = (type: string) => {
    switch (type) {
      case 'sick':
        return <span className="text-rose-400 uppercase text-[10px] font-extrabold">Sick Leave</span>;
      case 'casual':
        return <span className="text-indigo-400 uppercase text-[10px] font-extrabold">Casual Leave</span>;
      case 'annual':
        return <span className="text-emerald-400 uppercase text-[10px] font-extrabold">Annual Leave</span>;
      default:
        return <span className="text-slate-400 uppercase text-[10px] font-extrabold">{type} Leave</span>;
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-2.5 text-sm select-none animate-pulse">
          <UserCheck className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-2.5 text-sm select-none">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Calendar className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            Leave & Time Off
          </h1>
          <p className="page-subtitle">Submit leave requests and review company leave schedules.</p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Tab selectors */}
          <div className="tab-bar">
            {isAdmin && (
              <>
                <button
                  onClick={() => { setTab('admin_pending'); fetchAdminData(); }}
                  className={`tab-btn ${tab === 'admin_pending' ? 'active' : ''}`}
                >
                  Pending
                </button>
                <button
                  onClick={() => { setTab('admin_history'); fetchAdminData(); }}
                  className={`tab-btn ${tab === 'admin_history' ? 'active' : ''}`}
                >
                  History
                </button>
              </>
            )}
            <button
              onClick={() => { setTab('my'); fetchPersonalData(); }}
              className={`tab-btn ${tab === 'my' ? 'active' : ''}`}
            >
              My Requests
            </button>
          </div>

          <button onClick={openRequestModal} className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Request Leave
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Loading leave records...</p>
        </div>
      ) : (
        <>
          {/* Admin Pending Requests */}
          {tab === 'admin_pending' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingRequests.map((req) => (
                <div
                  key={req._id}
                  className="glass-card p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4 select-none">
                      <div>
                        <h4 className="font-extrabold text-white text-base tracking-wide">{req.userId?.fullName}</h4>
                        <p className="text-slate-400 text-xs mt-0.5">{req.userId?.jobTitle} &bull; ID: {req.userId?.employeeId}</p>
                      </div>
                      {getLeaveTypeTag(req.leaveType)}
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5 select-none">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Duration:</span>
                        <span className="font-semibold text-slate-200">
                          {new Date(req.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} to{' '}
                          {new Date(req.endDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {req.reason && (
                        <div className="mt-2.5 p-2.5 bg-white/3 border border-white/5 rounded-xl text-slate-400 leading-relaxed italic text-[11px]">
                          &ldquo;{req.reason}&rdquo;
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => handleProcessRequest(req._id, 'rejected')}
                      className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Deny</span>
                    </button>
                    <button
                      onClick={() => handleProcessRequest(req._id, 'approved')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:scale-105 cursor-pointer flex items-center gap-1 text-[11px]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              ))}

              {pendingRequests.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 text-sm select-none">
                  No pending leave requests left to process. Outstanding!
                </div>
              )}
            </div>
          )}

          {/* Historical logs table */}
          {tab !== 'admin_pending' && (
            <div className="glass-card rounded-3xl border border-white/10 overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/3 font-bold text-slate-400">
                      {tab === 'admin_history' && <th className="p-4">Employee</th>}
                      <th className="p-4">Leave Type</th>
                      <th className="p-4">Start Date</th>
                      <th className="p-4">End Date</th>
                      <th className="p-4">Reason</th>
                      <th className="p-4 text-center">Status</th>
                      {tab === 'admin_history' && <th className="p-4">Processed By</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {(tab === 'my' ? personalRequests : allRequests).map((req) => (
                      <tr key={req._id} className="hover:bg-white/3 transition-all">
                        {tab === 'admin_history' && (
                          <td className="p-4">
                            <div className="font-semibold text-white">{req.userId?.fullName}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">ID: {req.userId?.employeeId}</div>
                          </td>
                        )}
                        <td className="p-4 font-semibold">
                          {getLeaveTypeTag(req.leaveType)}
                        </td>
                        <td className="p-4">
                          {new Date(req.startDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="p-4">
                          {new Date(req.endDate).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="p-4 max-w-[200px] truncate text-slate-400" title={req.reason}>
                          {req.reason || '-'}
                        </td>
                        <td className="p-4 text-center">
                          {getStatusBadge(req.status)}
                        </td>
                        {tab === 'admin_history' && (
                          <td className="p-4 text-slate-400">
                            {req.approvedBy?.fullName || '-'}
                          </td>
                        )}
                      </tr>
                    ))}

                    {(tab === 'my' ? personalRequests : allRequests).length === 0 && (
                      <tr>
                        <td colSpan={tab === 'admin_history' ? 7 : 5} className="text-center py-12 text-slate-500 text-sm select-none">
                          No leave requests cataloged in this log.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Leave Request Form Modal */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/10 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-rose-500" />
                <span>Request Time Off</span>
              </h3>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Leave Category *</label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="annual">Annual Leave (Vacation)</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="other">Other / Special circumstance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Start Date *</label>
                  <input
                    type="date"
                    required
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">End Date *</label>
                  <input
                    type="date"
                    required
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Reason / Note</label>
                <textarea
                  name="reason"
                  placeholder="Provide details regarding this time-off request..."
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] text-xs cursor-pointer"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
