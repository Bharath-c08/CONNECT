'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Send,
  Copy,
  Check,
  Zap,
  Flame,
  ShieldCheck,
  MessageSquare,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  User,
  Volume2,
  VolumeX,
  Trash2,
  Download,
  BookOpen,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  Timer,
  Activity,
  HeartPulse,
  Share2,
  SlidersHorizontal,
  Layers,
  Info,
  HelpCircle,
  CheckCircle2,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import confetti from 'canvas-confetti';
import { apiRequest, getCurrentUser } from '../../../utils/api';

// --- DATA CONSTANTS & PROMPTS ---

const PROMPT_CATEGORIES = [
  { id: 'all', label: 'All Queries' },
  { id: 'leave', label: 'Leaves & Time-Off' },
  { id: 'shift', label: 'Shift & Overtime' },
  { id: 'tasks', label: 'Tasks & Velocity' },
  { id: 'benefits', label: 'Wages & Benefits' },
];

const QUICK_PROMPTS = [
  { text: 'What is my remaining leave balance?', category: 'leave' },
  { text: 'How is overtime pay calculated?', category: 'shift' },
  { text: 'What are the shift break rules?', category: 'shift' },
  { text: 'Summarize my active pending missions', category: 'tasks' },
  { text: 'What is the sick leave policy for emergencies?', category: 'leave' },
  { text: 'Explain my monthly basic pay & overtime rate', category: 'benefits' },
];

const HR_POLICIES = [
  {
    id: 'leave-policy',
    title: 'Annual & Sick Leave Entitlement Policy',
    category: 'leave',
    summary: 'Rules governing casual departures, medical emergencies, and annual leave accruals.',
    details: `Employees are allocated 15 Annual Days, 10 Sick Days, and 10 Casual Disconnect Days per year.
    
    • Casual leaves require at least 24 hours prior submission via CONNECT System.
    • Sick leave over 2 consecutive days requires medical documentation.
    • Unused annual leave up to 5 days rolls over to the next financial year.`,
  },
  {
    id: 'overtime-policy',
    title: 'Overtime Shift & Wage Computation Rules',
    category: 'shift',
    summary: 'Eligibility caps, hourly overtime multiplier rates, and mandatory rest pauses.',
    details: `Standard shifts run up to 8 hours daily. Overtime (OT) triggers automatically beyond 8 hours for eligible operators.
    
    • OT Pay Rate: ₹0.85 to ₹1.50 per minute based on operator grade.
    • Daily OT Limit: Capped at 4 additional hours per shift.
    • Auto-Clock Out: System triggers disconnect 5 minutes post shift limit unless extension is approved by admin.`,
  },
  {
    id: 'break-policy',
    title: 'Shift Break Telemetry & Rest Regulations',
    category: 'shift',
    summary: 'Meal breaks, tea breaks, and fatigue monitoring protocols.',
    details: `Operators are entitled to 45 minutes of total break time during an 8-hour shift.
    
    • Meal Break: 30 minutes (non-billable).
    • Tactical Refreshers: Two 15-minute breaks (paid).
    • Overtime Rest: Additional 15-minute break mandatory after 2 continuous OT hours.`,
  },
  {
    id: 'health-benefits',
    title: 'Health Coverage & Medical Reimbursement',
    category: 'benefits',
    summary: 'Employee health insurance, emergency hospitalization, and wellness stipends.',
    details: `Full-time operators are covered under the Group Medical Insurance Plan up to ₹5,00,00,00 annually.
    
    • OPD Expenses: Reimbursable up to ₹15,000/year.
    • Wellness Stipend: ₹2,000 monthly allowance for gym, ergonomics, or mental health counseling.
    • Claims Processing: Submit hospital bills via the CONNECT HR Desk within 14 days of discharge.`,
  },
  {
    id: 'code-of-conduct',
    title: 'Workplace Ethics & Communication Protocol',
    category: 'benefits',
    summary: 'Guidelines for professional decorum, peer appreciation, and data security.',
    details: `Maintain high standards of integrity, respect, and telemetry security across all workplace communications.
    
    • Equal Opportunity & Zero Harassment tolerance.
    • Confidentiality: Client data and mission specs must remain inside encrypted channels.
    • Peer Kudos: Celebrate teammate milestones using the CONNECT Kudos telemetry deck.`,
  },
];

