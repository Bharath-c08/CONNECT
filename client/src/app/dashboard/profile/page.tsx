'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User as UserIcon,
  Save,
  Lock,
  Phone,
  MapPin,
  Heart,
  CreditCard,
  Building,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Shield,
  Droplet,
  Calendar,
  Camera,
  Upload,
  ShieldCheck,
  Check,
  Sparkles,
  ExternalLink,
  X
} from 'lucide-react';
import { apiRequest, getCurrentUser } from '../../../utils/api';
import { motion, AnimatePresence } from 'framer-motion';
import PhotoCropUpload from '../../../components/PhotoCropUpload';

const springTransition = { type: 'spring', stiffness: 200, damping: 22 } as const;

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'other',
    address: '',
    password: '',
    
    // Emergency
    emergencyContactName: '',
    emergencyContactNumber: '',
    bloodGroup: '',
    
    // Identity & Finance
    panDetails: '',
    aadhaarDetails: '',
    bankAccountNumber: '',
    accountHolderFullName: '',
    ifscCode: '',
    branchName: ''
  });

  const [userId, setUserId] = useState('');

  useEffect(() => {
    const usr = getCurrentUser();
    if (!usr) {
      router.push('/');
      return;
    }
    const currentId = usr._id || usr.id;
    setUserId(currentId);
    fetchProfile(currentId);

    const handleUserUpdated = (e: any) => {
      if (e.detail) {
        setUserProfile((prev: any) => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('connect:user-updated', handleUserUpdated);
    return () => {
      window.removeEventListener('connect:user-updated', handleUserUpdated);
    };
  }, [router]);

  const fetchProfile = async (id: string) => {
    try {
      setLoading(true);
      const data = await apiRequest(`/users/${id}`);
      setUserProfile(data);
      
      setFormData({
        fullName: data.fullName || '',
        email: data.email || '',
        phone: data.phone || '',
        dob: data.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
        gender: data.gender || 'other',
        address: data.address || '',
        password: '', // Never populate password
        emergencyContactName: data.emergencyContactName || '',
        emergencyContactNumber: data.emergencyContactNumber || '',
        bloodGroup: data.bloodGroup || '',
        panDetails: data.panDetails || '',
        aadhaarDetails: data.aadhaarDetails || '',
        bankAccountNumber: data.bankAccountNumber || '',
        accountHolderFullName: data.accountHolderFullName || '',
        ifscCode: data.ifscCode || '',
        branchName: data.branchName || ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoSaved = (newPhotoUrl: string) => {
    setUserProfile((prev: any) => ({
      ...prev,
      profilePhoto: newPhotoUrl
    }));

    if (typeof window !== 'undefined') {
      try {
        const localUserStr = localStorage.getItem('user');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          localUser.profilePhoto = newPhotoUrl;
          localStorage.setItem('user', JSON.stringify(localUser));
          window.dispatchEvent(new CustomEvent('connect:user-updated', { detail: localUser }));
        }
      } catch (e) {
        // ignore
      }
    }

    setSuccess('PROFILE PICTURE UPDATED & SYNCHRONIZED WITH IDENTITY LEDGER.');
    setShowPhotoEditor(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = { ...formData };
      if (!payload.password) {
        delete payload.password; // Don't send empty password
      }
      
      const updated = await apiRequest(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setUserProfile((prev: any) => ({ ...prev, ...updated }));
      setSuccess('PROFILE UPDATED SUCCESSFULLY.');

      // Update local storage name if it changed
      const localUserStr = localStorage.getItem('user');
      if (localUserStr) {
        const localUser = JSON.parse(localUserStr);
        localUser.fullName = payload.fullName;
        localStorage.setItem('user', JSON.stringify(localUser));
        window.dispatchEvent(new CustomEvent('connect:user-updated', { detail: localUser }));
      }
    } catch (err: any) {
      setError(err.message || 'FAILED TO UPDATE PROFILE.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500 text-[10px] select-none font-mono">
        <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
        <p>DECRYPTING PROFILE DATA...</p>
      </div>
    );
  }

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="space-y-6 font-mono max-w-5xl mx-auto">
      
      {/* Alerts */}
      <AnimatePresence mode="wait">
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <CheckCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// SUCCESS: {success}</span>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded flex items-center gap-2.5 text-xs select-none"
          >
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>// FAULT: {error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 select-none"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-widest text-emerald-400 flex items-center gap-2">
            <UserIcon className="w-5.5 h-5.5" />
            // OPERATOR_PROFILE
          </h1>
          <p className="mt-1 text-[10px] text-slate-500 tracking-wider uppercase">
            MANAGE PERSONAL IDENTIFICATION, OFFICIAL PHOTO, AND SECURE DATA
          </p>
        </div>
      </motion.div>

      {/* ── OPERATOR IDENTITY & PROFILE PICTURE HERO CARD ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
        className="p-6 rounded-2xl border bg-zinc-950/70 relative overflow-hidden backdrop-blur-xl shadow-xl"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Avatar container */}
            <div className="relative group shrink-0">
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 bg-zinc-900 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.15)] relative"
                style={{
                  borderColor: userProfile?.profilePhoto ? 'var(--brand)' : 'var(--border)'
                }}
              >
                {userProfile?.profilePhoto ? (
                  <img
                    src={userProfile.profilePhoto}
                    alt={userProfile.fullName || 'Operator'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 p-2 text-center">
                    <Camera className="w-8 h-8 opacity-60 text-cyan-400" />
                    <span className="text-[10px] font-extrabold text-cyan-400">
                      {getInitials(userProfile?.fullName)}
                    </span>
                  </div>
                )}

                {/* Hover trigger overlay */}
                <button
                  type="button"
                  onClick={() => setShowPhotoEditor(!showPhotoEditor)}
                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-cyan-400 cursor-pointer"
                  title="Update profile picture"
                >
                  <Camera className="w-6 h-6 animate-pulse" />
                  <span className="text-[8px] font-bold uppercase tracking-wider">CHANGE PHOTO</span>
                </button>
              </div>

              {/* Verified badge or indicator */}
              <div
                className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border flex items-center gap-1 shadow-lg bg-zinc-950"
                style={{
                  borderColor: userProfile?.profilePhoto ? 'rgb(16, 185, 129)' : 'var(--border)',
                  color: userProfile?.profilePhoto ? 'rgb(52, 211, 153)' : 'rgb(148, 163, 184)'
                }}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${userProfile?.profilePhoto ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{userProfile?.profilePhoto ? 'PHOTO_ACTIVE' : 'NO_PHOTO'}</span>
              </div>
            </div>

            {/* Profile Meta info */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {userProfile?.role || 'OPERATOR'}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-zinc-900 text-slate-300 border border-white/10">
                  ID: {userProfile?.employeeId || 'CONNECT_ID'}
                </span>
                {userProfile?.employmentType && (
                  <span className="text-[9px] uppercase text-slate-400 font-bold">
                    &bull; {userProfile.employmentType}
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
                {userProfile?.fullName || 'OPERATOR'}
              </h2>

              <p className="text-xs text-slate-400">
                {userProfile?.jobTitle || 'UNASSIGNED ROLE'} &bull; <span className="text-slate-300">{userProfile?.email}</span>
              </p>

              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SYNCHRONIZED WITH IDENTITY & COMPLIANCE HUB</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowPhotoEditor(!showPhotoEditor)}
              className="btn btn-primary h-9 px-4 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{showPhotoEditor ? 'CLOSE EDITOR' : 'CHANGE PROFILE PHOTO'}</span>
            </button>

            <Link
              href="/dashboard/onboarding"
              className="btn btn-secondary h-9 px-4 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              title="Open Identity & Compliance Hub to view digital credentials and ID card"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>IDENTITY & COMPLIANCE</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>
          </div>
        </div>

        {/* Collapsible Photo Crop Tool */}
        <AnimatePresence>
          {showPhotoEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springTransition}
              className="mt-6 pt-6 border-t border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    PASSPORT / PROFILE PICTURE CROPPER & UPLOADER
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhotoEditor(false)}
                  className="btn-icon h-7 w-7 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-white/10">
                <PhotoCropUpload
                  currentPhoto={userProfile?.profilePhoto}
                  onPhotoSaved={handlePhotoSaved}
                  aspectRatio="1:1"
                  userId={userId}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Column 1 */}
          <div className="space-y-6">
            
            {/* Basic Info */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={springTransition}
              className="card p-6 relative overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase mb-6">
                <UserIcon className="w-4 h-4 text-cyan-400" />
                BASIC_INFO
              </h3>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label mb-1">FULL NAME *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} required className="input" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">DATE OF BIRTH</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className="input pl-9" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">GENDER</label>
                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="select w-full">
                      <option value="male">MALE</option>
                      <option value="female">FEMALE</option>
                      <option value="other">OTHER</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">UPLINK EMAIL *</label>
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="input" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1 flex items-center gap-1.5"><Phone className="w-3 h-3"/> MOBILE NUMBER</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1 flex items-center gap-1.5"><MapPin className="w-3 h-3"/> LOCATION</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} className="input" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Emergency Contact */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.05 }}
              className="card p-6 relative overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
              <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase mb-6">
                <Heart className="w-4 h-4 text-rose-400" />
                EMERGENCY_PROTOCOLS
              </h3>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label mb-1">EMERGENCY CONTACT NAME</label>
                  <input type="text" name="emergencyContactName" value={formData.emergencyContactName} onChange={handleInputChange} className="input" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">CONTACT NUMBER</label>
                    <input type="text" name="emergencyContactNumber" value={formData.emergencyContactNumber} onChange={handleInputChange} className="input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1 flex items-center gap-1.5"><Droplet className="w-3 h-3 text-rose-500"/> BLOOD GROUP</label>
                    <input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} placeholder="e.g. O+, AB-" className="input uppercase" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Column 2 */}
          <div className="space-y-6">
            
            {/* Security */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.1 }}
              className="card p-6 relative overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase mb-6">
                <Shield className="w-4 h-4 text-amber-400" />
                SECURITY_CREDENTIALS
              </h3>

              <div className="form-group">
                <label className="form-label mb-1 flex items-center gap-1.5"><Lock className="w-3 h-3"/> OVERRIDE PASSWORD</label>
                <input 
                  type="password" 
                  name="password" 
                  value={formData.password} 
                  onChange={handleInputChange} 
                  placeholder="Leave blank to keep unchanged" 
                  className="input" 
                />
              </div>
            </motion.div>

            {/* Identity & Finance */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ ...springTransition, delay: 0.15 }}
              className="card p-6 relative overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
              <h3 className="text-xs font-bold text-white flex items-center gap-2 tracking-widest uppercase mb-6">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                IDENTITY_&_BANKING
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label mb-1">PAN NUMBER</label>
                    <input type="text" name="panDetails" value={formData.panDetails} onChange={handleInputChange} className="input uppercase" />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1">AADHAAR NUMBER</label>
                    <input type="text" name="aadhaarDetails" value={formData.aadhaarDetails} onChange={handleInputChange} className="input" />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="form-group">
                    <label className="form-label mb-1">ACCOUNT HOLDER FULL NAME</label>
                    <input type="text" name="accountHolderFullName" value={formData.accountHolderFullName} onChange={handleInputChange} className="input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label mb-1 flex items-center gap-1.5"><Building className="w-3 h-3"/> BANK ACCOUNT NUMBER</label>
                    <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleInputChange} className="input" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label mb-1">IFSC CODE</label>
                      <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleInputChange} className="input uppercase" />
                    </div>
                    <div className="form-group">
                      <label className="form-label mb-1">BRANCH NAME</label>
                      <input type="text" name="branchName" value={formData.branchName} onChange={handleInputChange} className="input" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex justify-end pt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={saving}
            className="btn btn-primary h-11 px-8 text-xs font-extrabold cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'UPDATING...' : 'SAVE CHANGES'}
          </motion.button>
        </div>

      </form>
    </div>
  );
}
