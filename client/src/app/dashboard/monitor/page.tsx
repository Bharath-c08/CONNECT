'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Eye,
  Video,
  VideoOff,
  Activity,
  MousePointer,
  Keyboard,
  Cpu,
  HardDrive,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Camera,
  Download,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Maximize2,
  Minimize2,
  X,
  TrendingUp,
  BarChart3,
  Layers,
  Sparkles,
  Zap,
  Flame,
  Radio,
  FileText
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

interface Operator {
  _id: string;
  fullName: string;
  employeeId: string;
  email: string;
  jobTitle: string;
  role: string;
  profilePhoto: string;
  phone: string;
  teams: any[];
  isOnline: boolean;
  isClockedIn: boolean;
  isOnBreak: boolean;
  workingStatus: 'active_working' | 'idle_warning' | 'extended_idle' | 'on_break' | 'offline';
  sessionId: string | null;
  clockInTime: string | null;
  shiftElapsedMinutes: number;
  breakElapsedMinutes: number;
  netWorkingMinutes: number;
  idleMinutes: number;
  totalEvents: number;
  eventsPerMinute: number;
  activityStats: {
    mouseMovements: number;
    mouseClicks: number;
    keyPresses: number;
    lastActivityAt: string | null;
  };
  performanceTelemetry: {
    cpuLatencyMs: number;
    memoryUsageMb: number;
    monitoringStatus: string;
  };
  productivityScore: number;
  activeTasks: any[];
  completedTasksTodayCount: number;
  regularShiftLimit: number;
  breakLimitMinutes: number;
}

