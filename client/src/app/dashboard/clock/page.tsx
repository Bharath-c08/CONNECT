'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  UserCheck,
  Search,
  CheckCircle,
  FileText
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';

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

  const stats = getAggregates();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Clock className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            Timesheets & Roster
          </h1>
          <p className="page-subtitle">Track work logs, schedules, and payroll metrics.</p>
        </div>

        <div className="tab-bar self-start sm:self-auto">
          {isAdmin && (
            <>
              <button
                onClick={() => { setTab('admin_live'); fetchAdminData(); }}
                className={`tab-btn ${tab === 'admin_live' ? 'active' : ''}`}
              >
                Live Roster
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
            onClick={() => { setTab('personal'); fetchPersonalData(); }}
            className={`tab-btn ${tab === 'personal' ? 'active' : ''}`}
          >
            My Shifts
          </button>
        </div>
      </div>


      {/* Aggregate cards (Visible for personal summary or admin logs history) */}
      {tab !== 'admin_live' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
          <div className="glass-card p-5 rounded-3xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Regular Hours</span>
              <strong className="text-lg font-bold text-white mt-0.5 block font-mono">{stats.hours} hrs</strong>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Overtime Hours</span>
              <strong className="text-lg font-bold text-white mt-0.5 block font-mono">{stats.otHours} hrs</strong>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <span className="text-emerald-500 font-bold">₹</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">OT Wages</span>
              <strong className="text-lg font-bold text-emerald-400 mt-0.5 block font-mono">₹{stats.otPay}</strong>
            </div>
          </div>

          <div className="glass-card p-5 rounded-3xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <span className="text-indigo-500 font-bold">₹</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Gross Earnings</span>
              <strong className="text-lg font-bold text-white mt-0.5 block font-mono">₹{stats.grossPay}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Admin Filters Row */}
      {tab === 'admin_history' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl select-none">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Filter Employee</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-4 py-0 bg-white/5 border border-white/10 rounded-xl outline-none text-white cursor-pointer focus:border-red-500/50 transition-all"
            >
              <option value="" className="bg-[#0b0b1a]">All Employees</option>
              {staffList.map((emp) => (
                <option key={emp._id} value={emp._id} className="bg-[#0b0b1a]">
                  {emp.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-0 bg-white/5 border border-white/10 rounded-xl outline-none text-white cursor-pointer focus:border-red-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-0 bg-white/5 border border-white/10 rounded-xl outline-none text-white cursor-pointer focus:border-red-500/50 transition-all"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-sm transition-all cursor-pointer"
              title="Clear Filters"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Loading shift records...</p>
        </div>
      ) : (
        <>
          {/* Live Roster Panel */}
          {tab === 'admin_live' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide flex items-center gap-2 select-none">
                <UserCheck className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
                <span>Currently Clocked In ({liveSessions.length})</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {liveSessions.map((session) => (
                  <div
                    key={session._id}
                    className="glass-card p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between border-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.01)]"
                  >
                    <div className="absolute top-0 right-0 p-4 shrink-0">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping inline-block"></span>
                    </div>

                    <div>
                      <div className="mb-4">
                        <h4 className="font-extrabold text-white text-base tracking-wide">{session.userId?.fullName}</h4>
                        <p className="text-slate-400 text-xs mt-0.5">{session.userId?.jobTitle || 'No Title'}</p>
                      </div>

                      <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Employee ID:</span>
                          <span>{session.userId?.employeeId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Clock In Time:</span>
                          <span>{new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        {session.location?.address && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Location:</span>
                            <span className="text-[10px] text-right truncate max-w-[150px]">{session.location.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {liveSessions.length === 0 && (
                  <div className="col-span-full text-center py-12 text-slate-500 text-sm select-none">
                    No employees are currently clocked in.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Historical Timesheets Table */}
          {tab !== 'admin_live' && (
            <div className="glass-card rounded-3xl border border-white/10 overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/3 font-bold text-slate-400">
                      {tab === 'admin_history' && <th className="p-4">Employee</th>}
                      <th className="p-4">Date</th>
                      <th className="p-4">Clock In</th>
                      <th className="p-4">Clock Out</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">OT (Min)</th>
                      <th className="p-4 text-right">Wages</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-200">
                    {sessions.map((session) => (
                      <tr key={session._id} className="hover:bg-white/3 transition-all">
                        {tab === 'admin_history' && (
                          <td className="p-4">
                            <div className="font-semibold text-white">{session.userId?.fullName}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{session.userId?.employeeId} &bull; {session.userId?.jobTitle}</div>
                          </td>
                        )}
                        <td className="p-4 font-medium">
                          {new Date(session.clockIn).toLocaleDateString([], { dateStyle: 'medium' })}
                        </td>
                        <td className="p-4 font-mono">
                          {new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4 font-mono">
                          {session.clockOut
                            ? new Date(session.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '--:--'}
                        </td>
                        <td className="p-4 font-mono">
                          {session.status === 'completed'
                            ? `${Math.floor(session.duration / 60)}h ${(session.duration % 60)}m`
                            : 'Active'}
                        </td>
                        <td className="p-4 font-mono text-amber-400">
                          {session.overtimeMinutes || 0}
                        </td>
                        <td className="p-4 text-right font-mono text-emerald-400">
                          {session.status === 'completed'
                            ? `₹${(session.regularPay + session.overtimePay).toFixed(2)}`
                            : 'Tracking...'}
                        </td>
                        <td className="p-4 text-center">
                          {session.status === 'completed' ? (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">Completed</span>
                          ) : (
                            <span className="px-2 py-0.5 text-[9px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md animate-pulse">On Clock</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {sessions.length === 0 && (
                      <tr>
                        <td colSpan={tab === 'admin_history' ? 8 : 7} className="text-center py-12 text-slate-500 text-sm select-none">
                          No shifts registered in this timeframe.
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
    </div>
  );
}
