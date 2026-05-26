'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  Calendar,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Binary,
  Download,
  FileText,
  MessageSquare,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../../utils/export';
import confetti from 'canvas-confetti';
import { apiRequest, getCurrentUser, getSocketUrl } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

export default function TaskBoardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: [] as string[],
    startDate: '',
    endDate: '',
    priority: 'medium',
  });

  // Finish/Submit Comments Modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState('');
  const [operatorComments, setOperatorComments] = useState('');

  // Admin Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTaskId, setReviewTaskId] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'escalate'>('approve');
  const [adminFeedback, setAdminFeedback] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportStatusFilter, setExportStatusFilter] = useState('all');
  const [exportPriorityFilter, setExportPriorityFilter] = useState('all');
  const [exportAssigneeFilter, setExportAssigneeFilter] = useState('all');

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    fetchTasks(usr);

    // Setup global socket to trigger live board updates across admin/user tabs instantly!
    const socket = io(getSocketUrl());
    socket.on('connect', () => {
      if (usr) {
        socket.emit('join-room', usr._id || usr.id);
      }
    });

    socket.on('task-updated', () => {
      fetchTasks(usr);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchTasks = async (usr: any) => {
    setLoading(true);
    try {
      const activeUser = usr || currentUser || getCurrentUser();
      if (!activeUser) return;
      let data = [];
      
      if (activeUser.role === 'admin' || activeUser.role === 'superadmin') {
        data = await apiRequest('/tasks/company');
        const employees = await apiRequest('/users');
        setStaffList(employees);
      } else {
        data = await apiRequest('/tasks/my');
      }
      setTasks(data);
    } catch (err) {
      console.error('Error fetching tasks roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAssigneeChange = (userId: string) => {
    setFormData(prev => {
      const current = prev.assignedTo as string[];
      if (current.includes(userId)) {
        return { ...prev, assignedTo: current.filter(id => id !== userId) };
      }
      return { ...prev, assignedTo: [...current, userId] };
    });
  };

  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: [],
      startDate: '',
      endDate: '',
      priority: 'medium',
    });
    setError('');
    setSuccess('');
    setCreateModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.assignedTo || formData.assignedTo.length === 0) {
      setError('SELECT AT LEAST ONE ACTIVE OPERATOR FOR THIS MISSION PROTOCOL.');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('BOTH START DATE/TIME AND END DATE/TIME ARE REQUIRED.');
      return;
    }

    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setSuccess('MISSION TASK ENGAGED AND PIPELINED SUCCESSFULLY.');
      setCreateModalOpen(false);
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'MISSION PIPELINE INITIALIZATION FAILURE.');
    }
  };

  const handleStartTask = async (taskId: string) => {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'in-progress' }),
      });
      setSuccess('MISSION ENGAGED. TASK STARTED IMMEDIATELY.');
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'COULD NOT ENGAGE MISSION TASK.');
    }
  };

  const openSubmitModal = (taskId: string) => {
    setSubmittingTaskId(taskId);
    setOperatorComments('');
    setError('');
    setSuccess('');
    setSubmitModalOpen(true);
  };

  const handleSubmitForReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorComments.trim()) {
      setError('OPERATOR COMMENTS ARE REQUIRED BEFORE SUBMITTING MISSION FOR APPROVAL.');
      return;
    }
    setError('');
    try {
      await apiRequest(`/tasks/${submittingTaskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'waiting_for_approval',
          operatorComments: operatorComments.trim()
        }),
      });
      setSuccess('MISSION SUBMITTED FOR REVIEW. WAITING FOR ADMIN APPROVAL.');
      setSubmitModalOpen(false);
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'COULD NOT SUBMIT MISSION.');
    }
  };

  const openReviewModal = (taskId: string, action: 'approve' | 'escalate') => {
    setReviewTaskId(taskId);
    setReviewAction(action);
    setAdminFeedback('');
    setError('');
    setSuccess('');
    setReviewModalOpen(true);
  };

  const handleReviewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewAction === 'escalate' && !adminFeedback.trim()) {
      setError('FEEDBACK IS REQUIRED WHEN ESCALATING A TASK BACK TO OPERATOR.');
      return;
    }
    setError('');
    try {
      await apiRequest(`/tasks/${reviewTaskId}/review`, {
        method: 'PUT',
        body: JSON.stringify({
          action: reviewAction,
          adminFeedback: reviewAction === 'escalate' ? adminFeedback.trim() : undefined
        }),
      });

      if (reviewAction === 'approve') {
        setSuccess('MISSION OFFICIALLY APPROVED AND REGISTERED AS COMPLETED.');
        confetti({
          particleCount: 80,
          spread: 50,
          colors: ['#06b6d4', '#10b981', '#ffffff']
        });
      } else {
        setSuccess('MISSION ESCALATED AND SENT BACK TO OPERATOR PIPELINE.');
      }
      setReviewModalOpen(false);
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'COULD NOT PROCESS REVIEW RESOLUTION.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('CONFIRM DELETION / DE-ORBIT OF THIS TASK UNIT?')) return;
    setError('');
    try {
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'SYS_TASK PURGE REJECTION.');
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-rose-400 bg-rose-500/10 border border-rose-500/25';
      case 'medium':
        return 'text-amber-400 bg-amber-500/10 border border-amber-500/25';
      default:
        return 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/25';
    }
  };

  const handleExportTasks = async () => {
    const filtered = tasks.filter((t) => {
      const matchStatus = exportStatusFilter === 'all' || t.status === exportStatusFilter;
      const matchPriority = exportPriorityFilter === 'all' || t.priority === exportPriorityFilter;
      const matchAssignee = exportAssigneeFilter === 'all' || (Array.isArray(t.assignedTo) && t.assignedTo.some((a: any) => a._id === exportAssigneeFilter));
      return matchStatus && matchPriority && matchAssignee;
    });

    const columns = [
      { header: 'Title', key: 'title' },
      { header: 'Description', key: 'description' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Priority', key: 'priority' },
      { header: 'Status', key: 'status' },
      { header: 'Start Date', key: 'startDate' },
      { header: 'End Date', key: 'endDate' },
      { header: 'Created At', key: 'createdAt' },
    ];

    const rows = filtered.map((t) => ({
      title: t.title || '',
      description: t.description || '',
      assignedTo: Array.isArray(t.assignedTo) ? t.assignedTo.map((a: any) => a.fullName).join(', ') : '',
      priority: t.priority || '',
      status: t.status || '',
      startDate: t.startDate ? new Date(t.startDate).toLocaleString() : '',
      endDate: t.endDate ? new Date(t.endDate).toLocaleString() : '',
      createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '',
    }));

    const filename = `tasks_${new Date().toISOString().split('T')[0]}`;
    if (exportFormat === 'csv') {
      exportToCSV(rows, columns, filename);
    } else {
      await exportToPDF(rows, columns, 'Task Report', filename);
    }
    setExportModalOpen(false);
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6 font-mono">
      <AnimatePresence mode="wait">
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <CheckCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// PIPELINE: {success}</span>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// CRITICAL_FAULT: {error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <ClipboardList className="w-5.5 h-5.5" />
            // MISSION_PIPELINES
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            DISTRIBUTE, EXECUTE, AND MONITOR OPERATIONAL TARGETS ACROSS STAGES.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setExportModalOpen(true)}
            className="btn btn-secondary cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT
          </motion.button>
          {isAdmin && (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={openCreateModal} 
              className="btn btn-primary self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4.5 h-4.5" />
              ASSIGN MISSION
            </motion.button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-slate-500 text-[10px] select-none">
          <Binary className="w-7 h-7 text-[#ef4444] animate-spin" />
          <p>UPLINKING PIPELINE ARCHITECTURE...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start select-none">
          
          {/* Column 1: Pending */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springTransition}
            className="kanban-col relative overflow-hidden"
          >
            <div className="absolute top-1 left-2 text-[6px] opacity-15">STAGE // 01</div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 pt-1">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>PENDING_LOGS</span>
              </h3>
              <span className="badge bg-white/5 text-slate-300 text-[9px] font-extrabold">
                {getTasksByStatus('pending').length}
              </span>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {getTasksByStatus('pending').map((task) => (
                <motion.div 
                  key={task._id} 
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  className="card flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-xs tracking-wider leading-snug">{task.title.toUpperCase()}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 badge ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px] leading-relaxed mb-3">{task.description || 'NO SPECIFIC DESCRIPTION REGISTERED.'}</p>
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="text-[9px] text-slate-500 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>START: {task.startDate ? new Date(task.startDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_START_TIME'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>END: {task.endDate ? new Date(task.endDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_END_TIME'}</span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-white/5">
                        OPERATOR: <strong className="text-rose-400 font-semibold">{task.assignedTo?.map((u: any) => u.fullName).join(', ').toUpperCase() || 'SELF'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {isAdmin && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-icon btn-icon-danger h-7 w-7 cursor-pointer mr-auto"
                          title="Purge Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleStartTask(task._id)}
                        className="px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/25 text-slate-300 font-extrabold rounded text-[9px] transition-all cursor-pointer flex items-center gap-1 uppercase tracking-widest"
                      >
                        <span>START</span>
                        <ArrowRight className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {getTasksByStatus('pending').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs italic select-none">
                  NO PENDING PROTOCOLS ACTIVE.
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Column 2: In-Progress */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.05 }}
            className="kanban-col relative overflow-hidden"
          >
            <div className="absolute top-1 left-2 text-[6px] opacity-15">STAGE // 02</div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 pt-1">
              <h3 className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>IN_PROCESSING</span>
              </h3>
              <span className="badge bg-white/5 text-slate-300 text-[9px] font-extrabold">
                {getTasksByStatus('in-progress').length}
              </span>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {getTasksByStatus('in-progress').map((task) => (
                <motion.div 
                  key={task._id} 
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  className={`card flex flex-col justify-between ${task.adminFeedback ? 'border-red-500/40 bg-red-500/5' : ''}`}
                  style={{
                    backgroundColor: task.adminFeedback ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-card)',
                    borderColor: task.adminFeedback ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-xs tracking-wider leading-snug">{task.title.toUpperCase()}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 badge ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px] leading-relaxed mb-3">{task.description || 'NO DESCRIPTION ATTACHED.'}</p>
                    
                    {task.adminFeedback && (
                      <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-400 font-sans">
                        <div className="font-bold flex items-center gap-1 uppercase mb-0.5 tracking-wider font-mono text-red-500">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                          <span>ESCALATION FEEDBACK:</span>
                        </div>
                        <p>{task.adminFeedback}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="text-[9px] text-slate-500 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>START: {task.startDate ? new Date(task.startDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_START_TIME'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>END: {task.endDate ? new Date(task.endDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_END_TIME'}</span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-white/5">
                        OPERATOR: <strong className="text-rose-400 font-semibold">{task.assignedTo?.map((u: any) => u.fullName).join(', ').toUpperCase() || 'SELF'}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {isAdmin && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-icon btn-icon-danger h-7 w-7 cursor-pointer mr-auto"
                          title="Purge Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => openSubmitModal(task._id)}
                        className="px-2.5 py-1.5 bg-[#ef4444] hover:bg-red-500 text-zinc-950 font-extrabold rounded text-[9px] transition-all cursor-pointer flex items-center gap-1 uppercase tracking-widest"
                      >
                        <span>FINISH</span>
                        <CheckCircle className="w-3 h-3" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}

              {getTasksByStatus('in-progress').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs italic select-none">
                  NO ACTIVE MISSIONS CURRENTLY IN PROCESS.
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Column 3: Waiting for Approval */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.08 }}
            className="kanban-col relative overflow-hidden"
          >
            <div className="absolute top-1 left-2 text-[6px] opacity-15">STAGE // 03</div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 pt-1">
              <h3 className="text-[11px] font-extrabold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                <span>WAITING_APPROVAL</span>
              </h3>
              <span className="badge bg-white/5 text-slate-300 text-[9px] font-extrabold">
                {getTasksByStatus('waiting_for_approval').length}
              </span>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {getTasksByStatus('waiting_for_approval').map((task) => (
                <motion.div 
                  key={task._id} 
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  className="card flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-xs tracking-wider leading-snug">{task.title.toUpperCase()}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 badge ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px] leading-relaxed mb-3">{task.description || 'NO DESCRIPTION.'}</p>
                    
                    {task.operatorComments && (
                      <div className="mb-3 p-2 bg-white/5 border border-white/10 rounded text-[10px] text-slate-300 font-sans">
                        <div className="font-bold flex items-center gap-1 uppercase mb-0.5 tracking-wider font-mono text-violet-400">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>OPERATOR COMMENTS:</span>
                        </div>
                        <p>{task.operatorComments}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="text-[9px] text-slate-500 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>START: {task.startDate ? new Date(task.startDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_START_TIME'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>END: {task.endDate ? new Date(task.endDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_END_TIME'}</span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-white/5">
                        OPERATOR: <strong className="text-rose-400 font-semibold">{task.assignedTo?.map((u: any) => u.fullName).join(', ').toUpperCase() || 'SELF'}</strong>
                      </div>
                    </div>

                    {isAdmin ? (
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
                        <button
                          onClick={() => openReviewModal(task._id, 'escalate')}
                          className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 font-extrabold rounded text-[9px] cursor-pointer flex items-center gap-1 tracking-widest uppercase transition-colors"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>ESCALATE</span>
                        </button>
                        <button
                          onClick={() => openReviewModal(task._id, 'approve')}
                          className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-extrabold rounded text-[9px] cursor-pointer flex items-center gap-1 tracking-widest uppercase transition-colors"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>APPROVE</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[9px] text-violet-400 italic text-right pt-1 font-bold">
                        AWAITING ADMIN AUTHORIZATION
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {getTasksByStatus('waiting_for_approval').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs italic select-none">
                  NO MISSIONS CURRENTLY IN AUDIT STAGE.
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Column 4: Completed */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.1 }}
            className="kanban-col relative overflow-hidden"
          >
            <div className="absolute top-1 left-2 text-[6px] opacity-15">STAGE // 04</div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5 pt-1">
              <h3 className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>DECRYPTED_OK</span>
              </h3>
              <span className="badge bg-white/5 text-slate-300 text-[9px] font-extrabold">
                {getTasksByStatus('completed').length}
              </span>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
            >
              {getTasksByStatus('completed').map((task) => (
                <motion.div 
                  key={task._id} 
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  className="card flex flex-col justify-between opacity-60 hover:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-slate-300 text-xs tracking-wider leading-snug line-through">{task.title.toUpperCase()}</h4>
                      <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                        DONE
                      </span>
                    </div>

                    <p className="text-slate-500 text-[11px] leading-relaxed mb-3 line-through">{task.description || 'NO ADDITIONAL NOTES.'}</p>
                    
                    {task.operatorComments && (
                      <div className="mb-2 p-1.5 bg-white/5 border border-white/10 rounded text-[9px] text-slate-400 font-sans">
                        <span className="font-bold font-mono text-emerald-500/70">COMMENTS: </span>
                        {task.operatorComments}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="text-[9px] text-slate-500 flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>START: {task.startDate ? new Date(task.startDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_START_TIME'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>END: {task.endDate ? new Date(task.endDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'NO_END_TIME'}</span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-white/5">
                        OPERATOR: <strong className="text-rose-400 font-semibold">{task.assignedTo?.map((u: any) => u.fullName).join(', ').toUpperCase() || 'SELF'}</strong>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center justify-end pt-1">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteTask(task._id)}
                          className="btn-icon btn-icon-danger h-7 w-7 cursor-pointer mr-auto"
                          title="Purge Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {getTasksByStatus('completed').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs italic select-none">
                  NO MISSIONS RECORDED SOLVED YET.
                </div>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Assign Task Modal (Admins) */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <ClipboardList className="w-4.5 h-4.5 text-[#ef4444]" />
                  <span>INITIALIZE MISSION PARAMETERS</span>
                </h3>
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label mb-1">Mission Objective Title *</label>
                  <input
                    type="text"
                    required
                    name="title"
                    placeholder="Enter operation title..."
                    value={formData.title}
                    onChange={handleInputChange}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">Operational Directives</label>
                  <textarea
                    name="description"
                    placeholder="Describe parameters or protocols..."
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="textarea"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label mb-2">Assign Operators *</label>
                  <div className="max-h-40 overflow-y-auto border p-3 rounded grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-body)' }}>
                    {staffList.map((emp) => (
                      <label key={emp._id} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-300 hover:text-white transition-colors font-semibold">
                        <input 
                          type="checkbox" 
                          className="w-3.5 h-3.5 rounded border-slate-600 bg-black/50 text-[#ef4444] focus:ring-[#ef4444] cursor-pointer" 
                          checked={(formData.assignedTo as string[]).includes(emp._id)}
                          onChange={() => handleAssigneeChange(emp._id)}
                        />
                        <span className="truncate">{emp.fullName.toUpperCase()} ({emp.employeeId})</span>
                      </label>
                    ))}
                    {staffList.length === 0 && <span className="text-slate-500 italic col-span-2 text-xs">NO OPERATORS AVAILABLE</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">Task Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="select"
                  >
                    <option value="low">LOW PRIORITY</option>
                    <option value="medium">MEDIUM PRIORITY</option>
                    <option value="high">HIGH PRIORITY</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">Start Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">End Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                </div>

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    ABORT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    ENGAGE_MISSION
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Operator Finish Comments Modal */}
      <AnimatePresence>
        {submitModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <CheckCircle className="w-4.5 h-4.5 text-[#ef4444]" />
                  <span>CONCLUDE MISSION PROTOCOL</span>
                </h3>
                <button
                  onClick={() => setSubmitModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForReview} className="modal-body space-y-4">
                <div className="form-group">
                  <label className="form-label mb-1 text-slate-300">Provide Comments / Deliverable Notes *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter completion details, actions taken, or delivery links..."
                    value={operatorComments}
                    onChange={(e) => setOperatorComments(e.target.value)}
                    className="textarea"
                  />
                  <p className="mt-1 text-[9px] text-slate-500 uppercase">
                    Your remarks will be submitted directly to administration for audit logs.
                  </p>
                </div>

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setSubmitModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    SUBMIT_FOR_AUDIT
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Review Modal */}
      <AnimatePresence>
        {reviewModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  {reviewAction === 'approve' ? <ThumbsUp className="w-4.5 h-4.5 text-[#ef4444]" /> : <ThumbsDown className="w-4.5 h-4.5 text-[#ef4444]" />}
                  <span>ADMIN RESOLUTION: {reviewAction.toUpperCase()}</span>
                </h3>
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleReviewTask} className="modal-body space-y-4">
                {reviewAction === 'escalate' ? (
                  <div className="form-group">
                    <label className="form-label mb-1 text-slate-300">Escalation Feedback / Directives *</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Specify exactly what changes or improvements are required by the operator..."
                      value={adminFeedback}
                      onChange={(e) => setAdminFeedback(e.target.value)}
                      className="textarea"
                    />
                  </div>
                ) : (
                  <div className="text-slate-300 text-xs py-2 uppercase leading-relaxed tracking-wider">
                    Confirm official authorization and approval of this mission log. This will flag the task as successfully completed on the operator's ledger.
                  </div>
                )}

                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    CONFIRM_{reviewAction.toUpperCase()}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Export Modal ───────────────────────────────── */}
      <AnimatePresence>
        {exportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={springTransition}
              className="relative w-full max-w-md rounded-xl overflow-hidden font-mono"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/40 to-transparent" />

              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-[#ef4444]" />
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">Export Task Report</h2>
                </div>
                <button onClick={() => setExportModalOpen(false)} className="btn-icon w-7 h-7 cursor-pointer">
                  <span className="text-slate-400 hover:text-white transition-colors text-sm">✕</span>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Format */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Export Format</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['csv', 'pdf'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-extrabold uppercase border transition-all cursor-pointer ${
                          exportFormat === fmt
                            ? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Status</label>
                    <select value={exportStatusFilter} onChange={(e) => setExportStatusFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="waiting_for_approval">Waiting Approval</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Priority</label>
                    <select value={exportPriorityFilter} onChange={(e) => setExportPriorityFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Priorities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  {isAdmin && staffList.length > 0 && (
                    <div>
                      <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Assigned To</label>
                      <select value={exportAssigneeFilter} onChange={(e) => setExportAssigneeFilter(e.target.value)} className="select w-full text-[10px]">
                        <option value="all">All Operators</option>
                        {staffList.map((emp: any) => (
                          <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-slate-600 tracking-wider">
                  {tasks.filter(t =>
                    (exportStatusFilter === 'all' || t.status === exportStatusFilter) &&
                    (exportPriorityFilter === 'all' || t.priority === exportPriorityFilter) &&
                    (exportAssigneeFilter === 'all' || (Array.isArray(t.assignedTo) && t.assignedTo.some((a: any) => a._id === exportAssigneeFilter)))
                  ).length} TASK RECORDS WILL BE EXPORTED
                </p>
              </div>

              <div className="px-6 pb-5 pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setExportModalOpen(false)} className="btn btn-secondary h-9 text-[10px] cursor-pointer">CANCEL</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExportTasks}
                  className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  GENERATE {exportFormat.toUpperCase()}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
