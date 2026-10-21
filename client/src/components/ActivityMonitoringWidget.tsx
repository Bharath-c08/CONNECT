'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  MousePointer,
  Keyboard,
  Clock,
  Cpu,
  HardDrive,
  CheckCircle2,
  PauseCircle,
  XCircle
} from 'lucide-react';
import { activityTracker, TrackerState } from '../utils/activityTracker';

interface ActivityMonitoringWidgetProps {
  clockedIn: boolean;
  activeSession: any;
  elapsedSeconds: number;
  breakElapsedTime?: string;
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
  className = ''
}: ActivityMonitoringWidgetProps) {
  const [trackerState, setTrackerState] = useState<TrackerState>(activityTracker.getState());

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
    });

    return () => {
      unsubscribeState();
    };
  }, []);

  const isOnBreak = activeSession?.status === 'on_break';

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
          borderColor: clockedIn ? 'var(--brand)' : 'var(--border)',
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
              <p className="text-[9px] text-slate-500">REAL-TIME SHIFT ACTIVITY TELEMETRY</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusBadge.bgColor} ${statusBadge.borderColor} ${statusBadge.color}`}>
              <span className="flex h-2 w-2 relative">
                {clockedIn && !isOnBreak && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusBadge.dotColor} opacity-75`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${statusBadge.dotColor}`} />
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider">{statusBadge.label}</span>
            </div>
          </div>
        </div>

        {/* Real-time Status Readouts Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[10px]">
          <div className="p-2.5 rounded bg-zinc-950/40 border border-white/5 flex flex-col justify-between">
            <span className="text-slate-500 uppercase tracking-wider block text-[8px]">Shift Status</span>
            <strong className={`text-xs font-bold mt-1 uppercase ${isOnBreak ? 'text-amber-400' : clockedIn ? 'text-emerald-400' : 'text-slate-500'}`}>
              {isOnBreak ? 'On Break' : clockedIn ? 'Working' : 'Stopped'}
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
        </div>

        {/* Timer Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded bg-zinc-950/60 border border-white/5 text-center">
          <div>
            <span className="text-[8px] text-slate-500 uppercase tracking-wider block">Working Time</span>
            <strong className="text-sm font-extrabold text-white font-mono mt-0.5 block">
              {formatSecondsToHMS(elapsedSeconds)}
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
    </>
  );
}
