'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
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
  Phone,
  Search,
  Smile,
  MoreVertical,
  ArrowLeft,
  CheckCheck,
  Binary,
  Trash
} from 'lucide-react';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';

const SOCKET_URL = getSocketUrl();
const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

export default function ChatHubPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Selection states
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Search query & Mobile View states
  const [searchQuery, setSearchQuery] = useState('');
  const [activePane, setActivePane] = useState<'sidebar' | 'chat'>('sidebar');

  // Modal State
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDesc, setTeamDesc] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  
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

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket server:', socket.id);
      
      const myId = myIdRef.current;
      if (myId) {
        socket.emit('join-room', myId);
        socket.emit('register-user', myId);
      }
    });

    socket.on('active-users-list', (usersList: string[]) => {
      setOnlineUserIds(usersList);
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

    socket.on('message-deleted', (deletedMessageId: string) => {
      setMessages((prev) => prev.filter((msg) => msg._id !== deletedMessageId));
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
    setActivePane('chat');
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
    setActivePane('chat');
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

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await apiRequest(`/chats/${messageId}`, {
        method: 'DELETE',
      });
      setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
    } catch (err: any) {
      console.error('Error deleting message:', err);
      alert(err.message || 'Failed to delete message.');
    }
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

  // Filters search list for channels & employees
  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (emp.jobTitle && emp.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full gap-1 select-none overflow-hidden font-mono">
      
      {/* Framer Page Header banner block - unified dashboard style */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="page-header mb-6"
      >
        <div>
          <h1 className="page-title flex items-center gap-2 text-lg tracking-widest text-[#ef4444]">
            <span>// TRANSMISSION_DESK: CORES</span>
          </h1>
          <p className="page-subtitle text-[10px] text-slate-500">Decrypt and link operational channels inside active workspace links.</p>
        </div>
      </motion.div>

      {/* Main Card Columns */}
      <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[580px] h-[calc(100vh-14rem)] overflow-hidden">
        
        {/* Left Card: Channels and Colleagues list - Responsive Toggle */}
        <aside 
          className={`w-full lg:w-[300px] flex flex-col shrink-0 border rounded-2xl shadow-lg overflow-hidden transition-all duration-300 relative ${
            activePane === 'sidebar' ? 'flex' : 'hidden lg:flex'
          }`}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)'
          }}
        >
          <div className="absolute top-1 left-2 text-[7px] font-mono opacity-20">UPLINK_DIRECTORY</div>
          
          {/* Header search area */}
          <div className="p-4 shrink-0 select-none flex flex-col gap-3 pt-5" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#ef4444]">COMS_ROSTER</span>
              {isAdmin && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setError('');
                    setCreateTeamModalOpen(true);
                  }}
                  className="p-1 rounded bg-white/5 border hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-all cursor-pointer h-7 w-7 flex items-center justify-center"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  title="CREATE_NODE"
                >
                  <Plus className="w-4.5 h-4.5" />
                </motion.button>
              )}
            </div>

            <div className="input-with-icon w-full relative">
              <span className="input-icon" style={{ paddingLeft: '14px' }}>
                <Search className="w-4 h-4 text-slate-500" />
              </span>
              <input 
                type="text" 
                placeholder="SEARCH_COMS..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input rounded w-full outline-none text-[11px]"
                style={{ height: '36px', paddingLeft: '44px', paddingRight: '32px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Directory listings */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar font-mono text-[11px]">
            
            {/* Teams */}
            <div className="space-y-1.5">
              <h4 className="text-[9px] font-extrabold uppercase tracking-widest pl-2" style={{ color: 'var(--text-muted)' }}>// CHANNELS</h4>
              <div className="space-y-1 relative">
                {filteredTeams.map((t, index) => {
                  const isSelected = selectedTeam && selectedTeam._id === t._id;
                  const idxStr = (index + 1).toString().padStart(2, '0');
                  return (
                    <motion.button
                      key={t._id}
                      onClick={() => handleSelectTeam(t)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded text-left border relative group transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: isSelected ? 'var(--border-strong)' : 'transparent',
                      }}
                    >
                      {/* Active sliding background marker */}
                      {isSelected && (
                        <motion.div
                          layoutId="active-sidebar-selection"
                          className="absolute inset-0 rounded -z-10 border"
                          style={{
                            backgroundColor: 'var(--brand-subtle)',
                            borderColor: 'var(--border-strong)'
                          }}
                          transition={springTransition}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#ef4444]" />
                      )}
                      <div className="w-7 h-7 rounded border flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-elevated)',
                          borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                          color: isSelected ? 'var(--brand)' : 'var(--text-secondary)'
                        }}
                      >
                        <Hash className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-bold truncate block text-white">{t.name.toUpperCase()}</span>
                          <span className="text-[8px] opacity-35">[{idxStr}]</span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {filteredTeams.length === 0 && (
                <span className="text-[10px] block pl-2 italic text-slate-600">NO ACTIVE CHANNELS</span>
              )}
            </div>

            {/* Direct messages */}
            <div className="space-y-1.5 pt-2">
              <h4 className="text-[9px] font-extrabold uppercase tracking-widest pl-2" style={{ color: 'var(--text-muted)' }}>// OPERATORS</h4>
              <div className="space-y-1 relative">
                {filteredEmployees.map((emp, index) => {
                  const isSelected = selectedUser && selectedUser._id === emp._id;
                  const idxStr = (index + 1).toString().padStart(2, '0');
                  return (
                    <motion.button
                      key={emp._id}
                      onClick={() => handleSelectUser(emp)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded text-left border relative group transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: 'transparent',
                        borderColor: isSelected ? 'var(--border-strong)' : 'transparent',
                      }}
                    >
                      {/* Active sliding background marker */}
                      {isSelected && (
                        <motion.div
                          layoutId="active-sidebar-selection"
                          className="absolute inset-0 rounded -z-10 border"
                          style={{
                            backgroundColor: 'var(--brand-subtle)',
                            borderColor: 'var(--border-strong)'
                          }}
                          transition={springTransition}
                        />
                      )}
                      {isSelected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-[#ef4444]" />
                      )}
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded border flex items-center justify-center font-bold text-[10px]"
                          style={{
                            backgroundColor: isSelected ? 'var(--brand-subtle)' : 'var(--bg-elevated)',
                            borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
                            color: isSelected ? 'var(--brand)' : 'var(--text-secondary)'
                          }}
                        >
                          {getInitials(emp.fullName)}
                        </div>
                        {onlineUserIds.includes(emp._id) ? (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-zinc-950 shadow-sm" />
                        ) : (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-zinc-700 border border-zinc-950 shadow-sm opacity-60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <span className="font-bold truncate block text-white">{emp.fullName.toUpperCase()}</span>
                          <span className="text-[8px] opacity-35">[OP_{idxStr}]</span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
              {filteredEmployees.length === 0 && (
                <span className="text-[10px] block pl-2 italic text-slate-600">NO OPERATORS ONLINE</span>
              )}
            </div>
          </div>
        </aside>

        {/* Right Card: Main Active Chat Window Card */}
        <div 
          className={`flex-1 flex flex-col border shadow-lg overflow-hidden relative transition-all duration-300 rounded-2xl min-w-0 ${
            activePane === 'chat' ? 'flex' : 'hidden lg:flex'
          }`}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border)'
          }}
        >
          
          <AnimatePresence mode="wait">
            {selectedTeam || selectedUser ? (
              <motion.div
                key={selectedTeam ? `team-${selectedTeam._id}` : `user-${selectedUser._id}`}
                initial={{ opacity: 0, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.99 }}
                transition={springTransition}
                className="flex-grow flex flex-col h-full overflow-hidden"
              >
                {/* Card topbar header */}
                <div className="h-16 px-4 md:px-5 flex items-center justify-between shrink-0 select-none z-10 relative overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div className="absolute top-1 left-2 text-[7px] opacity-25">STABLE_TRANSMISSION_LINK</div>
                  
                  <div className="flex items-center gap-3 min-w-0 pt-2">
                    {/* Responsive mobile back arrow */}
                    <button
                      onClick={() => setActivePane('sidebar')}
                      className="p-2 -ml-2 rounded border lg:hidden shrink-0 cursor-pointer text-slate-400 hover:text-slate-200"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    {selectedTeam ? (
                      <>
                        <div className="w-8 h-8 rounded border flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'var(--brand-subtle)', borderColor: 'var(--border-strong)', color: 'var(--brand)' }}
                        >
                          <Hash className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-extrabold tracking-widest truncate text-white uppercase">{selectedTeam.name}</h3>
                          <p className="text-[9px] truncate mt-0.5 text-slate-500">// DESC: {selectedTeam.description || 'Channel encryption active'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded border flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ backgroundColor: 'var(--brand-subtle)', borderColor: 'var(--border-strong)', color: 'var(--brand)' }}
                        >
                          {getInitials(selectedUser.fullName)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xs font-extrabold tracking-widest truncate text-white uppercase">{selectedUser.fullName}</h3>
                          {onlineUserIds.includes(selectedUser._id) ? (
                            <p className="text-[9px] font-bold text-emerald-500 tracking-wider mt-0.5">UPLINK_ESTABLISHED</p>
                          ) : (
                            <p className="text-[9px] font-bold text-slate-500 tracking-wider mt-0.5 opacity-65">LINK_OFFLINE</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Call buttons only for direct DMs */}
                  {selectedUser && (
                    <div className="flex items-center gap-3 pt-2">
                      <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCall('audio')} 
                        className="h-10 w-10 md:h-11 md:w-11 flex items-center justify-center rounded-lg border hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors shrink-0 cursor-pointer text-slate-400" 
                        style={{ borderColor: 'var(--border)' }} 
                        title="AUDIO_LINK"
                      >
                        <Phone className="w-5 h-5" />
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.05 }} 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCall('video')} 
                        className="h-10 w-10 md:h-11 md:w-11 flex items-center justify-center rounded-lg border hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors shrink-0 cursor-pointer text-slate-400" 
                        style={{ borderColor: 'var(--border)' }} 
                        title="VIDEO_LINK"
                      >
                        <Video className="w-5 h-5" />
                      </motion.button>
                    </div>
                  )}
                </div>

                {/* Chat timeline message rows */}
                <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar" style={{ backgroundColor: 'var(--bg)' }}>
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const isMe = msg.senderId._id === (currentUser?.id || currentUser?._id);
                      const senderName = msg.senderId?.fullName || 'Operator';
                      const timeString = new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const currentDate = new Date(msg.createdAt).toLocaleDateString([], { dateStyle: 'medium' });
                      const prevMsg = index > 0 ? messages[index - 1] : null;
                      const prevDate = prevMsg ? new Date(prevMsg.createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : null;
                      const showDateHeader = currentDate !== prevDate;

                      return (
                        <React.Fragment key={msg._id}>
                          {showDateHeader && (
                            <div className="flex justify-center my-4 select-none">
                              <span className="px-2.5 py-1 rounded text-[8px] font-bold uppercase border tracking-widest bg-zinc-950"
                                style={{
                                  borderColor: 'var(--border)',
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {currentDate}
                              </span>
                            </div>
                          )}

                          <motion.div 
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`}
                          >
                            {/* Sender name badge for team discussion */}
                            {selectedTeam && !isMe && (
                              <div className="text-[10px] font-extrabold mb-1 text-cyan-400 tracking-wider select-none">
                                [{senderName.toUpperCase()}]
                              </div>
                            )}

                            <div
                              className="px-8 py-5.5 text-sm leading-relaxed border rounded-[4px] font-mono break-words min-w-[220px] max-w-[92%] md:max-w-[82%] shadow-md"
                              style={{
                                backgroundColor: isMe ? 'rgba(6, 182, 212, 0.14)' : 'rgba(28, 28, 40, 0.95)',
                                borderColor: isMe ? 'rgba(6, 182, 212, 0.45)' : 'rgba(255, 255, 255, 0.05)',
                                color: isMe ? 'var(--text-primary)' : '#f8fafc'
                              }}
                            >
                              {msg.content}
                            </div>

                            {/* Timestamp and Checkmark below bubble */}
                            <div className="flex items-center gap-1.5 mt-1.5 px-2 text-[10px] text-slate-400 select-none">
                              <span>{timeString}</span>
                              {isMe && (
                                <CheckCheck className="w-3.5 h-3.5 text-brand shrink-0" />
                              )}
                              {(isMe || isAdmin) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="ml-2 text-rose-500 hover:text-rose-400 hover:scale-110 transition-all cursor-pointer flex items-center justify-center p-0.5 rounded border border-transparent hover:border-rose-500/20 bg-transparent"
                                  title="DELETE_MESSAGE"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        </React.Fragment>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat Text Input Composer Form - Simple and beautifully integrated */}
                <div className="p-4 shrink-0 select-none" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                  <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-4xl mx-auto">
                    
                    <div className="flex-1 rounded-xl flex items-center border"
                       style={{
                         backgroundColor: 'var(--bg-input)',
                         borderColor: 'var(--border)'
                       }}
                    >
                      <button type="button" className="pl-3 pr-1.5 text-slate-500 hover:text-slate-300 transition-colors shrink-0 cursor-pointer" title="Emojis">
                        <Smile className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        placeholder="COMPILE MESSAGE CAPSULE..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1 h-9 py-1.5 px-2 bg-transparent outline-none text-[11px]"
                        style={{ color: 'var(--text-primary)' }}
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={!newMessage.trim()}
                      whileHover={newMessage.trim() ? { scale: 1.02 } : {}}
                      whileTap={newMessage.trim() ? { scale: 0.98 } : {}}
                      className="btn btn-primary h-9 px-4 rounded flex items-center justify-center gap-1 text-[10px] font-bold transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-30 border-0"
                      style={{
                        boxShadow: 'var(--shadow-btn)'
                      }}
                    >
                      <span>TRANSMIT</span>
                      <Send className="w-3 h-3" />
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty-chat-pane"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-grow flex flex-col items-center justify-center text-center gap-3 select-none px-6" 
                style={{ backgroundColor: 'var(--bg)' }}
              >
                <div className="w-10 h-10 rounded border flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                </div>
                <h3 className="text-xs font-bold text-slate-400">// ACTIVE_NODE_LIST</h3>
                <p className="text-[10px] max-w-xs leading-relaxed text-slate-500">Select a secure node channel or workspace employee above to decrypt uplink.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Team Modal */}
      <AnimatePresence>
        {createTeamModalOpen && (
          <div className="modal-overlay select-none z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={springTransition}
              className="modal-box max-w-md w-full"
            >
              <div className="modal-header">
                <h3 className="text-xs font-bold flex items-center gap-2 text-white">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>INITIALIZE_WORK_NODE</span>
                </h3>
                <button
                  onClick={() => setCreateTeamModalOpen(false)}
                  className="p-1 rounded hover:bg-white/5 border cursor-pointer text-slate-500 hover:text-white"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTeamSubmit} className="modal-body space-y-4">
                {error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded flex items-center gap-2 text-[10px] shrink-0 font-mono">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Node name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. engineering, operations"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mission Parameters</label>
                  <textarea
                    placeholder="Describe operational tasks..."
                    value={teamDesc}
                    onChange={(e) => setTeamDesc(e.target.value)}
                    rows={2}
                    className="textarea"
                  />
                </div>

                {/* Members checkboxes */}
                <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                  <label className="form-label mb-2 block">Choose Team Members</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {employees.map((emp) => (
                      <label
                        key={emp._id}
                        className="flex items-center gap-2.5 p-2 bg-white/3 border border-white/5 hover:bg-white/5 rounded cursor-pointer select-none text-[11px]"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          borderColor: 'var(--border)'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(emp._id)}
                          onChange={() => handleToggleMember(emp._id)}
                          className="w-3.5 h-3.5 rounded border-zinc-800 text-rose-600 focus:ring-rose-500"
                        />
                        <span style={{ color: 'var(--text-primary)' }}>{emp.fullName.toUpperCase()} ([OP])</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="modal-footer pt-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setCreateTeamModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-bold cursor-pointer"
                  >
                    INITIALIZE_NODE
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