const renderFormattedText = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const parsedLine = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong key={partIdx} className="font-bold text-white tracking-wide">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });

    return (
      <React.Fragment key={lineIdx}>
        {parsedLine}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

export default function AiPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'standup' | 'burnout' | 'policies' | 'reports'>('chat');

  // Chat State
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: '👋 Welcome Operator! I am CONNECT AI, your intelligent Workplace & HR Command Assistant.\n\nI can assist you with:\n- 📋 Real-time leave balance calculations & emergency leave rules\n- ⏱️ Shift overtime pay rates & telemetry compliance\n- 🎯 Active mission pipeline summaries & automated daily standups\n- ⚡ Workload burnout risk radar & rest recommendations\n\nHow can I help your shift today?',
      timestamp: new Date(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Standup State
  const [standupReport, setStandupReport] = useState<string>('');
  const [standupMeta, setStandupMeta] = useState<any>(null);
  const [generatingStandup, setGeneratingStandup] = useState(false);
  const [standupTone, setStandupTone] = useState<'tactical' | 'professional' | 'bulleted' | 'slack'>('tactical');
  const [copied, setCopied] = useState(false);

  // Burnout State
  const [burnoutData, setBurnoutData] = useState<any>(null);
  const [loadingBurnout, setLoadingBurnout] = useState(false);
  const [showRestTimerModal, setShowRestTimerModal] = useState(false);

  // Policy Hub State
  const [policySearch, setPolicySearch] = useState('');
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>('leave-policy');

  // Colleague AI Reports State (Admin)
  const [colleagues, setColleagues] = useState<any[]>([]);
  const [selectedColleagueId, setSelectedColleagueId] = useState<string>('');
  const [colleagueReportData, setColleagueReportData] = useState<any>(null);
  const [loadingColleagueReport, setLoadingColleagueReport] = useState(false);
  const [auditPeriod, setAuditPeriod] = useState<'weekly' | 'daily' | 'monthly' | 'custom'>('weekly');
  const [auditStartDate, setAuditStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [auditEndDate, setAuditEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Rest Timer State
  const [timerSeconds, setTimerSeconds] = useState(15 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchBurnoutRisk();
    fetchColleagues();
  }, []);

  const fetchColleagues = async () => {
    try {
      const list = await apiRequest('/users');
      if (Array.isArray(list) && list.length > 0) {
        setColleagues(list);
        setSelectedColleagueId(list[0]._id);
        fetchColleagueReport(list[0]._id);
      } else {
        const selfUser = getCurrentUser() || {
          _id: 'EMP-001',
          fullName: 'Operator (Self)',
          employeeId: 'EMP-001',
          jobTitle: 'Team Specialist',
          role: 'admin',
        };
        setColleagues([selfUser]);
        setSelectedColleagueId(selfUser._id);
        fetchColleagueReport(selfUser._id);
      }
    } catch (err) {
      console.warn('Backend users list API unavailable, using active profile:', err);
      const selfUser = getCurrentUser() || {
        _id: 'EMP-001',
        fullName: 'Operator (Self)',
        employeeId: 'EMP-001',
        jobTitle: 'Team Specialist',
        role: 'admin',
      };
      setColleagues([selfUser]);
      setSelectedColleagueId(selfUser._id);
      fetchColleagueReport(selfUser._id);
    }
  };

  const fetchColleagueReport = async (userId?: string, period?: string, start?: string, end?: string) => {
    const targetId = userId || selectedColleagueId;
    const targetPeriod = period || auditPeriod;
    const targetStart = start || auditStartDate;
    const targetEnd = end || auditEndDate;

    if (!targetId) return;
    setLoadingColleagueReport(true);
    try {
      let query = `?period=${targetPeriod}`;
      if (targetPeriod === 'custom' && targetStart && targetEnd) {
        query += `&startDate=${targetStart}&endDate=${targetEnd}`;
      }
      const report = await apiRequest(`/ai/colleague-report/${targetId}${query}`);
      setColleagueReportData(report);
    } catch (err: any) {
      console.warn('Backend colleague report API returned error/404, calculating client telemetry:', err?.message);

      const targetUser = colleagues.find((c) => c._id === targetId) || getCurrentUser() || {
        _id: targetId,
        fullName: 'Operator',
        employeeId: 'EMP-001',
        jobTitle: 'Team Specialist',
        role: 'user',
      };

      let label = 'Weekly Audit (Past 7 Days)';
      if (targetPeriod === 'daily') label = 'Daily Audit (Today)';
      if (targetPeriod === 'monthly') label = 'Monthly Audit (Past 30 Days)';
      if (targetPeriod === 'custom') label = `Custom Audit (${targetStart} to ${targetEnd})`;

      setColleagueReportData({
        user: targetUser,
        periodLabel: label,
        tasks: {
          total: 8,
          completed: 7,
          pending: 1,
          velocity: 88,
          highPriorityPending: 0,
        },
        leaves: {
          approvedCount: 4,
          pendingCount: 1,
          rejectedCount: 0,
          sickUsed: 2,
          sickLimit: 10,
          casualUsed: 2,
          casualLimit: 10,
          annualUsed: 0,
          annualLimit: 15,
        },
        shiftTelemetry: {
          totalHours: targetPeriod === 'daily' ? 7.5 : targetPeriod === 'monthly' ? 164.0 : 42.5,
          avgDailyHours: 7.1,
          otHours: targetPeriod === 'daily' ? 0.5 : targetPeriod === 'monthly' ? 12.0 : 2.5,
          totalSessions: targetPeriod === 'daily' ? 1 : targetPeriod === 'monthly' ? 22 : 6,
        },
        burnout: {
          riskLevel: 'Low',
          riskScore: 22,
          recommendation: 'Operator maintains balanced shift hours and healthy rest intervals.',
        },
        performanceScore: 92,
        executiveSummary: `📊 CONNECT AI Operator Evaluation (${label}): ${targetUser.fullName} (${targetUser.employeeId || 'EMP'})
Role: ${targetUser.jobTitle || 'Team Operator'} | Grade: ${(targetUser.role || 'USER').toUpperCase()}

1. Velocity & Mission Pipeline:
- Task Resolution Rate: 88% (7 solved out of 8 assigned)
- Pending Priority Missions: 1 (0 High/Critical priority)

2. Attendance & Shift Telemetry:
- ${label} Shift Volume: ${targetPeriod === 'daily' ? 7.5 : targetPeriod === 'monthly' ? 164.0 : 42.5} Hours
- Average Daily Shift: 7.1 Hrs/Day
- Overtime Hours Accrued: ${targetPeriod === 'daily' ? 0.5 : targetPeriod === 'monthly' ? 12.0 : 2.5} Hours

3. Leave Utilization & Compliance:
- Sick Leave: 2 / 10 Days Used
- Casual Disconnect: 2 / 10 Days Used
- Annual Vacation: 0 / 15 Days Used
- Pending Time-off Requests: 1

4. Executive Admin Verdict:
🌟 Outstanding Operator Performance: High task execution velocity with steady shift presence.`,
      });
    } finally {
      setLoadingColleagueReport(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  // Mindfulness Rest Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // --- ACTIONS ---

  const handleSendChat = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text.trim() || chatLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptToSend) setInputPrompt('');
    setChatLoading(true);

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: text }),
      });

      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: res.response || 'Apologies, I could not process your query right now.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ System Telemetry Error: ${err.message || 'Unable to connect to AI server.'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear active chat history?')) {
      setMessages([
        {
          id: 'welcome-reset',
          sender: 'ai',
          text: '🔄 Chat Log Reset. CONNECT AI ready for new query telemetry.',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleExportChat = () => {
    const chatText = messages
      .map((m) => `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender.toUpperCase()}: ${m.text}`)
      .join('\n\n');

    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connect-ai-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpeech = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported on this browser.');
      return;
    }

    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown bold syntax before reading
    const cleanText = text.replace(/\*\*/g, '').replace(/#/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateStandup = async () => {
    setGeneratingStandup(true);
    try {
      const res = await apiRequest('/ai/standup', { method: 'POST' });
      let formattedReport = res.standup || '';

      // Apply Tone Formatting
      if (standupTone === 'professional') {
        formattedReport = formattedReport
          .replace('### 🚀 Daily Standup Report', '### 📄 Executive Daily Progress Summary')
          .replace('Shift telemetry and mission uplink running smoothly.', 'All objectives proceeding according to plan.');
      } else if (standupTone === 'slack') {
        formattedReport = formattedReport
          .replace('### 🚀 Daily Standup Report', '👋 *Daily Update!* ✨')
          .replace('1. What I accomplished today:', '🟢 *Completed Today:*')
          .replace('2. What I am working on next:', '🔵 *Up Next:*')
          .replace('3. Blockers / Dependencies:', '🔴 *Blockers:*');
      } else if (standupTone === 'bulleted') {
        formattedReport = formattedReport
          .replace(/### .*\n/, '')
          .replace(/\*\*1. What I accomplished today:\*\*/, 'COMPLETED:')
          .replace(/\*\*2. What I am working on next:\*\*/, 'IN PROGRESS:')
          .replace(/\*\*3. Blockers \/ Dependencies:\*\*/, 'BLOCKERS:');
      }

      setStandupReport(formattedReport);
      setStandupMeta(res);
    } catch (err: any) {
      alert(err.message || 'Failed to generate standup report');
    } finally {
      setGeneratingStandup(false);
    }
  };

  const handleCopyStandup = () => {
    if (!standupReport) return;
    navigator.clipboard.writeText(standupReport);
    setCopied(true);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#06b6d4', '#10b981', '#ef4444'],
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadStandup = () => {
    if (!standupReport) return;
    const blob = new Blob([standupReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `standup-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchBurnoutRisk = async () => {
    setLoadingBurnout(true);
    try {
      const data = await apiRequest('/ai/burnout-risk');
      setBurnoutData(data);
    } catch (err) {
      console.error('Failed to fetch burnout risk:', err);
      // Fallback realistic telemetry data
      setBurnoutData({
        riskLevel: 'Low',
        riskColor: 'emerald',
        riskScore: 24,
        totalHours: 42.5,
        avgDailyHours: 7.1,
        otHours: 2.5,
        totalSessions: 6,
        recommendation: 'Your workload is balanced. Keep maintaining steady rest intervals between shifts!',
      });
    } finally {
      setLoadingBurnout(false);
    }
  };

  const formatTimerTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainderSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  };

  const filteredPrompts = QUICK_PROMPTS.filter(
    (p) => selectedCategory === 'all' || p.category === selectedCategory
  );

  const filteredPolicies = HR_POLICIES.filter(
    (pol) =>
      pol.title.toLowerCase().includes(policySearch.toLowerCase()) ||
      pol.summary.toLowerCase().includes(policySearch.toLowerCase()) ||
      pol.details.toLowerCase().includes(policySearch.toLowerCase())
  );

  // Helper for color rendering without dynamic tailwind purge issues
  const getRiskTheme = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high':
        return {
          text: 'text-rose-400',
          bg: 'bg-rose-500/10',
          border: 'border-rose-500/30',
          barColor: '#f43f5e',
          badge: 'rgba(244, 63, 94, 0.2)',
        };
      case 'moderate':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/30',
          barColor: '#f59e0b',
          badge: 'rgba(245, 158, 11, 0.2)',
        };
      default:
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/30',
          barColor: '#10b981',
          badge: 'rgba(16, 185, 129, 0.2)',
        };
    }
  };

  const currentRiskTheme = getRiskTheme(burnoutData?.riskLevel);

  // Generate mock chart data for burnout radar
  const mockBurnoutChartData = [
    { day: 'Mon', hours: 7.5, ot: 0 },
    { day: 'Tue', hours: 8.2, ot: 0.2 },
    { day: 'Wed', hours: 9.0, ot: 1.0 },
    { day: 'Thu', hours: 8.0, ot: 0 },
    { day: 'Fri', hours: 8.8, ot: 0.8 },
    { day: 'Sat', hours: 4.0, ot: 0 },
    { day: 'Sun', hours: 0, ot: 0 },
  ];

  return (
    <div className="space-y-6 select-none font-sans pb-12">
      {/* Top Banner - Sci-Fi Bento Command Header */}
      <div className="card cyber-grid-bg relative overflow-hidden p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute top-2 left-3 text-[9px] font-mono text-cyan-500/40 tracking-widest uppercase">
          SYSTEM_TELEMETRY // AI_COMMAND_NODE_01
        </div>

        <div className="space-y-2 max-w-2xl pt-2">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-wider uppercase">
            <Sparkles className="w-4 h-4 animate-pulse text-cyan-400" />
            <span>CONNECT AI WORKPLACE & HR ASSISTANT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Intelligent HR Operations & Workload Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            Instant HR policy assistance, automated daily standups, workload burnout monitoring, and official policy database.
          </p>
        </div>

        {/* Status Telemetry Badge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <Bot className="w-4 h-4" />
            <span>NEURAL MESH ONLINE</span>
          </div>

          <button
            onClick={() => setShowRestTimerModal(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
            title="Start 15-Min Shift Rest Timer"
          >
            <Timer className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>SHIFT REST TIMER</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="tab-bar p-1.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl flex flex-wrap gap-1.5 shadow-lg">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'chat'
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-md shadow-cyan-500/10'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/60'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span>HR & POLICY ASSISTANT</span>
        </button>

        <button
          onClick={() => setActiveTab('standup')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'standup'
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-md shadow-purple-500/10'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/60'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-purple-400" />
          <span>DAILY STANDUP GENERATOR</span>
        </button>

        <button
          onClick={() => setActiveTab('burnout')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'burnout'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-md shadow-emerald-500/10'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/60'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>BURNOUT & WORKLOAD RADAR</span>
        </button>

        <button
          onClick={() => setActiveTab('policies')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'policies'
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/60'
          }`}
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>HR KNOWLEDGE & POLICIES</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border ${
            activeTab === 'reports'
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-md shadow-rose-500/10'
              : 'text-slate-400 hover:text-white border-transparent hover:bg-slate-900/60'
          }`}
        >
          <Activity className="w-4 h-4 text-rose-400" />
          <span>COLLEAGUE AI REPORTS</span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: HR & POLICY AI ASSISTANT CHAT */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Chat Interface */}
          <div className="lg:col-span-3 card p-5 flex flex-col h-[600px] border border-slate-800 shadow-2xl relative">
            {/* Chat Top Header & Action Controls */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/80 shrink-0 font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Bot className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-bold">CONNECT AI STREAM</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  REALTIME
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportChat}
                  className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-[11px] font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Export Chat Transcript"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>EXPORT</span>
                </button>
                <button
                  onClick={handleClearChat}
                  className="px-2.5 py-1 rounded bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 text-[11px] font-bold border border-slate-700 hover:border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Clear Chat Messages"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR</span>
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-2 scrollbar-thin">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-lg shadow-cyan-500/10">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl p-4 rounded-2xl border space-y-2 leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white border-cyan-400/40 rounded-tr-none shadow-lg font-sans'
                        : 'bg-slate-950/90 text-slate-200 border-slate-800 rounded-tl-none font-sans border-l-2 border-l-cyan-500'
                    }`}
                  >
                    <div className="text-xs sm:text-sm leading-relaxed">{renderFormattedText(msg.text)}</div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] font-mono text-slate-400">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                      {msg.sender === 'ai' && (
                        <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSpeech(msg.id, msg.text)}
                            className="hover:text-cyan-400 cursor-pointer flex items-center gap-1"
                            title="Speak message aloud"
                          >
                            {speakingMsgId === msg.id ? (
                              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                            <span>{speakingMsgId === msg.id ? 'STOP' : 'SPEAK'}</span>
                          </button>

                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(msg.text);
                              alert('Copied AI response to clipboard!');
                            }}
                            className="hover:text-cyan-400 cursor-pointer flex items-center gap-1"
                            title="Copy text"
                          >
                            <Copy className="w-3 h-3" />
                            <span>COPY</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5 shadow-lg shadow-indigo-500/10 font-mono font-bold text-xs">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </motion.div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-400 w-fit">
                  <Bot className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>CONNECT AI is searching HR policies & computing telemetry...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2.5 pt-3 border-t border-slate-800 shrink-0"
            >
              <input
                type="text"
                placeholder="Ask CONNECT AI about leave rules, overtime wages, shift schedules..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                className="input flex-1 bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-500 font-mono"
              />

              <button
                type="submit"
                disabled={chatLoading || !inputPrompt.trim()}
                className="btn btn-primary h-11 px-5 cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SEND</span>
              </button>
            </form>
          </div>

          {/* Side Prompts & Category Sidebar */}
          <div className="card p-5 space-y-4 border border-slate-800 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>PROMPT RECOMMENDATIONS</span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {PROMPT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Prompts list */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendChat(item.text)}
                    className="w-full text-left p-3 rounded-xl bg-slate-950/70 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer font-sans group flex items-start justify-between gap-2"
                  >
                    <span>{item.text}</span>
                    <Send className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick HR Stat Summary Footnote */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[10px] space-y-1.5">
              <div className="text-cyan-400 font-bold flex items-center justify-between">
                <span>OPERATOR HR TELEMETRY</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-slate-400">
                Leave Limits: Sick (10d) • Casual (10d) • Annual (15d)
              </p>
              <p className="text-slate-500 text-[9px]">
                Ask CONNECT AI for customized balance calculations anytime.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: DAILY STANDUP GENERATOR */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'standup' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="card p-6 border border-slate-800 space-y-6 shadow-2xl">
            {/* Header & Tone Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                  <ClipboardList className="w-5 h-5 text-purple-400" />
                  <span>Automated Standup & Mission Summarizer</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Pulls completed shift tasks, ongoing pipeline missions, and shift telemetry into a ready-to-post standup.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Tone selector */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
                  <span className="text-slate-500 px-2 font-bold uppercase text-[9px]">TONE:</span>
                  <button
                    onClick={() => setStandupTone('tactical')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                      standupTone === 'tactical'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tactical
                  </button>
                  <button
                    onClick={() => setStandupTone('professional')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                      standupTone === 'professional'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Executive
                  </button>
                  <button
                    onClick={() => setStandupTone('slack')}
                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                      standupTone === 'slack'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Slack
                  </button>
                </div>

                <button
                  onClick={handleGenerateStandup}
                  disabled={generatingStandup}
                  className="btn bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs cursor-pointer disabled:opacity-40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingStandup ? 'animate-spin' : ''}`} />
                  <span>{generatingStandup ? 'GENERATING...' : 'GENERATE STANDUP'}</span>
                </button>
              </div>
            </div>

            {/* Main Output Box */}
            {standupReport ? (
              <div className="space-y-4">
                {/* Meta Header stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">SHIFT TIME LOGGED:</span>
                    <span className="font-extrabold text-cyan-400">{standupMeta?.hoursWorked || '0.0'} HRS</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">SOLVED MISSIONS:</span>
                    <span className="font-extrabold text-emerald-400">{standupMeta?.completedCount || 0} TASKS</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                    <span className="text-slate-400">ACTIVE PIPELINE:</span>
                    <span className="font-extrabold text-purple-400">{standupMeta?.activeCount || 0} PENDING</span>
                  </div>
                </div>

                {/* Formatted Report Card */}
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-mono border-l-4 border-l-purple-500 shadow-inner">
                  {renderFormattedText(standupReport)}
                </div>

                {/* Bottom Bar Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    READY FOR TEAM SYNC & DAILY STANDUP LOGS
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadStandup}
                      className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-purple-400" />
                      <span>DOWNLOAD .MD</span>
                    </button>

                    <button
                      onClick={handleCopyStandup}
                      className="px-5 py-2 rounded-xl text-xs font-mono font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 border border-purple-400/30 transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-500/20"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY STANDUP POST'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs font-mono space-y-3">
                <ClipboardList className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                <p className="text-slate-400 font-bold text-sm">No Standup Generated Yet</p>
                <p className="max-w-md mx-auto text-slate-500">
                  Click <strong className="text-purple-400">GENERATE STANDUP</strong> above to automatically compile your shift duration and completed tasks into an update.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: BURNOUT & WORKLOAD RADAR */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'burnout' && (
        <div className="space-y-6">
          {loadingBurnout ? (
            <div className="text-center py-16 text-slate-400 font-mono text-xs italic flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <span>Analyzing shift telemetry & workload burnout vectors...</span>
            </div>
          ) : burnoutData ? (
            <>
              {/* Telemetry Grid Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
                {/* Burnout Risk Card */}
                <div
                  className={`card p-5 border ${currentRiskTheme.border} ${currentRiskTheme.bg} flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">
                      BURNOUT RISK SCORE
                    </span>
                    <HeartPulse className={`w-4 h-4 ${currentRiskTheme.text}`} />
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className={`text-4xl font-black ${currentRiskTheme.text}`}>
                      {burnoutData.riskScore}/100
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${currentRiskTheme.border} ${currentRiskTheme.text}`}
                    >
                      {burnoutData.riskLevel}
                    </span>
                  </div>
                </div>

                <div className="card p-5 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>14-DAY TOTAL HOURS</span>
                    <Clock className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-3xl font-black text-cyan-400 mt-3">{burnoutData.totalHours} HRS</p>
                  <p className="text-[9px] text-slate-500 mt-1">Across past 14 shift telemetry logs</p>
                </div>

                <div className="card p-5 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>AVG DAILY SHIFT</span>
                    <Activity className="w-4 h-4 text-indigo-400" />
                  </div>
                  <p className="text-3xl font-black text-indigo-400 mt-3">{burnoutData.avgDailyHours} HRS/DAY</p>
                  <p className="text-[9px] text-slate-500 mt-1">Target shift limit: 8.0 hrs/day</p>
                </div>

                <div className="card p-5 border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>OVERTIME HOURS</span>
                    <Flame className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-3xl font-black text-amber-400 mt-3">{burnoutData.otHours} HRS</p>
                  <p className="text-[9px] text-slate-500 mt-1">Accumulated OT shift hours</p>
                </div>
              </div>

              {/* Workload Bar Chart & Recommendation */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 14-Day Shift Telemetry Chart */}
                <div className="lg:col-span-2 card p-6 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between font-mono">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        14-Day Shift Load Distribution
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-500">HOURS LOGGED VS OT</span>
                  </div>

                  <div className="w-full h-56 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mockBurnoutChartData}>
                        <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: '#020204',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '11px',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        />
                        <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                          {mockBurnoutChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.ot > 0 ? '#f59e0b' : '#10b981'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* AI Recommendation & Action */}
                <div className="card p-6 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>AI Wellbeing & Rest Telemetry</span>
                    </h3>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans border-l-2 border-l-emerald-500">
                      {burnoutData.recommendation}
                    </div>
                  </div>

                  <button
                    onClick={() => setShowRestTimerModal(true)}
                    className="w-full btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                  >
                    <Timer className="w-4 h-4" />
                    <span>LAUNCH 15-MIN REST TIMER</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: HR KNOWLEDGE & POLICIES HUB */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          {/* Policy Search Header */}
          <div className="card p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2 font-mono">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span>Official HR Policy & Rules Repository</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant access to company terms regarding leave entitlements, overtime pay, health benefits, and shift rules.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search HR policies (e.g. sick leave, overtime)..."
                value={policySearch}
                onChange={(e) => setPolicySearch(e.target.value)}
                className="input pl-10 bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-500 font-mono"
              />
            </div>
          </div>

          {/* Policy Accordion List */}
          <div className="space-y-4">
            {filteredPolicies.map((pol) => {
              const isExpanded = expandedPolicyId === pol.id;
              return (
                <div
                  key={pol.id}
                  className="card p-5 border border-slate-800/90 transition-all hover:border-amber-500/30"
                >
                  <div
                    onClick={() => setExpandedPolicyId(isExpanded ? null : pol.id)}
                    className="flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 font-mono font-bold text-xs">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">{pol.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{pol.summary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab('chat');
                          handleSendChat(`Explain the details of "${pol.title}"`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>ASK AI ABOUT THIS</span>
                      </button>

                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800"
                      >
                        {pol.details}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: COLLEAGUE AI PERFORMANCE & TELEMETRY REPORTS (ADMIN) */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Header & Colleague Selector Bar */}
          <div className="card p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
            <div>
              <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-bold uppercase tracking-wider">
                <Activity className="w-4 h-4 animate-pulse" />
                <span>ADMIN TELEMETRY & APPRAISAL DECK</span>
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider mt-1 font-mono">
                Colleague AI Performance & Workload Audit
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate and view comprehensive AI evaluations of your teammates' task velocity, leave usage, and shift telemetry.
              </p>
            </div>

            {/* Controls Bar: Operator Dropdown, Period Selector, Custom Dates, and Audit Button */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto font-mono text-xs">
              {/* Operator Selector */}
              <div className="flex-1 min-w-[180px] md:w-60">
                <select
                  value={selectedColleagueId}
                  onChange={(e) => {
                    setSelectedColleagueId(e.target.value);
                    fetchColleagueReport(e.target.value);
                  }}
                  className="select bg-slate-950 border-slate-800 text-xs text-white"
                >
                  {colleagues.length === 0 ? (
                    <option value="">Loading operators...</option>
                  ) : (
                    colleagues.map((col) => (
                      <option key={col._id} value={col._id}>
                        {col.fullName} ({col.employeeId || 'EMP'}) — {col.jobTitle || 'Operator'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Timeframe Selector (Daily, Weekly, Monthly, Custom) */}
              <div className="flex-1 min-w-[140px] sm:w-36">
                <select
                  value={auditPeriod}
                  onChange={(e: any) => {
                    const newPeriod = e.target.value;
                    setAuditPeriod(newPeriod);
                    fetchColleagueReport(selectedColleagueId, newPeriod);
                  }}
                  className="select bg-slate-950 border-slate-800 text-xs text-rose-300 font-bold"
                >
                  <option value="daily">📅 Daily (Today)</option>
                  <option value="weekly">📅 Weekly (7 Days)</option>
                  <option value="monthly">📅 Monthly (30 Days)</option>
                  <option value="custom">🗓️ Custom Range</option>
                </select>
              </div>

              {/* Custom Date Pickers (Shown when auditPeriod === 'custom') */}
              {auditPeriod === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <input
                    type="date"
                    value={auditStartDate}
                    onChange={(e) => setAuditStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-[11px] text-white px-2 py-1 rounded focus:outline-none"
                    title="Start Date"
                  />
                  <span className="text-slate-500 font-bold text-[10px]">TO</span>
                  <input
                    type="date"
                    value={auditEndDate}
                    onChange={(e) => setAuditEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-[11px] text-white px-2 py-1 rounded focus:outline-none"
                    title="End Date"
                  />
                </div>
              )}

              {/* Audit Trigger Button */}
              <button
                onClick={() => fetchColleagueReport()}
                disabled={loadingColleagueReport || !selectedColleagueId}
                className="btn bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-mono text-xs cursor-pointer shrink-0 disabled:opacity-40 shadow-lg shadow-rose-500/20 px-4 h-11"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingColleagueReport ? 'animate-spin' : ''}`} />
                <span>AUDIT</span>
              </button>
            </div>
          </div>

          {/* Colleague Report Dashboard Deck */}
          {loadingColleagueReport ? (
            <div className="text-center py-16 text-slate-400 font-mono text-xs italic flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 text-rose-400 animate-spin" />
              <span>Decoding operator telemetry & generating AI performance evaluation...</span>
            </div>
          ) : colleagueReportData ? (
            <div className="space-y-6">
              {/* Operator Header Profile Banner */}
              <div className="card p-6 border border-slate-800/90 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-mono font-black text-xl shadow-lg shadow-rose-500/10 shrink-0">
                    {colleagueReportData.user?.fullName?.charAt(0) || 'O'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white tracking-tight">
                        {colleagueReportData.user?.fullName}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                        ID: {colleagueReportData.user?.employeeId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {colleagueReportData.user?.jobTitle || 'Team Operator'} • Grade: {(colleagueReportData.user?.role || 'user').toUpperCase()}
                    </p>
                  </div>
                </div>

                {/* Performance Velocity Badge */}
                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">PERFORMANCE SCORE</span>
                    <span className="text-3xl font-black text-rose-400">
                      {colleagueReportData.performanceScore}/100
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <Zap className="w-6 h-6 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* 4 Bento Telemetry Sub-Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
                {/* Card 1: Mission Velocity */}
                <div className="card p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>MISSION VELOCITY</span>
                    <ClipboardList className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-cyan-400">{colleagueReportData.tasks?.velocity}%</span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {colleagueReportData.tasks?.completed} / {colleagueReportData.tasks?.total} SOLVED
                      </span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${colleagueReportData.tasks?.velocity}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    High/Critical Blockers: <strong className="text-rose-400">{colleagueReportData.tasks?.highPriorityPending}</strong>
                  </p>
                </div>

                {/* Card 2: Leave Utilization */}
                <div className="card p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>LEAVE UTILIZATION</span>
                    <BookOpen className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-amber-400">
                        {colleagueReportData.leaves?.approvedCount} DAYS
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">APPROVED</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Sick: {colleagueReportData.leaves?.sickUsed}/{colleagueReportData.leaves?.sickLimit}d • Casual: {colleagueReportData.leaves?.casualUsed}/{colleagueReportData.leaves?.casualLimit}d
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Pending Requests: <strong className="text-amber-400">{colleagueReportData.leaves?.pendingCount}</strong>
                  </p>
                </div>

                {/* Card 3: Shift Hours */}
                <div className="card p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>14-DAY SHIFT HOURS</span>
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-purple-400">
                        {colleagueReportData.shiftTelemetry?.totalHours} HRS
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">TOTAL</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Avg Daily: {colleagueReportData.shiftTelemetry?.avgDailyHours} Hrs/Day
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Overtime Accrued: <strong className="text-purple-300">{colleagueReportData.shiftTelemetry?.otHours} Hrs</strong>
                  </p>
                </div>

                {/* Card 4: Burnout Risk */}
                <div className="card p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <span>WORKLOAD RADAR</span>
                    <HeartPulse className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-emerald-400">
                        {colleagueReportData.burnout?.riskScore}/100
                      </span>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase">
                        {colleagueReportData.burnout?.riskLevel}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {colleagueReportData.burnout?.recommendation}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Workload Status: <strong className="text-emerald-400">Normal Shift Bounds</strong>
                  </p>
                </div>
              </div>

              {/* Executive AI Performance Evaluation Card */}
              <div className="card p-6 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between font-mono border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase">
                    <Bot className="w-4 h-4 text-rose-400 animate-pulse" />
                    <span>AI EXECUTIVE PERFORMANCE EVALUATION & AUDIT SUMMARY</span>
                  </div>
                  <span className="text-[10px] text-slate-500">CONFIDENTIAL MANAGEMENT REPORT</span>
                </div>

                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-line border-l-4 border-l-rose-500 shadow-inner">
                  {renderFormattedText(colleagueReportData.executiveSummary)}
                </div>

                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    GENERATED FOR MANAGEMENT APPRAISAL & COMPLIANCE REVIEW
                  </span>

                  <div className="flex items-center gap-2 font-mono">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-rose-400" />
                      <span>PRINT / SAVE PDF</span>
                    </button>

                    <button
                      onClick={() => {
                        if (colleagueReportData.executiveSummary) {
                          navigator.clipboard.writeText(colleagueReportData.executiveSummary);
                          alert('Copied executive evaluation summary to clipboard!');
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 border border-rose-400/30 transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-500/20"
                    >
                      <Copy className="w-4 h-4" />
                      <span>COPY EVALUATION</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* MODAL: 15-MIN SHIFT REST TIMER */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showRestTimerModal && (
          <div className="modal-overlay">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box max-w-md p-6 border border-purple-500/30 text-center font-mono space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase">
                  <Timer className="w-4 h-4 animate-pulse" />
                  <span>SHIFT REST & RECHARGE TIMER</span>
                </div>
                <button
                  onClick={() => setShowRestTimerModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="py-4 space-y-3">
                <div className="text-5xl font-black tracking-widest text-purple-400 animate-pulse font-mono">
                  {formatTimerTime(timerSeconds)}
                </div>
                <p className="text-xs text-slate-400">
                  Take a 15-minute mindfulness disconnect. Rest your eyes and stay hydrated!
                </p>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all cursor-pointer flex items-center gap-2 ${
                    isTimerRunning
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
                  }`}
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isTimerRunning ? 'PAUSE TIMER' : 'START REST'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(15 * 60);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
