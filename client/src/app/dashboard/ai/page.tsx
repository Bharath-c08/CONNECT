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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest, getCurrentUser } from '../../../utils/api';

const QUICK_PROMPTS = [
  'What is my remaining leave balance?',
  'How is overtime pay calculated?',
  'What are the shift break rules?',
  'Summarize my active pending missions',
];

export default function AiPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'standup' | 'burnout'>('chat');

  // Chat State
  const [messages, setMessages] = useState<any[]>([
    {
      sender: 'ai',
      text: '👋 Hello! I am **CONNECT AI**, your HR & Workplace Assistant. How can I help you today with leave policies, overtime rules, or task pipelines?',
      timestamp: new Date(),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Standup State
  const [standupReport, setStandupReport] = useState<string>('');
  const [standupMeta, setStandupMeta] = useState<any>(null);
  const [generatingStandup, setGeneratingStandup] = useState(false);
  const [copied, setCopied] = useState(false);

  // Burnout State
  const [burnoutData, setBurnoutData] = useState<any>(null);
  const [loadingBurnout, setLoadingBurnout] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchBurnoutRisk();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendChat = async (promptToSend?: string) => {
    const text = promptToSend || inputPrompt;
    if (!text.trim() || chatLoading) return;

    const userMsg = { sender: 'user', text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptToSend) setInputPrompt('');
    setChatLoading(true);

    try {
      const res = await apiRequest('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: text }),
      });

      const aiMsg = {
        sender: 'ai',
        text: res.response || 'Sorry, I could not process your query right now.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ Error processing query: ${err.message || 'Server error'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateStandup = async () => {
    setGeneratingStandup(true);
    try {
      const res = await apiRequest('/ai/standup', { method: 'POST' });
      setStandupReport(res.standup || '');
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
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#06b6d4', '#10b981', '#3b82f6'],
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const fetchBurnoutRisk = async () => {
    setLoadingBurnout(true);
    try {
      const data = await apiRequest('/ai/burnout-risk');
      setBurnoutData(data);
    } catch (err) {
      console.error('Failed to fetch burnout risk:', err);
    } finally {
      setLoadingBurnout(false);
    }
  };

  return (
    <div className="space-y-6 select-none font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-indigo-950/40 backdrop-blur-lg border-cyan-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs tracking-wider uppercase font-bold">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>// INTELLIGENT_WORKSPACE</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">CONNECT AI Workplace & HR Assistant</h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Instant HR policy support, automated daily standup creation, and workload burnout risk monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
          <Bot className="w-4 h-4 animate-spin" style={{ animationDuration: '6s' }} />
          <span>CONNECT_AI v1.0 ONLINE</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
            activeTab === 'chat'
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>HR & POLICY ASSISTANT</span>
        </button>

        <button
          onClick={() => setActiveTab('standup')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
            activeTab === 'standup'
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>DAILY STANDUP GENERATOR</span>
        </button>

        <button
          onClick={() => setActiveTab('burnout')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 ${
            activeTab === 'burnout'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>BURNOUT & WORKLOAD RADAR</span>
        </button>
      </div>

      {/* Tab 1: Interactive Chat */}
      {activeTab === 'chat' && (
        <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 flex flex-col h-[520px] shadow-xl">
          {/* Quick Prompts Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-slate-800 shrink-0">
            <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0">PROMPT SUGGESTIONS:</span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendChat(prompt)}
                className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-800/60 text-slate-300 border border-slate-700 hover:border-cyan-500 hover:text-white shrink-0 cursor-pointer transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-xl p-4 rounded-2xl border space-y-1.5 whitespace-pre-line leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white border-cyan-500/30 rounded-tr-none'
                      : 'bg-slate-950 text-slate-200 border-slate-800 rounded-tl-none font-sans'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div className="text-[9px] opacity-40 text-right font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {chatLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs font-mono">
                <Bot className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>CONNECT AI is thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="flex items-center gap-3 pt-3 border-t border-slate-800 shrink-0"
          >
            <input
              type="text"
              placeholder="Ask CONNECT AI about leave rules, overtime, shift schedules..."
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              type="submit"
              disabled={chatLoading || !inputPrompt.trim()}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition-all cursor-pointer border-0 flex items-center gap-2 disabled:opacity-40 uppercase tracking-wider"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SEND</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Daily Standup Generator */}
      {activeTab === 'standup' && (
        <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-6 shadow-xl max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-400" />
                <span>Automated Standup Summarizer</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregates your completed tasks, in-progress missions, and shift hours into a formatted standup post.
              </p>
            </div>

            <button
              onClick={handleGenerateStandup}
              disabled={generatingStandup}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 transition-all cursor-pointer border-0 flex items-center justify-center gap-2 uppercase tracking-wider shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingStandup ? 'animate-spin' : ''}`} />
              <span>{generatingStandup ? 'GENERATING...' : 'GENERATE STANDUP'}</span>
            </button>
          </div>

          {standupReport ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border bg-slate-950 border-slate-800 font-sans text-xs text-slate-200 whitespace-pre-line leading-relaxed border-l-4 border-l-purple-500">
                {standupReport}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  LOGGED: {standupMeta?.hoursWorked || '0.0'} Shift Hrs • {standupMeta?.completedCount || 0} Solved Tasks
                </span>

                <button
                  onClick={handleCopyStandup}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 transition-all cursor-pointer flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                  <span>{copied ? 'COPIED TO CLIPBOARD!' : 'COPY STANDUP POST'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
              Click **GENERATE STANDUP** above to build your daily summary post!
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Workload & Burnout Radar */}
      {activeTab === 'burnout' && (
        <div className="space-y-6">
          {loadingBurnout ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">Calculating Workload & Burnout Radar...</div>
          ) : burnoutData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Risk Gauge Card */}
                <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">BURNOUT RISK SCORE</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className={`text-3xl font-black text-${burnoutData.riskColor}-400`}
                    >
                      {burnoutData.riskScore}/100
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-${burnoutData.riskColor}-500/10 text-${burnoutData.riskColor}-400 border border-${burnoutData.riskColor}-500/30`}
                    >
                      {burnoutData.riskLevel}
                    </span>
                  </div>
                </div>

                <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">14-DAY TOTAL HOURS</span>
                  <p className="text-2xl font-black text-cyan-400 mt-2">{burnoutData.totalHours} HRS</p>
                </div>

                <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">AVG DAILY SHIFT</span>
                  <p className="text-2xl font-black text-indigo-400 mt-2">{burnoutData.avgDailyHours} HRS/DAY</p>
                </div>

                <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">OVERTIME HOURS</span>
                  <p className="text-2xl font-black text-amber-400 mt-2">{burnoutData.otHours} HRS</p>
                </div>
              </div>

              {/* AI Recommendation Box */}
              <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-3">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>AI Wellbeing & Rest Recommendation</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800">
                  {burnoutData.recommendation}
                </p>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
