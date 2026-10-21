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
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../../utils/export';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';
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
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

const formatMinutesToHoursAndMins = (minutes: number) => {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

export default function TimesheetsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'personal' | 'admin_history' | 'admin_live' | 'admin_breaks'>('personal');

  // Break configurator state
  const [breakTypes, setBreakTypes] = useState<any[]>([]);
  const [newBreakName, setNewBreakName] = useState('');
  const [newBreakDuration, setNewBreakDuration] = useState('');
  const [breakActionLoading, setBreakActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Shift session editor states (Admin)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    clockIn: '',
    clockOut: '',
    duration: 0,
    shiftType: 'regular',
    approvalStatus: 'approved'
  });

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null);

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

      // Establish real-time socket connections for silent telemetry updates
      const socket = io(getSocketUrl());
      
      socket.on('connect', () => {
        console.log('Telemetry pipeline uplink established.');
      });

      socket.on('clock-status-changed', () => {
        if (usr.role === 'admin' || usr.role === 'superadmin') {
          // Silent refresh of master roster and live operators
          apiRequest('/clock/admin/live').then(setLiveSessions).catch(console.error);
          apiRequest('/clock/admin/roster').then(setSessions).catch(console.error);
        } else {
          // Silent refresh of personal logs
          apiRequest('/clock/history').then(setSessions).catch(console.error);
        }
      });

      return () => {
        socket.disconnect();
      };
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

  const fetchBreakTypes = async () => {
    try {
      const data = await apiRequest('/clock/breaks/types');
      setBreakTypes(data);
    } catch (err) {
      console.error('Error fetching break types:', err);
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

      // 4. Fetch break types
      await fetchBreakTypes();
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

  // Create Break Type
  const handleCreateBreakType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBreakName || !newBreakDuration) return;
    setBreakActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiRequest('/clock/breaks/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBreakName,
          duration: Number(newBreakDuration)
        })
      });
      setNewBreakName('');
      setNewBreakDuration('');
      setSuccessMsg('BREAK TYPE CONFIGURED SUCCESSFULLY');
      await fetchBreakTypes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating break type');
    } finally {
      setBreakActionLoading(false);
    }
  };

  // Delete Break Type
  const handleDeleteBreakType = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiRequest(`/clock/breaks/types/${id}`, {
        method: 'DELETE'
      });
      setSuccessMsg('BREAK TYPE DELETED SUCCESSFULLY');
      await fetchBreakTypes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting break type');
    }
  };

  const handleApproveShift = async (sessionId: string) => {
    try {
      await apiRequest(`/clock/admin/approve-shift/${sessionId}`, {
        method: 'PUT'
      });
      fetchAdminData();
    } catch (err) {
      console.error('Error approving shift:', err);
    }
  };

  const handleRejectShift = async (sessionId: string) => {
    try {
      await apiRequest(`/clock/admin/reject-shift/${sessionId}`, {
        method: 'PUT'
      });
      fetchAdminData();
    } catch (err) {
      console.error('Error rejecting shift:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('CONFIRM DELETION OF THIS SHIFT RECORD? THIS ACTION IS PERMANENT.')) {
      return;
    }
    try {
      await apiRequest(`/clock/admin/session/${sessionId}`, {
        method: 'DELETE'
      });
      fetchAdminData();
    } catch (err) {
      console.error('Error deleting shift session:', err);
    }
  };

  // Format date safely for datetime-local input YYYY-MM-DDTHH:MM without timezone drift
  const formatDateForInput = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const tzoffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const openEditSessionModal = (session: any) => {
    setSelectedSession(session);
    setEditFormData({
      clockIn: formatDateForInput(session.clockIn),
      clockOut: formatDateForInput(session.clockOut),
      duration: session.duration || 0,
      shiftType: session.shiftType || 'regular',
      approvalStatus: session.approvalStatus || (session.needsApproval ? 'pending' : 'approved')
    });
    setErrorMsg('');
    setSuccessMsg('');
    setEditModalOpen(true);
  };

  const handleEditSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const needsApproval = editFormData.approvalStatus === 'pending';
      
      await apiRequest(`/clock/admin/session/${selectedSession._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clockIn: new Date(editFormData.clockIn).toISOString(),
          clockOut: editFormData.clockOut ? new Date(editFormData.clockOut).toISOString() : null,
          duration: Number(editFormData.duration),
          shiftType: editFormData.shiftType,
          approvalStatus: editFormData.approvalStatus,
          needsApproval
        })
      });

      setSuccessMsg('SHIFT RECORD RE-WRITTEN SUCCESSFULLY.');
      setEditModalOpen(false);
      fetchAdminData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating shift session.');
    }
  };

  // Aggregates calculation helper
  const getAggregates = () => {
    let totalMinutes = 0;
    let completedShifts = 0;
    let totalBreaks = 0;
    let totalBreakMinutes = 0;

    const filtered = sessions.filter(session => {
      if (viewMode === 'table') return true;
      
      const sessionDate = new Date(session.clockIn);
      return sessionDate.getMonth() === currentMonth &&
             sessionDate.getFullYear() === currentYear;
    });

    filtered.forEach(session => {
      if (session.status === 'completed') {
        completedShifts++;
        totalMinutes += session.duration || 0;
        totalBreakMinutes += session.userId?.breakLimitMinutes ?? 0;
        if (session.breaks && session.breaks.length > 0) {
          totalBreaks += session.breaks.length;
        }
      }
    });

    const totalHours = totalMinutes / 60;

    return {
      hours: totalHours.toFixed(2),
      shifts: completedShifts,
      breaksCount: totalBreaks,
      breakMinutes: totalBreakMinutes
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
      { header: 'Clocked In (mins)', key: 'clockedInMins' },
      { header: 'Breaks (mins)', key: 'breakMins' },
      { header: 'Net Working (mins)', key: 'netWorkingMins' },
      { header: 'Status', key: 'status' },
    ];

    const rows = filtered.map((s) => {
      const totalSessionMins = s.clockOut
        ? Math.round((new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime()) / 60000)
        : Math.round((Date.now() - new Date(s.clockIn).getTime()) / 60000);
      
      const breakLimitMins = s.userId?.breakLimitMinutes ?? 0;

      return {
        employee: s.userId?.fullName || '',
        employeeId: s.userId?.employeeId || '',
        date: new Date(s.clockIn).toLocaleDateString(),
        clockIn: new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clockOut: s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        clockedInMins: totalSessionMins,
        breakMins: breakLimitMins,
        netWorkingMins: s.status === 'completed' ? s.duration : 'ACTIVE',
        status: s.status || '',
      };
    });

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

        <div className="flex flex-col items-start md:items-end gap-3 self-start md:self-auto select-none">
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
                <button
                  onClick={() => { setTab('admin_breaks'); fetchBreakTypes(); }}
                  className={`tab-btn relative cursor-pointer ${tab === 'admin_breaks' ? 'active' : ''}`}
                >
                  BREAK CONFIGURATOR
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

          {/* View Toggles & Export buttons — shown only on history tabs */}
          {tab !== 'admin_live' && tab !== 'admin_breaks' && (
            <div className="flex items-center gap-2 shrink-0 select-none">
              <div className="tab-bar h-9 flex items-center px-0.5">
                <button
                  onClick={() => setViewMode('table')}
                  className={`tab-btn relative cursor-pointer h-7 text-[9px] px-3 font-extrabold uppercase transition-all tracking-wider border-0 outline-none ${
                    viewMode === 'table' ? 'active' : ''
                  }`}
                >
                  ALL HISTORIC
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`tab-btn relative cursor-pointer h-7 text-[9px] px-3 font-extrabold uppercase transition-all tracking-wider border-0 outline-none ${
                    viewMode === 'calendar' ? 'active' : ''
                  }`}
                >
                  MONTHLY CALENDAR
                </button>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setExportModalOpen(true)}
                className="btn btn-secondary h-9 px-3 text-[10px] cursor-pointer flex items-center gap-1.5 shrink-0"
                title="Export timesheet data"
              >
                <Download className="w-3.5 h-3.5" />
                EXPORT
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>


      {/* Aggregate telemetry capsules */}
      {tab !== 'admin_live' && tab !== 'admin_breaks' && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 select-none"
        >
          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // SHIFT_COUNT</div>
            <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Completed Shifts</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{stats.shifts} shifts</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // LOAD_HRS</div>
            <div className="w-9 h-9 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Clocked Hours</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{stats.hours} hrs</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5">
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // BREAKS_TAKEN</div>
            <div className="w-9 h-9 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Breaks Taken</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{stats.breaksCount} breaks</strong>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="card flex items-center gap-4 py-4 px-5" style={{ borderColor: 'var(--border-strong)' }}>
            <div className="absolute top-1 left-2 text-[6px] opacity-20">DECK // BREAK_TIME</div>
            <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
              <span className="text-emerald-400 font-bold text-sm">Hrs</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase tracking-wider">Total Break Time</span>
              <strong className="text-base font-extrabold text-white mt-0.5 block font-mono">{formatMinutesToHoursAndMins(stats.breakMinutes)}</strong>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Admin Filters Row */}
      {tab === 'admin_history' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded bg-zinc-950/40 select-none"
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
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">TO TIMESTAMP</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input pl-9"
              />
            </div>
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
                      {session.status === 'on_break' ? (
                        <span className="flex h-2 w-2 relative" title="On Break">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                      ) : (
                        <span className="flex h-2 w-2 relative" title="Active Shift">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <div className="absolute top-1 left-2 text-[6px] opacity-20">UPLINK // NODE_STREAM</div>

                    <div>
                      <div className="mb-4 select-none pt-1">
                        <h4 className="font-extrabold text-white text-sm tracking-widest">{session.userId?.fullName.toUpperCase()}</h4>
                        <p className="text-slate-400 text-[10px] mt-0.5 tracking-wider uppercase">
                          {session.userId?.jobTitle || 'UNASSIGNED ROLE'} &bull;{' '}
                          <span style={{ color: session.status === 'on_break' ? 'var(--warning)' : 'var(--success)' }}>
                            {session.status === 'on_break' ? `ON BREAK (${session.breaks?.find((b: any) => !b.endedAt)?.breakType || 'CUSTOM'})` : 'ACTIVE'}
                          </span>
                        </p>
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
          {tab !== 'admin_live' && tab !== 'admin_breaks' && (
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
              
              {/* View Toggle Bar */}
              <div className="flex items-center justify-end p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex bg-zinc-900 rounded p-0.5 select-none">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded ${viewMode === 'table' ? 'bg-zinc-800 text-white' : 'text-slate-500'}`}
                  >
                    Table
                  </button>
                  <button 
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-1 text-[9px] font-bold uppercase rounded ${viewMode === 'calendar' ? 'bg-zinc-800 text-white' : 'text-slate-500'}`}
                  >
                    Calendar
                  </button>
                </div>
              </div>
              
              {viewMode === 'calendar' ? (
                <div className="p-5 font-mono select-none calendar-grid-container">
                  {/* Calendar Navigation Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                    <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#ef4444]" />
                      <span>
                        // CALENDAR_VIEW: {new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' }).toUpperCase()} {currentYear}
                      </span>
                    </h3>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (currentMonth === 0) {
                            setCurrentMonth(11);
                            setCurrentYear(prev => prev - 1);
                          } else {
                            setCurrentMonth(prev => prev - 1);
                          }
                        }}
                        className="btn btn-secondary h-8 w-8 cursor-pointer flex items-center justify-center p-0"
                        title="PREVIOUS_MONTH"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          setCurrentMonth(today.getMonth());
                          setCurrentYear(today.getFullYear());
                        }}
                        className="btn btn-secondary h-8 px-2.5 text-[9px] font-extrabold uppercase cursor-pointer"
                      >
                        CURRENT
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentMonth === 11) {
                            setCurrentMonth(0);
                            setCurrentYear(prev => prev + 1);
                          } else {
                            setCurrentMonth(prev => prev + 1);
                          }
                        }}
                        className="btn btn-secondary h-8 w-8 cursor-pointer flex items-center justify-center p-0"
                        title="NEXT_MONTH"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Days of Week Header */}
                    {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((day) => (
                      <div key={day} className="text-center py-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-zinc-950/40 border rounded-sm" style={{ borderColor: 'var(--border)' }}>
                        {day}
                      </div>
                    ))}

                    {/* Empty cells for leading days */}
                    {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, index) => (
                      <div key={`empty-${index}`} className="min-h-[110px] bg-zinc-950/10 border border-dashed rounded-sm opacity-25" style={{ borderColor: 'var(--border)' }} />
                    ))}

                    {/* Current Month Days */}
                    {Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }).map((_, index) => {
                      const day = index + 1;
                      const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                      
                      // Filter sessions for this day
                      const daySessions = sessions.filter((s) => {
                        const sDate = new Date(s.clockIn);
                        return sDate.getFullYear() === currentYear &&
                               sDate.getMonth() === currentMonth &&
                               sDate.getDate() === day;
                      });

                      return (
                        <div 
                          key={`day-${day}`} 
                          onClick={() => {
                            setSelectedDateForDetail(new Date(currentYear, currentMonth, day));
                          }}
                          className={`min-h-[110px] flex flex-col justify-between p-2.5 rounded bg-zinc-950/20 border hover:bg-zinc-900/30 cursor-pointer transition-all relative ${
                            isToday 
                              ? 'border-[#ef4444]/60 shadow-[inset_0_0_8px_rgba(239,68,68,0.05)]' 
                              : ''
                          }`}
                          style={{ borderColor: isToday ? undefined : 'var(--border)' }}
                        >
                          <div className="flex items-center justify-between select-none">
                            {isToday && (
                              <span className="text-[6px] font-extrabold bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] px-1 py-0.5 rounded-[2px] uppercase tracking-wider">
                                today
                              </span>
                            )}
                            <span className={`text-[10px] font-bold ml-auto ${isToday ? 'text-[#ef4444]' : 'text-slate-500'}`}>
                              {day.toString().padStart(2, '0')}
                            </span>
                          </div>

                          <div className="flex-1 mt-2.5 overflow-y-auto scrollbar-none max-h-[70px]">
                            {daySessions.slice(0, 3).map((session) => (
                              <div
                                key={session._id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isAdmin) {
                                    openEditSessionModal(session);
                                  }
                                }}
                                className={`text-[9px] leading-tight px-1.5 py-0.5 rounded truncate select-none cursor-pointer border hover:scale-[1.02] active:scale-[0.98] transition-all font-mono mb-1 ${
                                  session.shiftType === 'overtime'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15'
                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/15'
                                }`}
                                title={`${session.userId?.fullName || 'Operator'} (${formatMinutesToHoursAndMins(session.duration)})`}
                              >
                                {tab === 'admin_history' && session.userId?.fullName 
                                  ? `${session.userId.fullName.split(' ')[0]}: ` 
                                  : ''}
                                {formatMinutesToHoursAndMins(session.duration)}
                              </div>
                            ))}
                            {daySessions.length > 3 && (
                              <div className="text-[8px] text-slate-500 font-extrabold pl-1.5 select-none">
                                + {daySessions.length - 3} MORE
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto pt-4">
                  <table className="w-full text-left border-collapse text-[11px] select-none">
                    <thead>
                      <tr className="border-b bg-zinc-950/50 font-extrabold text-slate-400 uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                        {tab === 'admin_history' && <th className="py-3.5 px-5">OPERATOR</th>}
                        <th className="py-3.5 px-5">SYS_DATE</th>
                        <th className="py-3.5 px-5">SHIFT_IN</th>
                        <th className="py-3.5 px-5">SHIFT_OUT</th>
                        <th className="py-3.5 px-5 text-center">CLOCK_IN_TIME</th>
                        <th className="py-3.5 px-5 text-center">BREAK_TIME</th>
                        <th className="py-3.5 px-5 text-center">NET_WORKING</th>
                        <th className="py-3.5 px-5 text-center">LINK_STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-300" style={{ borderColor: 'var(--border)' }}>
                      {sessions.map((session) => {
                        const totalSessionMins = session.clockOut
                          ? Math.round((new Date(session.clockOut).getTime() - new Date(session.clockIn).getTime()) / 60000)
                          : Math.round((Date.now() - new Date(session.clockIn).getTime()) / 60000);

                        return (
                          <tr key={session._id} className="hover:bg-cyan-500/[0.02] transition-all">
                            {tab === 'admin_history' && (
                              <td className="py-3 px-5">
                                <div className="font-extrabold text-white">{session.userId?.fullName.toUpperCase()}</div>
                                <div className="text-[9px] text-slate-500 mt-0.5 tracking-wider uppercase">{session.userId?.employeeId} &bull; {session.userId?.jobTitle}</div>
                              </td>
                            )}
                            <td className="py-3 px-5 font-semibold">
                              <div>{new Date(session.clockIn).toLocaleDateString([], { dateStyle: 'medium' })}</div>
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-[3px] text-[8px] font-extrabold uppercase tracking-wide border ${
                                session.shiftType === 'overtime'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                              }`}>
                                {session.shiftType === 'overtime' ? 'OVERTIME (OT)' : 'REGULAR'}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              {new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3 px-5">
                              {session.clockOut
                                 ? new Date(session.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                 : '--:--'}
                            </td>
                            <td className="py-3 px-5 text-center font-mono">
                              {formatMinutesToHoursAndMins(totalSessionMins)}
                            </td>
                            <td className="py-3 px-5 text-center font-mono text-amber-400">
                              {formatMinutesToHoursAndMins(session.userId?.breakLimitMinutes ?? 0)} ({session.breaks?.length || 0} breaks)
                              {session.breaks?.length > 0 && (
                                <div className="text-[9px] text-slate-500 font-normal font-sans mt-0.5">
                                  ({session.breaks.map((b: any) => `${b.breakType}: ${formatMinutesToHoursAndMins(b.duration)}`).join(', ')})
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-5 text-center font-bold text-cyan-400 font-mono">
                              {session.status === 'completed'
                                 ? formatMinutesToHoursAndMins(session.duration)
                                 : 'ACTIVE'}
                            </td>
                            <td className="py-3 px-5 text-center">
                              {session.status === 'completed' ? (
                                session.needsApproval ? (
                                  isAdmin ? (
                                    <div className="flex items-center justify-center gap-1.5 select-none font-mono">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveShift(session._id)}
                                        className="py-1 px-2.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 text-[9px] font-extrabold cursor-pointer transition-all"
                                      >
                                        APPROVE
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectShift(session._id)}
                                        className="py-1 px-2.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 text-[9px] font-extrabold cursor-pointer transition-all"
                                        title="Disapprove this shift session"
                                      >
                                        DISAPPROVE
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openEditSessionModal(session)}
                                        className="py-1 px-2.5 rounded bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                      >
                                        EDIT
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSession(session._id)}
                                        className="py-1 px-2.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                      >
                                        DELETE
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[8px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-sm badge uppercase animate-pulse">PENDING APPROVAL</span>
                                  )
                                ) : session.approvalStatus === 'rejected' ? (
                                  <div className="flex items-center justify-center gap-1.5 select-none font-mono">
                                    <span className="px-2 py-0.5 text-[8px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-sm badge uppercase">DISAPPROVED</span>
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleApproveShift(session._id)}
                                          className="py-1 px-2.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 text-[9px] font-extrabold cursor-pointer transition-all"
                                          title="Re-approve and complete this shift"
                                        >
                                          APPROVE
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openEditSessionModal(session)}
                                          className="py-1 px-2.5 rounded bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                        >
                                          EDIT
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSession(session._id)}
                                          className="py-1 px-2.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                        >
                                          DELETE
                                        </button>
                                      </>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5 select-none font-mono">
                                    <span className="px-2 py-0.5 text-[8px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-sm badge uppercase">
                                      {session.approvalStatus === 'approved' ? 'APPROVED' : 'COMPLETED'}
                                    </span>
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleRejectShift(session._id)}
                                          className="py-1 px-2.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 text-[9px] font-extrabold cursor-pointer transition-all"
                                          title="Disapprove and reject this completed shift"
                                        >
                                          DISAPPROVE
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openEditSessionModal(session)}
                                          className="py-1 px-2.5 rounded bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                        >
                                          EDIT
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSession(session._id)}
                                          className="py-1 px-2.5 rounded bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/25 hover:bg-[#ef4444]/20 text-[9px] font-extrabold cursor-pointer transition-all uppercase"
                                        >
                                          DELETE
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )
                              ) : session.status === 'on_break' ? (
                                <span className="px-2 py-0.5 text-[8px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/25 rounded-sm badge uppercase animate-pulse">ON BREAK</span>
                              ) : (
                                <span className="px-2 py-0.5 text-[8px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/25 rounded-sm badge uppercase animate-pulse">STREAMING</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {sessions.length === 0 && (
                        <tr>
                          <td colSpan={tab === 'admin_history' ? 7 : 6} className="text-center py-16 text-slate-500 text-xs italic select-none">
                            NO SHIFT DATA DECODED IN CURRENT SPECIFIED TIMELINE.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* Admin Break Configurator Panel */}
          {tab === 'admin_breaks' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Configure/Create Break Type Form */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card h-fit space-y-5"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="absolute top-1 left-2 text-[6px] opacity-20">CONFIG // REGISTER_BREAK_TEMPLATE</div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b pb-2 select-none" style={{ borderColor: 'var(--border)' }}>
                  NEW BREAK CONFIG
                </h3>

                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] uppercase font-bold tracking-wider rounded select-none">
                    // FAULT: {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded select-none">
                    // SUCCESS: {successMsg}
                  </div>
                )}

                <form onSubmit={handleCreateBreakType} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">BREAK TYPE NAME</label>
                    <input
                      type="text"
                      placeholder="e.g. LUNCH BREAK, COFFEE BREAK"
                      value={newBreakName}
                      onChange={(e) => setNewBreakName(e.target.value)}
                      className="input uppercase"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">DURATION (MINUTES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 15, 30, 45"
                      value={newBreakDuration}
                      onChange={(e) => setNewBreakDuration(e.target.value)}
                      className="input"
                      min="1"
                      required
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={breakActionLoading}
                    className="btn btn-primary w-full h-10 text-xs font-bold cursor-pointer border-0 flex items-center justify-center gap-2"
                  >
                    {breakActionLoading ? 'INITIALIZING...' : 'COMMIT BREAK CONFIG'}
                  </motion.button>
                </form>
              </motion.div>

              {/* Configured Break Types List */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card lg:col-span-2 overflow-hidden p-0 relative"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="absolute top-1 left-2 text-[6px] opacity-20">CONFIG // ACTIVE_BREAK_SCHEMAS</div>
                <div className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest select-none">
                    CONFIGURED BREAK SCHEMAS
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px] select-none">
                    <thead>
                      <tr className="border-b bg-zinc-950/50 font-extrabold text-slate-400 uppercase tracking-widest" style={{ borderColor: 'var(--border)' }}>
                        <th className="py-3 px-5">BREAK LABEL</th>
                        <th className="py-3 px-5">DURATION ALLOTMENT</th>
                        <th className="py-3 px-5 text-center">CONTROLS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-300" style={{ borderColor: 'var(--border)' }}>
                      {breakTypes.map((type) => (
                        <tr key={type._id} className="hover:bg-cyan-500/[0.02] transition-all">
                          <td className="py-3 px-5 font-bold text-white uppercase tracking-wider">
                            {type.name}
                          </td>
                          <td className="py-3 px-5 text-cyan-400 font-bold font-mono">
                            {type.duration} MINUTES
                          </td>
                          <td className="py-3 px-5 text-center">
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteBreakType(type._id)}
                              className="btn btn-secondary py-1 px-3.5 text-[9px] font-bold text-rose-400 hover:text-rose-300 border-rose-500/20 hover:border-rose-500/50 cursor-pointer"
                            >
                              DELETE
                            </motion.button>
                          </td>
                        </tr>
                      ))}

                      {breakTypes.length === 0 && (
                        <tr>
                          <td colSpan={3} className="text-center py-12 text-slate-500 text-xs italic">
                            NO CUSTOM BREAK SCHEMAS DETECTED.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Admin Shift Session Edit Modal */}
      <AnimatePresence>
        {editModalOpen && selectedSession && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md font-mono"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <Clock className="w-4.5 h-4.5 text-[#ef4444]" />
                  <span>EDIT SHIFT RECORD: {selectedSession.userId?.fullName?.toUpperCase() || ''}</span>
                </h3>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <span className="text-xs">✕</span>
                </button>
              </div>

              <form onSubmit={handleEditSessionSubmit} className="modal-body space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] uppercase font-bold tracking-wider rounded select-none">
                    // FAULT: {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold tracking-wider rounded select-none">
                    // SUCCESS: {successMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label mb-1">Clock In Timestamp *</label>
                  <input
                    type="datetime-local"
                    required
                    value={editFormData.clockIn}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, clockIn: e.target.value }))}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">Clock Out Timestamp</label>
                  <input
                    type="datetime-local"
                    value={editFormData.clockOut}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, clockOut: e.target.value }))}
                    className="input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">Duration (Minutes) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={editFormData.duration}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, duration: Number(e.target.value) }))}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">Shift Type *</label>
                    <select
                      value={editFormData.shiftType}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, shiftType: e.target.value }))}
                      className="select"
                    >
                      <option value="regular">REGULAR</option>
                      <option value="overtime">OVERTIME (OT)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">Approval Link Status *</label>
                  <select
                    value={editFormData.approvalStatus}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, approvalStatus: e.target.value }))}
                    className="select"
                  >
                    <option value="pending">PENDING APPROVAL</option>
                    <option value="approved">APPROVED / COMPLETED</option>
                    <option value="rejected">DISAPPROVED / DENIED</option>
                  </select>
                </div>

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    ABORT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    SAVE_CHANGES
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Date Detail Drawer */}
      <AnimatePresence>
        {selectedDateForDetail && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDateForDetail(null)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-950 border-l border-white/10 z-50 shadow-2xl flex flex-col font-mono calendar-drawer-container"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-widest uppercase">
                    // SHIFT_DETAILS: {selectedDateForDetail.toLocaleDateString([], { dateStyle: 'long' }).toUpperCase()}
                  </h3>
                  <p className="text-[8px] text-slate-500 tracking-wider uppercase mt-1">
                    Telemetry logs for {selectedDateForDetail.toLocaleDateString([], { weekday: 'long' })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDateForDetail(null)}
                  className="h-8 w-8 rounded border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {(() => {
                  const daySessions = sessions.filter((s) => {
                    const sDate = new Date(s.clockIn);
                    return sDate.getFullYear() === selectedDateForDetail.getFullYear() &&
                           sDate.getMonth() === selectedDateForDetail.getMonth() &&
                           sDate.getDate() === selectedDateForDetail.getDate();
                  });

                  if (daySessions.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-500 text-xs italic">
                        NO ACTIVE SHIFT RECORDS REGISTERED FOR THIS DATE.
                      </div>
                    );
                  }

                  return daySessions.map((session) => {
                    const totalSessionMins = session.clockOut
                      ? Math.round((new Date(session.clockOut).getTime() - new Date(session.clockIn).getTime()) / 60000)
                      : Math.round((Date.now() - new Date(session.clockIn).getTime()) / 60000);

                    return (
                      <div
                        key={session._id}
                        className="p-4 rounded border border-white/5 bg-zinc-900/30 space-y-3 relative overflow-hidden"
                      >
                        <div className="absolute top-1 right-2 text-[6px] opacity-10 font-mono">NODE_LOG_{session._id.substring(18)}</div>
                        
                        {/* Operator Info */}
                        <div className="flex items-center gap-3 border-b border-white/5 pb-2.5">
                          <div className="h-8 w-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                            {session.userId?.fullName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'OP'}
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-white uppercase">{session.userId?.fullName || 'UNKNOWN OPERATOR'}</div>
                            <div className="text-[8px] text-slate-500 mt-0.5 tracking-wider uppercase">
                              {session.userId?.employeeId || 'NO ID'} &bull; {session.userId?.jobTitle || 'OPERATOR'}
                            </div>
                          </div>
                        </div>

                        {/* Shift Times */}
                        <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-400 font-mono">
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">clock_in:</span>
                            <span className="text-white font-bold">{new Date(session.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">clock_out:</span>
                            <span className="text-white font-bold">
                              {session.clockOut 
                                ? new Date(session.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'ACTIVE'}
                            </span>
                          </div>
                        </div>

                        {/* Shift Durations & Types */}
                        <div className="grid grid-cols-3 gap-2 pt-2 text-[9px] font-mono border-t border-dashed border-white/5">
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">total_time:</span>
                            <span className="text-slate-300 font-semibold">{formatMinutesToHoursAndMins(totalSessionMins)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">break_limit:</span>
                            <span className="text-amber-400 font-semibold">{formatMinutesToHoursAndMins(session.userId?.breakLimitMinutes ?? 0)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[8px] uppercase">net_working:</span>
                            <span className="text-cyan-400 font-bold">
                              {session.status === 'completed' ? formatMinutesToHoursAndMins(session.duration) : 'ACTIVE'}
                            </span>
                          </div>
                        </div>

                        {/* Approval / Actions */}
                        <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-white/5">
                          <div>
                            <span className={`inline-block px-1.5 py-0.5 rounded-[2px] text-[7px] font-extrabold uppercase border ${
                              session.shiftType === 'overtime'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'
                            }`}>
                              {session.shiftType === 'overtime' ? 'overtime' : 'regular'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {session.status === 'completed' ? (
                              session.needsApproval ? (
                                isAdmin ? (
                                  <>
                                    <button
                                      onClick={() => handleApproveShift(session._id)}
                                      className="py-1 px-2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-[8px] font-bold cursor-pointer transition-all border-0 outline-none"
                                    >
                                      APPROVE
                                    </button>
                                    <button
                                      onClick={() => handleRejectShift(session._id)}
                                      className="py-1 px-2 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 text-[8px] font-bold cursor-pointer transition-all border-0 outline-none"
                                    >
                                      REJECT
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[7px] font-bold text-amber-400 tracking-wider">PENDING APPROVAL</span>
                                )
                              ) : session.approvalStatus === 'rejected' ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[7px] font-bold text-rose-400 tracking-wider">REJECTED</span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleApproveShift(session._id)}
                                      className="py-1 px-2 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-[8px] font-bold cursor-pointer transition-all border-0 outline-none"
                                    >
                                      APPROVE
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[7px] font-bold text-emerald-400 tracking-wider">APPROVED</span>
                              )
                            ) : (
                              <span className="text-[7px] font-bold text-cyan-400 tracking-wider animate-pulse">ACTIVE_STREAMING</span>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setSelectedDateForDetail(null);
                                  openEditSessionModal(session);
                                }}
                                className="py-1 px-2 rounded bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white text-[8px] font-bold cursor-pointer transition-all uppercase border-0"
                              >
                                edit
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
