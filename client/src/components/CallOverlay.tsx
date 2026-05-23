import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Video, Phone, PhoneOff, Mic, MicOff, VideoOff, Maximize, Minimize, User as UserIcon } from 'lucide-react';

interface CallOverlayProps {
  socket: Socket | null;
  currentUser: any;
}

export default function CallOverlay({ socket, currentUser }: CallOverlayProps) {
  const [callState, setCallState] = useState<'idle' | 'calling' | 'receiving' | 'connected'>('idle');
  const [callData, setCallData] = useState<any>(null); // { signal, from, name, type }
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // Initialize Media Devices
  const getMediaOptions = (type: 'audio' | 'video') => ({
    audio: true,
    video: type === 'video'
  });

  // Basic cleanup
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

  const rejectCall = () => {
    socket?.emit('reject-call', { to: callData.from });
    endCall(false);
  };

  const endCall = (emitEvent = true) => {
    if (emitEvent && socket && callData) {
      const target = callData.to || callData.from;
      socket.emit('end-call', { to: target });
    }
    cleanupMedia();
    setCallData(null);
    setCallState('idle');
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      {/* Calling / Receiving Modals */}
      {(callState === 'calling' || callState === 'receiving') && (
        <div className="modal-box w-full max-w-sm text-center p-8 anim-fade-up">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-500 animate-pulse">
            <UserIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold mb-1">{callData?.name}</h3>
          <p className="text-sm text-slate-400 mb-8">
            {callState === 'calling' ? `Calling...` : `Incoming ${callData?.type} call...`}
          </p>
          
          <div className="flex justify-center gap-4">
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

      {/* Connected Video UI */}
      {callState === 'connected' && (
        <div className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 anim-fade-up">
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
          </div>

          {/* Video Layout */}
          <div className="flex-1 relative bg-black/50">
            {/* Remote Video (Full Screen) */}
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <div className="text-white/30 flex flex-col items-center">
                  <UserIcon className="w-24 h-24 mb-4 opacity-50" />
                  <p>Waiting for video...</p>
                </div>
              )}
            </div>

            {/* Local Video (PiP) */}
            {callData?.type === 'video' && (
              <div className="absolute bottom-24 right-6 w-48 aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20 transition-all hover:scale-105 z-20">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                {isVideoOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 text-white/50 backdrop-blur-sm">
                    <VideoOff className="w-8 h-8" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controls Bar */}
          <div className="h-24 bg-gradient-to-t from-black/90 to-black/0 absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 pb-4 z-10">
            <button onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}>
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            {callData?.type === 'video' && (
              <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-md'}`}>
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            <button onClick={() => endCall(true)} className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110">
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
