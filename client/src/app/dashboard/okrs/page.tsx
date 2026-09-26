'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Plus,
  X,
  Star,
  Users,
  Award,
  BarChart3,
  Edit3,
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { apiRequest, getCurrentUser } from '../../../utils/api';

export default function OKRsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'okrs' | 'radar' | 'submit_review'>('okrs');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Create Goal Modal State
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalCategory, setGoalCategory] = useState('Individual');
  const [targetVal, setTargetVal] = useState(100);
  const [unit, setUnit] = useState('%');
  const [assignedUser, setAssignedUser] = useState('');
  const [quarter, setQuarter] = useState('Q3');
  const [submittingGoal, setSubmittingGoal] = useState(false);

  // Update Progress Modal
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [newProgress, setNewProgress] = useState(0);

  // Submit 360 Review State
  const [revieweeId, setRevieweeId] = useState('');
  const [reviewType, setReviewType] = useState('peer');
  const [ratings, setRatings] = useState({
    technical: 4,
    communication: 4,
    leadership: 4,
    punctuality: 4,
    teamwork: 4,
  });
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user) {
      setAssignedUser(user._id);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchGoals(), fetchReviews(), fetchRadarSummary(), fetchUsers()]);
    } catch (err) {
      console.error('Error loading OKR page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const data = await apiRequest('/okrs');
      setGoals(Array.isArray(data) ? data : []);
    } catch (e) {
      setGoals([]);
    }
  };

  const fetchReviews = async () => {
    try {
      const data = await apiRequest('/reviews');
      setReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      setReviews([]);
    }
  };

  const fetchRadarSummary = async () => {
    const user = getCurrentUser();
    if (!user) return;
    try {
      const data = await apiRequest(`/reviews/summary/${user._id}`);
      setRadarData(data?.radarData || []);
    } catch (e) {
      setRadarData([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/users');
      setUsersList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle || !targetVal) return;

    setSubmittingGoal(true);
    try {
      await apiRequest('/okrs', {
        method: 'POST',
        body: JSON.stringify({
          title: goalTitle,
          description: goalDesc,
          category: goalCategory,
          targetValue: targetVal,
          currentValue: 0,
          unit,
          assignedTo: assignedUser || currentUser?._id,
          quarter,
        }),
      });

      setShowGoalModal(false);
      setGoalTitle('');
      setGoalDesc('');
      fetchGoals();
    } catch (err: any) {
      alert(err.message || 'Failed to create goal');
    } finally {
      setSubmittingGoal(false);
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;

    try {
      await apiRequest(`/okrs/${selectedGoal._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          currentValue: newProgress,
        }),
      });
      setSelectedGoal(null);
      fetchGoals();
    } catch (err: any) {
      alert(err.message || 'Failed to update progress');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revieweeId) return;

    setSubmittingReview(true);
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          revieweeId,
          reviewType,
          period: `${new Date().getFullYear()}-${quarter}`,
          ratings,
          feedback,
          strengths,
          improvements,
        }),
      });

      alert('360 Review submitted successfully!');
      setRevieweeId('');
      setFeedback('');
      setStrengths('');
      setImprovements('');
      fetchReviews();
      fetchRadarSummary();
      setActiveTab('radar');
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const completedGoalsCount = goals.filter((g) => g.status === 'completed').length;
  const overallProgressPercent = goals.length
    ? Math.round(
        goals.reduce((acc, curr) => acc + Math.min(100, (curr.currentValue / curr.targetValue) * 100), 0) /
          goals.length
      )
    : 0;

  const filteredGoals = goals.filter((g) => {
    if (statusFilter === 'all') return true;
    return g.status === statusFilter;
  });

  return (
    <div className="space-y-6 select-none font-mono">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-cyan-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs tracking-wider uppercase font-bold">
            <Target className="w-4 h-4 animate-pulse" />
            <span>// PERFORMANCE_MATRIX</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">OKRs & 360 Reviews</h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Track key objectives, align team milestones, and view 360-degree radar performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGoalModal(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer border-0 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>CREATE OBJECTIVE</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">ACTIVE OKRs</p>
            <p className="text-2xl font-black text-cyan-400">{goals.length}</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">COMPLETED OKRs</p>
            <p className="text-2xl font-black text-emerald-400">{completedGoalsCount}</p>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-900/60 border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">OVERALL PROGRESS</p>
            <p className="text-2xl font-black text-indigo-400">{overallProgressPercent}%</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('okrs')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
            activeTab === 'okrs'
              ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          OBJECTIVES & KEY RESULTS
        </button>

        <button
          onClick={() => setActiveTab('radar')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
            activeTab === 'radar'
              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          360 RADAR METRICS
        </button>

        <button
          onClick={() => setActiveTab('submit_review')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
            activeTab === 'submit_review'
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
              : 'text-slate-400 hover:text-white border-transparent'
          }`}
        >
          SUBMIT 360 REVIEW
        </button>
      </div>

      {/* Tab 1: OKRs Board */}
      {activeTab === 'okrs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {['all', 'in_progress', 'completed', 'at_risk'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer border ${
                    statusFilter === st
                      ? 'bg-slate-800 text-white border-cyan-500/50'
                      : 'text-slate-500 border-transparent hover:text-slate-300'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs italic">Loading OKRs...</div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-xs">
              No objectives found for the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGoals.map((goal) => {
                const percent = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));

                const statusBg =
                  goal.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : goal.status === 'at_risk'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';

                return (
                  <div
                    key={goal._id}
                    className="p-5 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-4 shadow-lg hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">
                          {goal.category} • {goal.quarter}
                        </span>
                        <h3 className="text-sm font-extrabold text-white mt-0.5">{goal.title}</h3>
                        {goal.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{goal.description}</p>
                        )}
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusBg}`}>
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-400">Progress</span>
                        <span className="text-cyan-400">
                          {goal.currentValue} / {goal.targetValue} {goal.unit} ({percent}%)
                        </span>
                      </div>

                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
                      <span>Owner: {goal.assignedTo?.fullName || 'Unassigned'}</span>
                      <button
                        onClick={() => {
                          setSelectedGoal(goal);
                          setNewProgress(goal.currentValue);
                        }}
                        className="text-cyan-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Update Progress</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 360 Radar Metrics */}
      {activeTab === 'radar' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-4">
            <h2 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Competency Breakdown (360 Feedback)</span>
            </h2>

            <div className="h-72 w-full flex items-center justify-center">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#475569" />
                    <Radar name="My Score" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.4} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-500 text-xs italic">No review metrics calculated yet.</div>
              )}
            </div>
          </div>

          {/* Feedback Feed */}
          <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 space-y-4">
            <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">Received 360 Reviews</h2>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {reviews.length === 0 ? (
                <p className="text-slate-500 text-xs italic">No reviews submitted yet.</p>
              ) : (
                reviews.map((rev) => (
                  <div key={rev._id} className="p-4 rounded-xl border bg-slate-950 border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-cyan-400">
                        {rev.reviewerId?.fullName} ({rev.reviewType})
                      </span>
                      <span className="text-slate-500">{rev.period}</span>
                    </div>

                    {rev.feedback && <p className="text-xs text-slate-300 italic">"{rev.feedback}"</p>}

                    {rev.strengths && (
                      <p className="text-[10px] text-emerald-400">
                        <span className="font-bold">Strengths:</span> {rev.strengths}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Submit 360 Review Form */}
      {activeTab === 'submit_review' && (
        <div className="p-6 rounded-2xl border bg-slate-900/60 border-slate-800 max-w-2xl mx-auto space-y-6">
          <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-400" />
            <span>Submit 360 Evaluation</span>
          </h2>

          <form onSubmit={handleSubmitReview} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                Reviewee (Operator)
              </label>
              <select
                value={revieweeId}
                onChange={(e) => setRevieweeId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">-- Choose Colleague --</option>
                {usersList.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.fullName} ({u.jobTitle || 'Operator'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                  Review Type
                </label>
                <select
                  value={reviewType}
                  onChange={(e) => setReviewType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="peer">Peer Review</option>
                  <option value="self">Self Evaluation</option>
                  <option value="manager">Manager Review</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                  Cycle / Quarter
                </label>
                <input
                  type="text"
                  value={`2026-${quarter}`}
                  disabled
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500"
                />
              </div>
            </div>

            {/* Ratings 1-5 Sliders */}
            <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-slate-800">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Ratings (1 = Low, 5 = High)</p>
              {['technical', 'communication', 'leadership', 'punctuality', 'teamwork'].map((field) => (
                <div key={field} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-300 capitalize min-w-[100px]">{field}</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={(ratings as any)[field]}
                    onChange={(e) =>
                      setRatings({ ...ratings, [field]: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-500"
                  />
                  <span className="text-cyan-400 font-bold text-xs w-6 text-right">
                    {(ratings as any)[field]}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                Constructive Feedback
              </label>
              <textarea
                rows={3}
                placeholder="Key strengths, teamwork highlights, and development advice..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={submittingReview}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all cursor-pointer border-0 uppercase tracking-wider"
            >
              {submittingReview ? 'Submitting...' : 'Submit Evaluation'}
            </button>
          </form>
        </div>
      )}

      {/* Create Goal Modal */}
      <AnimatePresence>
        {showGoalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowGoalModal(false)}
            />
            <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-6 space-y-4 z-10 text-xs">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Create New Objective</h3>
                <button onClick={() => setShowGoalModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                    Objective Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Increase Code Test Coverage"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                      Target Value
                    </label>
                    <input
                      type="number"
                      required
                      value={targetVal}
                      onChange={(e) => setTargetVal(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="%">%</option>
                      <option value="Tasks">Tasks</option>
                      <option value="$">$</option>
                      <option value="Units">Units</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGoalModal(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGoal}
                    className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500"
                  >
                    Save Objective
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Update Progress Modal */}
      <AnimatePresence>
        {selectedGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedGoal(null)}
            />
            <div className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 space-y-4 z-10 text-xs">
              <h3 className="text-xs font-extrabold text-white uppercase">Update OKR Progress</h3>
              <p className="text-slate-400">{selectedGoal.title}</p>

              <form onSubmit={handleUpdateProgress} className="space-y-4">
                <div>
                  <div className="flex justify-between text-slate-300 font-bold mb-2">
                    <span>Current Value</span>
                    <span className="text-cyan-400">
                      {newProgress} / {selectedGoal.targetValue} {selectedGoal.unit}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={newProgress}
                    onChange={(e) => setNewProgress(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGoal(null)}
                    className="px-4 py-2 text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl font-bold text-white bg-cyan-500 hover:bg-cyan-400"
                  >
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
