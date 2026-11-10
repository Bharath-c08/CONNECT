'use client';

import React, { useState, useEffect } from 'react';
import {
  Award,
  FileText,
  Plus,
  Printer,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldCheck,
  Calendar,
  User as UserIcon,
  X,
  FileCheck,
  Loader2,
  Building,
  Sparkles,
  Eye,
  Check
} from 'lucide-react';
import { apiRequest } from '../utils/api';
import { generateQrSvg } from '../utils/qr';

interface CertificateItem {
  _id: string;
  userId: any;
  employeeId: string;
  fullName: string;
  certificateType: string;
  title: string;
  issueDate: string;
  effectiveDate: string;
  content: string;
  issuedByName: string;
  issuedByRole: string;
  status: string;
  verificationCode: string;
  metadata?: {
    designation?: string;
    department?: string;
    joiningDate?: string;
    relievingDate?: string;
    reason?: string;
    notes?: string;
  };
  createdAt: string;
}

interface UserCertificatesHubProps {
  currentUser: any;
  isStaff: boolean;
  allUsersList?: any[];
}

export default function UserCertificatesHub({
  currentUser,
  isStaff,
  allUsersList = [],
}: UserCertificatesHubProps) {
  const [subTab, setSubTab] = useState<'my' | 'admin'>('my');
  const [myCertificates, setMyCertificates] = useState<CertificateItem[]>([]);
  const [allCertificates, setAllCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Preview / Print Modal
  const [previewCert, setPreviewCert] = useState<CertificateItem | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');

  // Issue Certificate Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuingLoading, setIssuingLoading] = useState(false);
  const [selectedTargetUserIds, setSelectedTargetUserIds] = useState<string[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [certFormData, setCertFormData] = useState({
    certificateType: 'noc_letter',
    title: 'No Objection Certificate (NoC)',
    issueDate: new Date().toISOString().split('T')[0],
    effectiveDate: new Date().toISOString().split('T')[0],
    content: '',
    designation: '',
    department: 'Engineering & Operations',
    relievingDate: '',
    reason: '',
  });

  useEffect(() => {
    fetchCertificates();
  }, [subTab]);

  const fetchCertificates = async () => {
    setLoading(true);
    setError('');
    try {
      if (subTab === 'my') {
        const data = await apiRequest('/certificates/my');
        setMyCertificates(data || []);
      } else if (isStaff && subTab === 'admin') {
        const data = await apiRequest('/certificates/all');
        setAllCertificates(data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve certificates.');
    } finally {
      setLoading(false);
    }
  };

  // Generate QR when previewing
  useEffect(() => {
    if (previewCert) {
      const verifyUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/verify?cert=${previewCert.verificationCode}`
          : `https://connect.markdot.com/verify?cert=${previewCert.verificationCode}`;
      try {
        const svg = generateQrSvg(verifyUrl, 84, '#0f172a', '#ffffff');
        setQrSvg(svg);
      } catch (e) {
        console.error('Error generating certificate QR:', e);
      }
    } else {
      setQrSvg('');
    }
  }, [previewCert]);

  // Template generator
  const generateTemplateContent = (type: string, user?: any) => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const joining = user?.joiningDate
      ? new Date(user.joiningDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '{{joiningDate}}';
    const relieving = certFormData.relievingDate
      ? new Date(certFormData.relievingDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : today;

    const empName = user?.fullName || '{{fullName}}';
    const empId = user?.employeeId || '{{employeeId}}';
    const role = user?.jobTitle || certFormData.designation || '{{jobTitle}}';

    switch (type) {
      case 'noc_letter':
        return `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that ${empName} (Employee ID: ${empId}) has been in bona fide employment with Markdot Intellect Inc. as ${role} since ${joining}.\n\nThis Organization confirms that it has NO OBJECTION to their applications, official verifications, external academic endeavors, passport/visa documentation, or career advancement opportunities.\n\nDuring their tenure with our organization, their professional conduct, character, and dedication to responsibilities have been found exemplary. We take pleasure in issuing this certificate and wish them continued success in all their future endeavors.`;

      case 'relieving_letter':
        return `TO WHOMSOEVER IT MAY CONCERN\n\nThis is to formally acknowledge and confirm that ${empName} (Employee ID: ${empId}), who served with Markdot Intellect Inc. in the capacity of ${role}, has been formally relieved from all official employment obligations, operational duties, and company responsibilities effective as of the close of business on ${relieving}.\n\nWe hereby confirm that all official equipment, proprietary credentials, company assets, and internal handover tasks have been verified, settled, and accounted for in complete accordance with company compliance policies. There are no outstanding financial, contractual, or intellectual dues against their name.\n\nWe express our sincere appreciation for their contributions and professional commitment throughout their period of service and extend our best wishes for their prospective career milestones.`;

      case 'experience_letter':
        return `SERVICE & EXPERIENCE CERTIFICATE\n\nThis is to certify that ${empName} (Employee ID: ${empId}) was engaged with Markdot Intellect Inc. from ${joining} to ${relieving}.\n\nDuring their tenure with our firm, they operated as ${role} within the ${certFormData.department || 'Operations'} Division. Their daily responsibilities entailed technical execution, team collaboration, and adherence to high quality standards.\n\nThroughout their period of service, we observed ${empName} to be diligent, conscientious, technically proficient, and highly professional. Their integrity and workplace conduct have consistently met with our full satisfaction.\n\nThis certificate is issued upon their formal request without any liability on the part of the issuing authority. We wish them success and prosperity in all future career undertakings.`;

      case 'bonafide_letter':
        return `BONA FIDE EMPLOYMENT CERTIFICATE\n\nThis is to certify that ${empName} (Employee ID: ${empId}) is currently a bona fide, regular employee of Markdot Intellect Inc., working as ${role} in our ${certFormData.department || 'Operations'} department since ${joining}.\n\nTheir employment with the company is active and in good standing. This certificate is issued at the request of the employee for official identification, banking, residential, or administrative verification purposes only.`;

      default:
        return `CERTIFICATE OF RECORD\n\nThis is to certify that ${empName} (Employee ID: ${empId}) is associated with Markdot Intellect Inc. as ${role}.\n\nThis document serves as an official institutional attestation of their credentials and service records.`;
    }
  };

  const handleToggleUserSelection = (userId: string) => {
    const isSelected = selectedTargetUserIds.includes(userId);
    const next = isSelected
      ? selectedTargetUserIds.filter((id) => id !== userId)
      : [...selectedTargetUserIds, userId];
    setSelectedTargetUserIds(next);

    // If exactly 1 user is selected, customize preview with their data
    if (next.length === 1) {
      const target = allUsersList.find((u) => u._id === next[0]);
      if (target) {
        setCertFormData((prev) => ({
          ...prev,
          designation: target.jobTitle || prev.designation,
          content: generateTemplateContent(prev.certificateType, target),
        }));
      }
    } else if (next.length > 1 && selectedTargetUserIds.length <= 1) {
      // Revert to placeholder template for batch
      setCertFormData((prev) => ({
        ...prev,
        content: generateTemplateContent(prev.certificateType, null),
      }));
    }
  };

  const handleSelectAllUsers = () => {
    const allIds = allUsersList.map((u) => u._id);
    setSelectedTargetUserIds(allIds);
    setCertFormData((prev) => ({
      ...prev,
      content: generateTemplateContent(prev.certificateType, null),
    }));
  };

  const handleClearUserSelection = () => {
    setSelectedTargetUserIds([]);
  };

  const handleTypeChange = (newType: string) => {
    let newTitle = 'No Objection Certificate (NoC)';
    if (newType === 'relieving_letter') newTitle = 'Official Relieving Letter';
    if (newType === 'experience_letter') newTitle = 'Certificate of Experience & Service';
    if (newType === 'bonafide_letter') newTitle = 'Bonafide Employee Certificate';
    if (newType === 'custom_certificate') newTitle = 'Official Institutional Certificate';

    const target = selectedTargetUserIds.length === 1
      ? allUsersList.find((u) => u._id === selectedTargetUserIds[0])
      : null;

    setCertFormData((prev) => ({
      ...prev,
      certificateType: newType,
      title: newTitle,
      content: generateTemplateContent(newType, target),
    }));
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTargetUserIds.length === 0) {
      setError('Please select at least one employee.');
      return;
    }
    if (!certFormData.content.trim()) {
      setError('Please provide document content.');
      return;
    }

    setIssuingLoading(true);
    setError('');
    try {
      const res = await apiRequest('/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedTargetUserIds,
          certificateType: certFormData.certificateType,
          title: certFormData.title,
          content: certFormData.content,
          issueDate: certFormData.issueDate,
          effectiveDate: certFormData.effectiveDate,
          metadata: {
            designation: certFormData.designation,
            department: certFormData.department,
            relievingDate: certFormData.relievingDate || null,
            reason: certFormData.reason,
          },
        }),
      });

      const count = res.count || selectedTargetUserIds.length;
      setSuccess(`Certificate "${certFormData.title}" successfully issued and archived for ${count} employee(s).`);
      setShowIssueModal(false);
      resetIssueForm();
      fetchCertificates();
    } catch (err: any) {
      setError(err.message || 'Error issuing certificate.');
    } finally {
      setIssuingLoading(false);
    }
  };

  const handleDeleteCertificate = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete/revoke "${title}"?`)) {
      return;
    }
    setError('');
    try {
      await apiRequest(`/certificates/${id}`, { method: 'DELETE' });
      setSuccess('Certificate removed successfully.');
      fetchCertificates();
    } catch (err: any) {
      setError(err.message || 'Error deleting certificate.');
    }
  };

  const resetIssueForm = () => {
    setSelectedTargetUserIds([]);
    setUserSearchQuery('');
    setCertFormData({
      certificateType: 'noc_letter',
      title: 'No Objection Certificate (NoC)',
      issueDate: new Date().toISOString().split('T')[0],
      effectiveDate: new Date().toISOString().split('T')[0],
      content: generateTemplateContent('noc_letter', null),
      designation: '',
      department: 'Engineering & Operations',
      relievingDate: '',
      reason: '',
    });
  };

  const openIssueModal = () => {
    resetIssueForm();
    setShowIssueModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const activeList = subTab === 'my' ? myCertificates : allCertificates;

  const filteredCertificates = activeList.filter((cert) => {
    const matchesSearch =
      cert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.verificationCode.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || cert.certificateType === typeFilter;

    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'noc_letter':
        return (
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            NoC Letter
          </span>
        );
      case 'relieving_letter':
        return (
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/25">
            Relieving Letter
          </span>
        );
      case 'experience_letter':
        return (
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
            Experience Letter
          </span>
        );
      case 'bonafide_letter':
        return (
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/25">
            Bonafide Letter
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
            Certificate
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 font-mono select-none">
      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Header & Sub-tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-950/70 border border-white/10 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Award className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-widest uppercase flex items-center gap-2">
              <span>CERTIFICATES & EXIT CREDENTIALS</span>
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Official institutional certificates, No Objection letters (NoC), Relieving letters, and Service records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isStaff && (
            <div className="flex rounded-xl border border-white/10 overflow-hidden text-[10px] font-bold p-1 bg-zinc-900/60">
              <button
                type="button"
                onClick={() => setSubTab('my')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  subTab === 'my'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                My Certificates ({myCertificates.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('admin')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  subTab === 'admin'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Registry Ledger ({allCertificates.length})
              </button>
            </div>
          )}

          {isStaff && (
            <button
              type="button"
              onClick={openIssueModal}
              className="btn btn-primary h-9 px-4 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ISSUE CERTIFICATE</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-950/40 border border-white/10">
        <div className="relative flex items-center col-span-1 sm:col-span-2">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title, employee name, ID, or verification code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10 text-xs"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="select text-xs"
        >
          <option value="all">ALL DOCUMENT TYPES</option>
          <option value="noc_letter">No Objection Certificate (NoC)</option>
          <option value="relieving_letter">Relieving Letter</option>
          <option value="experience_letter">Experience & Service</option>
          <option value="bonafide_letter">Bonafide Letter</option>
          <option value="custom_certificate">Custom Certificate</option>
        </select>
      </div>

      {/* Certificate Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-xs uppercase tracking-wider">Synchronizing secure credentials ledger...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-white/10 bg-zinc-950/40 text-slate-500 flex flex-col items-center gap-3">
          <FileCheck className="w-12 h-12 opacity-30 text-cyan-400" />
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Certificates Found</h4>
          <p className="text-xs text-slate-400 max-w-md">
            {subTab === 'my'
              ? 'No official certificates or exit documents have been issued to your account yet.'
              : 'No issued certificates match the selected filters.'}
          </p>
          {isStaff && subTab === 'admin' && (
            <button
              onClick={openIssueModal}
              className="mt-2 btn btn-primary h-8 px-4 text-xs font-bold uppercase"
            >
              Issue First Certificate
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCertificates.map((cert) => (
            <div
              key={cert._id}
              className="card p-5 flex flex-col justify-between gap-4 rounded-2xl bg-zinc-950/60 border border-white/10 hover:border-cyan-500/40 transition-all shadow-lg relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  {getTypeBadge(cert.certificateType)}
                  <span className="text-[8px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    {cert.verificationCode}
                  </span>
                </div>

                <h4 className="text-sm font-black text-white uppercase tracking-wider line-clamp-1 mb-1">
                  {cert.title}
                </h4>

                <p className="text-[11px] text-cyan-400 font-bold mb-3 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>{cert.fullName}</span>
                  <span className="text-slate-500 text-[10px]">({cert.employeeId})</span>
                </p>

                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3 bg-zinc-900/60 p-2.5 rounded-lg border border-white/5 font-sans">
                  {cert.content}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5 text-[9px] text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Issued Date:</span>
                  <strong className="text-white font-mono">
                    {new Date(cert.issueDate).toLocaleDateString()}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Signatory:</span>
                  <span className="text-slate-300 font-semibold truncate max-w-[150px]">
                    {cert.issuedByName}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="flex-1 h-8 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View & Print</span>
                  </button>

                  {isStaff && subTab === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCertificate(cert._id, cert.title)}
                      className="h-8 w-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                      title="Revoke / Delete Certificate"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: PREVIEW & PRINT OFFICIAL CERTIFICATE ── */}
      {previewCert && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl p-6 relative flex flex-col gap-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 no-print">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white tracking-wider uppercase">
                  OFFICIAL INSTITUTIONAL CERTIFICATE
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn btn-primary h-8 px-4 text-[10px] font-bold uppercase flex items-center gap-1.5 cursor-pointer shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCert(null)}
                  className="btn-icon h-8 w-8 cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Formal Certificate A4 Paper Layout */}
            <div
              id="printable-certificate"
              className="bg-white text-zinc-900 p-8 sm:p-12 rounded-xl border border-slate-300 shadow-2xl font-serif relative overflow-hidden"
              style={{
                fontFamily: "'Times New Roman', Times, serif",
                color: '#0f172a',
                lineHeight: 1.8,
              }}
            >
              {/* Header Letterhead */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5 mb-8">
                <div>
                  <h1 className="text-2xl font-black tracking-widest text-slate-950 uppercase font-sans">
                    MARKDOT INTELLECT INC.
                  </h1>
                  <p className="text-[10px] uppercase font-sans font-bold tracking-wider text-slate-600 mt-0.5">
                    Corporate Technology & Human Resource Operations
                  </p>
                  <p className="text-[9px] font-sans text-slate-500">
                    Registered Digital Corporate Ledger • Verification Gateway: https://connect.markdot.com
                  </p>
                </div>
                <div className="text-right font-sans">
                  <span className="text-[9px] font-black uppercase text-slate-500 block">
                    REF VERIFICATION CODE
                  </span>
                  <span className="text-xs font-black font-mono text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-300 inline-block mt-0.5">
                    {previewCert.verificationCode}
                  </span>
                </div>
              </div>

              {/* Title & Metadata */}
              <div className="text-center my-6">
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-slate-950 underline decoration-slate-400 underline-offset-8">
                  {previewCert.title}
                </h2>
                <div className="flex items-center justify-between text-xs font-sans text-slate-600 mt-6 pt-2 border-t border-slate-200">
                  <span>
                    <strong>Date of Issue:</strong> {new Date(previewCert.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span>
                    <strong>Effective Date:</strong> {new Date(previewCert.effectiveDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Main Content Body */}
              <div className="my-8 text-sm sm:text-base text-justify whitespace-pre-line text-slate-800 leading-relaxed font-sans">
                {previewCert.content}
              </div>

              {/* Signatory & Security Footer */}
              <div className="mt-14 pt-6 border-t border-slate-300 flex items-end justify-between font-sans">
                <div className="flex items-center gap-3">
                  {qrSvg && (
                    <div
                      className="w-20 h-20 bg-white p-1 rounded border border-slate-300 shrink-0"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                  )}
                  <div className="text-[9px] text-slate-500 max-w-[200px]">
                    <span className="font-bold text-slate-800 block uppercase">
                      Official Digital Seal
                    </span>
                    <span>
                      Scan to verify document authenticity on the Markdot Institutional Ledger.
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="h-10 flex items-center justify-end">
                    <span className="font-serif italic text-base font-bold text-slate-800">
                      // {previewCert.issuedByName}
                    </span>
                  </div>
                  <div className="w-48 border-t-2 border-slate-900 pt-1 mt-1 text-right">
                    <span className="text-xs font-black uppercase text-slate-900 block">
                      {previewCert.issuedByName}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">
                      {previewCert.issuedByRole}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase block">
                      Markdot Intellect Inc.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ISSUE NEW CERTIFICATE (ADMIN) ── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-white/15 shadow-2xl p-6 relative flex flex-col gap-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-extrabold text-white tracking-wider uppercase">
                  ISSUE OFFICIAL EMPLOYEE CERTIFICATE
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="btn-icon h-8 w-8 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} className="flex flex-col gap-4 text-xs font-mono">
              {/* Multi-User Employee Selection */}
              <div className="form-group space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="form-label mb-0">TARGET EMPLOYEES *</label>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      {selectedTargetUserIds.length} Selected
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Select All ({allUsersList.length})
                    </button>
                    {selectedTargetUserIds.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearUserSelection}
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

                {/* Selected User Chips */}
                {selectedTargetUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-lg bg-zinc-900/40 border border-white/5">
                    {selectedTargetUserIds.map((userId) => {
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
                            onClick={() => handleToggleUserSelection(userId)}
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
                <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-zinc-900/60 divide-y divide-white/5">
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
                      const isSelected = selectedTargetUserIds.includes(u._id);
                      return (
                        <div
                          key={u._id}
                          onClick={() => handleToggleUserSelection(u._id)}
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

                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate flex items-center gap-1.5">
                                <span>{u.fullName}</span>
                                <span className="text-[9px] text-cyan-400 font-mono font-semibold">
                                  ({u.employeeId})
                                </span>
                              </p>
                              <p className="text-[9px] text-slate-400 truncate">
                                {u.jobTitle || 'Operator'} &bull; {u.role.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                            u.accountStatus === 'idle'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {u.accountStatus === 'idle' ? 'IDLE' : 'WORKING'}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {selectedTargetUserIds.length > 1 && (
                  <p className="text-[9px] text-cyan-400/80 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>
                      Batch issuance active ({selectedTargetUserIds.length} recipients): Each employee receives their own personalized certificate with dynamic parameters.
                    </span>
                  </p>
                )}
              </div>

              {/* Certificate Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label mb-1">CERTIFICATE TYPE *</label>
                  <select
                    value={certFormData.certificateType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="select w-full"
                    required
                  >
                    <option value="noc_letter">No Objection Certificate (NoC)</option>
                    <option value="relieving_letter">Relieving Letter</option>
                    <option value="experience_letter">Certificate of Experience & Service</option>
                    <option value="bonafide_letter">Bonafide Employee Certificate</option>
                    <option value="custom_certificate">Custom Letter / Certificate</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">DOCUMENT TITLE *</label>
                  <input
                    type="text"
                    value={certFormData.title}
                    onChange={(e) => setCertFormData({ ...certFormData, title: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label mb-1">ISSUE DATE</label>
                  <input
                    type="date"
                    value={certFormData.issueDate}
                    onChange={(e) => setCertFormData({ ...certFormData, issueDate: e.target.value })}
                    className="input w-full"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label mb-1">EFFECTIVE DATE</label>
                  <input
                    type="date"
                    value={certFormData.effectiveDate}
                    onChange={(e) => setCertFormData({ ...certFormData, effectiveDate: e.target.value })}
                    className="input w-full"
                  />
                </div>

                {certFormData.certificateType === 'relieving_letter' && (
                  <div className="form-group">
                    <label className="form-label mb-1">RELIEVING DATE</label>
                    <input
                      type="date"
                      value={certFormData.relievingDate}
                      onChange={(e) => {
                        setCertFormData({ ...certFormData, relievingDate: e.target.value });
                        const target = selectedTargetUserIds.length === 1
                          ? allUsersList.find((u) => u._id === selectedTargetUserIds[0])
                          : null;
                        setCertFormData((prev) => ({
                          ...prev,
                          relievingDate: e.target.value,
                          content: generateTemplateContent(prev.certificateType, target),
                        }));
                      }}
                      className="input w-full"
                    />
                  </div>
                )}
              </div>

              {/* Content / Body */}
              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label">DOCUMENT BODY / CONTENT *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const target = selectedTargetUserIds.length === 1
                        ? allUsersList.find((u) => u._id === selectedTargetUserIds[0])
                        : null;
                      setCertFormData((prev) => ({
                        ...prev,
                        content: generateTemplateContent(prev.certificateType, target),
                      }));
                    }}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-fill Standard Legal Template</span>
                  </button>
                </div>
                <textarea
                  value={certFormData.content}
                  onChange={(e) => setCertFormData({ ...certFormData, content: e.target.value })}
                  rows={8}
                  className="input w-full leading-relaxed font-sans"
                  placeholder="Official certificate body text..."
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="btn btn-secondary h-10 px-5 text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issuingLoading}
                  className="btn btn-primary h-10 px-6 text-xs font-bold uppercase flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                  }}
                >
                  {issuingLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{issuingLoading ? 'Issuing...' : selectedTargetUserIds.length > 1 ? `Issue to ${selectedTargetUserIds.length} Employees` : 'Issue & Archive Certificate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

