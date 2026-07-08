import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import {
  Video,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  User as UserIcon,
  Disc,
  StopCircle
} from 'lucide-react';
import { startRinging, stopRinging } from '../utils/audio';

interface CallOverlayProps {
  socket: Socket | null;
  currentUser: any;
}

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

export default function CallOverlay({ socket, currentUser }: CallOverlayProps) {
  const [callState, setCallState] = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');
  const [callData, setCallData] = useState<any>(null); // { signal, from, name, type }
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const isVideoOffRef = useRef(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Keep refs in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    isVideoOffRef.current = isVideoOff;
  }, [isVideoOff]);

  const getMediaOptions = (type: 'audio' | 'video') => ({
    audio: true,
    video: type === 'video'
  });

  const cleanupMedia = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.on('incoming-call', (data) => {
      if (callState !== 'idle') {
        socket.emit('reject-call', { to: data.from });
        return;
      }
      startRinging();
      setCallData(data);
      setCallState('receiving');
    });

    socket.on('call-rejected', () => {
      endCall(false);
      alert('Call was rejected or user is busy.');
    });

    socket.on('call-ended', () => {
      endCall(false);
    });

    socket.on('call-accepted', async (signal) => {
      if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          setCallState('connected');
        } catch(err) {
          console.error('Error setting remote description:', err);
        }
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    const handleOutgoingCall = async (e: any) => {
      const { toUserId, type, name } = e.detail;
      setCallData({ to: toUserId, name, type });
      setCallState('calling');
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(getMediaOptions(type));
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = createPeerConnection(toUserId);
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call-user', {
          userToCall: toUserId,
          signalData: offer,
          from: currentUser.id || currentUser._id,
          name: currentUser.fullName,
          type
        });

      } catch (err: any) {
        console.error('Error accessing media devices.', err);
        setCallState('idle');
        if (err.name === 'NotFoundError') {
          alert('Could not find a camera or microphone. Please connect a device to make a call.');
        } else {
          alert('Could not access camera/microphone. Please check browser permissions.');
        }
      }
    };

    window.addEventListener('initiate-call', handleOutgoingCall);

    return () => {
      socket.off('incoming-call');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('call-accepted');
      socket.off('ice-candidate');
      window.removeEventListener('initiate-call', handleOutgoingCall);
    };
  }, [socket, currentUser, callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream, callState]);

  const createPeerConnection = (targetId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('ice-candidate', { to: targetId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const answerCall = async () => {
    stopRinging();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaOptions(callData.type));
      setLocalStream(stream);

      const pc = createPeerConnection(callData.from);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      if (callData.signal) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket?.emit('answer-call', { to: callData.from, signal: answer });
        setCallState('connected');
      }
    } catch (err: any) {
      console.error('Error answering call.', err);
      endCall(true);
      if (err.name === 'NotFoundError') {
        alert('Could not find a camera or microphone. Cannot answer call.');
      } else {
        alert('Could not access camera/microphone. Cannot answer call.');
      }
    }
  };

  useEffect(() => {
    const handleExternalAccept = () => {
      if (callState === 'receiving') {
        answerCall();
      }
    };

    window.addEventListener('external-accept-call', handleExternalAccept);
    return () => {
      window.removeEventListener('external-accept-call', handleExternalAccept);
    };
  }, [callState, callData, answerCall]);

  const rejectCall = () => {
    socket?.emit('reject-call', { to: callData.from });
    endCall(false);
  };

  const endCall = (emitEvent = true) => {
    // Auto-stop recording if active
    if (isRecordingRef.current) {
      stopRecording();
    }

    if (emitEvent && socket && callData) {
      const target = callData.to || callData.from;
      socket.emit('end-call', { to: target });
    }
    stopRinging();
    cleanupMedia();
    setCallData(null);
    setCallState('idle');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  // ─── Composited Canvas + Audio Recording for Private Calls ──────────────────
  const startRecording = async () => {
    recordedChunksRef.current = [];

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Could not initialize canvas call recording context.');
      return;
    }

    let audioDest: MediaStreamAudioDestinationNode | null = null;
    let audioContext: AudioContext | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      audioDest = audioContext.createMediaStreamDestination();

      if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
        const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
        localSource.connect(audioDest);
      }

      if (remoteStreamRef.current && remoteStreamRef.current.getAudioTracks().length > 0) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStreamRef.current);
        remoteSource.connect(audioDest);
      }
    } catch (err) {
      console.warn('Audio mixer context failed, recording video-only:', err);
    }

    const canvasStream = canvas.captureStream(30);
    canvasStreamRef.current = canvasStream;

    const tracksToRecord: MediaStreamTrack[] = [];
    if (canvasStream.getVideoTracks().length > 0) {
      tracksToRecord.push(canvasStream.getVideoTracks()[0]);
    }
    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
      tracksToRecord.push(audioDest.stream.getAudioTracks()[0]);
    }

    const outputStream = new MediaStream(tracksToRecord);
    const mimeType = getBestMimeType();

    // Render compositor loop
    const drawCallLoop = () => {
      if (!isRecordingRef.current) return;

      // Draw premium futuristic background
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isVideoCall = callData?.type === 'video';

      if (isVideoCall) {
        // Draw Side-by-Side Video Layout
        const cellW = canvas.width / 2;
        const cellH = canvas.height;

        // Local stream on the left (Mirrored)
        ctx.strokeStyle = '#1e1e24';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, cellW, cellH);

        if (localVideoRef.current && !isVideoOffRef.current && localVideoRef.current.readyState >= 2) {
          ctx.save();
          ctx.translate(cellW, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(localVideoRef.current, 0, 0, cellW, cellH);
          ctx.restore();
        } else {
          // Draw Local Avatar card
          ctx.fillStyle = '#18181b';
          ctx.fillRect(4, 4, cellW - 8, cellH - 8);

          ctx.fillStyle = '#27272a';
          ctx.beginPath();
          ctx.arc(cellW / 2, cellH / 2, 80, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 36px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((currentUser?.fullName?.[0] || 'Y').toUpperCase(), cellW / 2, cellH / 2);
        }

        // Remote stream on the right
        ctx.strokeRect(cellW, 0, cellW, cellH);
        if (remoteVideoRef.current && remoteStreamRef.current && remoteVideoRef.current.readyState >= 2) {
          ctx.drawImage(remoteVideoRef.current, cellW, 0, cellW, cellH);
        } else {
          // Draw Remote Avatar card
          ctx.fillStyle = '#18181b';
          ctx.fillRect(cellW + 4, 4, cellW - 8, cellH - 8);

          ctx.fillStyle = '#27272a';
          ctx.beginPath();
          ctx.arc(cellW + cellW / 2, cellH / 2, 80, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 36px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((callData?.name?.[0] || 'R').toUpperCase(), cellW + cellW / 2, cellH / 2);
        }

        // Add beautiful layout name tag labels
        ctx.fillStyle = 'rgba(9, 9, 11, 0.7)';
        ctx.fillRect(20, cellH - 50, cellW - 40, 30);
        ctx.fillRect(cellW + 20, cellH - 50, cellW - 40, 30);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${currentUser?.fullName || 'YOU'} (YOU)`.toUpperCase(), 36, cellH - 35);
        ctx.fillText(callData?.name.toUpperCase(), cellW + 36, cellH - 35);

      } else {
        // Audio Call visual card representation
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

        // Circular glow nodes
        const drawAvatar = (cx: number, cy: number, name: string, color: string) => {
          ctx.fillStyle = '#18181b';
          ctx.beginPath();
          ctx.arc(cx, cy, 90, 0, Math.PI * 2);
          ctx.fill();

          ctx.lineWidth = 3;
          ctx.strokeStyle = color;
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 28px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((name?.[0] || '?').toUpperCase(), cx, cy);

          ctx.fillStyle = color;
          ctx.font = 'bold 13px monospace';
          ctx.fillText(name.toUpperCase(), cx, cy + 120);
        };

        drawAvatar(canvas.width * 0.3, canvas.height * 0.45, currentUser?.fullName || 'YOU', '#38bdf8');
        drawAvatar(canvas.width * 0.7, canvas.height * 0.45, callData?.name || 'OPERATOR', '#10b981');

        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.fillRect(canvas.width * 0.38, canvas.height * 0.4, canvas.width * 0.24, 40);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AUDIO UPLINK SECURED', canvas.width / 2, canvas.height * 0.43);
      }

      animationFrameRef.current = requestAnimationFrame(drawCallLoop);
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
        downloadBlob(blob, `call_recording_${callData?.name || 'call'}_${timestamp}.webm`);

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
      recorder.start(1000);
      drawCallLoop();
    } catch (err) {
      console.error('Call recording error:', err);
      alert('Could not start call recording.');
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-white" style={{ background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(12px)' }}>
      {/* Calling / Receiving Modals */}
      {(callState === 'calling' || callState === 'receiving') && (
        <div className="w-full max-w-sm text-center p-8 rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl scale-100 transform transition-all duration-300">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 animate-pulse">
            <UserIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold mb-1">{callData?.name}</h3>
          <p className="text-sm text-slate-400 mb-8">
            {callState === 'calling' ? `Calling...` : `Incoming ${callData?.type} call...`}
          </p>
          
          <div className="flex justify-center gap-6">
            <button onClick={() => callState === 'calling' ? endCall(true) : rejectCall()} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </button>
            {callState === 'receiving' && (
              <button onClick={answerCall} className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform hover:scale-105 animate-bounce">
                {callData?.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Connected Call UI */}
      {callState === 'connected' && (
        <div className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl relative border border-zinc-800 anim-fade-up">
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{callData?.name}</h3>
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected
                </span>
              </div>
            </div>

            {/* Glowing active record badge inside overlay */}
            {isRecording && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-[9px] font-extrabold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> RECORDING ACTIVE
              </div>
            )}
          </div>

          {/* Central content area */}
          <div className="flex-1 relative bg-black/50 flex items-center justify-center">
            {callData?.type === 'video' ? (
              <>
                {/* Remote Video (Full Screen) */}
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-white/30 flex flex-col items-center">
                      <UserIcon className="w-24 h-24 mb-4 opacity-50" />
                      <p>Waiting for remote media...</p>
                    </div>
                  )}
                </div>

                {/* Local Video (PiP) */}
                <div className="absolute bottom-24 right-6 w-48 aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all hover:scale-105 z-20">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                  {isVideoOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 text-white/50 backdrop-blur-sm">
                      <VideoOff className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Audio Call Visual Representation */
              <div className="flex flex-col items-center justify-center text-center p-8">
                {/* Hidden video element to play the remote audio track */}
                {remoteStream && (
                  <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                )}
                
                {/* Pulsing Glowing Avatar Card */}
                <div className="relative w-36 h-36 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
                  {/* Outer breathing rings */}
                  <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-75"></div>
                  <div className="w-28 h-28 rounded-full bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 text-4xl font-extrabold shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    {(callData?.name?.[0] || 'R').toUpperCase()}
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">{callData?.name}</h2>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Encrypted Voice Link Active
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="h-20 bg-zinc-900 border-t border-zinc-800/50 flex items-center justify-center gap-6 z-10 w-full shrink-0">
            {/* Record toggle */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50 animate-pulse'
                  : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record Call'}
            >
              {isRecording ? <StopCircle className="w-5 h-5" /> : <Disc className="w-5 h-5 text-rose-500" />}
            </button>

            {/* Mute Mic */}
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}>
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            {/* Toggle Cam */}
            {callData?.type === 'video' && (
              <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}>
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* Hangup */}
            <button onClick={() => endCall(true)} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110">
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
