'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  Copy,
  Check,
  Disc,
  StopCircle,
  Users,
  Monitor,
  MonitorOff,
  AlertTriangle
} from 'lucide-react';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../../utils/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface RemotePeer {
  socketId: string;
  userId: string;
  userName: string;
  stream: MediaStream | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

function getBestMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
}

function isSecureContext(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.meetingId as string;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [meeting, setMeeting] = useState<any>(null);
  const [meetingError, setMeetingError] = useState('');

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const remotePeersRef = useRef<RemotePeer[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const isVideoOffRef = useRef(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const isScreenSharingRef = useRef(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);

  // Refs for tracking video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Record<string, HTMLVideoElement>>({});
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const [permissionError, setPermissionError] = useState('');

  // Synchronize refs for accurate callback states
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    remotePeersRef.current = remotePeers;
  }, [remotePeers]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  // ─── 1. Load user + meeting ────────────────────────────────────────────────
  useEffect(() => {
    const usr = getCurrentUser();
    if (usr) setCurrentUser(usr);

    const fetchMeeting = async () => {
      try {
        const data = await apiRequest(`/meetings/${meetingId}`);
        setMeeting(data);
      } catch (err: any) {
        setMeetingError(err.message ?? 'Link decrypted but not registered on active node.');
      }
    };
    fetchMeeting();
  }, [meetingId]);

  // ─── Peer-connection factory ───────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (socketId: string, userId: string, userName: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice-candidate-meeting', {
            toSocketId: socketId,
            candidate: event.candidate,
            fromSocketId: socketRef.current.id,
          });
        }
      };

      pc.ontrack = (event) => {
        setRemotePeers((prev) => {
          const exists = prev.find((p) => p.socketId === socketId);
          if (exists) {
            return prev.map((p) =>
              p.socketId === socketId ? { ...p, stream: event.streams[0] } : p
            );
          }
          return [...prev, { socketId, userId, userName, stream: event.streams[0] }];
        });
      };

      peerConnectionsRef.current[socketId] = pc;
      return pc;
    },
    []
  );

  // ─── 2. Media + Socket setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser || !meeting) return;

    const socket = io(getSocketUrl());
    socketRef.current = socket;

    const setupMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.warn('Media access denied, joining without camera/mic:', err);
      }

      socket.emit('join-meeting', {
        meetingId,
        userId: currentUser.id ?? currentUser._id,
        userName: currentUser.fullName,
      });
    };

    setupMedia();

    socket.on('peer-joined', async ({ userId, userName, socketId }: any) => {
      const stream = localStreamRef.current;
      const pc = createPeerConnection(socketId, userId, userName);

      if (stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      }

      if (isScreenSharingRef.current && localScreenStreamRef.current) {
        const screenTrack = localScreenStreamRef.current.getVideoTracks()[0];
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && screenTrack) sender.replaceTrack(screenTrack);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('meeting-signal', {
        toSocketId: socketId,
        signal: offer,
        fromSocketId: socket.id,
        fromUserId: currentUser.id ?? currentUser._id,
        fromUserName: currentUser.fullName,
      });
    });

    socket.on('meeting-signal', async ({ signal, fromSocketId, fromUserId, fromUserName }: any) => {
      let pc = peerConnectionsRef.current[fromSocketId];

      if (!pc) {
        const stream = localStreamRef.current;
        pc = createPeerConnection(fromSocketId, fromUserId, fromUserName);
        if (stream) stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('meeting-signal', {
          toSocketId: fromSocketId,
          signal: answer,
          fromSocketId: socket.id,
          fromUserId: currentUser.id ?? currentUser._id,
          fromUserName: currentUser.fullName,
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      }
    });

    socket.on('ice-candidate-meeting', async ({ candidate, fromSocketId }: any) => {
      const pc = peerConnectionsRef.current[fromSocketId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('ICE error:', e);
        }
      }
    });

    socket.on('peer-left', ({ socketId }: any) => {
      if (peerConnectionsRef.current[socketId]) {
        peerConnectionsRef.current[socketId].close();
        delete peerConnectionsRef.current[socketId];
      }
      setRemotePeers((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    return () => {
      socket.emit('leave-meeting', {
        meetingId,
        userId: currentUser.id ?? currentUser._id,
        socketId: socket.id,
      });
      socket.disconnect();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [currentUser, meeting, createPeerConnection]);

  // ─── Toggle audio ──────────────────────────────────────────────────────────
  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((v) => !v);
    }
  };

  // ─── Toggle video ──────────────────────────────────────────────────────────
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsVideoOff((v) => !v);
    }
  };

  // ─── Screen share ──────────────────────────────────────────────────────────
  const toggleScreenShare = async () => {
    if (isScreenSharingRef.current) {
      localScreenStreamRef.current?.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current = null;
      isScreenSharingRef.current = false;
      setIsScreenSharing(false);

      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const videoTrack = camStream.getVideoTracks()[0];

        const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
        const newStream = new MediaStream([...audioTracks, videoTrack]);
        setLocalStream(newStream);
        localStreamRef.current = newStream;

        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(videoTrack);
        });
      } catch (err) {
        console.error('Error restoring camera:', err);
      }
    } else {
      if (!isSecureContext()) {
        setPermissionError('Screen sharing requires a secure context (HTTPS or localhost).');
        return;
      }

      if (!navigator.mediaDevices?.getDisplayMedia) {
        setPermissionError('Your browser does not support screen sharing.');
        return;
      }

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: false,
        });

        localScreenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        isScreenSharingRef.current = true;
        setIsScreenSharing(true);

        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err: any) {
        if (err.name !== 'NotAllowedError') {
          console.error('Screen share error:', err);
          setPermissionError(`Screen share failed: ${err.message}`);
        }
      }
    }
  };

  // ─── Canvas + Audio Composited Grid Recording ──────────────────────────────
  const startRecording = async () => {
    recordedChunksRef.current = [];

    // Create Compositor Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Could not initialize canvas recording context.');
      return;
    }

    // Initialize Web Audio API for mixing local + remote audio tracks
    let audioDest: MediaStreamAudioDestinationNode | null = null;
    let audioContext: AudioContext | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      audioDest = audioContext.createMediaStreamDestination();

      // Mix local mic audio
      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
        localSource.connect(audioDest);
      }

      // Mix all active remote audios
      remotePeersRef.current.forEach((peer) => {
        if (peer.stream && peer.stream.getAudioTracks().length > 0) {
          try {
            const peerSource = audioContext!.createMediaStreamSource(peer.stream);
            peerSource.connect(audioDest!);
          } catch (err) {
            console.warn(`Could not capture audio for ${peer.userName}:`, err);
          }
        }
      });
    } catch (err) {
      console.warn('Audio mixer context failed or not permitted, recording video-only:', err);
    }

    // Start 30fps canvas capture
    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;

    // Merge canvas video and mixed audio into a single stream
    const tracksToRecord: MediaStreamTrack[] = [];
    if (canvasStream.getVideoTracks().length > 0) {
      tracksToRecord.push(canvasStream.getVideoTracks()[0]);
    }
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
      tracksToRecord.push(audioDest.stream.getAudioTracks()[0]);
    }

    const outputStream = new MediaStream(tracksToRecord);
    const mimeType = getBestMimeType();

    // ── Render loop ──
    const drawGridLoop = () => {
      if (!isRecordingRef.current) return;

      // Clean canvas
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Collect all active layouts (local stream & remote videos)
      const participants = [
        {
          video: localVideoRef.current,
          name: `${currentUser?.fullName || 'YOU'} (YOU)`,
          isLocal: true,
          isVideoOff: isVideoOffRef.current && !isScreenSharingRef.current,
        },
        ...remotePeersRef.current.map((p) => ({
          video: remoteVideoRefs.current[p.socketId],
          name: p.userName,
          isLocal: false,
          isVideoOff: !p.stream || p.stream.getVideoTracks().length === 0 || !p.stream.getVideoTracks()[0].enabled,
        })),
      ];

      const count = participants.length;
      if (count > 0) {
        // Grid dimension logic
        let cols = 1;
        let rows = 1;
        if (count === 2) {
          cols = 2;
          rows = 1;
        } else if (count > 2) {
          cols = Math.ceil(Math.sqrt(count));
          rows = Math.ceil(count / cols);
        }

        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        participants.forEach((p, idx) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const x = col * cellW;
          const y = row * cellH;

          // Background box
          ctx.strokeStyle = '#1e1e24';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cellW, cellH);

          if (p.video && !p.isVideoOff && p.video.readyState >= 2) {
            ctx.save();
            // Mirror local camera stream (but NOT screen share)
            if (p.isLocal && !isScreenSharingRef.current) {
              ctx.translate(x + cellW, y);
              ctx.scale(-1, 1);
              ctx.drawImage(p.video, 0, 0, cellW, cellH);
            } else {
              ctx.drawImage(p.video, x, y, cellW, cellH);
            }
            ctx.restore();
          } else {
            // Draw luxury avatar background
            ctx.fillStyle = '#18181b';
            ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);

            ctx.fillStyle = '#27272a';
            ctx.beginPath();
            const cx = x + cellW / 2;
            const cy = y + cellH / 2;
            const r = Math.min(cellW, cellH) * 0.18;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();

            // Draw Initial letters
            ctx.fillStyle = '#38bdf8';
            ctx.font = `bold ${Math.max(14, r * 0.65)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initial = p.name ? p.name[0].toUpperCase() : '?';
            ctx.fillText(initial, cx, cy);
          }

          // Custom nameplate bar
          ctx.fillStyle = 'rgba(9, 9, 11, 0.75)';
          ctx.fillRect(x + 10, y + cellH - 30, cellW - 20, 20);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.name.toUpperCase(), x + 16, y + cellH - 20);
        });
      }

      animationFrameRef.current = requestAnimationFrame(drawGridLoop);
    };

    try {
      const recorder = new MediaRecorder(outputStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        downloadBlob(blob, `meet_recording_${meetingId}_${timestamp}.webm`);

        // Free compositor assets
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
        }
        if (canvasStreamRef.current) {
          canvasStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        setIsRecording(false);
        isRecordingRef.current = false;
      };

      isRecordingRef.current = true;
      setIsRecording(true);
      recorder.start(1000); // 1-second chunks
      drawGridLoop();
    } catch (err) {
      console.error('Recording initialization error:', err);
      alert('Could not start meeting recording.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const copyMeetingLink = () => {
    const url = `${window.location.origin}/dashboard/meet/${meetingId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (meetingError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-[11px] tracking-wider text-rose-400 select-none">
        <AlertTriangle className="w-8 h-8" />
        <span>// UPLINK_FAULT: {meetingError}</span>
        <button onClick={() => router.push('/dashboard/chat')} className="btn btn-secondary py-2 px-4 cursor-pointer">
          RETURN TO DIRECTORY
        </button>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 font-mono text-[11px] tracking-wider text-slate-500 select-none">
        <div className="animate-spin text-cyan-400 font-extrabold">// ESTABLISHING SECURE CONCURRENCY...</div>
      </div>
    );
  }

  const totalParticipants = 1 + remotePeers.length;
  const gridCols =
    totalParticipants === 1 ? 'grid-cols-1' :
    totalParticipants === 2 ? 'grid-cols-2' :
    totalParticipants <= 4 ? 'grid-cols-2' :
    'grid-cols-3';

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] font-mono text-[11px] select-none text-slate-300 relative overflow-hidden pb-4">
      {/* Non-blocking permission notification bar */}
      {permissionError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{permissionError}</span>
          <button
            onClick={() => setPermissionError('')}
            className="ml-auto text-amber-500 hover:text-amber-300 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border rounded-t-xl bg-zinc-950/60"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <span className="font-extrabold text-white uppercase tracking-widest">
            // SECURE MEET NODE: {meeting.title}
          </span>
          {isScreenSharing && (
            <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded text-[9px] font-bold">
              SCREEN PRESENTING
            </span>
          )}
          {isRecording && (
            <span className="px-2 py-0.5 bg-rose-500/15 border border-rose-500/45 text-rose-400 rounded text-[9px] font-extrabold animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> RECORDING ALL FEEDS
            </span>
          )}
        </div>
        <button
          onClick={copyMeetingLink}
          className="btn btn-secondary h-8 px-3 text-[10px] cursor-pointer flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'COPIED!' : 'SHARE LINK'}</span>
        </button>
      </div>

      {/* Video views viewport */}
      <div
        className={`flex-1 grid ${gridCols} gap-3 p-4 border-x bg-zinc-950/40 overflow-y-auto`}
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Local Participant view */}
        <div
          className="relative rounded-lg overflow-hidden border bg-zinc-950 flex items-center justify-center min-h-[160px]"
          style={{ borderColor: 'var(--border)' }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isScreenSharing ? '' : '-scale-x-100'}`}
          />
          {(isVideoOff || !localStream) && !isScreenSharing && (
            <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2">
              <div className="w-16 h-16 rounded-full border border-rose-500/20 bg-rose-500/5 flex items-center justify-center text-rose-400">
                <VideoOff className="w-7 h-7" />
              </div>
              <span className="font-bold text-slate-500 text-[10px]">CAMERA STREAM SUSPENDED</span>
            </div>
          )}
          <span className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[9px] font-extrabold text-white">
            {currentUser?.fullName?.toUpperCase()} (YOU)
            {isMuted && ' 🎤 MUTED'}
            {isScreenSharing && ' 🖥 PRESENTING'}
          </span>
        </div>

        {/* Remote Participants views */}
        {remotePeers.map((peer) => (
          <div
            key={peer.socketId}
            className="relative rounded-lg overflow-hidden border bg-zinc-950 flex items-center justify-center min-h-[160px]"
            style={{ borderColor: 'var(--border)' }}
          >
            <video
              ref={(el) => {
                if (el) {
                  remoteVideoRefs.current[peer.socketId] = el;
                  if (peer.stream) el.srcObject = peer.stream;
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!peer.stream && (
              <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2">
                <div className="w-16 h-16 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400 font-bold text-lg">
                  {peer.userName[0]?.toUpperCase()}
                </div>
                <span className="font-bold text-slate-500 text-[10px]">WAITING FOR OPERATOR TELEMETRY...</span>
              </div>
            )}
            <span className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[9px] font-extrabold text-white">
              {peer.userName.toUpperCase()}
            </span>
          </div>
        ))}

        {/* Idle mesh waiting screen */}
        {remotePeers.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/20 pointer-events-none">
            <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900/50 flex items-center justify-center text-slate-400 animate-pulse">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-500 tracking-widest">
              // WAITING FOR OTHER PARTICIPANTS TO LINK TERMINALS...
            </span>
          </div>
        )}
      </div>

      {/* Controller bar */}
      <div
        className="px-5 py-4 border rounded-b-xl bg-zinc-950/60 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Dynamic grid recording switch */}
        <div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`btn h-9 px-4 text-[10px] font-extrabold cursor-pointer flex items-center gap-1.5 border transition-all ${
              isRecording
                ? 'bg-rose-500/10 border-rose-500 text-rose-400 animate-pulse'
                : 'btn-secondary'
            }`}
          >
            {isRecording ? <StopCircle className="w-4 h-4" /> : <Disc className="w-4 h-4 text-rose-500" />}
            <span>{isRecording ? 'STOP RECORDING' : 'RECORD CALL'}</span>
          </button>
        </div>

        {/* Stream toggles */}
        <div className="flex items-center gap-3.5">
          {/* Mute */}
          <button
            onClick={toggleAudio}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
              isMuted
                ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                : 'bg-zinc-900 border-zinc-800 text-slate-300 hover:border-slate-500'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
          </button>

          {/* Camera toggle */}
          <button
            onClick={toggleVideo}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
              isVideoOff
                ? 'bg-rose-500/10 border-rose-500 text-rose-400'
                : 'bg-zinc-900 border-zinc-800 text-slate-300 hover:border-slate-500'
            }`}
            title={isVideoOff ? 'Enable camera' : 'Disable camera'}
          >
            {isVideoOff ? <VideoOff className="w-4.5 h-4.5" /> : <VideoIcon className="w-4.5 h-4.5" />}
          </button>

          {/* Screen present */}
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all border ${
              isScreenSharing
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                : 'bg-zinc-900 border-zinc-800 text-slate-300 hover:border-slate-500'
            }`}
            title={isScreenSharing ? 'Stop presenting' : 'Present screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-4.5 h-4.5" /> : <Monitor className="w-4.5 h-4.5" />}
          </button>
        </div>

        {/* Return buttons */}
        <div>
          <button
            onClick={() => router.push('/dashboard/chat')}
            className="btn h-9 px-5 bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer border-0 flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
          >
            <PhoneOff className="w-3.5 h-3.5 fill-current" />
            <span>DISCONNECT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
