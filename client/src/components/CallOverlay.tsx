import React, { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Video, Phone, Mic, MicOff, VideoOff, PhoneOff, User as UserIcon } from 'lucide-react';

interface CallOverlayProps {
  socket: Socket | null;
  currentUser: any;
}

export default function CallOverlay({ socket, currentUser }: CallOverlayProps) {
  const [callState, setCallState] = useState<'idle' | 'receiving' | 'calling' | 'connected'>('idle');
  const [callData, setCallData] = useState<any>(null); // { from, name, signal, type }
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.on('incoming-call', (data) => {
      if (callState !== 'idle') {
        // Automatically reject if busy
        socket.emit('reject-call', { to: data.from });
        return;
      }
      setCallData(data);
      setCallState('receiving');
    });

    socket.on('call-accepted', async (signal) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        setCallState('connected');
      }
    });

    socket.on('call-rejected', () => {
      endCall(false);
      alert('Call was rejected or user is busy.');
    });

    socket.on('call-ended', () => {
      endCall(false);
    });

    socket.on('ice-candidate', async (candidate) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding received ice candidate', e);
        }
      }
    });

    // Custom outgoing call trigger from the chat component
    const handleOutgoingCall = async (e: any) => {
      const { toUserId, type, name } = e.detail;
      setCallData({ to: toUserId, name, type });
      setCallState('calling');
      await initiateCall(toUserId, type);
    };

    window.addEventListener('initiate-call', handleOutgoingCall);

    return () => {
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('ice-candidate');
      window.removeEventListener('initiate-call', handleOutgoingCall);
    };
  }, [socket, currentUser, callState]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  const getMediaOptions = (type: 'audio' | 'video') => {
    return {
      audio: true,
      video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
    };
  };

  const createPeerConnection = (toUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit('ice-candidate', { to: toUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return pc;
  };

  const initiateCall = async (toUserId: string, type: 'audio' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaOptions(type));
      setLocalStream(stream);

      const pc = createPeerConnection(toUserId);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit('call-user', {
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

  const answerCall = async () => {
    try {
      const type = callData.type || 'video';
      const stream = await navigator.mediaDevices.getUserMedia(getMediaOptions(type));
      setLocalStream(stream);

      const pc = createPeerConnection(callData.from);
      peerConnectionRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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
      const target = callState === 'calling' ? callData.to : callData.from;
      socket.emit('end-call', { to: target });
    }
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    
    setLocalStream(null);
    setRemoteStream(null);
    setCallData(null);
    setCallState('idle');
    peerConnectionRef.current = null;
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      {/* Receiving Call View */}
      {callState === 'receiving' && (
        <div className="modal-box w-full max-w-sm text-center p-8 anim-fade-up">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-500 animate-pulse">
            <UserIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold mb-1">{callData?.name}</h3>
          <p className="text-sm text-slate-400 mb-8">Incoming {callData?.type} call...</p>
          
          <div className="flex justify-center gap-4">
            <button onClick={rejectCall} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </button>
            <button onClick={answerCall} className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform hover:scale-105 animate-bounce">
              {callData?.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
          </div>
        </div>
      )}

      {/* Calling / Connected View */}
      {(callState === 'calling' || callState === 'connected') && (
        <div className="w-full max-w-4xl h-[80vh] flex flex-col bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 anim-fade-up">
          
          {/* Main Remote Video Area */}
          <div className="flex-1 relative bg-slate-900 flex items-center justify-center">
            {callState === 'calling' ? (
              <div className="text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                  <UserIcon className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Calling {callData?.name}...</h2>
                <p className="text-slate-400">Waiting for answer</p>
              </div>
            ) : (
              <>
                {(callData?.type === 'audio' && !remoteStream?.getVideoTracks()[0]?.enabled) ? (
                   <div className="text-center">
                     <div className="w-32 h-32 rounded-full mx-auto bg-brand/20 border border-brand/50 flex items-center justify-center text-brand">
                       <UserIcon className="w-16 h-16" />
                     </div>
                     <h2 className="text-2xl font-bold text-white mt-6">{callData?.name}</h2>
                   </div>
                ) : (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                )}
              </>
            )}
          </div>

          {/* Local PiP Video */}
          {callState === 'connected' && callData?.type === 'video' && (
            <div className="absolute top-6 right-6 w-48 h-32 bg-black rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6">
            <button onClick={toggleAudio} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${isAudioMuted ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
              {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            {callData?.type === 'video' && (
              <button onClick={toggleVideo} className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all ${isVideoMuted ? 'bg-white/20 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            <button onClick={() => endCall(true)} className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 ml-4">
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
}
