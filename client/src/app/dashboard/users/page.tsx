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
  Phone,
  Mail,
  UserCheck,
  AlertCircle,
  Binary,
  Cpu,
  Layers,
  Fingerprint,
  Download,
  FileText,
  Calendar
} from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../../utils/export';
import { apiRequest, getCurrentUser } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';

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

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: springTransition }
};

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

  // Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [exportRoleFilter, setExportRoleFilter] = useState('all');
  const [exportTypeFilter, setExportTypeFilter] = useState('all');
  const [exportFields, setExportFields] = useState({
    employeeId: true,
    fullName: true,
    role: true,
    jobTitle: true,
    employmentType: true,
    email: true,
    phone: true,
    joiningDate: true,
    basicPay: true,
  });

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
    panDetails: '',
    aadhaarDetails: '',
    bankAccountNumber: '',
    accountHolderFullName: '',
    ifscCode: '',
    branchName: '',
    bloodGroup: '',
    emergencyContactNumber: '',
    emergencyContactName: '',
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
      setError(err.message || 'ERROR SECURING UPLINK TO REGISTRY.');
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
      panDetails: '',
      aadhaarDetails: '',
      bankAccountNumber: '',
      accountHolderFullName: '',
      ifscCode: '',
      branchName: '',
      bloodGroup: '',
      emergencyContactNumber: '',
      emergencyContactName: '',
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
      panDetails: user.panDetails || '',
      aadhaarDetails: user.aadhaarDetails || '',
      bankAccountNumber: user.bankAccountNumber || '',
      accountHolderFullName: user.accountHolderFullName || '',
      ifscCode: user.ifscCode || '',
      branchName: user.branchName || '',
      bloodGroup: user.bloodGroup || '',
      emergencyContactNumber: user.emergencyContactNumber || '',
      emergencyContactName: user.emergencyContactName || '',
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

      setSuccess(`OPERATOR [${formData.fullName.toUpperCase()}] ENGAGED SUCCESSFULLY.`);
      setCreateModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'ENGAGED REGISTRY TRANSACTION FAILED.');
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

      setSuccess(`OPERATOR CORE PARAMETERS SYNCD SUCCESSFULLY.`);
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'REGISTRY RE-WRITE TRANSACTION FAILURE.');
    }
  };

  const handleExport = async () => {
    // Apply export-specific filters
    const filtered = users.filter((user) => {
      const matchesRole = exportRoleFilter === 'all' || user.role === exportRoleFilter;
      const matchesType = exportTypeFilter === 'all' || user.employmentType === exportTypeFilter;
      return matchesRole && matchesType;
    });

    // Build columns from selected fields
    const allColumns = [
      { header: 'Employee ID', key: 'employeeId' },
      { header: 'Full Name', key: 'fullName' },
      { header: 'Role', key: 'role' },
      { header: 'Job Title', key: 'jobTitle' },
      { header: 'Employment Type', key: 'employmentType' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Joining Date', key: 'joiningDate' },
      { header: 'Basic Pay', key: 'basicPay' },
    ];
    const columns = allColumns.filter((c) => exportFields[c.key as keyof typeof exportFields]);

    // Map rows
    const rows = filtered.map((u) => ({
      employeeId: u.employeeId || '',
      fullName: u.fullName || '',
      role: u.role || '',
      jobTitle: u.jobTitle || '',
      employmentType: u.employmentType || '',
      email: u.email || '',
      phone: u.phone || '',
      joiningDate: u.joiningDate ? new Date(u.joiningDate).toLocaleDateString() : '',
      basicPay: u.basicPay ?? '',
    }));

    const filename = `employee_directory_${new Date().toISOString().split('T')[0]}`;
    if (exportFormat === 'csv') {
      exportToCSV(rows, columns, filename);
    } else {
      await exportToPDF(rows, columns, 'Employee Directory', filename);
    }
    setExportModalOpen(false);
  };

  const handleDeleteUser = async (userId: string, name: string) => {
    if (!confirm(`CONFIRM ABSOLUTE PURGE OF OPERATOR: ${name.toUpperCase()}?\nTHIS WILL REMOVE ALL LINKED CORE DATA.`)) {
      return;
    }

    setError('');
    setSuccess('');
    try {
      await apiRequest(`/users/${userId}`, { method: 'DELETE' });
      setSuccess(`OPERATOR DIRECTORY RECORD PURGED SUCCESSFULLY.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'SYS_CORE PURGE TRANSACTION ERROR.');
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
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      case 'admin':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      default:
        return 'bg-red-500/10 text-[#ef4444] border border-[#ef4444]/25';
    }
  };

  if (currentUser && currentUser.role === 'user') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4 font-mono select-none">
        <div className="w-16 h-16 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 animate-pulse">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-extrabold tracking-widest text-rose-500 uppercase">// SYS_CORE: ACCESS_DENIED</h2>
        <p className="text-slate-400 text-xs max-w-sm tracking-wide">
          REGISTRY INTERFACE RESTRICTED TO SECURE CONTROLLERS AND SYSTEM AUDITORS ONLY. UPLINK FAILED.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-mono">
      <AnimatePresence mode="wait">
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <UserCheck className="w-4.5 h-4.5 shrink-0" />
            <span>// SUCCESS: {success}</span>
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
            <span>// FAULT_ALARM: {error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-[#ef4444] flex items-center gap-2">
            <Users className="w-5.5 h-5.5" />
            // OPERATOR_DIRECTORY
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider">
            SECURE ACCESS CORE: MANAGE CREDENTIALS, WAGES CONFIGURATION AND NODE ROLES.
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
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={openCreateModal} 
            className="btn btn-primary cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            ENGAGE OPERATOR
          </motion.button>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springTransition, delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded select-none bg-zinc-950/40"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="relative flex items-center w-full">
          <span className="absolute left-4.5 text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name, ID, job…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input w-full"
            style={{ paddingLeft: '44px' }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="select"
        >
          <option value="all">ALL PRIVILEGE ROLES</option>
          <option value="superadmin">SUPER ADMINS</option>
          <option value="admin">ADMINS</option>
          <option value="user">EMPLOYEES</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="select"
        >
          <option value="all">ALL CONTRACT TYPES</option>
          <option value="fulltime">FULL TIME</option>
          <option value="parttime">PART TIME</option>
          <option value="Intern">INTERN</option>
        </select>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3 text-slate-500 text-[10px] select-none">
          <Binary className="w-7 h-7 text-cyan-400 animate-spin" />
          <p>UPLINKING CORE DIRECTORY TELEMETRY...</p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          {filteredUsers.map((user) => (
            <motion.div
              key={user._id}
              variants={cardVariants}
              whileHover={{ y: -2 }}
              className="card flex flex-col justify-between overflow-hidden shadow-md"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/20 to-transparent"></div>
              
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-4 select-none">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold truncate text-sm tracking-widest text-white">{user.fullName.toUpperCase()}</h3>
                    <p className="text-[10px] font-bold truncate mt-0.5 text-slate-400 uppercase">{user.jobTitle || 'UNASSIGNED ROLE'}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 badge ${getRoleColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>
 
                {/* Parameters */}
                <div className="space-y-2.5 text-[11px] pt-3 border-t tracking-wide text-slate-400" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{user.phone || 'NO_PHONE_LINK'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="uppercase text-[10px]">{user.employmentType} &bull; ID: {user.employeeId}</span>
                  </div>
                  <div className="flex items-center gap-2 select-none border-t pt-2 mt-2" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-emerald-500 font-bold">₹</span>
                    <span>WAGE_BAND: <strong className="font-bold text-emerald-400">₹{user.basicPay}/mo</strong></span>
                  </div>

                  {(user.bankAccountNumber || user.panDetails) && (
                    <div className="flex flex-col gap-1 border-t pt-2 mt-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[9px] uppercase font-bold text-slate-500">Bank & Identity</span>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <span className="truncate">A/C: <span className="text-slate-300">{user.bankAccountNumber || '—'}</span></span>
                        <span className="truncate">IFSC: <span className="text-slate-300">{user.ifscCode || '—'}</span></span>
                        <span className="col-span-2 truncate">PAN: <span className="text-slate-300 uppercase">{user.panDetails || '—'}</span></span>
                      </div>
                    </div>
                  )}

                  {(user.bloodGroup || user.emergencyContactNumber) && (
                    <div className="flex flex-col gap-1 border-t pt-2 mt-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[9px] uppercase font-bold text-slate-500">Personal / Emergency</span>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <span className="truncate">Blood: <span className="text-rose-400 font-bold uppercase">{user.bloodGroup || '—'}</span></span>
                        <span className="truncate">Emg Ph: <span className="text-slate-300">{user.emergencyContactNumber || '—'}</span></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
 
              {/* CRUD Actions */}
              <div className="mt-5 pt-3 border-t flex items-center justify-end gap-2 select-none" style={{ borderColor: 'var(--border)' }}>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => openEditModal(user)}
                  className="btn-icon h-8 w-8 cursor-pointer"
                  title="EDIT_OPERATOR"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleDeleteUser(user._id, user.fullName)}
                  className="btn-icon btn-icon-danger h-8 w-8 cursor-pointer"
                  title="PURGE_OPERATOR"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="col-span-full text-center py-16 text-slate-500 text-xs italic select-none">
              NO OPERATORS DETECTED WITH CURRENT MATCHING CHANNELS.
            </div>
          )}
        </motion.div>
      )}

      {/* Override Configuration Modal Panel */}
      <AnimatePresence>
        {(createModalOpen || editModalOpen) && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={springTransition}
              className="modal-box w-full max-w-2xl"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444] to-transparent"></div>
              
              {/* Modal Header */}
              <div className="modal-header select-none">
                <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase">
                  <Shield className="w-4 h-4 text-[#ef4444]" />
                  <span>{createModalOpen ? 'ENGAGE NEW OPERATOR PROTOCOL' : 'MODIFY OPERATOR CORE RECORD'}</span>
                </h3>
                <button
                  onClick={() => {
                    setCreateModalOpen(false);
                    setEditModalOpen(false);
                  }}
                  className="p-1 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Scroll Content */}
              <form
                onSubmit={createModalOpen ? handleCreateUser : handleEditUser}
                className="modal-body space-y-5"
              >
                {/* Profile/Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      disabled={editModalOpen}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">
                      {createModalOpen ? 'Password *' : 'Password (empty to keep)'}
                    </label>
                    <input
                      type="password"
                      required={createModalOpen}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      className="input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">Operator ID *</label>
                    <input
                      type="text"
                      required
                      name="employeeId"
                      value={formData.employeeId}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">Privilege Role *</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="select"
                    >
                      <option value="user">Employee (Regular user)</option>
                      {currentUser && currentUser.role === 'superadmin' && (
                        <option value="admin">Administrator</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">Contract Type *</label>
                    <select
                      name="employmentType"
                      value={formData.employmentType}
                      onChange={handleInputChange}
                      className="select"
                    >
                      <option value="fulltime">Full Time</option>
                      <option value="parttime">Part Time</option>
                      <option value="Intern">Intern</option>
                    </select>
                  </div>
                </div>

                {/* Personal Details */}
                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <h4 className="text-[10px] font-bold text-[#ef4444] uppercase tracking-widest mb-3.5 select-none flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5" />
                    // personal_telemetry
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="sm:col-span-2 form-group">
                      <label className="form-label mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Gender</label>
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        className="select"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label mb-1">Uplink Email *</label>
                      <input
                        type="email"
                        required
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Mobile Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label mb-1">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          name="dob"
                          value={formData.dob}
                          onChange={handleInputChange}
                          className="input pl-9"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Joining Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                        <input
                          type="date"
                          name="joiningDate"
                          value={formData.joiningDate}
                          onChange={handleInputChange}
                          className="input pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label mb-1">Location Coordinates / Address</label>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      rows={2}
                      className="textarea"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label mb-1">Blood Group</label>
                      <input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className="input uppercase" />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Emg. Contact Name</label>
                      <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Emg. Contact Phone</label>
                      <input type="text" name="emergencyContactNumber" value={formData.emergencyContactNumber} onChange={handleInputChange} className="input" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label mb-1">PAN Details</label>
                      <input type="text" name="panDetails" value={formData.panDetails} onChange={handleInputChange} className="input uppercase" />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Aadhaar Details</label>
                      <input type="text" name="aadhaarDetails" value={formData.aadhaarDetails} onChange={handleInputChange} className="input" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="form-group">
                      <label className="form-label mb-1">Bank Account Number</label>
                      <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange} className="input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">IFSC Code</label>
                      <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} className="input uppercase" />
                    </div>
                  </div>
                </div>

                {/* Wages */}
                <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                  <h4 className="text-[10px] font-bold text-[#ef4444] uppercase tracking-widest mb-3.5 select-none flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    // financial_configuration
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="form-label mb-1">Job Title</label>
                      <input
                        type="text"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleInputChange}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">Monthly Salary (₹ / Mo) *</label>
                      <input
                        type="number"
                        required
                        name="basicPay"
                        value={formData.basicPay}
                        onChange={handleInputChange}
                        className="input font-mono"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">OT Rate (₹ / Min)</label>
                      <input
                        type="number"
                        step="0.01"
                        name="overtimePayPerMinute"
                        value={formData.overtimePayPerMinute}
                        onChange={handleInputChange}
                        disabled={!formData.overtimeEligible}
                        className="input font-mono"
                      />
                    </div>
                  </div>

                  <div className="mt-4 select-none">
                    <label className="inline-flex items-center gap-3.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="overtimeEligible"
                        checked={formData.overtimeEligible}
                        onChange={handleInputChange}
                        className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-[#ef4444] focus:ring-[#ef4444]"
                      />
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                        ALLOW OVERTIME CALCULATOR (ACTIVE AFTER 8 SHIFT HOURS)
                      </span>
                    </label>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="modal-footer pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateModalOpen(false);
                      setEditModalOpen(false);
                    }}
                    className="btn btn-secondary h-9 text-[10px] cursor-pointer"
                  >
                    DISCONNECT
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-9 text-[10px] font-extrabold cursor-pointer"
                  >
                    {createModalOpen ? 'COMMIT_NEW_OPERATOR' : 'COMMIT_CHANGES'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Export Modal ────────────────────────────────── */}
      <AnimatePresence>
        {exportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={springTransition}
              className="relative w-full max-w-lg rounded-xl overflow-hidden font-mono"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {/* top accent */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ef4444]/40 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-[#ef4444]" />
                  <h2 className="text-xs font-extrabold uppercase tracking-widest text-white">Export Operator Registry</h2>
                </div>
                <button onClick={() => setExportModalOpen(false)} className="btn-icon w-7 h-7 cursor-pointer">
                  <X className="w-4 h-4" />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Role Filter</label>
                    <select value={exportRoleFilter} onChange={(e) => setExportRoleFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Roles</option>
                      <option value="superadmin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="user">Employee</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Employment Type</label>
                    <select value={exportTypeFilter} onChange={(e) => setExportTypeFilter(e.target.value)} className="select w-full text-[10px]">
                      <option value="all">All Types</option>
                      <option value="fulltime">Full Time</option>
                      <option value="parttime">Part Time</option>
                      <option value="Intern">Intern</option>
                    </select>
                  </div>
                </div>

                {/* Fields */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-2">Include Fields</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { key: 'employeeId', label: 'Employee ID' },
                      { key: 'fullName', label: 'Full Name' },
                      { key: 'role', label: 'Role' },
                      { key: 'jobTitle', label: 'Job Title' },
                      { key: 'employmentType', label: 'Employment Type' },
                      { key: 'email', label: 'Email' },
                      { key: 'phone', label: 'Phone' },
                      { key: 'joiningDate', label: 'Join Date' },
                      { key: 'basicPay', label: 'Basic Pay' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer select-none group">
                        <input
                          type="checkbox"
                          checked={exportFields[key as keyof typeof exportFields]}
                          onChange={(e) => setExportFields(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-950 text-[#ef4444] focus:ring-[#ef4444]"
                        />
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Preview count */}
                <p className="text-[9px] text-slate-600 tracking-wider">
                  {users.filter(u =>
                    (exportRoleFilter === 'all' || u.role === exportRoleFilter) &&
                    (exportTypeFilter === 'all' || u.employmentType === exportTypeFilter)
                  ).length} OPERATOR RECORDS WILL BE EXPORTED
                </p>
              </div>

              {/* Footer */}
              <div className="modal-footer px-6 pb-5 pt-4 border-t flex items-center justify-end gap-3 select-none" style={{ borderColor: 'var(--border)' }}>
                <button onClick={() => setExportModalOpen(false)} className="btn btn-secondary h-9 text-[10px] cursor-pointer">CANCEL</button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
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
