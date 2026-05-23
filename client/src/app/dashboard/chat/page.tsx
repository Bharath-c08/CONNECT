'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  MessageSquare,
  Plus,
  Send,
  Users,
  User as UserIcon,
  X,
  Shield,
  Hash,
  AlertCircle,
  Video,
  Phone
} from 'lucide-react';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';

const SOCKET_URL = getSocketUrl();

export default function ChatHubPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Selection states
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Modal State
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Active chat references to avoid socket listener teardown loops
  const activeChatIdRef = useRef<string | null>(null);
  const activeChatTypeRef = useRef<'team' | 'user' | null>(null);
  const myIdRef = useRef<string | null>(null);

  // 1. Initial mount - Load user profile
  useEffect(() => {
    const usr = getCurrentUser();
    if (usr) {
      setCurrentUser(usr);
      myIdRef.current = usr.id || usr._id;
    }
  }, []);

  // 2. Setup permanent Socket connection and fetch directories once user is resolved
  useEffect(() => {
    if (!currentUser) return;

    // Connect to WebSocket
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket server:', socket.id);
      
      // Join personal room for direct messaging
      const myId = myIdRef.current;
      if (myId) {
        socket.emit('join-room', myId);
      }
    });

    socket.on('receive-message', (message: any) => {
      const activeId = activeChatIdRef.current;
      const activeType = activeChatTypeRef.current;
      const myId = myIdRef.current;

      const isTeamMsg = message.teamId && activeType === 'team' && message.teamId === activeId;
      const isDirectMsg = !message.teamId && activeType === 'user' && (
        (message.senderId._id === activeId && message.recipientId === myId) ||
        (message.senderId._id === myId && message.recipientId === activeId)
      );

      if (isTeamMsg || isDirectMsg) {
        setMessages((prev) => [...prev, message]);
      }
    });

    fetchChannels(currentUser);

    return () => {
      socket.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChannels = async (usr: any) => {
    setLoading(true);
    try {
      const activeUser = usr || currentUser;
      if (!activeUser) return;
      const myId = activeUser.id || activeUser._id;
      
      // 1. Fetch teams
      const myTeams = await apiRequest('/teams/my');
      setTeams(myTeams);

      // Join all team rooms for real-time alerts
      myTeams.forEach((t: any) => {
        if (socketRef.current) {
          socketRef.current.emit('join-room', t._id);
        }
      });

      // 2. Fetch other employees for DMs
      const staffList = await apiRequest('/users');
      const filteredStaff = staffList.filter((e: any) => e._id !== myId);
      setEmployees(filteredStaff);
    } catch (err) {
      console.error('Error fetching chat directories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTeam = async (team: any) => {
    setSelectedUser(null);
    setSelectedTeam(team);
    activeChatIdRef.current = team._id;
    activeChatTypeRef.current = 'team';
    setMessages([]);
    try {
      const chatHistory = await apiRequest(`/chats/team/${team._id}`);
      setMessages(chatHistory);
    } catch (err: any) {
      console.error('Error loading team chats:', err);
    }
  };

  const handleSelectUser = async (user: any) => {
    setSelectedTeam(null);
    setSelectedUser(user);
    activeChatIdRef.current = user._id;
    activeChatTypeRef.current = 'user';
    setMessages([]);
    try {
      const chatHistory = await apiRequest(`/chats/direct/${user._id}`);
      setMessages(chatHistory);
    } catch (err: any) {
      console.error('Error loading direct chats:', err);
    }
  };

  const handleCall = (type: 'audio' | 'video') => {
    if (!selectedUser) return;
    const event = new CustomEvent('initiate-call', {
      detail: { toUserId: selectedUser._id, name: selectedUser.fullName, type }
    });
    window.dispatchEvent(event);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !currentUser) return;

    const myId = currentUser.id || currentUser._id;
    const payload: any = {
      senderId: myId,
      content: newMessage.trim(),
    };

    if (selectedTeam) {
      payload.teamId = selectedTeam._id;
    } else if (selectedUser) {
      payload.recipientId = selectedUser._id;
    }

    socketRef.current.emit('send-message', payload);
    setNewMessage('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Create Team Admin logic
  const handleToggleMember = (empId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleCreateTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!teamName.trim()) {
      setError('Please provide a team channel name.');
      return;
    }

    try {
      await apiRequest('/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDesc.trim(),
          members: selectedMembers,
        }),
      });

      setCreateTeamModalOpen(false);
      setTeamName('');
      setTeamDesc('');
      setSelectedMembers([]);
      fetchChannels(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create team.');
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="h-[calc(100vh-8.5rem)] flex bg-background border border-white/10 rounded-3xl overflow-hidden relative">
      {/* Sidebar Channels List */}
      <aside className="w-64 border-r border-white/10 flex flex-col h-full bg-white/[0.02] select-none">
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <span className="text-xs font-extrabold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-rose-500" />
            <span>Chat Channels</span>
          </span>

          {isAdmin && (
            <button
              onClick={() => {
                setError('');
                setCreateTeamModalOpen(true);
              }}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              title="Create Team"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Channels listing */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Teams / Rooms Section */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-2.5">Teams</h4>
            {teams.map((t) => (
              <button
                key={t._id}
                onClick={() => handleSelectTeam(t)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                  selectedTeam && selectedTeam._id === t._id
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold'
                    : 'text-slate-400 hover:bg-white/3 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Hash className="w-4 h-4 shrink-0 opacity-60" />
                <span className="truncate">{t.name}</span>
              </button>
            ))}
            {teams.length === 0 && (
              <span className="text-[10px] text-slate-600 block pl-2.5 italic">No teams joined.</span>
            )}
          </div>

          {/* Employees direct messages Section */}
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider pl-2.5">Staff Channels</h4>
            {employees.map((emp) => (
              <button
                key={emp._id}
                onClick={() => handleSelectUser(emp)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                  selectedUser && selectedUser._id === emp._id
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold'
                    : 'text-slate-400 hover:bg-white/3 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0">
                  {getInitials(emp.fullName)}
                </div>
                <span className="truncate">{emp.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Chat Conversation Pane */}
      <main className="flex-1 flex flex-col h-full bg-black/10">
        {/* Selected Chat info topbar */}
        {(selectedTeam || selectedUser) ? (
          <>
            <div className="h-16 px-6 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] shrink-0 select-none">
              {selectedTeam ? (
                <>
                  <Hash className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold text-white tracking-wide">{selectedTeam.name}</h3>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{selectedTeam.description || 'General team discussion'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-xs font-bold text-rose-400 shrink-0">
                    {getInitials(selectedUser.fullName)}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xs font-bold text-white tracking-wide">{selectedUser.fullName}</h3>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{selectedUser.jobTitle || 'Staff'}</p>
                  </div>
                  
                  {/* Call Buttons */}
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleCall('audio')} className="btn-icon bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400" title="Audio Call">
                      <Phone className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleCall('video')} className="btn-icon bg-white/5 hover:bg-brand/20 text-slate-400 hover:text-brand" title="Video Call">
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Conversation timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg) => {
                const isMe = msg.senderId._id === (currentUser?.id || currentUser?._id);
                const senderName = msg.senderId?.fullName || 'User';
                const senderJob = msg.senderId?.jobTitle || '';
                const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mb-1 select-none">
                      <span className="font-semibold text-slate-400">{senderName}</span>
                      {senderJob && <span>&bull; {senderJob}</span>}
                      <span>&bull; {timeString}</span>
                    </div>

                    <div
                      className={`max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-md border ${
                        isMe
                          ? 'bg-rose-600 border-rose-500/30 text-white rounded-tr-none'
                          : 'bg-white/5 border-white/10 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Textarea Compose Bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center gap-3 shrink-0">
              <input
                type="text"
                placeholder="Type your message here..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 h-12 px-5 bg-white/5 border border-white/10 rounded-2xl focus:border-rose-500/50 outline-none text-white text-sm placeholder-slate-500 transition-all"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-700/30 text-white disabled:text-slate-500 rounded-2xl transition-all shadow-[0_0_10px_rgba(244,63,94,0.2)] hover:scale-105 cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 select-none">
            <MessageSquare className="w-12 h-12 text-slate-600 animate-pulse" />
            <h3 className="text-sm font-bold text-slate-400 mt-2">Active Channels</h3>
            <p className="text-slate-500 text-xs max-w-xs">Select a team channel or staff member in the sidebar to begin communicating in real-time.</p>
          </div>
        )}
      </main>

      {/* Create Team Modal (Admins) */}
      {createTeamModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/10 relative overflow-hidden flex flex-col max-h-[85vh]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                <span>Create Team Channel</span>
              </h3>
              <button
                onClick={() => setCreateTeamModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeamSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-2 text-xs select-none shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Team Channel Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. engineering, digital-marketing..."
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  placeholder="Purpose of this discussion channel..."
                  value={teamDesc}
                  onChange={(e) => setTeamDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                />
              </div>

              {/* Members check list */}
              <div className="border-t border-white/5 pt-3">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 select-none">Select Team Members</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {employees.map((emp) => (
                    <label
                      key={emp._id}
                      className="flex items-center gap-2.5 p-2 bg-white/3 border border-white/5 hover:bg-white/5 rounded-xl cursor-pointer select-none text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(emp._id)}
                        onChange={() => handleToggleMember(emp._id)}
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-rose-600 focus:ring-rose-500"
                      />
                      <span>{emp.fullName} ({emp.jobTitle || 'Staff'})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setCreateTeamModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] text-xs cursor-pointer"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
