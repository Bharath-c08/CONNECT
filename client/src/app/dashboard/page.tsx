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
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { apiRequest } from '../../utils/api';

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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    // Stopwatch timer logic
    if (clockedIn && activeSession?.clockIn) {
      const start = new Date(activeSession.clockIn).getTime();
      
      const updateTimer = () => {
        const now = Date.now();
        const diffMs = now - start;
        const diffSecs = Math.floor(diffMs / 1000);
        
        setElapsedSeconds(diffSecs);

        const hrs = Math.floor(diffSecs / 3600);
        const mins = Math.floor((diffSecs % 3600) / 60);
        const secs = diffSecs % 60;

        setElapsedTime(
          `${hrs.toString().padStart(2, '0')}h ${mins
            .toString()
            .padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`
        );
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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch profile
      const userProfile = await apiRequest('/auth/me');
      setUser(userProfile);

      // 2. Fetch clock status
      const clockData = await apiRequest('/clock/status');
      setClockedIn(clockData.clockedIn);
      setActiveSession(clockData.session);

      // 3. Fetch personal tasks
      const taskData = await apiRequest('/tasks/my');
      setTasks(taskData.slice(0, 4)); // Show top 4 active tasks

      // 4. Fetch shift history for analytics
      const historyData = await apiRequest('/clock/history');
      setHistory(historyData.slice(0, 10)); // Show last 10 sessions

      // 5. Fetch personal leaves
      const leaveData = await apiRequest('/leaves/my');
      setLeaves(leaveData.slice(0, 3)); // Show top 3 requests
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleClockInOut = async () => {
    setError('');
    try {
      if (clockedIn) {
        // Clock Out
        const data = await apiRequest('/clock/out', { method: 'POST' });
        setClockedIn(false);
        setActiveSession(null);
        
        // Trigger high-end confetti celebration
        confetti({
          particleCount: 150,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f43f5e', '#ffffff', '#fbbf24', '#6366f1']
        });

        fetchDashboardData();
      } else {
        // Clock In
        // Optional: attempt to get coordinates
        let location = null;
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              location = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                address: 'GPS Verified Location'
              };
              await triggerClockIn(location);
            },
            async () => {
              // Denied geoloc - clock in anyway
              await triggerClockIn(null);
            }
          );
        } else {
          await triggerClockIn(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Clock operations failed.');
    }
  };

  const triggerClockIn = async (location: any) => {
    const data = await apiRequest('/clock/in', {
      method: 'POST',
      body: JSON.stringify({ location }),
    });
    setClockedIn(true);
    setActiveSession(data.session);
    fetchDashboardData();
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
        colors: ['#f43f5e', '#10b981']
      });

      fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'Error updating task status.');
    }
  };

  // Process data for Recharts hours
  const getChartData = () => {
    if (history.length === 0) {
      return [
        { name: 'Mon', hours: 0 },
        { name: 'Tue', hours: 0 },
        { name: 'Wed', hours: 0 },
        { name: 'Thu', hours: 0 },
        { name: 'Fri', hours: 0 }
      ];
    }

    return [...history]
      .reverse()
      .slice(-7) // Last 7 sessions
      .map(session => {
        const date = new Date(session.clockIn);
        return {
          name: date.toLocaleDateString([], { weekday: 'short', day: 'numeric' }),
          hours: parseFloat((session.duration / 60).toFixed(2)),
          pay: Math.round((session.regularPay + session.overtimePay) * 100) / 100,
        };
      });
  };

  // Calculate live earnings since clocked in
  const getLiveEarnings = () => {
    if (!clockedIn || !user) return 0;
    const minutes = elapsedSeconds / 60;
    const monthlySalary = user.basicPay || 0;
    const hourlyPay = monthlySalary / 176;
    const payPerMinute = hourlyPay / 60;
    
    // Simple per-minute live calculation
    let earned = minutes * payPerMinute;
    
    // Check if overtime has started (e.g. active minutes > 480)
    if (user.overtimeEligible && minutes > 480) {
      const regularEarned = 480 * payPerMinute;
      const overtimeEarned = (minutes - 480) * (user.overtimePayPerMinute || 0);
      earned = regularEarned + overtimeEarned;
    }
    
    return Math.round(earned * 100) / 100;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-10 h-10 border-[3px] rounded-full animate-spin" style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--brand)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-xl text-sm"
          style={{ background: 'var(--danger-subtle)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--danger)' }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">System Alert</p>
            <p className="mt-0.5 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Welcome Header */}
      {user && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome back, <span style={{ color: 'var(--brand)' }}>{user.fullName}</span>
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Here is your operations overview for today.
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono select-none self-start sm:self-auto"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>ID</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.employeeId}</span>
          </div>
        </div>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Clock Card ── */}
        <div
          className="glass-card anim-fade-up anim-delay-1 flex flex-col gap-6"
          style={{ borderColor: 'rgba(239,68,68,0.12)' }}
        >
          {/* Card header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-subtle)' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Time Tracker</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {clockedIn ? 'Shift in progress' : 'Not clocked in'}
                </p>
              </div>
            </div>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: clockedIn ? 'var(--success)' : 'var(--text-muted)', boxShadow: clockedIn ? '0 0 6px var(--success)' : 'none' }}
            />
          </div>

          {/* Stopwatch */}
          <div className="text-center py-4">
            <p className="text-4xl font-bold font-mono tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-1px' }}>
              {elapsedTime}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              {clockedIn ? 'Live elapsed time' : 'Ready to start'}
            </p>
          </div>

          {/* Earnings & Button */}
          <div className="flex flex-col gap-3 mt-auto">
            {clockedIn && (
              <div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Est. shift earnings</span>
                <span className="text-sm font-bold font-mono" style={{ color: 'var(--success)' }}>₹{getLiveEarnings()}</span>
              </div>
            )}
            <button
              onClick={handleClockInOut}
              className="btn btn-primary w-full text-base"
              style={{
                height: '52px',
                background: clockedIn ? '#dc2626' : 'var(--brand)',
                boxShadow: clockedIn ? '0 4px 16px rgba(220,38,38,0.3)' : '0 4px 16px rgba(239,68,68,0.25)',
              }}
            >
              {clockedIn ? (
                <><Square className="w-4 h-4 fill-white" /><span>Clock Off</span></>
              ) : (
                <><Play className="w-4 h-4 fill-white" /><span>Clock In</span></>
              )}
            </button>
          </div>
        </div>

        {/* ── Shift Analytics Chart ── */}
        <div className="glass-card anim-fade-up anim-delay-2 lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-subtle)' }}>
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Shift Analytics</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>Hours worked (last 7 sessions)</p>
              </div>
            </div>
          </div>
          <div className="w-full flex-1" style={{ minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <AreaChart data={getChartData()} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--brand)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    padding: '10px 14px',
                  }}
                  itemStyle={{ color: 'var(--brand)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="hours" stroke="var(--brand)" strokeWidth={2} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Profile Summary ── */}
        <div className="glass-card anim-fade-up anim-delay-3 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-subtle)' }}>
              <UserIcon className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>My Profile</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>Employment details</p>
            </div>
          </div>
          {user && (
            <div className="flex flex-col gap-0">
              {[
                { label: 'Basic Pay', value: `₹${user.basicPay || 0}/mo`, mono: true },
                { label: 'Overtime', value: user.overtimeEligible ? 'Eligible' : 'Not Eligible', highlight: user.overtimeEligible ? 'success' : null },
                ...(user.overtimeEligible ? [{ label: 'OT Rate', value: `₹${user.overtimePayPerMinute || 0}/min`, mono: true }] : []),
                { label: 'Contract', value: user.employmentType || 'Full-time' },
                { label: 'Joined', value: user.joiningDate ? new Date(user.joiningDate).toLocaleDateString([], { dateStyle: 'medium' }) : 'N/A' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span
                    className={`text-sm font-semibold ${(row as any).mono ? 'font-mono' : ''}`}
                    style={{ color: (row as any).highlight === 'success' ? 'var(--success)' : 'var(--text-primary)' }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── My Tasks ── */}
        <div className="glass-card anim-fade-up anim-delay-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-subtle)' }}>
                <ClipboardList className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>My Tasks</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>Active assignments</p>
              </div>
            </div>
            <Link
              href="/dashboard/tasks"
              className="flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              <span>Board</span><ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No active tasks. Nice work!</p>
            ) : (
              tasks.map(task => (
                <div
                  key={task._id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                    <p className="text-xs mt-0.5 capitalize" style={{ color: 'var(--text-muted)' }}>{task.priority} priority</p>
                  </div>
                  {task.status !== 'completed' && (
                    <button
                      onClick={() => handleTaskComplete(task._id)}
                      className="btn-icon"
                      style={{ color: 'var(--success)', background: 'var(--success-subtle)', borderColor: 'rgba(16,185,129,0.2)' }}
                      title="Mark Complete"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Leave Tracker ── */}
        <div className="glass-card anim-fade-up anim-delay-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-subtle)' }}>
                <Calendar className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Leave</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>Recent requests</p>
              </div>
            </div>
            <Link
              href="/dashboard/leaves"
              className="flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              <span>Planner</span><ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {leaves.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No leave requests this month.</p>
            ) : (
              leaves.map(leave => (
                <div
                  key={leave._id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate capitalize" style={{ color: 'var(--text-primary)' }}>{leave.leaveType} Leave</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(leave.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })} –{' '}
                      {new Date(leave.endDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg capitalize"
                    style={{
                      background: leave.status === 'approved' ? 'var(--success-subtle)' : leave.status === 'rejected' ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
                      color: leave.status === 'approved' ? 'var(--success)' : leave.status === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                    }}
                  >
                    {leave.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

