'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Trophy,
  Flame,
  Send,
  Star,
  Users,
  Search,
  Sparkles,
  Zap,
  CheckCircle,
  Plus,
  X,
  Heart,
  Crown,
  Medal,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';
import { io } from 'socket.io-client';

const BADGE_OPTIONS = [
  { name: 'Team Player', icon: Users, color: 'from-blue-500 to-indigo-600', description: 'Exceptional collaboration & team support' },
  { name: 'Problem Solver', icon: Zap, color: 'from-emerald-500 to-teal-600', description: 'Crushed critical bugs or obstacles' },
  { name: 'Code Wizard', icon: Sparkles, color: 'from-purple-500 to-violet-600', description: 'Brilliant technical execution & clean code' },
  { name: 'Overachiever', icon: Flame, color: 'from-amber-500 to-orange-600', description: 'Exceeded project targets & expectations' },
  { name: 'Leadership', icon: Crown, color: 'from-yellow-500 to-amber-600', description: 'Guided & inspired team members forward' },
  { name: 'Star Collaborator', icon: Star, color: 'from-cyan-500 to-blue-600', description: 'Seamless cross-department partnership' },
  { name: 'Innovator', icon: Trophy, color: 'from-pink-500 to-rose-600', description: 'Pioneered fresh ideas & novel solutions' },
  { name: 'Customer Hero', icon: Heart, color: 'from-rose-500 to-red-600', description: 'Outstanding client care & advocacy' },
];

