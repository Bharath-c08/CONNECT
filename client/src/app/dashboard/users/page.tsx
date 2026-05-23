'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Shield,
  Briefcase,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';

export default function UserDirectoryPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user',
    fullName: '',
    dob: '',
    gender: 'male',
    address: '',
    phone: '',
    email: '',
    jobTitle: '',
    joiningDate: '',
    employmentType: 'fulltime',
    employeeId: '',
    basicPay: 0,
    overtimeEligible: false,
    overtimePayPerMinute: 0,
  });

  useEffect(() => {
    const usr = getCurrentUser();
    setCurrentUser(usr);
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching staff registry.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const openCreateModal = () => {
    setFormData({
      username: '',
      password: '',
      role: 'user',
      fullName: '',
      dob: '',
      gender: 'male',
      address: '',
      phone: '',
      email: '',
      jobTitle: '',
      joiningDate: '',
      employmentType: 'fulltime',
      employeeId: '',
      basicPay: 0,
      overtimeEligible: false,
      overtimePayPerMinute: 0,
    });
    setError('');
    setSuccess('');
    setCreateModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // Keep empty unless updating
      role: user.role,
      fullName: user.fullName || '',
      dob: user.dob ? new Date(user.dob).toISOString().split('T')[0] : '',
      gender: user.gender || 'male',
      address: user.address || '',
      phone: user.phone || '',
      email: user.email || '',
      jobTitle: user.jobTitle || '',
      joiningDate: user.joiningDate ? new Date(user.joiningDate).toISOString().split('T')[0] : '',
      employmentType: user.employmentType || 'fulltime',
      employeeId: user.employeeId || '',
      basicPay: user.basicPay || 0,
      overtimeEligible: user.overtimeEligible || false,
      overtimePayPerMinute: user.overtimePayPerMinute || 0,
    });
    setError('');
    setSuccess('');
    setEditModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      setSuccess(`Employee ${formData.fullName} added successfully!`);
      setCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error creating employee account.');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Remove empty password field to avoid overwriting it
    const dataToSend = { ...formData };
    if (!dataToSend.password) {
      delete (dataToSend as any).password;
    }

    try {
      await apiRequest(`/users/${selectedUser._id}`, {
        method: 'PUT',
        body: JSON.stringify(dataToSend),
      });

      setSuccess(`Employee profile updated successfully!`);
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error updating employee account.');
    }
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`Are you absolutely sure you want to delete ${name}? This action is permanent.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await apiRequest(`/users/${userId}`, { method: 'DELETE' });
      setSuccess(`Employee profile deleted successfully.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete employee account.');
    }
  };

  // Search and Filter computation
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesType = typeFilter === 'all' || user.employmentType === typeFilter;

    return matchesSearch && matchesRole && matchesType;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'admin':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
    }
  };

  if (currentUser && currentUser.role === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
        <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-slate-400 text-sm max-w-sm">This registry dashboard is restricted to administrators and operations executives only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center gap-2.5 text-sm select-none animate-pulse">
          <UserCheck className="w-5 h-5 shrink-0" />
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
            <Users className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            Staff Directory
          </h1>
          <p className="page-subtitle">Manage credentials, wages configuration, and profiles.</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary self-start sm:self-auto">
          <Plus className="w-5 h-5" />
          Add Employee
        </button>
      </div>


      {/* Search & Filters */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <div className="input-with-icon">
          <span className="input-icon"><Search className="w-4.5 h-4.5" /></span>
          <input
            type="text"
            placeholder="Search by name, ID, job…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="select"
        >
          <option value="all">All Roles</option>
          <option value="superadmin">Super Admins</option>
          <option value="admin">Admins</option>
          <option value="user">Employees</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="select"
        >
          <option value="all">All Employment Types</option>
          <option value="fulltime">Full Time</option>
          <option value="parttime">Part Time</option>
          <option value="Intern">Intern</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs">Retrieving staff registry...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <div
              key={user._id}
              className="glass-card p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent"></div>
              
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-white truncate text-base tracking-wide">{user.fullName}</h3>
                    <p className="text-slate-400 text-xs font-semibold truncate mt-0.5">{user.jobTitle || 'No Title Assigned'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>

                 <div className="space-y-2.5 text-xs text-slate-300 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                    <span>{user.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-4.5 h-4.5 text-slate-500 shrink-0" />
                    <span className="capitalize">{user.employmentType} &bull; ID: {user.employeeId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">₹</span>
                    <span>Salary: <strong className="font-mono text-emerald-400">₹{user.basicPay}/month</strong></span>
                  </div>
                </div>
              </div>

              {/* CRUD Actions */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => openEditModal(user)}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 transition-all cursor-pointer hover:scale-105"
                  title="Edit Profile"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteUser(user._id, user.fullName)}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 transition-all cursor-pointer hover:scale-105"
                  title="Delete Account"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm select-none">
              No employees match the specified filters or search term.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal Frame */}
      {(createModalOpen || editModalOpen) && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-2xl rounded-3xl border border-white/10 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-rose-500 to-transparent"></div>
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 select-none">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                <span>{createModalOpen ? 'Register New Employee' : 'Modify Employee details'}</span>
              </h3>
              <button
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditModalOpen(false);
                }}
                className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Modal Scroll Content */}
            <form
              onSubmit={createModalOpen ? handleCreateUser : handleEditUser}
              className="flex-1 p-6 space-y-5 overflow-y-auto"
            >
              {/* Profile/Credentials Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Username *</label>
                  <input
                    type="text"
                    required
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={editModalOpen}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {createModalOpen ? 'Password *' : 'Password (leave blank to keep unchanged)'}
                  </label>
                  <input
                    type="password"
                    required={createModalOpen}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Employee ID *</label>
                  <input
                    type="text"
                    required
                    name="employeeId"
                    value={formData.employeeId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Access Role *</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  >
                    <option value="user">Employee (Regular user)</option>
                    {/* Admins can only create standard users, superadmin can create anyone */}
                    {currentUser && currentUser.role === 'superadmin' && (
                      <option value="admin">Administrator</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Employment Type *</label>
                  <select
                    name="employmentType"
                    value={formData.employmentType}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                  >
                    <option value="fulltime">Full Time</option>
                    <option value="parttime">Part Time</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
              </div>

              {/* Personal Details */}
              <div className="border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3.5">Personal details</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Gender</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address *</label>
                    <input
                      type="email"
                      required
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mobile Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Joining Date</label>
                    <input
                      type="date"
                      name="joiningDate"
                      value={formData.joiningDate}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-[#0b0b1a] border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs cursor-pointer"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Communication Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Wage and Overtime Config */}
              <div className="border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3.5">Contract & Wages</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Job Title</label>
                    <input
                      type="text"
                      name="jobTitle"
                      value={formData.jobTitle}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Monthly Salary (₹ / Month) *</label>
                    <input
                      type="number"
                      required
                      name="basicPay"
                      value={formData.basicPay}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">OT Rate (₹ / Minute)</label>
                    <input
                      type="number"
                      step="0.01"
                      name="overtimePayPerMinute"
                      value={formData.overtimePayPerMinute}
                      onChange={handleInputChange}
                      disabled={!formData.overtimeEligible}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl focus:border-rose-500/50 outline-none text-white text-xs placeholder-slate-500 disabled:opacity-50 font-mono"
                    />
                  </div>
                </div>

                <div className="mt-3.5">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="overtimeEligible"
                      checked={formData.overtimeEligible}
                      onChange={handleInputChange}
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs text-slate-300">Employee is eligible for Overtime payment (Starts after 8 working hours)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setEditModalOpen(false);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] text-xs cursor-pointer"
                >
                  {createModalOpen ? 'Create Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
