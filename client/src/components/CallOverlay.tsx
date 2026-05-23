import React, { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Video, Phone, PhoneOff, User as UserIcon } from 'lucide-react';
import { JitsiMeeting } from '@jitsi/react-sdk';

interface CallOverlayProps {
  socket: Socket | null;
  currentUser: any;
}

export default function CallOverlay({ socket, currentUser }: CallOverlayProps) {
  const [callState, setCallState] = useState<'idle' | 'receiving' | 'in-call'>('idle');
  const [callData, setCallData] = useState<any>(null); // { from, name, type, roomName }

  useEffect(() => {
    if (!socket || !currentUser) return;

    // Listen for incoming call request
    socket.on('incoming-call', (data) => {
      if (callState !== 'idle') {
        // Automatically reject if busy
        socket.emit('reject-call', { to: data.from });
        return;
      }
      setCallData(data);
      setCallState('receiving');
    });

    // If the other person rejects the call
    socket.on('call-rejected', () => {
      endCall(false);
      alert('Call was rejected or user is busy.');
    });

    // If the other person ends the call
    socket.on('call-ended', () => {
      endCall(false);
    });

    // Outgoing call trigger from the chat component
    const handleOutgoingCall = (e: any) => {
      const { toUserId, type, name } = e.detail;
      const myId = currentUser.id || currentUser._id;
      // Create a unique room name
      const roomName = `Markdot-HRM-${myId}-${toUserId}-${Date.now()}`;
      
      setCallData({ to: toUserId, name, type, roomName });
      setCallState('in-call');
      
      // Tell the other person to ring
      socket.emit('call-user', {
        userToCall: toUserId,
        roomName,
        from: myId,
        name: currentUser.fullName,
        type
      });
    };

    window.addEventListener('initiate-call', handleOutgoingCall);

    return () => {
      socket.off('incoming-call');
      socket.off('call-rejected');
      socket.off('call-ended');
      window.removeEventListener('initiate-call', handleOutgoingCall);
    };
  }, [socket, currentUser, callState]);

  const answerCall = () => {
    setCallState('in-call');
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
    
    setCallData(null);
    setCallState('idle');
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

      {/* Jitsi In-Call View */}
      {callState === 'in-call' && (
        <div className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-black rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 anim-fade-up">
          
          {/* Top Bar for hanging up manually in case Jitsi doesn't trigger event */}
          <div className="h-12 bg-black/50 absolute top-0 left-0 right-0 z-10 flex justify-end items-center px-4">
            <button 
              onClick={() => endCall(true)} 
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" /> End Call
            </button>
          </div>

          <div className="flex-1">
            <JitsiMeeting
              roomName={callData?.roomName || 'Markdot-Fallback-Room'}
              configOverwrite={{
                startWithAudioMuted: false,
                startWithVideoMuted: callData?.type === 'audio',
                prejoinPageEnabled: false,
                disableDeepLinking: true,
              }}
              interfaceConfigOverwrite={{
                DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                SHOW_CHROME_EXTENSION_BANNER: false,
              }}
              userInfo={{
                displayName: currentUser?.fullName || 'User',
                email: currentUser?.email || 'user@example.com'
              }}
              onApiReady={(externalApi) => {
                // Listen for when the user clicks the native red hangup button in Jitsi
                externalApi.addListener('videoConferenceLeft', () => {
                  endCall(true);
                });
              }}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