export default function SuperAdminMonitorPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(4); // seconds, 0 = off

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active_working' | 'idle_warning' | 'on_break' | 'camera_on' | 'offline'>('all');
  const [sortBy, setSortBy] = useState<'productivity_desc' | 'productivity_asc' | 'idle_desc' | 'shift_desc' | 'name_asc'>('productivity_desc');
  const [activeTab, setActiveTab] = useState<'grid' | 'matrix' | 'analytics' | 'audit'>('grid');

  // Socket & Live Video State
  const [socket, setSocket] = useState<Socket | null>(null);
  // Map of userId -> { status: 'requesting' | 'live' | 'error', lastFrame: string, lastTimestamp: number }
  const [cameraFeeds, setCameraFeeds] = useState<{
    [userId: string]: {
      status: 'requesting' | 'live' | 'error';
      lastFrame?: string;
      lastTimestamp?: number;
      fps?: number;
    };
  }>({});

  // Fullscreen / Focused Inspection Modal
  const [focusedOperator, setFocusedOperator] = useState<Operator | null>(null);

  // Nudge Modal
  const [nudgeModalOperator, setNudgeModalOperator] = useState<Operator | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudgeType, setNudgeType] = useState<'warning' | 'info' | 'kudos'>('warning');
  const [nudgeSending, setNudgeSending] = useState(false);
  const [nudgeSuccess, setNudgeSuccess] = useState(false);

  // WebRTC PeerConnections map for live stream tracks: userId -> RTCPeerConnection
  const peerConnectionsRef = useRef<{ [userId: string]: RTCPeerConnection }>({});

  // 1. Initial Auth Check & Socket Setup
  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);

    const s = io(getSocketUrl());
    setSocket(s);

    if (usr) {
      s.on('connect', () => {
        s.emit('join-room', usr._id || usr.id);
        s.emit('register-user', usr._id || usr.id);
      });
    }

    // Socket: Live Camera Frame Received
    s.on('monitor-camera-frame', (data: { userId: string; frameData: string; timestamp: number }) => {
      setCameraFeeds((prev) => {
        const current = prev[data.userId];
        return {
          ...prev,
          [data.userId]: {
            status: 'live',
            lastFrame: data.frameData,
            lastTimestamp: data.timestamp,
            fps: current?.lastTimestamp ? Math.round(1000 / (data.timestamp - current.lastTimestamp)) : 1
          }
        };
      });
    });

    // Socket: Camera Accepted & Ready
    s.on('monitor-camera-ready', (data: { userId: string; userName?: string }) => {
      setCameraFeeds((prev) => ({
        ...prev,
        [data.userId]: {
          ...(prev[data.userId] || {}),
          status: 'live'
        }
      }));
    });

    return () => {
      s.disconnect();
    };
  }, []);

  // 2. Fetch Data
  const fetchTelemetryData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [opsData, analyticsData, logsData] = await Promise.all([
        apiRequest('/monitor/operators'),
        apiRequest('/monitor/analytics'),
        apiRequest('/monitor/audit-log')
      ]);

      setOperators(opsData || []);
      setAnalytics(analyticsData || null);
      setAuditLogs(logsData || []);
    } catch (err) {
      console.error('Error fetching monitor telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      fetchTelemetryData();
    } else if (currentUser && currentUser.role !== 'superadmin') {
      setLoading(false);
    }
  }, [currentUser]);

  // 3. Auto-refresh Loop
  useEffect(() => {
    if (autoRefreshInterval <= 0 || currentUser?.role !== 'superadmin') return;

    const interval = setInterval(() => {
      fetchTelemetryData(true);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, currentUser]);

  // Camera Control: Turn On Camera for User
  const handleTurnOnCamera = (operator: Operator) => {
    if (!socket) return;

    setCameraFeeds((prev) => ({
      ...prev,
      [operator._id]: {
        status: 'requesting',
        lastTimestamp: Date.now()
      }
    }));

    socket.emit('monitor-request-camera', {
      targetUserId: operator._id,
      adminId: currentUser?._id || currentUser?.id,
      adminName: currentUser?.fullName || 'Super Administrator'
    });

    // Log audit event
    apiRequest('/monitor/audit', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: operator._id,
        actionType: 'camera_start',
        title: 'Camera Surveillance Initiated',
        details: `Supervisor initiated live working performance feed for ${operator.fullName} (${operator.employeeId})`
      })
    }).catch(() => {});
  };

  // Camera Control: Stop Camera for User
  const handleStopCamera = (operatorId: string) => {
    if (!socket) return;

    setCameraFeeds((prev) => {
      const updated = { ...prev };
      delete updated[operatorId];
      return updated;
    });

    if (peerConnectionsRef.current[operatorId]) {
      peerConnectionsRef.current[operatorId].close();
      delete peerConnectionsRef.current[operatorId];
    }

    socket.emit('monitor-stop-camera', {
      targetUserId: operatorId
    });

    // Log audit event
    apiRequest('/monitor/audit', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: operatorId,
        actionType: 'camera_stop',
        title: 'Camera Surveillance Terminated',
        details: `Supervisor disconnected live camera feed.`
      })
    }).catch(() => {});
  };

  // Batch: Turn On All Working Cameras
  const handleTurnOnAllWorkingCameras = () => {
    operators
      .filter((op) => op.isClockedIn && op.workingStatus !== 'offline')
      .forEach((op) => {
        handleTurnOnCamera(op);
      });
  };

  // Batch: Stop All Cameras
  const handleStopAllCameras = () => {
    Object.keys(cameraFeeds).forEach((userId) => {
      handleStopCamera(userId);
    });
  };

  // Take Snapshot of Live Feed with Watermark
  const handleCaptureSnapshot = async (operator: Operator) => {
    const feed = cameraFeeds[operator._id];
    if (!feed?.lastFrame) {
      alert('No active camera frame available to capture.');
      return;
    }

    // Create canvas to stamp audit verification watermark
    const img = new Image();
    img.src = feed.lastFrame;
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 640;
      canvas.height = img.height || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw video frame
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Add watermark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(
        `OPERATOR: ${operator.fullName.toUpperCase()} [${operator.employeeId}] | ROLE: ${operator.jobTitle.toUpperCase()}`,
        15,
        canvas.height - 28
      );

      ctx.fillStyle = '#10b981';
      ctx.font = '10px monospace';
      ctx.fillText(
        `TIME: ${new Date().toISOString()} | PRODUCTIVITY: ${operator.productivityScore}% | AUDITOR: ${currentUser?.fullName || 'SUPER ADMIN'}`,
        15,
        canvas.height - 12
      );

      const stampedDataUrl = canvas.toDataURL('image/png');

      // Trigger download
      const a = document.createElement('a');
      a.href = stampedDataUrl;
      a.download = `AUDIT_${operator.employeeId}_${Date.now()}.png`;
      a.click();

      // Log to backend audit trail
      try {
        await apiRequest('/monitor/audit', {
          method: 'POST',
          body: JSON.stringify({
            targetUserId: operator._id,
            actionType: 'snapshot_captured',
            title: 'Performance Snapshot Stamped & Downloaded',
            details: `Supervisor verified working state of ${operator.fullName}. Score at capture: ${operator.productivityScore}%`,
            metricsSnapshot: {
              productivityScore: operator.productivityScore,
              eventsPerMinute: operator.eventsPerMinute,
              mouseMovements: operator.activityStats.mouseMovements,
              mouseClicks: operator.activityStats.mouseClicks,
              keyPresses: operator.activityStats.keyPresses,
              idleMinutes: operator.idleMinutes,
              shiftElapsedMinutes: operator.shiftElapsedMinutes
            }
          })
        });
        fetchTelemetryData(true);
      } catch (err) {
        console.error('Error logging snapshot:', err);
      }
    };
  };

  // Send Productivity Nudge to Operator
  const handleSendNudge = async () => {
    if (!nudgeModalOperator || !nudgeMessage.trim()) return;

    setNudgeSending(true);
    try {
      await apiRequest('/monitor/nudge', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: nudgeModalOperator._id,
          message: nudgeMessage.trim(),
          type: nudgeType,
          title:
            nudgeType === 'warning'
              ? '⚠️ Supervisor Productivity Alert'
              : nudgeType === 'kudos'
              ? '🌟 Supervisor Performance Commendation'
              : '📢 Supervisor Notice'
        })
      });

      setNudgeSuccess(true);
      setTimeout(() => {
        setNudgeSuccess(false);
        setNudgeModalOperator(null);
        setNudgeMessage('');
      }, 1500);
      fetchTelemetryData(true);
    } catch (err: any) {
      alert(`Error sending nudge: ${err.message}`);
    } finally {
      setNudgeSending(false);
    }
  };

  // Filtered & Sorted Operators List
  const filteredOperators = operators
    .filter((op) => {
      // Exclude self if superadmin wants to only monitor staff
      if (op._id === currentUser?._id && operators.length > 1) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = op.fullName.toLowerCase().includes(q);
        const matchEmpId = op.employeeId.toLowerCase().includes(q);
        const matchTitle = op.jobTitle.toLowerCase().includes(q);
        const matchEmail = op.email.toLowerCase().includes(q);
        if (!matchName && !matchEmpId && !matchTitle && !matchEmail) return false;
      }

      // Status Filter
      if (statusFilter === 'active_working' && op.workingStatus !== 'active_working') return false;
      if (statusFilter === 'idle_warning' && op.workingStatus !== 'idle_warning' && op.workingStatus !== 'extended_idle') return false;
      if (statusFilter === 'on_break' && !op.isOnBreak) return false;
      if (statusFilter === 'camera_on' && !cameraFeeds[op._id]) return false;
      if (statusFilter === 'offline' && op.workingStatus !== 'offline') return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'productivity_desc') return b.productivityScore - a.productivityScore;
      if (sortBy === 'productivity_asc') return a.productivityScore - b.productivityScore;
      if (sortBy === 'idle_desc') return b.idleMinutes - a.idleMinutes;
      if (sortBy === 'shift_desc') return b.shiftElapsedMinutes - a.shiftElapsedMinutes;
      if (sortBy === 'name_asc') return a.fullName.localeCompare(b.fullName);
      return 0;
    });

  // Calculate live camera count
  const activeCamerasCount = Object.keys(cameraFeeds).length;

  // Render Access Denied if user is not superadmin
  if (!loading && currentUser && currentUser.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 font-mono">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4 shadow-xl shadow-rose-500/10">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-extrabold text-white uppercase tracking-wider">Access Restricted // Root Privilege Required</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-md">
          The Specialized Workforce Surveillance & Productivity Monitor is reserved exclusively for the <strong>Super Administrator</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono select-none pb-12">
      {/* ── TOP HEADER & COMMAND HUD ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Eye className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white tracking-widest uppercase flex items-center gap-2">
                  <span>SUPER ADMIN MONITOR</span>
                  <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded">
                    ROOT_SURVEILLANCE
                  </span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider">
                REAL-TIME OPERATOR PERFORMANCE TELEMETRY & LIVE CAMERA AUDITING
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls & Auto-refresh */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Active Feeds Badge */}
          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
            activeCamerasCount > 0 ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' : 'bg-zinc-900 border-white/10 text-slate-400'
          }`}>
            <Video className={`w-3.5 h-3.5 ${activeCamerasCount > 0 ? 'text-cyan-400 animate-pulse' : ''}`} />
            <span className="text-[11px] font-bold">{activeCamerasCount} Feeds Active</span>
          </div>

          {/* Batch Camera Toggles */}
          <button
            onClick={handleTurnOnAllWorkingCameras}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Turn On All Cameras</span>
          </button>

          {activeCamerasCount > 0 && (
            <button
              onClick={handleStopAllCameras}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <VideoOff className="w-3.5 h-3.5" />
              <span>Stop All</span>
            </button>
          )}

          {/* Auto Refresh Dropdown */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1 text-slate-300 text-[11px]">
            <RefreshCw className={`w-3 h-3 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-slate-400">Sync:</span>
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              aria-label="Select auto-refresh sync interval"
              className="bg-transparent text-white font-bold text-[11px] outline-none cursor-pointer"
            >
              <option value={3} className="bg-zinc-900 text-white">3s (Fast)</option>
              <option value={5} className="bg-zinc-900 text-white">5s (Normal)</option>
              <option value={10} className="bg-zinc-900 text-white">10s (Eco)</option>
              <option value={0} className="bg-zinc-900 text-white">Pause</option>
            </select>
          </div>

          <button
            onClick={() => fetchTelemetryData()}
            disabled={refreshing}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Manual sync now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI TELEMETRY METRIC TILES ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Workforce */}
        <div className="card p-3 rounded-xl border border-white/10 bg-zinc-950/40 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[9px] uppercase tracking-wider">
            <span>Workforce</span>
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-white">{analytics?.totalUsers || operators.length}</span>
            <span className="text-[10px] text-slate-500">Operators</span>
          </div>
        </div>

        {/* Currently Working */}
        <div className="card p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400 text-[9px] uppercase tracking-wider">
            <span>Active Shift</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-400">{analytics?.totalClockedIn || 0}</span>
            <span className="text-[10px] text-emerald-500/70">Clocked In</span>
          </div>
        </div>

        {/* High Focus Operators */}
        <div className="card p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-cyan-400 text-[9px] uppercase tracking-wider">
            <span>High Focus</span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-cyan-400">{analytics?.brackets?.highFocus || 0}</span>
            <span className="text-[10px] text-cyan-500/70">&gt;80% Velocity</span>
          </div>
        </div>

        {/* Idle Warning */}
        <div className="card p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400 text-[9px] uppercase tracking-wider">
            <span>Idle Warning</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-400">{analytics?.idleWarningCount || 0}</span>
            <span className="text-[10px] text-amber-500/70">&gt;5m Inactive</span>
          </div>
        </div>

        {/* On Break */}
        <div className="card p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-400 text-[9px] uppercase tracking-wider">
            <span>On Break</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-400">{analytics?.onBreakCount || 0}</span>
            <span className="text-[10px] text-indigo-500/70">Resting</span>
          </div>
        </div>

        {/* Average Workforce Productivity Score */}
        <div className="card p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-400 text-[9px] uppercase tracking-wider">
            <span>Avg Productivity</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-white">{analytics?.avgProductivityScore || 82}%</span>
            <span className="text-[10px] text-slate-500">Index</span>
          </div>
        </div>
      </div>

      {/* ── VIEW TABS & FILTER TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
        {/* Navigation View Modes */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/80 border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'grid'
                ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Command Grid</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Surveillance Matrix ({activeCamerasCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Productivity Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search operator, ID, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            aria-label="Filter operators by working status"
            className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">Status: All Operators</option>
            <option value="active_working">Active &amp; Working</option>
            <option value="idle_warning">Idle Warning (&gt;5m)</option>
            <option value="on_break">On Break</option>
            <option value="camera_on">Camera Streaming</option>
            <option value="offline">Off Shift / Offline</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            aria-label="Sort operators by performance telemetry criteria"
            className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="productivity_desc">Sort: Highest Productivity</option>
            <option value="productivity_asc">Sort: Lowest Productivity (Attention)</option>
            <option value="idle_desc">Sort: Longest Idle</option>
            <option value="shift_desc">Sort: Longest Shift</option>
            <option value="name_asc">Sort: Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: COMMAND GRID VIEW                                  */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredOperators.map((operator) => {
            const feed = cameraFeeds[operator._id];
            const isCameraOn = !!feed;
            const isFeedLive = feed?.status === 'live';

            // Productivity color badge
            const getScoreColor = (score: number) => {
              if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
              if (score >= 60) return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' };
              if (score >= 40) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
              return { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' };
            };
            const scoreColor = getScoreColor(operator.productivityScore);

            return (
              <div
                key={operator._id}
                className={`card p-4 rounded-xl border flex flex-col justify-between gap-3.5 transition-all relative overflow-hidden ${
                  isCameraOn
                    ? 'border-cyan-500/50 bg-zinc-950/90 shadow-lg shadow-cyan-500/10'
                    : operator.workingStatus === 'idle_warning' || operator.workingStatus === 'extended_idle'
                    ? 'border-amber-500/40 bg-zinc-950/60'
                    : operator.workingStatus === 'active_working'
                    ? 'border-white/10 bg-zinc-950/40 hover:border-cyan-500/30'
                    : 'border-white/5 bg-zinc-950/20 opacity-80'
                }`}
              >
                {/* Top Header: Avatar, Name, Employee ID & Online Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {operator.profilePhoto ? (
                        <img
                          src={operator.profilePhoto}
                          alt={operator.fullName}
                          className="w-11 h-11 rounded-lg object-cover border border-white/20"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-bold text-white">
                          {operator.fullName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Online beacon */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black ${
                          operator.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                        title={operator.isOnline ? 'Online on platform' : 'Offline'}
                      />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{operator.fullName}</span>
                      </h4>
                      <p className="text-[10px] text-slate-400">{operator.jobTitle} • <span className="text-cyan-400">{operator.employeeId}</span></p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                            operator.workingStatus === 'active_working'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : operator.workingStatus === 'on_break'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : operator.workingStatus === 'idle_warning' || operator.workingStatus === 'extended_idle'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                              : 'bg-zinc-800 text-slate-400 border border-white/5'
                          }`}
                        >
                          {operator.workingStatus === 'active_working'
                            ? '● WORKING'
                            : operator.workingStatus === 'on_break'
                            ? '● ON BREAK'
                            : operator.workingStatus === 'idle_warning' || operator.workingStatus === 'extended_idle'
                            ? `⚠️ IDLE (${operator.idleMinutes}M)`
                            : 'OFF SHIFT'}
                        </span>

                        {operator.isClockedIn && (
                          <span className="text-[9px] text-slate-500">
                            {Math.floor(operator.shiftElapsedMinutes / 60)}h {operator.shiftElapsedMinutes % 60}m on shift
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Productivity Index Pill */}
                  <div className={`flex flex-col items-end px-2.5 py-1 rounded-lg border ${scoreColor.bg} ${scoreColor.border} ${scoreColor.text}`}>
                    <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">PRODUCTIVITY</span>
                    <strong className="text-base font-extrabold">{operator.productivityScore}%</strong>
                  </div>
                </div>

                {/* ── LIVE CAMERA MONITOR VIEWPORT ── */}
                <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
                  {isCameraOn ? (
                    isFeedLive && feed?.lastFrame ? (
                      <div className="relative w-full h-full group">
                        <img
                          src={feed.lastFrame}
                          alt={`Live Feed of ${operator.fullName}`}
                          className="w-full h-full object-cover mirror"
                          style={{ transform: 'scaleX(-1)' }}
                        />

                        {/* Top HUD Overlay */}
                        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between text-[9px]">
                          <span className="px-2 py-0.5 rounded bg-black/80 text-rose-400 border border-rose-500/40 font-bold flex items-center gap-1.5 backdrop-blur-sm">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            LIVE AUDIT // {feed.fps || 1} FPS
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCaptureSnapshot(operator)}
                              className="px-2 py-0.5 rounded bg-black/80 hover:bg-cyan-600 text-white font-bold text-[9px] flex items-center gap-1 border border-white/15 backdrop-blur-sm cursor-pointer"
                              title="Capture & download stamped audit snapshot"
                            >
                              <Camera className="w-3 h-3" />
                              Snap
                            </button>
                            <button
                              onClick={() => setFocusedOperator(operator)}
                              className="p-1 rounded bg-black/80 hover:bg-white/20 text-white border border-white/15 backdrop-blur-sm cursor-pointer"
                              title="Expand to Fullscreen HUD"
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Bottom HUD Telemetry Strip */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 px-2 py-1 rounded bg-black/80 border border-white/10 flex items-center justify-between text-[8px] text-slate-300 backdrop-blur-sm">
                          <span>{operator.activityStats.mouseMovements} moves • {operator.activityStats.keyPresses} keys</span>
                          <span className="text-cyan-400 font-bold">{operator.eventsPerMinute} evt/min</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
                        <span className="text-[10px] text-cyan-300 font-bold tracking-wider uppercase">
                          CONNECTING CAMERA FEED...
                        </span>
                        <span className="text-[8px] text-slate-500 mt-0.5">Awaiting operator webcam stream uplink</span>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-slate-600 mb-2">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] text-slate-500 tracking-wider uppercase font-bold">
                        CAMERA FEED STANDBY
                      </span>
                      <button
                        onClick={() => handleTurnOnCamera(operator)}
                        disabled={!operator.isOnline}
                        className={`mt-2.5 px-3 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                          operator.isOnline
                            ? 'bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-zinc-950 border border-cyan-500/40 shadow-sm'
                            : 'bg-zinc-800 text-slate-600 border border-white/5 cursor-not-allowed'
                        }`}
                      >
                        <Video className="w-3 h-3" />
                        <span>Turn On Camera</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Real-time Telemetry Metrics Grid */}
                <div className="grid grid-cols-4 gap-1.5 p-2 rounded-lg bg-zinc-900/60 border border-white/5 text-[9px] text-center">
                  <div>
                    <span className="text-slate-500 block text-[7.5px] uppercase">Moves</span>
                    <strong className="text-white font-bold">{operator.activityStats.mouseMovements}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[7.5px] uppercase">Clicks</span>
                    <strong className="text-emerald-400 font-bold">{operator.activityStats.mouseClicks}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[7.5px] uppercase">Keys</span>
                    <strong className="text-indigo-400 font-bold">{operator.activityStats.keyPresses}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[7.5px] uppercase">Velocity</span>
                    <strong className="text-cyan-400 font-bold">{operator.eventsPerMinute}/m</strong>
                  </div>
                </div>

                {/* Footer Controls: Turn Off Camera / Nudge / Chat */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px]">
                  {isCameraOn ? (
                    <button
                      onClick={() => handleStopCamera(operator._id)}
                      className="px-2.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <VideoOff className="w-3 h-3" />
                      <span>Stop Camera</span>
                    </button>
                  ) : (
                    <span className="text-[9px] text-slate-500">
                      Last Active: {operator.activityStats.lastActivityAt ? new Date(operator.activityStats.lastActivityAt).toLocaleTimeString() : 'N/A'}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setNudgeModalOperator(operator);
                        setNudgeMessage(`Please verify your working status. Your activity has been logged as ${operator.workingStatus}.`);
                      }}
                      className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Send instant supervisor nudge"
                    >
                      <Send className="w-3 h-3" />
                      <span>Nudge</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: SURVEILLANCE MATRIX VIEW                           */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-white font-bold uppercase tracking-wider">
                LIVE CAMERA SURVEILLANCE MATRIX ({activeCamerasCount} FEEDS RUNNING)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTurnOnAllWorkingCameras}
                className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-xs uppercase cursor-pointer"
              >
                Turn On All
              </button>
              {activeCamerasCount > 0 && (
                <button
                  onClick={handleStopAllCameras}
                  className="px-3 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold text-xs uppercase cursor-pointer"
                >
                  Stop All
                </button>
              )}
            </div>
          </div>

          {activeCamerasCount === 0 ? (
            <div className="card p-12 rounded-2xl border border-white/10 bg-zinc-950/40 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3">
                <Video className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Active Video Feeds</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Turn on cameras for individual operators in the Command Grid or click below to launch feeds for all currently working operators.
              </p>
              <button
                onClick={handleTurnOnAllWorkingCameras}
                className="mt-4 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Turn On All Working Operator Cameras</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {Object.keys(cameraFeeds).map((userId) => {
                const operator = operators.find((op) => op._id === userId);
                const feed = cameraFeeds[userId];
                if (!operator) return null;

                return (
                  <div
                    key={userId}
                    className="relative rounded-xl overflow-hidden border border-cyan-500/40 bg-black aspect-video flex flex-col justify-between group shadow-xl"
                  >
                    {feed.lastFrame ? (
                      <img
                        src={feed.lastFrame}
                        alt={operator.fullName}
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-[10px] text-cyan-400">
                        CONNECTING STREAM...
                      </div>
                    )}

                    {/* Top HUD */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[9px] pointer-events-none">
                      <span className="px-2 py-0.5 rounded bg-black/80 text-white font-bold border border-white/20 backdrop-blur-md">
                        {operator.fullName} [{operator.employeeId}]
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-rose-500 text-black font-extrabold text-[8px] animate-pulse">
                        LIVE
                      </span>
                    </div>

                    {/* Hover Control Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                      <button
                        onClick={() => handleCaptureSnapshot(operator)}
                        className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title="Snapshot"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setFocusedOperator(operator)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-white text-white hover:text-black font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title="Expand"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStopCamera(operator._id)}
                        className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title="Stop Camera"
                      >
                        <VideoOff className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom HUD */}
                    <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded bg-black/80 border border-white/10 text-[8px] text-slate-300 flex items-center justify-between backdrop-blur-md pointer-events-none">
                      <span>Productivity: <strong className="text-emerald-400">{operator.productivityScore}%</strong></span>
                      <span className="text-cyan-300">{operator.eventsPerMinute} ev/m</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 3: PRODUCTIVITY ANALYTICS                             */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Workforce Activity Intensity Over Time */}
            <div className="card p-5 rounded-2xl border border-white/10 bg-zinc-950/60">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Workforce Activity Intensity (Last 8 Hours)
                  </h3>
                  <p className="text-[10px] text-slate-500">Aggregate telemetry events &amp; productivity trajectory</p>
                </div>
                <TrendingUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.hourlyActivityTrend || []}>
                    <defs>
                      <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="time" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <Area type="monotone" dataKey="activityEvents" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#activityGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Productivity Velocity Distribution */}
            <div className="card p-5 rounded-2xl border border-white/10 bg-zinc-950/60">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Productivity Distribution By Velocity Tier
                  </h3>
                  <p className="text-[10px] text-slate-500">Active workforce grouped by velocity score</p>
                </div>
                <BarChart3 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { tier: 'High (80-100%)', count: analytics?.brackets?.highFocus || 0, fill: '#10b981' },
                      { tier: 'Steady (60-79%)', count: analytics?.brackets?.steadyFocus || 0, fill: '#06b6d4' },
                      { tier: 'Moderate (40-59%)', count: analytics?.brackets?.moderate || 0, fill: '#f59e0b' },
                      { tier: 'Low (<40%)', count: analytics?.brackets?.attentionNeeded || 0, fill: '#f43f5e' },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="tier" stroke="#71717a" fontSize={10} />
                    <YAxis stroke="#71717a" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {['#10b981', '#06b6d4', '#f59e0b', '#f43f5e'].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Leaderboard Table: Top Productive Operators */}
          <div className="card p-5 rounded-2xl border border-white/10 bg-zinc-950/60">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
              Top Productivity Velocity Leaderboard (Today)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 text-[10px] uppercase">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Operator</th>
                    <th className="pb-2">Job Title</th>
                    <th className="pb-2">Velocity (Ev/min)</th>
                    <th className="pb-2">Total Events</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(analytics?.leaderboard || []).map((item: any, i: number) => (
                    <tr key={item.userId} className="hover:bg-white/5">
                      <td className="py-2.5 font-bold text-slate-400">#{i + 1}</td>
                      <td className="py-2.5 font-bold text-white">{item.fullName} <span className="text-slate-500 text-[10px]">[{item.employeeId}]</span></td>
                      <td className="py-2.5 text-slate-400">{item.jobTitle}</td>
                      <td className="py-2.5 text-cyan-400 font-bold">{item.eventsPerMinute}</td>
                      <td className="py-2.5 text-slate-300">{item.totalEvents}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                          {item.productivityScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 4: AUDIT TRAIL VIEW                                   */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="card p-5 rounded-2xl border border-white/10 bg-zinc-950/60">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Surveillance &amp; Productivity Action Audit Log
              </h3>
              <p className="text-[10px] text-slate-500">Chronological history of camera audits, snapshot captures, and supervisor nudges</p>
            </div>
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>

          {auditLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No surveillance actions logged yet in this session.
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((log: any) => (
                <div
                  key={log._id}
                  className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase shrink-0 mt-0.5 ${
                        log.actionType === 'camera_start'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : log.actionType === 'snapshot_captured'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : log.actionType === 'nudge_sent'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-slate-400'
                      }`}
                    >
                      {log.actionType.replace('_', ' ')}
                    </span>
                    <div>
                      <p className="font-bold text-white">{log.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{log.details}</p>
                      {log.targetUserId && (
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          Operator: {log.targetUserId.fullName} [{log.targetUserId.employeeId}]
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 text-right shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* EXPANDED / FULLSCREEN INSPECTION MODAL                    */}
      {/* ────────────────────────────────────────────────────────── */}
      {focusedOperator && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-zinc-950 border border-cyan-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>LIVE SURVEILLANCE FEED // {focusedOperator.fullName}</span>
                  <span className="text-xs text-cyan-400 font-mono">[{focusedOperator.employeeId}]</span>
                </h3>
              </div>
              <button
                onClick={() => setFocusedOperator(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Large Video + Telemetry Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-y-auto">
              {/* Main HD Viewport */}
              <div className="md:col-span-2 bg-black flex items-center justify-center relative min-h-[350px]">
                {cameraFeeds[focusedOperator._id]?.lastFrame ? (
                  <img
                    src={cameraFeeds[focusedOperator._id].lastFrame}
                    alt={focusedOperator.fullName}
                    className="w-full h-full object-contain mirror"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                ) : (
                  <div className="text-center p-6 text-cyan-400 text-xs">
                    STREAM BUFFERING...
                  </div>
                )}

                {/* Stamped HUD Overlay */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/80 text-[10px] text-rose-400 border border-rose-500/30 font-bold backdrop-blur-md">
                  REC // SUPERVISOR ENCRYPTED STREAM
                </div>
              </div>

              {/* Side Telemetry HUD */}
              <div className="p-5 border-l border-white/10 bg-zinc-950 flex flex-col justify-between gap-4">
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                    REAL-TIME PERFORMANCE HUD
                  </h4>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400 text-xs">Productivity Score</span>
                      <strong className="text-lg font-black text-emerald-400">{focusedOperator.productivityScore}%</strong>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5">
                        <span className="text-[9px] text-slate-500 block uppercase">Mouse Moves</span>
                        <strong className="text-white font-bold">{focusedOperator.activityStats.mouseMovements}</strong>
                      </div>
                      <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5">
                        <span className="text-[9px] text-slate-500 block uppercase">Keystrokes</span>
                        <strong className="text-indigo-400 font-bold">{focusedOperator.activityStats.keyPresses}</strong>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5 text-xs flex justify-between">
                      <span className="text-slate-500">Idle Duration</span>
                      <strong className={`${focusedOperator.idleMinutes > 5 ? 'text-amber-400 font-bold' : 'text-slate-300'}`}>
                        {focusedOperator.idleMinutes} minutes
                      </strong>
                    </div>

                    <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/5 text-xs flex justify-between">
                      <span className="text-slate-500">Working Shift</span>
                      <strong className="text-white">
                        {Math.floor(focusedOperator.shiftElapsedMinutes / 60)}h {focusedOperator.shiftElapsedMinutes % 60}m
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleCaptureSnapshot(focusedOperator)}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Stamped Evidence Snapshot</span>
                  </button>

                  <button
                    onClick={() => {
                      setNudgeModalOperator(focusedOperator);
                      setNudgeMessage(`Supervisor Notice: Please adjust your focus pace. Current score: ${focusedOperator.productivityScore}%`);
                    }}
                    className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Performance Nudge</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SUPERVISOR NUDGE MODAL                                    */}
      {/* ────────────────────────────────────────────────────────── */}
      {nudgeModalOperator && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    SEND PRODUCTIVITY NUDGE
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    TARGET: {nudgeModalOperator.fullName} [{nudgeModalOperator.employeeId}]
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNudgeModalOperator(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Quick Presets</label>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setNudgeType('warning');
                    setNudgeMessage('⚠️ Inactivity Alert: No activity detected for 5+ minutes. Please report your mission status.');
                  }}
                  className="p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-slate-300 text-left hover:text-white"
                >
                  ⚠️ Inactivity Alert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNudgeType('warning');
                    setNudgeMessage('☕ Break Allowance Alert: Your break has exceeded the scheduled time limit.');
                  }}
                  className="p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-slate-300 text-left hover:text-white"
                >
                  ☕ Break Limit Exceeded
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNudgeType('kudos');
                    setNudgeMessage('🚀 Outstanding Velocity: Great productivity and focus sustained today. Keep it up!');
                  }}
                  className="p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-slate-300 text-left hover:text-white"
                >
                  🚀 High Velocity Kudos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNudgeType('info');
                    setNudgeMessage('📋 Mission Status: Please update your task completion status on the Operational Board.');
                  }}
                  className="p-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-slate-300 text-left hover:text-white"
                >
                  📋 Task Status Update
                </button>
              </div>
            </div>

            {/* Custom Message */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Nudge Message</label>
              <textarea
                rows={3}
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                placeholder="Type supervisor message to display on operator screen..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            {nudgeSuccess ? (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Nudge Delivered to Operator Screen!</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNudgeModalOperator(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-slate-400 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendNudge}
                  disabled={nudgeSending || !nudgeMessage.trim()}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {nudgeSending ? (
                    <span>Transmitting...</span>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmit Nudge</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
