'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  Video,
  VideoOff,
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  Minimize2,
  Maximize2,
  Shield,
  Activity
} from 'lucide-react';
import { playNotificationSound } from '../utils/audio';

interface CameraMonitorReceiverProps {
  socket: Socket | null;
  currentUser: any;
}

export default function CameraMonitorReceiver({ socket, currentUser }: CameraMonitorReceiverProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ adminId?: string; adminSocketId?: string; adminName?: string } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Supervisor Nudge Modal
  const [nudgeAlert, setNudgeAlert] = useState<{
    title: string;
    message: string;
    type: string;
    timestamp: string;
    adminName?: string;
  } | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Stop camera helper
  const stopCameraStream = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setAdminInfo(null);
  };

  // Sync stream to preview video whenever camera active or preview mounted
  useEffect(() => {
    if (isCameraActive && videoPreviewRef.current && localStreamRef.current) {
      videoPreviewRef.current.srcObject = localStreamRef.current;
      videoPreviewRef.current.play().catch(() => {});
    }
  }, [isCameraActive, isMinimized]);

  // Start frame broadcasting loop using hidden offscreen video
  const startFrameBroadcasting = (adminSocketId?: string, adminId?: string) => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = setInterval(() => {
      const video = hiddenVideoRef.current || videoPreviewRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !localStreamRef.current) return;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Draw downscaled frame to canvas (480x360 for high quality & ultra-low bandwidth)
      canvas.width = 480;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to JPEG dataURL with 0.65 quality
      const frameData = canvas.toDataURL('image/jpeg', 0.65);

      if (socket && socket.connected) {
        socket.emit('monitor-camera-frame', {
          targetAdminId: adminId,
          adminSocketId,
          userId: currentUser._id || currentUser.id,
          frameData,
          timestamp: Date.now()
        });
      }
    }, 600); // 600ms interval = ~1.7 fps responsive stream
  };

  useEffect(() => {
    if (!socket || !currentUser) return;

    // 1. Camera Requested by Super Admin
    const handleCameraRequested = async (data: { adminId: string; adminSocketId?: string; adminName?: string }) => {
      console.log('[MONITOR CLIENT] Camera requested by superadmin:', data);
      setAdminInfo(data);
      setPermissionError(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 }
          },
          audio: false
        });

        localStreamRef.current = stream;

        // Attach to hidden video immediately for capture
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          try {
            await hiddenVideoRef.current.play();
          } catch (e) {
            console.warn('Hidden video play catch:', e);
          }
        }

        setIsCameraActive(true);

        // Notify super admin that camera is ready
        socket.emit('monitor-camera-accepted', {
          adminSocketId: data.adminSocketId,
          adminId: data.adminId,
          userId: currentUser._id || currentUser.id,
          userName: currentUser.fullName
        });

        // Start broadcasting frames
        startFrameBroadcasting(data.adminSocketId, data.adminId);
      } catch (err: any) {
        console.error('[MONITOR CLIENT] Error accessing camera device:', err);
        const errMsg =
          err.name === 'NotAllowedError'
            ? 'Webcam permission was denied by operator on their browser.'
            : err.name === 'NotFoundError'
            ? 'No webcam device found on operator workstation.'
            : err.message || 'Camera access failed.';

        setPermissionError(errMsg);
        stopCameraStream();

        // Notify admin of error
        socket.emit('monitor-camera-error', {
          adminSocketId: data.adminSocketId,
          targetAdminId: data.adminId,
          userId: currentUser._id || currentUser.id,
          error: errMsg
        });
      }
    };

    // 2. Camera Stopped by Super Admin
    const handleCameraStopped = () => {
      console.log('[MONITOR CLIENT] Superadmin stopped camera surveillance');
      stopCameraStream();
    };

    // 3. WebRTC Offer from Super Admin (for live video track)
    const handleWebRTCOffer = async (data: { signal: any; fromAdminId: string; adminSocketId?: string }) => {
      if (!localStreamRef.current) return;

      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        });
        peerConnectionRef.current = pc;

        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('monitor-ice-candidate', {
              targetSocketId: data.adminSocketId,
              targetUserId: data.fromAdminId,
              candidate: event.candidate
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('monitor-webrtc-answer', {
          targetAdminSocketId: data.adminSocketId,
          targetAdminId: data.fromAdminId,
          signal: answer,
          userId: currentUser._id || currentUser.id
        });
      } catch (e) {
        console.error('[MONITOR CLIENT] WebRTC connection error:', e);
      }
    };

    // 4. ICE candidate
    const handleIceCandidate = async (data: { candidate: any }) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[MONITOR CLIENT] Error adding ICE candidate:', e);
        }
      }
    };

    // 5. Supervisor Nudge Received
    const handleNudgeReceived = (data: any) => {
      console.log('[MONITOR CLIENT] Supervisor nudge received:', data);
      playNotificationSound();
      setNudgeAlert(data);
    };

    socket.on('monitor-camera-requested', handleCameraRequested);
    socket.on('monitor-camera-stopped', handleCameraStopped);
    socket.on('monitor-webrtc-offer', handleWebRTCOffer);
    socket.on('monitor-ice-candidate', handleIceCandidate);
    socket.on('monitor-nudge-received', handleNudgeReceived);

    return () => {
      socket.off('monitor-camera-requested', handleCameraRequested);
      socket.off('monitor-camera-stopped', handleCameraStopped);
      socket.off('monitor-webrtc-offer', handleWebRTCOffer);
      socket.off('monitor-ice-candidate', handleIceCandidate);
      socket.off('monitor-nudge-received', handleNudgeReceived);
      stopCameraStream();
    };
  }, [socket, currentUser]);

  return (
    <>
      {/* Offscreen video and canvas for continuous reliable frame extraction */}
      <video
        ref={hiddenVideoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'fixed', width: '1px', height: '1px', opacity: 0.01, pointerEvents: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Active Camera Surveillance Floating Indicator ── */}
      {isCameraActive && (
        <div
          className={`fixed z-50 transition-all duration-300 font-mono shadow-2xl ${
            isMinimized
              ? 'bottom-4 right-4 bg-zinc-950/90 border border-cyan-500/50 rounded-full px-3.5 py-1.5 flex items-center gap-2.5 backdrop-blur-md cursor-pointer'
              : 'bottom-4 right-4 bg-zinc-950/95 border border-cyan-500/40 rounded-xl p-3 w-72 backdrop-blur-md flex flex-col gap-2.5'
          }`}
          style={{ boxShadow: '0 0 25px rgba(6, 182, 212, 0.25)' }}
        >
          {isMinimized ? (
            <div
              className="flex items-center gap-2"
              onClick={() => setIsMinimized(false)}
              title="Click to expand supervisor monitoring HUD"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase">
                CAMERA AUDIT ACTIVE
              </span>
              <Maximize2 className="w-3 h-3 text-slate-400 hover:text-white" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                  <span className="text-[10px] font-extrabold text-cyan-300 tracking-wider uppercase flex items-center gap-1">
                    <Shield className="w-3 h-3 text-cyan-400" />
                    SUPERVISOR AUDIT ACTIVE
                  </span>
                </div>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Minimize indicator"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Live Video Preview Thumbnail */}
              <div className="relative rounded overflow-hidden bg-black border border-white/10 aspect-video flex items-center justify-center">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-rose-400 font-bold border border-rose-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  REC // STREAMING
                </div>
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-slate-300 border border-white/10">
                  {adminInfo?.adminName || 'Super Admin'}
                </div>
              </div>

              {/* Status Note */}
              <div className="text-[9px] text-slate-400 leading-tight flex items-start gap-1.5">
                <Activity className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Performance &amp; working environment video is actively transmitting to Super Admin.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Permission Error Toast if camera failed */}
      {permissionError && (
        <div className="fixed bottom-4 right-4 z-50 bg-rose-950/95 border border-rose-500/50 rounded-xl p-3 max-w-sm text-xs font-mono shadow-2xl flex items-start gap-2.5 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold text-rose-300 text-[11px] uppercase">Camera Access Notice</h4>
            <p className="text-[10px] text-rose-200/80 mt-0.5">{permissionError}</p>
          </div>
          <button onClick={() => setPermissionError(null)} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Supervisor Nudge Alert Modal ── */}
      {nudgeAlert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-md bg-zinc-950 border border-amber-500/40 rounded-2xl p-6 font-mono shadow-2xl relative overflow-hidden flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 0 40px rgba(245, 158, 11, 0.25)' }}
          >
            {/* Top Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wider uppercase">
                    {nudgeAlert.title}
                  </h3>
                  <p className="text-[10px] text-amber-400/90 uppercase tracking-widest">
                    FROM: {nudgeAlert.adminName || 'SUPER ADMINISTRATOR'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setNudgeAlert(null)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-slate-200 text-xs leading-relaxed">
              &quot;{nudgeAlert.message}&quot;
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span>Telemetry Timestamp: {new Date(nudgeAlert.timestamp).toLocaleTimeString()}</span>
              <button
                onClick={() => setNudgeAlert(null)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Acknowledge &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
