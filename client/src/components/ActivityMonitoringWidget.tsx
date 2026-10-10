'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  MousePointer,
  Keyboard,
  Clock,
  AlertTriangle,
  Cpu,
  HardDrive,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import { activityTracker, TrackerState } from '../utils/activityTracker';

interface ActivityMonitoringWidgetProps {
  clockedIn: boolean;
  activeSession: any;
  elapsedSeconds: number;
  breakElapsedTime?: string;
  onManualResume?: () => void;
  className?: string;
}

const formatSecondsToHMS = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function ActivityMonitoringWidget({
  clockedIn,
  activeSession,
  elapsedSeconds,
  breakElapsedTime = '00m 00s',
  onManualResume,
  className = ''
}: ActivityMonitoringWidgetProps) {
  const [trackerState, setTrackerState] = useState<TrackerState>(activityTracker.getState());
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [idleModalStartTime, setIdleModalStartTime] = useState<string>('');

  useEffect(() => {
    // Sync shift & break state with activityTracker singleton
    if (clockedIn && activeSession) {
      const isOnBreak = activeSession.status === 'on_break';
      activityTracker.startShift(isOnBreak);
    } else {
      activityTracker.stopShift();
    }
  }, [clockedIn, activeSession?.status]);

  useEffect(() => {
    // Subscribe to state updates
    const unsubscribeState = activityTracker.subscribeStateChange((state) => {
      setTrackerState(state);
      if (state.isIdle && state.idleStartTime) {
        setShowIdleModal(true);
        setIdleModalStartTime(new Date(state.idleStartTime).toLocaleTimeString());
      } else if (!state.isIdle) {
        setShowIdleModal(false);
      }
    });

    // Subscribe to idle triggered modal alert
    const unsubscribeIdleTriggered = activityTracker.subscribeIdleTriggered((startTimeIso) => {
      setShowIdleModal(true);
      setIdleModalStartTime(new Date(startTimeIso).toLocaleTimeString());
    });

    const unsubscribeIdleResumed = activityTracker.subscribeIdleResumed(() => {
      setShowIdleModal(false);
    });

    return () => {
      unsubscribeState();
      unsubscribeIdleTriggered();
      unsubscribeIdleResumed();
    };
  }, []);

  const isOnBreak = activeSession?.status === 'on_break';
  const isIdle = trackerState.isIdle;

  // Compute status badge
  const getStatusBadge = () => {
    if (!clockedIn) {
      return {
        label: 'Monitoring Stopped',
        color: 'text-rose-400',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/30',
        dotColor: 'bg-rose-500',
        icon: XCircle
      };
    }
    if (isOnBreak) {
      return {
        label: 'Break',
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        dotColor: 'bg-amber-500',
        icon: PauseCircle
      };
    }
    if (isIdle) {
      return {
        label: 'Idle',
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        dotColor: 'bg-orange-500',
        icon: AlertTriangle
      };
    }
    return {
      label: 'Monitoring Active',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      dotColor: 'bg-emerald-500',
      icon: CheckCircle2
    };
  };

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge.icon;

  // Calculate Break Duration from session breaks
  let totalBreakSeconds = 0;
  if (activeSession?.breaks && Array.isArray(activeSession.breaks)) {
    activeSession.breaks.forEach((b: any) => {
      const bStart = new Date(b.startedAt).getTime();
      const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : Date.now();
      totalBreakSeconds += Math.floor((bEnd - bStart) / 1000);
    });
  }

  // Last activity formatted timestamp
  const lastActivityTimeFormatted = trackerState.activityStats.lastActivityAt
    ? new Date(trackerState.activityStats.lastActivityAt).toLocaleTimeString()
    : 'N/A';

  return (
    <>
      {/* ── Main Activity Monitoring Card Widget ── */}
      <div
        className={`card flex flex-col gap-4 font-mono select-none relative overflow-hidden ${className}`}
        style={{
          borderColor: isIdle ? 'var(--warning)' : clockedIn ? 'var(--brand)' : 'var(--border)',
          backgroundColor: 'var(--bg-card)'
        }}
      >
        <div className="absolute top-1 left-2 text-[7px] opacity-25">MODULE_03 // MOUSE_TRACKER_TELEMETRY</div>

        {/* Card Header & Status Indicator */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-1.5">
                <span>MOUSE TRACKER & ACTIVITY MONITOR</span>
              </h3>
              <p className="text-[9px] text-slate-500">REAL-TIME SHIFT TELEMETRY & IDLE DETECTION</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusBadge.bgColor} ${statusBadge.borderColor} ${statusBadge.color}`}>
            <span className="flex h-2 w-2 relative">
              {clockedIn && !isOnBreak && !isIdle && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusBadge.dotColor} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusBadge.dotColor}`} />
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider">{statusBadge.label}</span>
          </div>
        </div>

        {/* Real-time Status Readouts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[10px]">
          <div className="p-2.5 rounded bg-zinc-950/40 border border-white/5 flex flex-col justify-between">
            <span className="text-slate-500 uppercase tracking-wider block text-[8px]">Shift Status</span>
            <strong className={`text-xs font-bold mt-1 uppercase ${isOnBreak ? 'text-amber-400' : isIdle ? 'text-orange-400' : clockedIn ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isOnBreak ? 'On Break' : isIdle ? 'Idle (Paused)' : clockedIn ? 'Working' : 'Stopped'}
            </strong>
          </div>

          <div className="p-2.5 rounded bg-zinc-950/40 border border-white/5 flex flex-col justify-between">
            <span className="text-slate-500 uppercase tracking-wider block text-[8px]">Activity Monitoring</span>
            <strong className={`text-xs font-bold mt-1 uppercase ${clockedIn && !isOnBreak ? 'text-cyan-400' : 'text-slate-400'}`}>
              {clockedIn && !isOnBreak ? 'Active' : 'Paused / Off'}
            </strong>
          </div>

          <div className="p-2.5 rounded bg-zinc-950/40 border border-white/5 flex flex-col justify-between">
            <span className="text-slate-500 uppercase tracking-wider block text-[8px]">Last Activity</span>
            <strong className="text-xs font-bold text-white mt-1 font-mono">{lastActivityTimeFormatted}</strong>
          </div>

          <div className="p-2.5 rounded bg-zinc-950/40 border border-white/5 flex flex-col justify-between">
            <span className="text-slate-500 uppercase tracking-wider block text-[8px]">Idle Threshold</span>
            <strong className="text-xs font-bold text-amber-400 mt-1">3 Minutes</strong>
          </div>
        </div>

        {/* Timer Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded bg-zinc-950/60 border border-white/5 text-center">
          <div>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider block">Working Time</span>
            <strong className="text-sm font-extrabold text-white font-mono mt-0.5 block">
              {formatSecondsToHMS(Math.max(0, elapsedSeconds - trackerState.idleDurationSeconds))}
            </strong>
          </div>

          <div>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider block">Idle Time</span>
            <strong className="text-sm font-extrabold text-orange-400 font-mono mt-0.5 block">
              {formatSecondsToHMS(trackerState.idleDurationSeconds)}
            </strong>
          </div>

          <div>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider block">Break Time</span>
            <strong className="text-sm font-extrabold text-amber-400 font-mono mt-0.5 block">
              {formatSecondsToHMS(totalBreakSeconds)}
            </strong>
          </div>
        </div>

        {/* Activity & Background Performance Metrics */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between text-[9px] text-slate-400 gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-300" title="Mouse Move Events">
              <MousePointer className="w-3 h-3 text-cyan-400" />
              <span>{trackerState.activityStats.mouseMovements} moves</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300" title="Mouse Click Events">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>{trackerState.activityStats.mouseClicks} clicks</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300" title="Keyboard Keypress Events">
              <Keyboard className="w-3 h-3 text-indigo-400" />
              <span>{trackerState.activityStats.keyPresses} keys</span>
            </span>
          </div>

          {/* Performance Telemetry */}
          <div className="flex items-center gap-3 border-l border-white/10 pl-3">
            <span className="flex items-center gap-1 text-slate-400" title="CPU Event Loop Latency">
              <Cpu className="w-3 h-3 text-amber-400" />
              <span>{trackerState.performance.cpuLatencyMs}ms lat</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400" title="Memory Footprint">
              <HardDrive className="w-3 h-3 text-rose-400" />
              <span>{trackerState.performance.memoryUsageMb} MB</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Screen Became Idle Alert Popup Modal ── */}
      <AnimatePresence>
        {showIdleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md p-6 rounded-xl border relative shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--warning)',
                boxShadow: '0 0 40px rgba(245, 158, 11, 0.25)'
              }}
            >
              <div className="absolute top-1 left-2 text-[7px] font-mono opacity-30">SYSTEM_ALERT // IDLE_DETECTION_PAUSE</div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 animate-bounce">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-wider uppercase flex items-center gap-2">
                    ⚠️ Screen Became Idle
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    No activity has been detected for <strong>3 continuous minutes</strong>.
                  </p>
                </div>
              </div>

              <div className="mt-5 p-4 rounded-lg bg-zinc-950/80 border border-amber-500/30 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase">Working timer:</span>
                  <span className="font-extrabold text-rose-400 uppercase tracking-widest px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                    PAUSED
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase">Idle started:</span>
                  <span className="font-bold text-amber-400 font-mono">{idleModalStartTime}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-3">
                <p className="text-[11px] text-slate-400 text-center italic">
                  Move the mouse or interact with the computer to resume activity monitoring automatically.
                </p>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setShowIdleModal(false);
                    if (onManualResume) onManualResume();
                  }}
                  className="btn btn-primary w-full h-10 text-xs font-bold uppercase cursor-pointer flex items-center justify-center gap-2 border-0"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)'
                  }}
                >
                  <PlayCircle className="w-4 h-4" />
                  <span>Resume Activity Monitoring</span>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
