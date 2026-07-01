'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Gift,
  Award,
  Plus,
  Trash2,
  Users,
  Binary,
  AlertCircle,
  Bell,
  X,
  Radio
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function EventsPage() {
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [celebrations, setCelebrations] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Admin Publish Modal state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchData();
  }, []);

  const fetchUserData = async () => {
    try {
      const u = await apiRequest('/auth/me');
      setUser(u);
      if (u.role === 'admin' || u.role === 'superadmin') {
        const teamsData = await apiRequest('/teams');
        setAllTeams(teamsData);
      }
    } catch (err) {
      console.error('Error fetching user info', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/events');
      setEvents(data.events || []);
      setCelebrations(data.celebrations || []);

      // Trigger confetti if there is any celebration happening today!
      const hasTodayCelebration = data.celebrations?.some((c: any) => c.isToday);
      if (hasTodayCelebration) {
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#ef4444', '#10b981', '#fbbf24', '#06b6d4', '#d946ef']
          });
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync communal events telemetry.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!title.trim() || !description.trim() || !date || selectedTeams.length === 0) {
      setError('ALL EVENT PARAMETERS MUST BE FULLY SPECIFIED.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          date,
          targetTeams: selectedTeams
        })
      });

      setSuccess('COMMUNAL EVENT PUBLISHED AND BROADCASTED.');
      setTitle('');
      setDescription('');
      setDate('');
      setSelectedTeams([]);
      setPublishModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to upload event parameters.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('ARE YOU SURE YOU WANT TO DESTROY THIS EVENT BROADCAST?')) return;
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/events/${eventId}`, { method: 'DELETE' });
      setSuccess('EVENT BROADCAST PURGED SUCCESSFULLY.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error purging event record.');
    }
  };

  const handleTeamCheckbox = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const todayCelebrations = celebrations.filter(c => c.isToday);
  const upcomingCelebrations = celebrations.filter(c => !c.isToday);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 font-mono text-[11px] tracking-wider select-none text-slate-500">
        <Binary className="w-8 h-8 text-cyan-400 animate-spin" />
        <p>SYNCHRONIZING COMMUNAL TELEMETRY FEED...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-mono events-card-container">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <Radio className="w-5.5 h-5.5 animate-pulse" />
            // COMMUNAL_EVENTS
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider">
            TEAM CELEBRATIONS, ANNOUNCEMENTS, AND LOGISTICAL EVENTS DIRECTORY.
          </p>
        </div>

        {isAdmin && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setPublishModalOpen(true)}
            className="btn btn-primary h-10 px-4 text-xs cursor-pointer flex items-center gap-2 border-0 self-start sm:self-auto"
            style={{ boxShadow: '0 0 15px rgba(6,182,212,0.2)' }}
          >
            <Plus className="w-4 h-4" />
            PUBLISH EVENT
          </motion.button>
        )}
      </motion.div>

      {/* Notifications */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs"
        >
          <AlertCircle className="w-4.5 h-4.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-extrabold">// TELEMETRY_ALARM</p>
            <p className="mt-1 opacity-80">{error}</p>
          </div>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"
        >
          <Bell className="w-4.5 h-4.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-extrabold">// SYSTEM_BROADCAST</p>
            <p className="mt-1 opacity-80">{success}</p>
          </div>
        </motion.div>
      )}

      {/* Today's Celebrations Spotlight Card */}
      {todayCelebrations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-lg p-6 flex flex-col md:flex-row items-center gap-6 border shadow-2xl select-none"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(217, 70, 239, 0.15) 50%, rgba(6, 182, 212, 0.15) 100%)',
            borderColor: 'rgba(239, 68, 68, 0.25)'
          }}
        >
          <div className="absolute top-1 left-2 text-[6px] opacity-25">SPOTLIGHT // TEAM_CELEBRATION</div>
          
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#ef4444] to-[#d946ef] text-white shadow-lg animate-bounce">
            <Gift className="h-8 w-8" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-lg font-black text-white tracking-widest uppercase">
              TRANSMITTING DAY CELEBRATIONS! 🎉
            </h2>
            <div className="mt-2 space-y-2 text-xs">
              {todayCelebrations.map((c, i) => (
                <div key={i} className="text-slate-200">
                  &bull; <strong className="text-cyan-400 font-extrabold">{c.fullName.toUpperCase()}</strong> (ID: {c.employeeId}) is celebrating a{' '}
                  <span className="text-pink-400 font-bold uppercase tracking-wider">
                    {c.type === 'birthday' ? 'Birthday 🎂' : `Work Anniversary (${c.years} Year${c.years > 1 ? 's' : ''}) 🎖️`}
                  </span>{' '}
                  today!
                </div>
              ))}
            </div>
            <p className="mt-3.5 text-[9px] text-slate-500 uppercase tracking-widest">
              Join the encrypted feeds channel to transmit your congratulations messages.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main Content Sections */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 xl:grid-cols-3 gap-6"
      >
        {/* Left Column: Manual Events Feed */}
        <div className="xl:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">
            // MANUAL_EVENTS_LOGS ({events.length})
          </h3>

          {events.length === 0 ? (
            <div className="card text-center py-12 text-slate-500 text-xs italic">
              NO ANNOUNCEMENTS OR MANUAL EVENTS RECORDED FOR YOUR TEAMS.
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <motion.div
                  key={event._id}
                  variants={cardVariants}
                  whileHover={{ y: -2 }}
                  className="card flex flex-col gap-4 py-5 px-6 relative"
                >
                  <div className="absolute top-1 left-2 text-[6px] opacity-20">LOG // EVENT_EMISSION</div>
                  
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">{event.title}</h4>
                      <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">
                        DATE: {new Date(event.date).toLocaleDateString([], { dateStyle: 'long' })}
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEvent(event._id)}
                        className="btn-icon text-rose-500 hover:text-rose-400 cursor-pointer h-7 w-7 rounded border border-rose-500/10 hover:border-rose-500/30"
                        title="PURGE BROADCAST"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line">{event.description}</p>

                  <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/5 text-[9px] text-slate-500 uppercase tracking-widest mt-2">
                    <div>
                      PUBLISHER: <span className="text-slate-300 font-bold">{event.creator?.fullName || 'SYSTEM_ADMIN'}</span>
                    </div>
                    <div>&bull;</div>
                    <div className="flex items-center gap-1">
                      TEAMS: 
                      {event.targetTeams?.map((t: any, idx: number) => (
                        <span key={idx} className="bg-zinc-900 border border-white/10 px-1.5 py-0.5 rounded text-[8px] text-cyan-400 ml-1">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Upcoming celebrations list */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 pb-2">
            // MONTH_CELEBRATIONS_CALENDAR ({upcomingCelebrations.length})
          </h3>

          {upcomingCelebrations.length === 0 ? (
            <div className="card text-center py-8 text-slate-500 text-xs italic">
              NO CELEBRATIONS SCHEDULED FOR THE REMAINING MONTH.
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingCelebrations
                .sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate())
                .map((c, i) => (
                  <motion.div
                    key={i}
                    variants={cardVariants}
                    className="card flex items-center gap-3.5 py-3 px-4"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border shrink-0 ${
                      c.type === 'birthday' 
                        ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' 
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                    }`}>
                      {c.type === 'birthday' ? <Gift className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate text-white uppercase">{c.fullName}</p>
                      <p className="text-[9px] text-slate-500 uppercase tracking-wider mt-0.5">
                        {c.type === 'birthday' ? 'Birthday' : `${c.years}-Year Anniversary`} &bull;{' '}
                        {new Date(c.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Publish Event Dialog/Modal */}
      <AnimatePresence>
        {publishModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setPublishModalOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />
            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={springTransition}
              className="fixed inset-x-4 top-10 md:top-20 mx-auto max-w-lg bg-zinc-950 border border-white/10 p-6 rounded-lg z-50 shadow-2xl flex flex-col font-mono"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  // COMPILE_EVENT_PARAMETERS
                </span>
                <button
                  onClick={() => setPublishModalOpen(false)}
                  className="btn-icon h-7 w-7 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePublishEvent} className="space-y-4 mt-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Event Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. SYSTEM UPGRADE TELEMETRY DECK"
                    className="input text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Event Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Provide details about the scheduled announcement or logistical event..."
                    className="input text-white resize-none py-2"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Select Target Teams</label>
                  <div className="max-h-28 overflow-y-auto border border-white/10 rounded p-2 bg-zinc-950/40 space-y-1.5">
                    {allTeams.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic py-2 text-center">NO REGISTERED TEAMS DETECTED.</p>
                    ) : (
                      allTeams.map((team) => (
                        <label key={team._id} className="flex items-center gap-2 cursor-pointer py-1 px-1 rounded hover:bg-white/5 select-none">
                          <input
                            type="checkbox"
                            checked={selectedTeams.includes(team._id)}
                            onChange={() => handleTeamCheckbox(team._id)}
                            className="rounded border-white/10 text-cyan-500 focus:ring-0 bg-transparent h-3.5 w-3.5 cursor-pointer"
                          />
                          <span className="text-[10px] font-bold text-slate-350">{team.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setPublishModalOpen(false)}
                    className="flex-1 btn btn-secondary h-10 uppercase text-[10px]"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 btn btn-primary h-10 uppercase text-[10px]"
                  >
                    {submitting ? 'TRANSMITTING...' : 'BROADCAST EVENT'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
