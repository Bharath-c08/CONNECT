'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Plus,
  Edit3,
  Eye,
  History,
  Users,
  Search,
  ExternalLink,
  Lock,
  ChevronRight,
  X,
  Send,
  HelpCircle,
  Sparkles,
  RefreshCw,
  Building,
  UserCheck,
  Trash2,
  Check
} from 'lucide-react';
import { apiRequest } from '../../../utils/api';
import PhotoCropUpload from '../../../components/PhotoCropUpload';
import DigitalIdCard from '../../../components/DigitalIdCard';
import PrintableDocument from '../../../components/PrintableDocument';

interface DocumentItem {
  _id: string;
  title: string;
  category: string;
  description: string;
  content: string;
  version: number;
  assignmentType: string;
  requiresAcknowledgment: boolean;
  createdAt: string;
  updatedAt: string;
  isSigned: boolean;
  signature?: {
    _id: string;
    signedAt: string;
    verificationId: string;
    certificateHash: string;
    status: string;
    documentVersion: number;
    ipAddress?: string;
  };
}

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState<'terms' | 'idcard' | 'admin'>('terms');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Employee documents states
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [signedArchive, setSignedArchive] = useState<any[]>([]);

  // Modals
  const [readingDoc, setReadingDoc] = useState<DocumentItem | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [signingLoading, setSigningLoading] = useState(false);
  const [viewingPrintable, setViewingPrintable] = useState<{ doc: any; sig: any } | null>(null);

  // Admin states
  const [adminDocs, setAdminDocs] = useState<any[]>([]);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [showCreateDocModal, setShowCreateDocModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [auditDoc, setAuditDoc] = useState<any | null>(null);
  const [auditSignatures, setAuditSignatures] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Form states for Create/Edit Document
  const [formData, setFormData] = useState({
    title: '',
    category: 'General Agreement',
    description: '',
    content: '',
    assignmentType: 'all',
    targetUsers: [] as string[],
    targetRoles: [] as string[],
    targetEmploymentTypes: [] as string[],
    changeNotes: ''
  });

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  // Initial Data Fetching
  const fetchEmployeeData = async () => {
    try {
      // 1. Fetch user profile first so ID card and identity always display
      try {
        const meData = await apiRequest('/auth/me');
        if (meData) setCurrentUser(meData);
      } catch (meErr) {
        console.warn('Could not fetch user profile:', meErr);
      }

      // 2. Fetch assigned documents
      try {
        const docsData = await apiRequest('/documents/my');
        setDocuments(docsData?.documents || []);
        setPendingCount(docsData?.pendingCount || 0);
      } catch (docsErr: any) {
        console.warn('Assigned documents endpoint unavailable:', docsErr);
        setDocuments([]);
        setPendingCount(0);
      }

      // 3. Fetch signatures archive
      try {
        const archiveData = await apiRequest('/documents/signatures/my');
        setSignedArchive(archiveData || []);
      } catch (archErr: any) {
        console.warn('Signatures archive endpoint unavailable:', archErr);
        setSignedArchive([]);
      }
    } catch (err: any) {
      console.error('Error in fetchEmployeeData:', err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [docsList, users] = await Promise.all([
        apiRequest('/documents/admin/list'),
        apiRequest('/users')
      ]);
      setAdminDocs(docsList || []);
      setAllUsersList(users || []);
    } catch (err: any) {
      console.error('Error fetching admin docs:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchEmployeeData().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && isStaff) {
      fetchAdminData();
    }
  }, [activeTab, isStaff]);

  // Keyboard ESC listener to close open document viewers and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewingPrintable) setViewingPrintable(null);
        if (readingDoc) setReadingDoc(null);
        if (docToDelete) setDocToDelete(null);
        if (showCreateDocModal) setShowCreateDocModal(false);
        if (auditDoc) setAuditDoc(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewingPrintable, readingDoc, docToDelete, showCreateDocModal, auditDoc]);

  // Sign Document Handler
  const handleSignDocument = async () => {
    if (!readingDoc || !consentChecked) return;

    setSigningLoading(true);
    setError('');
    try {
      const res = await apiRequest(`/documents/${readingDoc._id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentConfirmed: true })
      });

      setSuccess(`"${readingDoc.title}" acknowledged & digitally signed. Verification ID: ${res.signature?.verificationId}`);
      setReadingDoc(null);
      setConsentChecked(false);
      await fetchEmployeeData();
    } catch (err: any) {
      setError(err.message || 'Failed to sign document.');
    } finally {
      setSigningLoading(false);
    }
  };

  // Open Document Reader Modal
  const openReader = (doc: DocumentItem) => {
    setReadingDoc(doc);
    setConsentChecked(false);
    setError('');
  };

  // Open Printable Document
  const openPrintModal = (doc: any, sig: any) => {
    setViewingPrintable({ doc, sig });
  };

  // Open Audit Modal for Admin
  const openAuditModal = async (doc: any) => {
    setAuditDoc(doc);
    setAuditLoading(true);
    try {
      const data = await apiRequest(`/documents/admin/${doc._id}/audit`);
      setAuditSignatures(data.signatures || []);
    } catch (e) {
      console.error(e);
    } finally {
      setAuditLoading(false);
    }
  };

  // Create / Edit Document Handler
  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingDoc) {
        // Update document (increments version)
        await apiRequest(`/documents/admin/${editingDoc._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        setSuccess(`Document updated to Version ${editingDoc.version + 1} and assigned successfully.`);
      } else {
        // Create new document
        await apiRequest('/documents/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        setSuccess('New agreement/policy published and assigned successfully.');
      }

      setShowCreateDocModal(false);
      setEditingDoc(null);
      resetForm();
      await fetchAdminData();
      await fetchEmployeeData();
    } catch (err: any) {
      setError(err.message || 'Failed to save document.');
    }
  };

  // Delete Document Handler
  const handleDeleteDocument = async () => {
    if (!docToDelete) return;
    setDeletingLoading(true);
    setError('');
    try {
      await apiRequest(`/documents/admin/${docToDelete._id}`, {
        method: 'DELETE'
      });
      setSuccess(`Agreement "${docToDelete.title}" and its assigned records have been permanently deleted.`);
      if (editingDoc?._id === docToDelete._id) {
        setShowCreateDocModal(false);
        setEditingDoc(null);
      }
      setDocToDelete(null);
      await fetchAdminData();
      await fetchEmployeeData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete agreement.');
    } finally {
      setDeletingLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      category: 'General Agreement',
      description: '',
      content: '',
      assignmentType: 'all',
      targetUsers: [],
      targetRoles: [],
      targetEmploymentTypes: [],
      changeNotes: ''
    });
    setUserSearchQuery('');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingDoc(null);
    setShowCreateDocModal(true);
  };

  const openEditModal = (doc: any) => {
    setEditingDoc(doc);
    setUserSearchQuery('');
    setFormData({
      title: doc.title,
      category: doc.category || 'General Agreement',
      description: doc.description || '',
      content: doc.content || '',
      assignmentType: doc.assignmentType || 'all',
      targetUsers: doc.targetUsers ? doc.targetUsers.map((u: any) => u._id || u) : [],
      targetRoles: doc.targetRoles || [],
      targetEmploymentTypes: doc.targetEmploymentTypes || [],
      changeNotes: ''
    });
    setShowCreateDocModal(true);
  };

  const handlePhotoSaved = (newPhoto: string) => {
    setCurrentUser((prev: any) => ({
      ...prev,
      profilePhoto: newPhoto
    }));
    setSuccess('Passport photo updated on official credential.');
  };

  return (
    <div className="flex flex-col gap-6 font-mono select-none">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-950/60 border border-white/10 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-1 left-2 text-[7px] opacity-25">MODULE_08 // IDENTITY_AND_COMPLIANCE_ENGINE</div>

        <div className="flex items-center gap-3.5 pt-1">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldCheck className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
              <span>IDENTITY & COMPLIANCE HUB</span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Dynamic terms acknowledgment, tamper-proof document hashes, and digital employee ID credentials.
            </p>
          </div>
        </div>

        {/* Status Metrics Strip */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {pendingCount > 0 ? (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              <span>{pendingCount} Pending Terms to Sign</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>All Terms Acknowledged</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Alerts Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white text-sm cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white text-sm cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'terms'
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Terms & Agreements</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 font-black text-[9px] flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('idcard')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'idcard'
              ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Digital ID Card</span>
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ml-auto ${
              activeTab === 'admin'
                ? 'bg-purple-500/15 border border-purple-500/40 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Admin Document Hub</span>
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* ── TAB 1: EMPLOYEE TERMS & AGREEMENTS ── */}
      {/* ======================================================== */}
      {activeTab === 'terms' && (
        <div className="flex flex-col gap-6">
          {/* Pending Requirements Section */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>MANDATORY AGREEMENTS AWAITING SIGNATURE</span>
                <span className="text-[10px] text-amber-400">({documents.filter((d) => !d.isSigned).length})</span>
              </h3>
            </div>

            {documents.filter((d) => !d.isSigned).length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-950/40 border border-white/5 flex flex-col items-center justify-center text-center gap-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 opacity-80" />
                <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  You are 100% compliant!
                </h4>
                <p className="text-xs text-slate-500 max-w-md">
                  All active company terms, codes of conduct, and employment policies assigned to your role have been acknowledged and signed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents
                  .filter((d) => !d.isSigned)
                  .map((doc) => (
                    <div
                      key={doc._id}
                      className="p-5 rounded-2xl bg-zinc-950/60 border border-amber-500/30 flex flex-col justify-between gap-4 relative overflow-hidden group hover:border-amber-400 transition-all shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[8px] font-extrabold uppercase text-amber-400 tracking-widest block">
                              {doc.category} &bull; v{doc.version}.0
                            </span>
                            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider mt-0.5">
                              {doc.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                              {doc.description || 'Compliance attestation required prior to operational access.'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[8px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
                          REQUIRED
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[9px] text-slate-500">
                        <span>Assigned: {new Date(doc.createdAt).toLocaleDateString()}</span>
                        <button
                          type="button"
                          onClick={() => openReader(doc)}
                          className="btn btn-primary h-8 px-4 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                          }}
                        >
                          <span>Read & Sign Agreement</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* "My Documents" Signed Archive Section */}
          <div className="flex flex-col gap-3 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <span>MY SIGNED DOCUMENTS ARCHIVE</span>
                <span className="text-[10px] text-cyan-400">({signedArchive.length})</span>
              </h3>
            </div>

            {signedArchive.length === 0 ? (
              <div className="p-8 rounded-2xl bg-zinc-950/40 border border-white/5 text-center text-xs text-slate-500">
                No archived signed documents found.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-zinc-900/60 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                      <th className="py-3 px-4">DOCUMENT NAME</th>
                      <th className="py-3 px-4">VERSION</th>
                      <th className="py-3 px-4">SIGNED TIMESTAMP</th>
                      <th className="py-3 px-4">VERIFICATION ID</th>
                      <th className="py-3 px-4 text-center">AUTHENTICITY</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {signedArchive.map((sig) => (
                      <tr key={sig._id} className="hover:bg-cyan-500/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white uppercase">
                          {sig.documentTitle || sig.documentId?.title}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                          v{sig.documentVersion}.0
                        </td>
                        <td className="py-3 px-4 text-[10px] text-slate-400">
                          {new Date(sig.signedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] font-black text-amber-400">
                          {sig.verificationId}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                              sig.status === 'valid'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {sig.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openPrintModal(sig.documentId || { title: sig.documentTitle, content: sig.documentContent || 'Document content archived', version: sig.documentVersion }, sig)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer transition-all"
                          >
                            <Printer className="w-3 h-3" />
                            <span>View / Print</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── TAB 2: DIGITAL ID CARD GENERATOR ── */}
      {/* ======================================================== */}
      {activeTab === 'idcard' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Photo Upload & Profile Audit */}
            <div className="lg:col-span-1 flex flex-col gap-5 p-5 rounded-2xl bg-zinc-950/60 border border-white/10">
              <h3 className="text-xs font-black uppercase tracking-wider text-white border-b border-white/10 pb-2 flex items-center gap-2">
                <span>IDENTITY VERIFICATION & PHOTO</span>
              </h3>

              {/* Passport Photo Cropper Tool */}
              <PhotoCropUpload
                currentPhoto={currentUser?.profilePhoto}
                onPhotoSaved={handlePhotoSaved}
                userId={currentUser?._id}
              />

              {/* Profile Details Audit List */}
              <div className="space-y-2 pt-3 border-t border-white/10 text-xs">
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black block">
                  CREDENTIAL DATA POINTS
                </span>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">FULL NAME:</span>
                    <strong className="text-white uppercase">{currentUser?.fullName || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">EMPLOYEE ID:</span>
                    <strong className="text-cyan-400 uppercase">{currentUser?.employeeId || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">JOB TITLE:</span>
                    <strong className="text-slate-300 uppercase">{currentUser?.jobTitle || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">BLOOD GROUP:</span>
                    <strong className="text-rose-400">{currentUser?.bloodGroup || 'O+'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">DATE OF BIRTH:</span>
                    <strong className="text-slate-300">
                      {currentUser?.dob ? new Date(currentUser.dob).toLocaleDateString() : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[8px] uppercase">PHONE:</span>
                    <strong className="text-slate-300">{currentUser?.phone || 'N/A'}</strong>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-slate-500 block text-[8px] uppercase">EMERGENCY CONTACT:</span>
                  <strong className="text-amber-400 text-[10px]">
                    {currentUser?.emergencyContactNumber || 'Not configured'}
                    {currentUser?.emergencyContactName ? ` (${currentUser.emergencyContactName})` : ''}
                  </strong>
                </div>

                <div className="pt-2">
                  <span className="text-slate-500 block text-[8px] uppercase">RESIDENTIAL ADDRESS:</span>
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {currentUser?.address || 'Address pending verification.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Digital ID Card Preview & Print Engine */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              {currentUser && (
                <DigitalIdCard
                  user={{
                    ...currentUser,
                    dob: currentUser?.dob,
                    phone: currentUser?.phone,
                    emergencyContactNumber: currentUser?.emergencyContactNumber,
                    emergencyContactName: currentUser?.emergencyContactName,
                    address: currentUser?.address,
                    profilePhoto: currentUser?.profilePhoto,
                    bloodGroup: currentUser?.bloodGroup
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── TAB 3: ADMIN POLICY & DOCUMENT HUB ── */}
      {/* ======================================================== */}
      {activeTab === 'admin' && isStaff && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                // COMPLIANCE_AND_TERMS_GOVERNANCE
              </h3>
              <p className="text-[10px] text-slate-500">
                Draft agreements, manage assignment filters, inspect immutable signature audits, and revoke tokens.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="btn btn-primary h-9 px-4 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
              }}
            >
              <Plus className="w-4 h-4" />
              <span>Draft New Agreement</span>
            </button>
          </div>

          {/* Admin Documents Table */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-zinc-950/40">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-zinc-900/60 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
                  <th className="py-3 px-4">TITLE & CATEGORY</th>
                  <th className="py-3 px-4">VERSION</th>
                  <th className="py-3 px-4">TARGET CRITERIA</th>
                  <th className="py-3 px-4 text-center">SIGNED COUNT</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {adminDocs.map((doc) => (
                  <tr key={doc._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-bold text-white">
                      <div className="uppercase">{doc.title}</div>
                      <span className="text-[8px] text-slate-500 tracking-wider uppercase">
                        {doc.category} &bull; Created {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      v{doc.version}.0
                      {doc.versionHistory?.length > 0 && (
                        <span className="text-[8px] text-slate-500 block">
                          ({doc.versionHistory.length} revisions)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[10px] text-slate-400 font-mono">
                      <span className="uppercase text-amber-400 font-bold">
                        {doc.assignmentType === 'all'
                          ? 'BROADCAST [ALL USERS]'
                          : doc.assignmentType === 'specific_users'
                          ? `CUSTOM [${doc.targetUsers?.length || 0} EMPLOYEES]`
                          : doc.assignmentType.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {doc.currentVersionSignatures || 0}
                      <span className="text-[8px] text-slate-500 block">
                        all versions: {doc.totalAllTimeSignatures || 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                          doc.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-800 text-slate-400 border-white/10'
                        }`}
                      >
                        {doc.isActive ? 'Active' : 'Archived'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openAuditModal(doc)}
                          className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                          title="View complete audit trail of who signed this document"
                        >
                          <Eye className="w-3 h-3 inline mr-1" />
                          <span>Audit Trail</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(doc)}
                          className="px-2.5 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                          title="Edit terms & increment version"
                        >
                          <Edit3 className="w-3 h-3 inline mr-1" />
                          <span>Update</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDocToDelete(doc)}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                          title="Permanently delete assigned agreement"
                        >
                          <Trash2 className="w-3 h-3 inline mr-1" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── MODAL: DOCUMENT READER & CONSENT ACKNOWLEDGMENT ── */}
      {/* ======================================================== */}
      {readingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-3xl max-h-[90vh] rounded-2xl border flex flex-col shadow-2xl overflow-hidden relative"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--brand)'
            }}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    {readingDoc.title}
                  </h3>
                  <span className="text-[8px] text-slate-400 uppercase font-mono">
                    CATEGORY: {readingDoc.category} &bull; REVISION VERSION {readingDoc.version}.0
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReadingDoc(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Content Scrollable View */}
            <div className="p-6 overflow-y-auto flex-1 font-sans text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line select-text bg-zinc-950/40">
              {readingDoc.content}
            </div>

            {/* Consent Box & Digital Signing Footer */}
            <div className="p-5 border-t border-white/10 bg-zinc-950 flex flex-col gap-3 font-mono">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-cyan-400 cursor-pointer shrink-0"
                />
                <span className="text-[10px] text-amber-200 leading-normal">
                  <strong>Explicit Consent Acknowledgment:</strong> I,{' '}
                  <span className="text-white font-extrabold">{currentUser?.fullName}</span> (Emp No:{' '}
                  <span className="text-cyan-400 font-extrabold">{currentUser?.employeeId}</span>), confirm that I have
                  carefully read, understood, and agreed to all provisions and obligations of this agreement. I consent
                  to my digital signature being cryptographically anchored with my device IP address, browser agent,
                  and timestamp into the Markdot Trust Ledger.
                </span>
              </label>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setReadingDoc(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!consentChecked || signingLoading}
                  onClick={handleSignDocument}
                  className="btn btn-primary h-10 px-6 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  }}
                >
                  {signingLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Digitally Sign & Acknowledge</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── MODAL: VIEW / PRINT SIGNED DOCUMENT WITH QR ── */}
      {/* ======================================================== */}
      {viewingPrintable && (
        <div className="fixed inset-0 z-[99999] flex flex-col bg-black/95 backdrop-blur-2xl overflow-hidden select-none">
          {/* ── DEDICATED FIXED TOP BAR: ALWAYS PINNED AND VISIBLE ── */}
          <div className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-8 border-b border-white/10 bg-zinc-950 z-50 no-print shadow-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
                  {viewingPrintable.doc.title || viewingPrintable.sig.documentTitle}
                </h3>
                <span className="text-[8px] text-cyan-400 font-mono tracking-widest uppercase block mt-0.5 truncate">
                  VERIFICATION ID: {viewingPrintable.sig.verificationId} &bull; CRYPTOGRAPHIC RECORD
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {/* Top Print Button */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                className="btn btn-primary h-10 px-5 text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)'
                }}
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>

              {/* Top Close Button */}
              <button
                type="button"
                onClick={() => setViewingPrintable(null)}
                className="h-10 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-xs uppercase flex items-center gap-2 cursor-pointer transition-colors border border-white/10 shadow-sm"
                title="Close document viewer [ESC]"
              >
                <X className="w-4 h-4" />
                <span>Close [ESC]</span>
              </button>
            </div>
          </div>

          {/* ── SCROLLABLE DOCUMENT PREVIEW AREA ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-4xl mx-auto py-2">
              <PrintableDocument
                document={{
                  _id: viewingPrintable.doc._id || 'ARCHIVE',
                  title: viewingPrintable.doc.title || viewingPrintable.sig.documentTitle,
                  category: viewingPrintable.doc.category,
                  content: viewingPrintable.doc.content || viewingPrintable.sig.documentContent || 'Document content archived in Markdot Legal repository.',
                  version: viewingPrintable.sig.documentVersion || viewingPrintable.doc.version || 1,
                  createdAt: viewingPrintable.doc.createdAt
                }}
                signature={viewingPrintable.sig}
                user={{
                  fullName: currentUser?.fullName || 'OPERATOR',
                  employeeId: currentUser?.employeeId || 'NO-ID',
                  jobTitle: currentUser?.jobTitle,
                  email: currentUser?.email,
                  employmentType: currentUser?.employmentType
                }}
                onClose={() => setViewingPrintable(null)}
              />
            </div>
          </div>

          {/* ── FLOATING QUICK-ACTION PILL AT BOTTOM RIGHT ── */}
          <div className="fixed bottom-6 right-8 z-50 flex items-center gap-2 no-print bg-zinc-950/95 border border-white/20 p-2 rounded-2xl shadow-2xl backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="h-9 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={() => setViewingPrintable(null)}
              className="h-9 px-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer transition-colors border border-white/10"
              title="Close viewer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── MODAL: CREATE / UPDATE DOCUMENT (ADMIN) ── */}
      {/* ======================================================== */}
      {showCreateDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl border flex flex-col shadow-2xl overflow-hidden relative"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--brand)'
            }}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950">
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                {editingDoc ? `// UPDATE_TERMS_VERSION [v${editingDoc.version} -> v${editingDoc.version + 1}]` : '// DRAFT_NEW_AGREEMENT'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateDocModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs font-mono">
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Information Security Policy & Data Handling Agreement"
                  className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-cyan-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-cyan-400 text-xs cursor-pointer"
                  >
                    <option value="General Agreement">General Agreement</option>
                    <option value="Code of Conduct">Code of Conduct</option>
                    <option value="Non-Disclosure Agreement (NDA)">Non-Disclosure Agreement (NDA)</option>
                    <option value="Information Security Policy">Information Security Policy</option>
                    <option value="Employment Terms">Employment Terms</option>
                    <option value="Remote Work Guidelines">Remote Work Guidelines</option>
                    <option value="Equipment Consent">Equipment Consent</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Assignment Scope</label>
                  <select
                    value={formData.assignmentType}
                    onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-cyan-400 text-xs cursor-pointer"
                  >
                    <option value="all">All Users (Broadcast)</option>
                    <option value="specific_users">Specific Users (Multiple Selection)</option>
                    <option value="role">By Role (e.g. Admin / User)</option>
                    <option value="employment_type">By Employment Type</option>
                  </select>
                </div>
              </div>

              {/* Multiple User Selection Engine */}
              {formData.assignmentType === 'specific_users' && (
                <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-zinc-950/80 border border-cyan-500/25">
                  {/* Top Bar: Label, Counter Badge, Bulk Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <label className="text-[10px] uppercase font-black tracking-wider text-white">
                        Target Employees
                      </label>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        {formData.targetUsers.length} Selected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[9px] font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          const allIds = allUsersList.map((u) => u._id);
                          setFormData({ ...formData, targetUsers: allIds });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Select All ({allUsersList.length})
                      </button>
                      {formData.targetUsers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, targetUsers: [] })}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search / Filter Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Filter employees by name, ID, role, or title..."
                      className="w-full h-8 pl-8 pr-8 rounded-lg bg-zinc-900 border border-white/10 text-white placeholder-slate-500 text-[10px] outline-none focus:border-cyan-400"
                    />
                    {userSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setUserSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Selected User Chips (Quick Review & Remove) */}
                  {formData.targetUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto py-1">
                      {formData.targetUsers.map((userId) => {
                        const userObj = allUsersList.find((u) => u._id === userId);
                        if (!userObj) return null;
                        return (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 text-[9px] font-bold"
                          >
                            <span>{userObj.fullName}</span>
                            <span className="text-[8px] text-cyan-500/80 font-mono">({userObj.employeeId})</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  targetUsers: formData.targetUsers.filter((id) => id !== userId)
                                });
                              }}
                              className="hover:text-rose-400 cursor-pointer ml-0.5"
                              title="Remove employee"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Scrollable Checkbox Employee List */}
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/60 divide-y divide-white/5">
                    {allUsersList
                      .filter((u) => {
                        if (!userSearchQuery) return true;
                        const q = userSearchQuery.toLowerCase();
                        return (
                          (u.fullName || '').toLowerCase().includes(q) ||
                          (u.employeeId || '').toLowerCase().includes(q) ||
                          (u.role || '').toLowerCase().includes(q) ||
                          (u.jobTitle || '').toLowerCase().includes(q)
                        );
                      })
                      .map((u) => {
                        const isSelected = formData.targetUsers.includes(u._id);
                        return (
                          <div
                            key={u._id}
                            onClick={() => {
                              const next = isSelected
                                ? formData.targetUsers.filter((id) => id !== u._id)
                                : [...formData.targetUsers, u._id];
                              setFormData({ ...formData, targetUsers: next });
                            }}
                            className={`p-2 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-cyan-500/15 border-l-2 border-cyan-400 text-white'
                                : 'hover:bg-white/[0.03] text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Custom Styled Checkbox */}
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-cyan-500 border-cyan-400 text-zinc-950'
                                    : 'border-white/20 bg-zinc-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>

                              {/* Initials Avatar */}
                              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[9px] font-extrabold text-cyan-400 shrink-0">
                                {(u.fullName || 'U')
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </div>

                              {/* Employee Identity */}
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                  <span>{u.fullName}</span>
                                  {u._id === currentUser?._id && (
                                    <span className="text-[7.5px] px-1 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[9px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                  <span className="text-cyan-400/90 font-bold">EMP ID: {u.employeeId}</span>
                                  {u.jobTitle && <span className="text-slate-400">&bull; {u.jobTitle}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Role / Permission Pill */}
                            <div className="shrink-0 text-right">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                                  u.role === 'superadmin' || u.role === 'admin'
                                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    : 'bg-zinc-800 text-slate-400 border-white/10'
                                }`}
                              >
                                {u.role}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {allUsersList.length > 0 &&
                      allUsersList.filter((u) => {
                        if (!userSearchQuery) return true;
                        const q = userSearchQuery.toLowerCase();
                        return (
                          (u.fullName || '').toLowerCase().includes(q) ||
                          (u.employeeId || '').toLowerCase().includes(q) ||
                          (u.role || '').toLowerCase().includes(q) ||
                          (u.jobTitle || '').toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No employees match "{userSearchQuery}"
                        </div>
                      )}
                  </div>

                  {/* Helper footer */}
                  <div className="text-[8px] text-slate-500 flex items-center justify-between px-1">
                    <span>Click any employee row to toggle selection</span>
                    <span>{formData.targetUsers.length} employee(s) assigned</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Agreement Text (Full Body) *</label>
                <textarea
                  required
                  rows={8}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the full terms, clauses, responsibilities, and conditions..."
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-cyan-400 font-sans text-xs leading-relaxed"
                />
              </div>

              {editingDoc && (
                <div>
                  <label className="text-[9px] uppercase font-bold text-amber-400 block mb-1">Revision Change Notes</label>
                  <input
                    type="text"
                    value={formData.changeNotes}
                    onChange={(e) => setFormData({ ...formData, changeNotes: e.target.value })}
                    placeholder="Briefly state reason for updating this version..."
                    className="w-full h-9 px-3 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none focus:border-cyan-400 text-xs"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {editingDoc ? (
                  <button
                    type="button"
                    onClick={() => setDocToDelete(editingDoc)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Agreement</span>
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateDocModal(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-bold uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary h-10 px-6 text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
                    }}
                  >
                    <span>{editingDoc ? 'Publish New Version' : 'Publish & Assign'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── MODAL: ADMIN AUDIT TRAIL ── */}
      {/* ======================================================== */}
      {auditDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div
            className="w-full max-w-4xl max-h-[90vh] rounded-2xl border flex flex-col shadow-2xl overflow-hidden relative"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--brand)'
            }}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    // AUDIT_TRAIL: {auditDoc.title}
                  </h3>
                  <span className="text-[8px] text-slate-400 font-mono uppercase">
                    CURRENT VERSION: v{auditDoc.version}.0 &bull; TOTAL RECORDED SIGNATURES: {auditSignatures.length}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditDoc(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 font-mono">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading audit ledger...</span>
                </div>
              ) : auditSignatures.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs italic">
                  NO SIGNATURES RECORDED FOR THIS DOCUMENT YET.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-zinc-900/80 text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
                        <th className="py-2.5 px-3">EMPLOYEE</th>
                        <th className="py-2.5 px-3">VERSION</th>
                        <th className="py-2.5 px-3">TIMESTAMP</th>
                        <th className="py-2.5 px-3">IP ADDRESS</th>
                        <th className="py-2.5 px-3">VERIFICATION ID</th>
                        <th className="py-2.5 px-3">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {auditSignatures.map((s) => (
                        <tr key={s._id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div>{s.userId?.fullName || 'Unknown'}</div>
                            <span className="text-[8px] text-slate-500 uppercase">{s.userId?.employeeId}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400 font-bold">
                            v{s.documentVersion}.0
                          </td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-400">
                            {new Date(s.signedAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[9px] text-slate-400">
                            {s.ipAddress || '127.0.0.1'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                            {s.verificationId}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[7px] font-extrabold uppercase border ${
                                s.status === 'valid'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ── MODAL: CONFIRM DELETE ASSIGNED AGREEMENT ── */}
      {/* ======================================================== */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-zinc-950 p-6 flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  DELETE ASSIGNED AGREEMENT
                </h3>
                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">
                  PERMANENT COMPLIANCE ACTION
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-slate-300 space-y-2">
              <p className="font-bold text-white uppercase">
                Are you sure you want to delete &ldquo;{docToDelete.title}&rdquo;?
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This will immediately remove this agreement from all assigned employee onboarding views and permanently delete all <strong className="text-rose-400">{docToDelete.totalAllTimeSignatures || 0}</strong> associated cryptographic signature records from the active registry.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingLoading}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingLoading}
                onClick={handleDeleteDocument}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-lg disabled:opacity-50"
              >
                {deletingLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{deletingLoading ? 'Deleting...' : 'Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

