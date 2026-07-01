'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Clock,
  Play,
  Square,
  TrendingUp,
  CheckSquare,
  Calendar,
  DollarSign,
  User as UserIcon,
  ChevronRight,
  ClipboardList,
  AlertCircle,
  Binary,
  Radio,
  Sliders
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { apiRequest } from '../../utils/api';
import { motion } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

const gridContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [clockedIn, setClockedIn] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00h 00m 00s');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [celebrations, setCelebrations] = useState<any[]>([]);
  
  const [breakTypes, setBreakTypes] = useState<any[]>([]);
  const [selectedBreakType, setSelectedBreakType] = useState<any>(null);
  const [breakElapsedTime, setBreakElapsedTime] = useState('00m 00s');
  const [clockStatus, setClockStatus] = useState<any>({
    regularShiftLimit: 8,
    otShiftLimit: 4,
    overtimeEligible: false,
    regularMinutesToday: 0,
    otMinutesToday: 0
  });
  const [selectedShiftType, setSelectedShiftType] = useState<'regular' | 'overtime'>('regular');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (clockedIn && activeSession?.clockIn) {
      const start = new Date(activeSession.clockIn).getTime();
      
      const updateTimer = () => {
        const now = Date.now();
        
        // Calculate breaks and excess penalty in real-time
        let totalBreakMs = 0;
        if (activeSession.breaks && activeSession.breaks.length > 0) {
          activeSession.breaks.forEach((b: any) => {
            const bStart = new Date(b.startedAt).getTime();
            const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : now;
            const actualDurationMs = bEnd - bStart;
            
            // Limit duration in ms
            const limitMs = (b.duration || 0) * 60000;
            const excessMs = Math.max(0, actualDurationMs - limitMs);
            
            // Total deduction is the break duration itself + excess penalty
            totalBreakMs += (actualDurationMs + excessMs);
          });
        }

        const elapsedMs = Math.max(0, (now - start) - totalBreakMs);
        const elapsedSecs = Math.floor(elapsedMs / 1000);
        
        setElapsedSeconds(elapsedSecs);

        const hrs = Math.floor(elapsedSecs / 3600);
        const mins = Math.floor((elapsedSecs % 3600) / 60);
        const secs = elapsedSecs % 60;

        setElapsedTime(
          `${hrs.toString().padStart(2, '0')}h ${mins
            .toString()
            .padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
        );

        // Calculate active break duration
        if (activeSession.status === 'on_break') {
          const activeBreak = activeSession.breaks?.find((b: any) => !b.endedAt);
          if (activeBreak) {
            const breakStart = new Date(activeBreak.startedAt).getTime();
            const breakDiffMs = now - breakStart;
            const breakDiffSecs = Math.max(0, Math.floor(breakDiffMs / 1000));
            const bMins = Math.floor(breakDiffSecs / 60);
            const bSecs = breakDiffSecs % 60;
            setBreakElapsedTime(`${bMins.toString().padStart(2, '0')}m ${bSecs.toString().padStart(2, '0')}s`);
          }
        }
      };
      
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime('00h 00m 00s');
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clockedIn, activeSession]);

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [
        userProfileRes,
        clockDataRes,
        taskDataRes,
        historyDataRes,
        leaveDataRes,
        breakTypesDataRes,
        eventsRes
      ] = await Promise.allSettled([
        apiRequest('/auth/me'),
        apiRequest(`/clock/status?timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}`),
        apiRequest('/tasks/my'),
        apiRequest('/clock/history'),
        apiRequest('/leaves/my'),
        apiRequest('/clock/breaks/types'),
        apiRequest('/events')
      ]);

      if (userProfileRes.status === 'fulfilled') {
        setUser(userProfileRes.value);
      } else {
        console.error('Error fetching user profile:', userProfileRes.reason);
      }

      if (clockDataRes.status === 'fulfilled') {
        const clockData = clockDataRes.value;
        setClockedIn(clockData.clockedIn);
        setActiveSession(clockData.session);
        setClockStatus({
          regularShiftLimit: clockData.regularShiftLimit ?? 8,
          otShiftLimit: clockData.otShiftLimit ?? 4,
          overtimeEligible: clockData.overtimeEligible ?? false,
          regularMinutesToday: clockData.regularMinutesToday ?? 0,
          otMinutesToday: clockData.otMinutesToday ?? 0
        });
        if ((clockData.regularMinutesToday ?? 0) >= (clockData.regularShiftLimit ?? 8) * 60 && clockData.overtimeEligible) {
          setSelectedShiftType('overtime');
        } else {
          setSelectedShiftType('regular');
        }
      } else {
        console.error('Error fetching clock status:', clockDataRes.reason);
        setError('CRITICAL: Failed to retrieve shift telemetry status.');
      }

      if (taskDataRes.status === 'fulfilled') {
        setTasks(taskDataRes.value.slice(0, 4));
      } else {
        console.error('Error fetching tasks:', taskDataRes.reason);
      }

      if (historyDataRes.status === 'fulfilled') {
        setHistory(historyDataRes.value.slice(0, 10));
      } else {
        console.error('Error fetching history:', historyDataRes.reason);
      }

      if (leaveDataRes.status === 'fulfilled') {
        setLeaves(leaveDataRes.value.slice(0, 3));
      } else {
        console.error('Error fetching leaves:', leaveDataRes.reason);
      }

      if (eventsRes.status === 'fulfilled') {
        setEvents(eventsRes.value.events || []);
        setCelebrations(eventsRes.value.celebrations || []);
      } else {
        console.error('Error fetching events:', eventsRes.reason);
      }

      if (breakTypesDataRes.status === 'fulfilled') {
        const breakTypesData = breakTypesDataRes.value;
        setBreakTypes(breakTypesData);
        if (breakTypesData.length > 0) {
          setSelectedBreakType(breakTypesData[0]);
        }
      } else {
        console.error('Error fetching break types:', breakTypesDataRes.reason);
      }
    } catch (err: any) {
      setError(err.message || 'ERROR CONNECTING TO SYS_CORE. PLEASE LINK UPLINK INTERFACE.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleClockInOut = async () => {
    setError('');
    try {
      if (clockedIn) {
        // Clock Out
        await apiRequest('/clock/out', { method: 'POST' });
        setClockedIn(false);
        setActiveSession(null);
        
        confetti({
          particleCount: 150,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#ef4444', '#d946ef', '#ffffff', '#10b981']
        });

        fetchDashboardData(true);
      } else {
        // Clock In
        let location = null;
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              location = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                address: 'GPS LINK VERIFIED'
              };
              await triggerClockIn(location);
            },
            async () => {
              await triggerClockIn(null);
            }
          );
        } else {
          await triggerClockIn(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'CLOCK TELEMETRY FAULT.');
    }
  };

  const triggerClockIn = async (location: any) => {
    const data = await apiRequest('/clock/in', {
      method: 'POST',
      body: JSON.stringify({ 
        location, 
        shiftType: selectedShiftType,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }),
    });
    setClockedIn(true);
    setActiveSession(data.session);
    fetchDashboardData();
  };

  const handleStartBreak = async () => {
    if (!selectedBreakType) return;
    setError('');
    try {
      const data = await apiRequest('/clock/break/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakType: selectedBreakType.name,
          duration: selectedBreakType.duration,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      setActiveSession(data.session);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'START BREAK TELEMETRY FAULT.');
    }
  };

  const handleEndBreak = async () => {
    setError('');
    try {
      const data = await apiRequest('/clock/break/end', {
        method: 'POST'
      });
      setActiveSession(data.session);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'END BREAK TELEMETRY FAULT.');
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'completed' }),
      });
      
      confetti({
        particleCount: 50,
        spread: 40,
        colors: ['#ef4444', '#10b981']
      });

      fetchDashboardData(true);
    } catch (err: any) {
      setError(err.message || 'MISSION UPDATE FAILED.');
    }
  };

  const getChartData = () => {
    if (history.length === 0) {
      return [
        { name: '01', hours: 0 },
        { name: '02', hours: 0 },
        { name: '03', hours: 0 },
        { name: '04', hours: 0 },
        { name: '05', hours: 0 }
      ];
    }

    return [...history]
      .reverse()
      .slice(-7)
      .map((session, index) => {
        const date = new Date(session.clockIn);
        return {
          name: date.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
          hours: parseFloat((session.duration / 60).toFixed(2)),
          pay: Math.round((session.regularPay + session.overtimePay) * 100) / 100,
        };
      });
  };

  const getLiveEarnings = () => {
    if (!clockedIn || !user) return 0;
    const minutes = elapsedSeconds / 60;
    const monthlySalary = user.basicPay || 0;
    const hourlyPay = monthlySalary / 176;
    const payPerMinute = hourlyPay / 60;
    
    let earned = minutes * payPerMinute;
    
    if (user.overtimeEligible && minutes > 480) {
      const regularEarned = 480 * payPerMinute;
      const overtimeEarned = (minutes - 480) * (user.overtimePayPerMinute || 0);
      earned = regularEarned + overtimeEarned;
    }
    
    return Math.round(earned * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 font-mono text-[11px] tracking-wider select-none text-slate-500">
        <Binary className="w-8 h-8 text-cyan-400 animate-spin" />
        <p>DECODING CORE_DASHBOARD TELEMETRY...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs select-none"
        >
          <AlertCircle className="w-4.5 h-4.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-extrabold">// TELEMETRY_ALARM</p>
            <p className="mt-1 opacity-80">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Welcome Header */}
      {user && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springTransition}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none font-mono"
        >
          <div>
            <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444]">
              // ACTIVE_OPERATOR: {user.fullName.toUpperCase()}
            </h1>
            <p className="mt-1 text-[10px] text-slate-500 tracking-wider">
              UPLINK DECK_01 SECURE TERMINAL ESTABLISHED.
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs select-none self-start sm:self-auto border bg-zinc-950/40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <span className="opacity-45 text-[10px]">OPERATOR_ID:</span>
            <span className="font-bold text-white tracking-widest">{user.employeeId}</span>
          </div>
        </motion.div>
      )}

      {/* Communal Events & Celebrations Spotlight Alert */}
      {(() => {
        const todayStr = new Date().toDateString();
        const todayEvents = events.filter(e => new Date(e.date).toDateString() === todayStr);
        const todayCelebrations = celebrations.filter(c => c.isToday);
        
        if (todayCelebrations.length === 0 && todayEvents.length === 0) return null;
        
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={springTransition}
            className="mb-8 p-6 rounded-xl border relative overflow-hidden font-mono shadow-2xl select-none events-card-container"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(217, 70, 239, 0.25) 50%, rgba(6, 182, 212, 0.25) 100%)',
              borderColor: '#ef4444',
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.3), inset 0 0 15px rgba(217, 70, 239, 0.2)'
            }}
          >
            <div className="text-[7px] text-pink-400 font-bold uppercase tracking-wider mb-4 animate-pulse">// PRIORITY_UPLINK: TODAY_COMMUNAL_ALERTS</div>
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ef4444] to-[#d946ef] text-white flex items-center justify-center shadow-lg shrink-0 animate-bounce">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                {todayCelebrations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center justify-center md:justify-start gap-2">
                      <span>TODAY'S CELEBRATIONS! 🎉</span>
                    </h3>
                    <div className="mt-1.5 space-y-1 text-xs">
                      {todayCelebrations.map((c, i) => (
                        <p key={i} className="text-slate-200">
                          &bull; <strong className="text-cyan-400">{c.fullName.toUpperCase()}</strong> (ID: {c.employeeId}) is celebrating a{' '}
                          <span className="text-pink-400 font-bold uppercase">
                            {c.type === 'birthday' ? 'Birthday 🎂' : `Work Anniversary (${c.years} Year${c.years > 1 ? 's' : ''}) 🎖️`}
                          </span>{' '}
                          today!
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {todayEvents.length > 0 && (
                  <div className={todayCelebrations.length > 0 ? "pt-3 border-t border-white/10" : ""}>
                    <h3 className="text-sm font-black text-white tracking-widest uppercase text-left">
                      TODAY'S EVENT LOGS & ANNOUNCEMENTS
                    </h3>
                    <div className="mt-2 space-y-3">
                      {todayEvents.map((event) => (
                        <div key={event._id} className="p-3.5 rounded border bg-zinc-950/40 border-white/5 text-left">
                          <h4 className="text-xs font-bold text-cyan-400 uppercase">{event.title}</h4>
                          <p className="text-xs text-slate-350 mt-1 leading-relaxed whitespace-pre-line">{event.description}</p>
                          <p className="text-[9px] text-slate-500 mt-2 uppercase tracking-wider">
                            PUBLISHER: {event.creator?.fullName || 'SYSTEM_ADMIN'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Bento Grid */}
      <motion.div 
        variants={gridContainerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >

        {/* ── Clock Card ── */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -2 }}
          className="card flex flex-col gap-6"
          style={{ borderColor: clockedIn ? 'var(--success)' : 'var(--border)' }}
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">MODULE_01 // TIME_TELEMETRY</div>
          
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
                <Clock className="w-4 h-4" />
              </div>
              <div className="font-mono">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SHIFT_LOG</p>
                <p className="text-[11px] font-extrabold mt-0.5" style={{ color: clockedIn ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {clockedIn ? 'TRANSMITTING...' : 'DISCONNECTED'}
                </p>
              </div>
            </div>
            {clockedIn ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            )}
          </div>

          <div className="text-center py-1 select-none flex flex-col gap-1.5">
            <p className="text-3xl font-extrabold font-mono tracking-widest text-white animate-pulse" style={{ letterSpacing: '2px' }}>
              {elapsedTime}
            </p>
            <p className="text-[9px] font-mono text-slate-500 tracking-wider">
              {clockedIn 
                ? `ACTIVE ${activeSession?.shiftType === 'overtime' ? 'OVERTIME (OT)' : 'REGULAR'} SHIFT RUNNING` 
                : 'SYSTEM_READY'}
            </p>
          </div>

          {/* Shift Telemetry Limits Tracker */}
          <div className="flex flex-col gap-2 p-3 rounded bg-zinc-950/40 border text-[10px] font-mono select-none" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>REGULAR SHIFT CAP:</span>
                <span className="text-white font-bold">
                  {((clockStatus.regularMinutesToday || 0) / 60).toFixed(1)} / {clockStatus.regularShiftLimit} hrs
                </span>
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                <div 
                  className="bg-[#ef4444] h-1 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((clockStatus.regularMinutesToday || 0) / (clockStatus.regularShiftLimit * 60)) * 100)}%` }} 
                />
              </div>
            </div>

            {clockStatus.overtimeEligible && (
              <div className="flex flex-col gap-1 mt-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-slate-400">
                  <span>OVERTIME (OT) SHIFT CAP:</span>
                  <span className="text-white font-bold">
                    {((clockStatus.otMinutesToday || 0) / 60).toFixed(1)} / {clockStatus.otShiftLimit} hrs
                  </span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, ((clockStatus.otMinutesToday || 0) / (clockStatus.otShiftLimit * 60)) * 100)}%` }} 
                  />
                </div>
              </div>
            )}
          </div>

          {/* Shift Type Selection (when clocked out) */}
          {!clockedIn && (
            <div className="flex flex-col gap-2 p-3 rounded bg-zinc-950/40 border" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">SELECT TARGET SHIFT MODE:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedShiftType('regular')}
                  disabled={(clockStatus.regularMinutesToday || 0) >= clockStatus.regularShiftLimit * 60}
                  className={`py-2 rounded text-[10px] font-extrabold uppercase border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    selectedShiftType === 'regular'
                      ? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title={
                    (clockStatus.regularMinutesToday || 0) >= clockStatus.regularShiftLimit * 60 
                      ? 'Regular limit met today.' 
                      : 'Clock in to regular shift'
                  }
                >
                  <span>Regular</span>
                  <span className="text-[8px] font-normal opacity-85">
                    {((clockStatus.regularMinutesToday || 0) / 60).toFixed(1)}h done
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedShiftType('overtime')}
                  disabled={!clockStatus.overtimeEligible || (clockStatus.regularMinutesToday || 0) < clockStatus.regularShiftLimit * 60 || (clockStatus.otMinutesToday || 0) >= clockStatus.otShiftLimit * 60}
                  className={`py-2 rounded text-[10px] font-extrabold uppercase border transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    selectedShiftType === 'overtime'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title={
                    !clockStatus.overtimeEligible 
                      ? 'Not OT Eligible' 
                      : (clockStatus.regularMinutesToday || 0) < clockStatus.regularShiftLimit * 60 
                        ? 'Exhaust regular shift first.' 
                        : (clockStatus.otMinutesToday || 0) >= clockStatus.otShiftLimit * 60 
                          ? 'OT limit met today.' 
                          : 'Clock in to Overtime shift'
                  }
                >
                  <span>Overtime (OT)</span>
                  <span className="text-[8px] font-normal opacity-85">
                    {((clockStatus.otMinutesToday || 0) / 60).toFixed(1)}h done
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-auto font-mono">
            {clockedIn && activeSession && (
              <div className="flex flex-col gap-2.5 p-3 rounded bg-zinc-950/60 border select-none" style={{ borderColor: 'var(--border)' }}>
                {activeSession.status === 'on_break' ? (
                  <>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        ON BREAK: {activeSession.breaks?.find((b: any) => !b.endedAt)?.breakType}
                      </span>
                      <span className="text-slate-500 font-mono">LIMIT: {activeSession.breaks?.find((b: any) => !b.endedAt)?.duration}m</span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="text-slate-400">BREAK ELAPSED:</span>
                      <span className="font-bold text-white font-mono">{breakElapsedTime}</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={handleEndBreak}
                      className="mt-2 btn btn-secondary w-full h-8 text-[10px] cursor-pointer flex items-center justify-center gap-1 border-amber-500/30 hover:border-amber-500/60 text-amber-400"
                    >
                      CONCLUDE BREAK
                    </motion.button>
                  </>
                ) : (
                  <>
                    {breakTypes.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 tracking-wider">
                          <span>SELECT BREAK TYPE:</span>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={selectedBreakType ? JSON.stringify(selectedBreakType) : ''}
                            onChange={(e) => setSelectedBreakType(e.target.value ? JSON.parse(e.target.value) : null)}
                            className="select flex-1 h-8 py-0 px-2 text-[10px]"
                          >
                            {breakTypes.map((type) => (
                              <option key={type._id} value={JSON.stringify(type)}>
                                {type.name} ({type.duration} MINS)
                              </option>
                            ))}
                          </select>
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleStartBreak}
                            className="btn btn-secondary h-8 px-3 text-[10px] cursor-pointer text-cyan-400 border-cyan-500/20 hover:border-cyan-500/50"
                          >
                            GO ON BREAK
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 text-center py-1">
                        NO BREAK TEMPLATES CONFIGURED BY ADMIN
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleClockInOut}
              className="btn btn-primary w-full h-11 text-xs cursor-pointer border-0 mt-1"
              style={{
                background: clockedIn ? 'var(--danger)' : 'var(--brand)',
                boxShadow: clockedIn ? '0 0 15px rgba(244,63,94,0.2)' : '0 0 15px rgba(6,182,212,0.2)',
              }}
            >
              {clockedIn ? (
                <><Square className="w-3.5 h-3.5 fill-current" /><span>DISCONNECT_SHIFT</span></>
              ) : (
                <><Play className="w-3.5 h-3.5 fill-current" /><span>INITIATE_SHIFT</span></>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* ── Shift Analytics Chart ── */}
        <motion.div 
          variants={cardVariants}
          whileHover={{ y: -2 }}
          className="card lg:col-span-2 flex flex-col gap-5"
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">MODULE_02 // LOAD_WAVE_ANALYSER</div>
          
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="font-mono">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WAVE_SPECTRUM</p>
                <p className="text-[11px] font-extrabold mt-0.5 text-slate-400">Shift Telemetry analytics (7 sessions)</p>
              </div>
            </div>
          </div>
          <div className="w-full flex-1" style={{ minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <AreaChart data={getChartData()} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(99, 102, 241, 0.08)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={9} tickLine={false} className="font-mono" />
                <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} className="font-mono" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '4px',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    padding: '8px 12px',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                  itemStyle={{ color: 'var(--brand)', fontWeight: 700 }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="hours" stroke="var(--brand)" strokeWidth={1.5} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Profile Summary ── */}
        <motion.div 
          variants={cardVariants}
          whileHover={{ y: -2 }}
          className="card flex flex-col gap-5"
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">MODULE_03 // OPERATOR_CREDENTIALS</div>
          
          <div className="flex items-center gap-3 select-none">
            <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="font-mono">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PARAMETERS</p>
              <p className="text-[11px] font-extrabold mt-0.5 text-slate-400">Operator Registry metrics</p>
            </div>
          </div>
          {user && (
            <div className="flex flex-col gap-0 select-none font-mono text-xs">
              {[
                { label: 'BASIC_PAY', value: `₹${user.basicPay || 0}/mo`, mono: true },
                { label: 'OVERTIME', value: user.overtimeEligible ? 'SECURE_OT' : 'NO_OT', highlight: user.overtimeEligible ? 'success' : null },
                ...(user.overtimeEligible ? [{ label: 'OT_WAGE_RATE', value: `₹${user.overtimePayPerMinute || 0}/min`, mono: true }] : []),
                { label: 'CONTRACT', value: (user.employmentType || 'FULLTIME').toUpperCase() },
                { label: 'ESTABLISHED', value: user.joiningDate ? new Date(user.joiningDate).toLocaleDateString([], { dateStyle: 'short' }) : 'N/A' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-slate-500 text-[10px]">{row.label}</span>
                  <span
                    className={`font-semibold ${(row as any).mono ? 'font-mono text-cyan-400' : ''}`}
                    style={{ color: (row as any).highlight === 'success' ? 'var(--success)' : 'var(--text-primary)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── My Tasks ── */}
        <motion.div 
          variants={cardVariants}
          whileHover={{ y: -2 }}
          className="card flex flex-col gap-5"
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">MODULE_04 // ACTIVE_MISSIONS</div>
          
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div className="font-mono">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">MISSION_LOGS</p>
                <p className="text-[11px] font-extrabold mt-0.5 text-slate-400">Assigned tactical pipelines</p>
              </div>
            </div>
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-0.5 text-[10px] font-mono font-bold tracking-widest uppercase hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              <span>SYS_BOARD</span><ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <p className="text-[11px] font-mono text-center py-8 text-slate-500 italic">NO ASSIGNED MISSION CAPSULES.</p>
            ) : (
              tasks.map(task => (
                <div
                  key={task._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded border"
                  style={{ background: 'rgba(16,16,24,0.4)', borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0 flex-1 select-none font-mono">
                    <p className="text-xs font-bold truncate text-white">{task.title}</p>
                    <p className="text-[9px] mt-0.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>PRIORITY: {task.priority}</p>
                  </div>
                  {task.status !== 'completed' && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTaskComplete(task._id)}
                      className="btn-icon cursor-pointer h-7 w-7 rounded"
                      style={{ color: 'var(--success)', background: 'var(--success-subtle)', borderColor: 'rgba(16,185,129,0.3)' }}
                      title="MARK_SOLVED"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* ── Leave Tracker ── */}
        <motion.div 
          variants={cardVariants}
          whileHover={{ y: -2 }}
          className="card flex flex-col gap-5"
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-25">MODULE_05 // DISCONNECT_LOGS</div>
          
          <div className="flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded bg-[#ef4444]/10 border border-[#ef4444]/20 flex items-center justify-center text-[#ef4444]">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="font-mono">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SCHEDULE_LOG</p>
                <p className="text-[11px] font-extrabold mt-0.5 text-slate-400">Departure timeoff logs</p>
              </div>
            </div>
            <Link
              href="/dashboard/leaves"
              className="flex items-center gap-0.5 text-[10px] font-mono font-bold tracking-widest uppercase hover:underline"
              style={{ color: 'var(--brand)' }}
            >
              <span>SYS_PLANNER</span><ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {leaves.length === 0 ? (
              <p className="text-[11px] font-mono text-center py-8 text-slate-500 italic">NO TIME OFF REGISTRY DETECTED.</p>
            ) : (
              leaves.map(leave => (
                <div
                  key={leave._id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 rounded border"
                  style={{ background: 'rgba(16,16,24,0.4)', borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0 flex-1 select-none font-mono">
                    <p className="text-xs font-bold truncate text-white capitalize">{leave.leaveType} Leave</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
                      {new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className="text-[9px] font-mono font-bold px-2 py-0.5 rounded capitalize select-none border"
                    style={{
                      background: leave.status === 'approved' ? 'var(--success-subtle)' : leave.status === 'rejected' ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
                      color: leave.status === 'approved' ? 'var(--success)' : leave.status === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                      borderColor: leave.status === 'approved' ? 'rgba(16,185,129,0.3)' : leave.status === 'rejected' ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)'
                    }}
                  >
                    {leave.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
