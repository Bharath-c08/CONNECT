'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  X,
  Users,
  Video,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

export default function MeetingCalendarHub() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedInvites, setSelectedInvites] = useState<string[]>([]);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const usr = getCurrentUser();
    if (usr) {
      setCurrentUser(usr);
    }
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const meetData = await apiRequest('/meetings/my');
      setMeetings(meetData);

      const staff = await apiRequest('/users');
      const filteredStaff = staff.filter((e: any) => e._id !== (currentUser?.id || currentUser?._id));
      setEmployees(filteredStaff);
    } catch (err) {
      console.error('Error loading calendar telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleInvite = (id: string) => {
    setSelectedInvites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Build generated meet slug
  const generateMeetSlug = () => {
    const parts = [
      Math.random().toString(36).substring(2, 5),
      Math.random().toString(36).substring(2, 5),
      Math.random().toString(36).substring(2, 5)
    ];
    return parts.join('-');
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    
    if (!title.trim() || !startTime || !endTime) {
      setModalError('Please fill out all required meeting parameters.');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      setModalError('Shift conclusion time must occur after launch time.');
      return;
    }

    const meetingId = generateMeetSlug();

    try {
      const res = await apiRequest('/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          meetingId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          participants: selectedInvites
        })
      });

      setModalSuccess('MEETING NODE SUCCESSFULLY SCHEDULED');
      const shareUrl = `${window.location.origin}/dashboard/meet/${meetingId}`;
      setGeneratedLink(shareUrl);
      
      // Refresh calendar
      fetchCalendarData();

      // Clear basic form
      setTitle('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setSelectedInvites([]);

    } catch (err: any) {
      setModalError(err.message || 'Error scheduling meeting event.');
    }
  };

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayIndex = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getMeetingsForDay = (day: number) => {
    return meetings.filter((m) => {
      const start = new Date(m.startTime);
      return (
        start.getDate() === day &&
        start.getMonth() === currentDate.getMonth() &&
        start.getFullYear() === currentDate.getFullYear()
      );
    });
  };

  return (
    <div className="flex flex-col gap-8 font-mono select-none">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <CalendarIcon className="w-5.5 h-5.5 animate-pulse" />
            // OPERATIONAL_CALENDAR
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            Uplink schedule coordinates, plan operational meetings, and launch meeting nodes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setModalError('');
              setModalSuccess('');
              setGeneratedLink('');
              setScheduleModalOpen(true);
            }}
            className="btn btn-primary h-11 px-4 text-xs font-bold cursor-pointer border-0 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>SCHEDULE MEET</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Main Grid Calendar Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* Calendar Grid card */}
        <div className="card lg:col-span-2 flex flex-col p-6" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="absolute top-1 left-2 text-[6px] opacity-20">CALENDAR // MONTH_TELEMETRY</div>
          
          {/* Calendar month selector header */}
          <div className="flex items-center justify-between mb-6 pt-2">
            <h3 className="text-sm font-extrabold text-white tracking-widest">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handlePrevMonth}
                className="btn btn-secondary w-8 h-8 p-0 flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="btn btn-secondary w-8 h-8 p-0 flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-7 gap-2.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-2 flex-grow min-h-[360px]">
            {/* Empty slots for offset */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2 border border-transparent opacity-10 bg-zinc-950/20 rounded" />
            ))}

            {/* Days slots */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayMeets = getMeetingsForDay(day);
              const isToday =
                day === new Date().getDate() &&
                currentDate.getMonth() === new Date().getMonth() &&
                currentDate.getFullYear() === new Date().getFullYear();

              return (
                <div
                  key={`day-${day}`}
                  className="p-2 rounded border flex flex-col justify-between items-stretch min-h-[64px] transition-all bg-zinc-950/40 relative"
                  style={{
                    borderColor: isToday ? 'var(--brand)' : 'var(--border)',
                  }}
                >
                  <span className={`text-[10px] font-bold self-start ${isToday ? 'text-cyan-400' : 'text-slate-400'}`}>
                    {day}
                  </span>
                  
                  <div className="space-y-1 mt-1">
                    {dayMeets.slice(0, 2).map((m) => (
                      <div
                        key={m._id}
                        onClick={() => router.push(`/dashboard/meet/${m.meetingId}`)}
                        className="px-1.5 py-0.5 rounded text-[8px] font-bold truncate block bg-[#ef4444]/10 border border-[#ef4444]/20 hover:border-[#ef4444]/65 text-[#ef4444] cursor-pointer"
                        title={m.title}
                      >
                        {m.title.toUpperCase()}
                      </div>
                    ))}
                    {dayMeets.length > 2 && (
                      <span className="text-[7px] text-slate-600 block text-right font-extrabold">
                        +{dayMeets.length - 2} MORE
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scheduled Meets List card */}
        <div className="card flex flex-col p-6 h-fit max-h-[520px]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div className="absolute top-1 left-2 text-[6px] opacity-20">SCHEDULE // ACTIVE_NODE_SCHEDULES</div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest border-b pb-3 mb-4" style={{ borderColor: 'var(--border)' }}>
            MEET UPLINKS
          </h3>

          <div className="space-y-3.5 overflow-y-auto pr-1 flex-grow">
            {meetings.length === 0 ? (
              <p className="text-[10px] italic text-slate-500 text-center py-16">
                NO REGISTERED VIDEO MEETING SCHEDULES.
              </p>
            ) : (
              meetings.map((m) => {
                const startTimeStr = new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = new Date(m.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={m._id}
                    className="p-3 border border-white/5 rounded-lg flex flex-col gap-2 relative bg-zinc-950/40"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-extrabold text-white text-xs truncate uppercase">{m.title}</h4>
                      <span className="shrink-0 text-[8px] font-extrabold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/25 px-1.5 py-0.5 rounded uppercase">
                        {dateStr}
                      </span>
                    </div>

                    <p className="text-[9px] text-slate-500 truncate mt-0.5">// DESC: {m.description || 'Secure Node Session'}</p>

                    <div className="flex items-center justify-between border-t border-dashed pt-2.5 mt-1" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {startTimeStr}
                      </span>

                      <button
                        onClick={() => router.push(`/dashboard/meet/${m.meetingId}`)}
                        className="py-1 px-3 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 text-[9px] font-extrabold cursor-pointer transition-all"
                      >
                        JOIN MEET
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Schedule Meeting Overlay Modal */}
      <AnimatePresence>
        {scheduleModalOpen && (
          <div className="modal-overlay z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              transition={springTransition}
              className="modal-box w-full max-w-lg"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="modal-header">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-widest">
                  <Video className="w-4.5 h-4.5 text-cyan-400 animate-pulse" />
                  <span>PLAN_CONFERENCE_PARAMETERS</span>
                </h3>
                <button
                  onClick={() => setScheduleModalOpen(false)}
                  className="p-1 rounded hover:bg-white/5 border cursor-pointer text-slate-500 hover:text-white"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal message boxes */}
              <div className="modal-body space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {modalError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded text-[10px] uppercase font-extrabold tracking-wider">
                    // FAULT: {modalError}
                  </div>
                )}

                {modalSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[10px] uppercase font-extrabold tracking-wider space-y-2">
                    <div>// SUCCESS: {modalSuccess}</div>
                    
                    {generatedLink && (
                      <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/20 select-text">
                        <span className="text-[9px] text-white flex-1 select-all break-all">{generatedLink}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedLink);
                            alert('Meeting Link Copied!');
                          }}
                          className="p-1.5 rounded border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!modalSuccess && (
                  <form onSubmit={handleScheduleSubmit} className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">MEETING TITLE *</label>
                      <input
                        type="text"
                        placeholder="e.g. Engineering Sprint Review"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">OPERATIONAL DESCRIPTION</label>
                      <textarea
                        placeholder="Agenda details..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="textarea"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group">
                        <label className="form-label">LAUNCH TIMESTAMP *</label>
                        <input
                          type="datetime-local"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">CONCLUSION TIMESTAMP *</label>
                        <input
                          type="datetime-local"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="input"
                        />
                      </div>
                    </div>

                    {/* Invites checklist */}
                    <div className="border-t pt-3.5" style={{ borderColor: 'var(--border)' }}>
                      <label className="form-label mb-2 block uppercase tracking-wider">CHOOSE CO-PARTICIPANTS</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {employees.map((emp) => (
                          <label
                            key={emp._id}
                            className="flex items-center gap-2.5 p-2 bg-zinc-950/20 border border-white/5 hover:bg-white/5 rounded cursor-pointer text-[10px]"
                            style={{
                              backgroundColor: 'var(--bg-elevated)',
                              borderColor: 'var(--border)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedInvites.includes(emp._id)}
                              onChange={() => handleToggleInvite(emp._id)}
                              className="w-3.5 h-3.5 rounded border-zinc-800 text-rose-600 focus:ring-rose-500"
                            />
                            <span className="text-white font-bold">{emp.fullName.toUpperCase()}</span>
                            <span className="text-slate-500 font-normal">({emp.jobTitle || 'Operator'})</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="modal-footer pt-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setScheduleModalOpen(false)}
                        className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary h-9 text-[10px] font-bold cursor-pointer"
                      >
                        COMMIT MEETING
                      </button>
                    </div>
                  </form>
                )}

                {modalSuccess && (
                  <div className="modal-footer pt-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setScheduleModalOpen(false)}
                      className="btn btn-primary h-9 px-6 text-[10px] font-bold cursor-pointer border-0"
                    >
                      CLOSE UPLINK
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
