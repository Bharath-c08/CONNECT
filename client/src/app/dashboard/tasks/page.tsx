'use client';

import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Plus,
  Trash2,
  Calendar,
  X,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest, getCurrentUser } from '../../../utils/api';

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
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    fetchTasks(usr);
  }, []);

  const fetchTasks = async (usr: any) => {
    setLoading(true);
    try {
      const activeUser = usr || currentUser;
      let data = [];
      
      if (activeUser.role === 'admin' || activeUser.role === 'superadmin') {
        data = await apiRequest('/tasks/company');
        // Fetch employees list for task assignment
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

  const openCreateModal = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      dueDate: '',
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

    if (!formData.assignedTo) {
      setError('Please select an employee to assign this task to.');
      return;
    }

    try {
      await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setSuccess('Task assigned successfully!');
      setCreateModalOpen(false);
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'Error creating task.');
    }
  };

  const handleStatusChange = async (taskId: string, currentStatus: string, nextStatus: 'pending' | 'in-progress' | 'completed') => {
    setError('');
    try {
      await apiRequest(`/tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });

      if (nextStatus === 'completed') {
        // Celebrate completion!
        confetti({
          particleCount: 80,
          spread: 50,
          colors: ['#f43f5e', '#10b981', '#ffffff']
        });
      }

      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setError('');
    try {
      await apiRequest(`/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete task.');
    }
  };

  // Group tasks by status columns
  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-rose-400 bg-rose-500/10 border border-rose-500/20';
      case 'medium':
        return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
      default:
        return 'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20';
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-2.5 text-sm select-none animate-pulse">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-2.5 text-sm select-none">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ClipboardList className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            Task Board
          </h1>
          <p className="page-subtitle">Manage and track team assignments across workflow stages.</p>
        </div>
        {isAdmin && (
          <button onClick={openCreateModal} className="btn btn-primary self-start sm:self-auto">
            <Plus className="w-5 h-5" />
            Assign Task
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Retrieving company tasks...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Column 1: Pending */}
          <div className="kanban-col">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 select-none">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span>Pending</span>
              </h3>
              <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-300 text-[10px] font-bold">
                {getTasksByStatus('pending').length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {getTasksByStatus('pending').map((task) => (
                <div key={task._id} className="glass-card p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-sm tracking-wide leading-snug">{task.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed mb-3">{task.description || 'No description provided.'}</p>
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 select-none">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No Due Date'}</span>
                      </span>
                      <span>Assigned to: <strong className="text-rose-400 font-semibold">{task.assignedTo?.fullName || 'Me'}</strong></span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer mr-auto"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(task._id, 'pending', 'in-progress')}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-300 font-semibold rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-0.5"
                      >
                        <span>Start</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {getTasksByStatus('pending').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs select-none">
                  No pending items.
                </div>
              )}
            </div>
          </div>

          {/* Column 2: In-Progress */}
          <div className="kanban-col">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 select-none">
              <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span>In Progress</span>
              </h3>
              <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-300 text-[10px] font-bold">
                {getTasksByStatus('in-progress').length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {getTasksByStatus('in-progress').map((task) => (
                <div key={task._id} className="glass-card p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-sm tracking-wide leading-snug">{task.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed mb-3">{task.description || 'No description.'}</p>
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 select-none">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'No Due Date'}</span>
                      </span>
                      <span>Assigned to: <strong className="text-rose-400 font-semibold">{task.assignedTo?.fullName || 'Me'}</strong></span>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer mr-auto"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(task._id, 'in-progress', 'completed')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-0.5"
                      >
                        <span>Finish</span>
                        <CheckCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {getTasksByStatus('in-progress').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs select-none">
                  No items in progress.
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Completed */}
          <div className="kanban-col">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 select-none">
              <h3 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Completed</span>
              </h3>
              <span className="px-2 py-0.5 rounded-lg bg-white/5 text-slate-300 text-[10px] font-bold">
                {getTasksByStatus('completed').length}
              </span>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {getTasksByStatus('completed').map((task) => (
                <div key={task._id} className="glass-card p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between opacity-70">
                  <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent"></div>
                  
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <h4 className="font-extrabold text-white text-sm tracking-wide leading-snug line-through">{task.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Done
                      </span>
                    </div>

                    <p className="text-slate-500 text-xs leading-relaxed mb-3 line-through">{task.description || 'No description.'}</p>
                  </div>

                  <div className="border-t border-white/5 pt-3 mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 select-none">
                      <span>Completed!</span>
                      <span>Assigned to: <strong className="text-rose-400 font-semibold">{task.assignedTo?.fullName || 'Me'}</strong></span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center justify-end pt-1">
                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all cursor-pointer mr-auto"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {getTasksByStatus('completed').length === 0 && (
                <div className="text-center py-10 text-slate-600 text-xs select-none">
                  No completed items yet. Let's finish some!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Task Modal (Admins) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-3xl border border-white/10 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-rose-500" />
                <span>Assign New Task</span>
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Task Title *</label>
                <input
                  type="text"
                  required
                  name="title"
                  placeholder="Task objective name..."
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  name="description"
                  placeholder="Detailed guidelines or instructions..."
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Assign To *</label>
                  <select
                    name="assignedTo"
                    value={formData.assignedTo}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  >
                    <option value="">Select Employee</option>
                    {staffList.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.fullName} ({emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] text-xs cursor-pointer"
                >
                  Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