export default function KudosPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [kudosList, setKudosList] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ totalPoints: 0, receivedCount: 0, sentCount: 0 });
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'leaderboard' | 'gallery'>('feed');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState('');
  const [selectedBadge, setSelectedBadge] = useState(BADGE_OPTIONS[0].name);
  const [points, setPoints] = useState(15);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchData();

    // Listen to live Kudos Socket broadcasts
    const socket = io(getSocketUrl());
    socket.on('kudos-broadcast', (newKudos) => {
      setKudosList((prev) => [newKudos, ...prev]);
      
      // Trigger confetti celebration!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#eab308'],
      });
      
      fetchStats();
      fetchLeaderboard();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchKudosFeed(), fetchLeaderboard(), fetchStats(), fetchUsers()]);
    } catch (err) {
      console.error('Error loading kudos page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKudosFeed = async () => {
    try {
      const data = await apiRequest('/kudos');
      setKudosList(Array.isArray(data) ? data : []);
    } catch (e) {
      setKudosList([]);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await apiRequest('/kudos/leaderboard');
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e) {
      setLeaderboard([]);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await apiRequest('/kudos/stats');
      setStats(data || { totalPoints: 0, receivedCount: 0, sentCount: 0 });
    } catch (e) {
      setStats({ totalPoints: 0, receivedCount: 0, sentCount: 0 });
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/users');
      setUsersList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendKudos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceiver || !message.trim()) return;

    setSubmitting(true);
    try {
      await apiRequest('/kudos', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: selectedReceiver,
          badge: selectedBadge,
          message,
          points,
        }),
      });

      // Fire local confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });

      setShowModal(false);
      setMessage('');
      setSelectedReceiver('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to send kudos');
    } finally {
      setSubmitting(false);
    }
  };

  const getBadgeMeta = (badgeName: string) => {
    return BADGE_OPTIONS.find((b) => b.name === badgeName) || BADGE_OPTIONS[0];
  };

  const filteredFeed = kudosList.filter((k) => {
    if (!searchFilter) return true;
    const query = searchFilter.toLowerCase();
    return (
      k.senderId?.fullName?.toLowerCase().includes(query) ||
      k.receiverId?.fullName?.toLowerCase().includes(query) ||
      k.badge.toLowerCase().includes(query) ||
      k.message.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 select-none font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 backdrop-blur-lg border-cyan-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs tracking-wider uppercase font-bold">
            <Trophy className="w-4 h-4 animate-bounce" />
            <span>// RECOGNITION_HUB</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Peer Kudos & Gamification</h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Celebrate achievements, award appreciation badges, and rank up on the company leaderboard.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer border-0 uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          <span>AWARD KUDOS</span>
        </button>
      </div>

      {/* Stats Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">TOTAL POINTS EARNED</p>
            <p className="text-2xl font-black text-amber-400">{stats.totalPoints || 0} PTS</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">KUDOS RECEIVED</p>
            <p className="text-2xl font-black text-cyan-400">{stats.receivedCount || 0}</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">KUDOS GIVEN</p>
            <p className="text-2xl font-black text-purple-400">{stats.sentCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'feed'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            ACTIVITY FEED
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'leaderboard'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            LEADERBOARD
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
              activeTab === 'gallery'
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                : 'text-slate-400 hover:text-white border-transparent'
            }`}
          >
            BADGES GALLERY
          </button>
        </div>

        {activeTab === 'feed' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search feed..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Activity Feed */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">Loading Kudos Feed...</div>
          ) : filteredFeed.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
              No kudos found. Be the first to send appreciation to a teammate!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeed.map((kudos) => {
                const meta = getBadgeMeta(kudos.badge);
                const BadgeIcon = meta.icon;
                return (
                  <motion.div
                    key={kudos._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl border bg-slate-900/70 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white shadow-md`}
                        >
                          <BadgeIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {kudos.badge}
                          </span>
                          <p className="text-xs text-slate-300 font-bold mt-1">
                            <span className="text-cyan-400">{kudos.senderId?.fullName || 'Anonymous'}</span> awarded{' '}
                            <span className="text-emerald-400">{kudos.receiverId?.fullName}</span>
                          </p>
                        </div>
                      </div>

                      <span className="px-2 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        +{kudos.points} PTS
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed italic">
                      "{kudos.message}"
                    </p>

                    <div className="text-[9px] text-slate-500 text-right">
                      {new Date(kudos.createdAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Top Recognized Operators</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">RANKED BY TOTAL POINTS</span>
          </div>

          <div className="space-y-2">
            {leaderboard.map((item, idx) => {
              const rankColor =
                idx === 0
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : idx === 1
                  ? 'text-slate-300 bg-slate-400/10 border-slate-400/30'
                  : idx === 2
                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                  : 'text-slate-400 bg-slate-800/40 border-slate-700';

              return (
                <div
                  key={item._id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${rankColor}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 bg-slate-900 border border-slate-700">
                      #{idx + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.user?.fullName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{item.user?.jobTitle || 'Operator'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-400 font-bold">{item.kudosCount} Badges</p>
                    </div>

                    <div className="text-right px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <p className="text-xs font-black">{item.totalPoints} PTS</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Badges Gallery */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {BADGE_OPTIONS.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.name}
                className="p-5 rounded-2xl border bg-slate-900/60 border-slate-800 hover:border-cyan-500/40 transition-all text-center space-y-3"
              >
                <div
                  className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${badge.color} flex items-center justify-center text-white shadow-lg`}
                >
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">{badge.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">{badge.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Award Kudos Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden z-10"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Award Peer Kudos</h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSendKudos} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                    Select Recipient
                  </label>
                  <select
                    value={selectedReceiver}
                    onChange={(e) => setSelectedReceiver(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Choose Team Member --</option>
                    {usersList
                      .filter((u) => u._id !== currentUser?._id)
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.fullName} ({u.jobTitle || 'Operator'})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                    Appreciation Badge
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {BADGE_OPTIONS.map((badge) => {
                      const isSelected = selectedBadge === badge.name;
                      const Icon = badge.icon;
                      return (
                        <button
                          type="button"
                          key={badge.name}
                          onClick={() => setSelectedBadge(badge.name)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-500/10 text-white font-bold'
                              : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 text-cyan-400" />
                          <span className="text-[11px] truncate">{badge.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                      Points Reward
                    </label>
                    <span className="text-amber-400 font-bold text-xs">+{points} PTS</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                    Personalized Message
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Write a hearty shoutout highlighting their great contribution..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition-all cursor-pointer border-0"
                  >
                    {submitting ? 'Sending...' : 'Send Kudos'}
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
