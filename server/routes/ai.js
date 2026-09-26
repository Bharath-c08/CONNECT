import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Task from '../models/Task.js';
import Session from '../models/Session.js';
import LeaveRequest from '../models/LeaveRequest.js';
import AiLog from '../models/AiLog.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate context-aware HR responses
function processHrQuery(query, user, tasks, leaves, recentSessions) {
  const q = query.toLowerCase();

  // 1. Leave & Time-Off Queries
  if (q.includes('leave') || q.includes('vacation') || q.includes('time off') || q.includes('sick') || q.includes('casual')) {
    const limits = user.leaveLimits ? Object.fromEntries(user.leaveLimits) : {};
    const sickDays = limits.sick || 10;
    const casualDays = limits.casual || 10;
    const annualDays = limits.annual || 15;

    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    const approvedLeaves = leaves.filter((l) => l.status === 'approved').length;

    return `📋 **Your Leave Summary & HR Policy:**

- **Sick Leave Protocol**: ${sickDays} days/year allocated.
- **Casual Disconnect**: ${casualDays} days/year allocated.
- **Annual Vacation**: ${annualDays} days/year allocated.

**Your Current Status**:
- Approved Leaves Logged: **${approvedLeaves}**
- Pending Requests: **${pendingLeaves}**

*Policy Note*: Leave requests must be submitted at least 24 hours in advance for casual departures, or as early as possible for medical emergencies.`;
  }

  // 2. Shift Hours & Overtime Queries
  if (q.includes('overtime') || q.includes('shift') || q.includes('clock') || q.includes('hours') || q.includes('pay') || q.includes('wage')) {
    const isOtEligible = user.overtimeEligible ? 'YES (Eligible for OT pay)' : 'NO (Regular shifts only)';
    const otRate = user.overtimePayPerMinute ? `₹${user.overtimePayPerMinute}/min` : 'Standard Rate';
    const shiftStart = user.shiftStartTime || '09:00';
    const shiftEnd = user.shiftEndTime || '17:00';

    return `⏱️ **Shift Telemetry & Overtime Policy:**

- **Standard Shift Schedule**: ${shiftStart} – ${shiftEnd} (${user.regularShiftLimit || 8} Hours Cap)
- **Overtime Status**: ${isOtEligible}
- **OT Wage Rate**: ${otRate}
- **Monthly Base Wage**: ₹${user.basicPay || 0} / month

*Policy Note*: Auto-clock out triggers 5 minutes after shift end time. Overtime shifts require prior supervisory approval.`;
  }

  // 3. Task & Mission Queries
  if (q.includes('task') || q.includes('mission') || q.includes('work') || q.includes('todo') || q.includes('priority')) {
    const activeTasks = tasks.filter((t) => t.status !== 'completed');
    const completedTasks = tasks.filter((t) => t.status === 'completed');

    if (activeTasks.length === 0) {
      return `✅ **Mission Pipeline Clean!**\n\nYou currently have no active pending tasks. Total completed tasks: **${completedTasks.length}**.`;
    }

    const topTask = activeTasks[0];
    return `🎯 **Current Task Pipeline Summary:**

You have **${activeTasks.length}** active tasks pending:
- **Top Priority**: "${topTask.title}" (Priority: **${topTask.priority || 'Medium'}**, Status: **${topTask.status}**)
- **Completed Missions**: **${completedTasks.length}**

*AI Recommendation*: Focus on completing "${topTask.title}" next to maintain optimal team velocity.`;
  }

  // 4. General HR & Workplace Assistance
  return `🤖 **CONNECT AI HR Assistant Response:**

Based on your profile as **${user.fullName}** (${user.jobTitle || 'Operator'}):

- **Employee ID**: ${user.employeeId}
- **Employment Contract**: ${(user.employmentType || 'fulltime').toUpperCase()}
- **Department/Role**: ${user.role?.toUpperCase() || 'USER'}

You can ask me about:
1. 📅 **Leave Balances & Policies** ("What is my leave balance?")
2. ⏱️ **Shift Schedules & Overtime** ("How is my overtime calculated?")
3. 🎯 **Task Pipelines & Daily Standups** ("Generate my daily standup")
4. ⚡ **Workload & Burnout Risk** ("Check my burnout risk")`;
}

// POST /api/ai/chat - Context-aware HR & Policy Assistant
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.user.userId;

    if (!prompt) {
      return res.status(400).json({ message: 'Prompt is required.' });
    }

    let user = null;
    let tasks = [];
    let leaves = [];
    let recentSessions = [];

    if (mongoose.connection.readyState === 1) {
      [user, tasks, leaves, recentSessions] = await Promise.all([
        User.findById(userId),
        Task.find({ assignedTo: userId }),
        LeaveRequest.find({ userId }),
        Session.find({ userId }).sort({ createdAt: -1 }).limit(10),
      ]);
    }

    const defaultUser = user || {
      fullName: 'Operator',
      employeeId: 'EMP-001',
      jobTitle: 'Team Member',
      role: 'user',
      leaveLimits: new Map([
        ['sick', 10],
        ['casual', 10],
        ['annual', 15],
      ]),
    };

    const aiResponseText = processHrQuery(prompt, defaultUser, tasks || [], leaves || [], recentSessions || []);

    // Log query in background if DB is ready
    if (mongoose.connection.readyState === 1 && user) {
      const log = new AiLog({
        userId,
        type: 'chat',
        prompt,
        response: aiResponseText,
      });
      await log.save().catch((e) => console.error(e));
    }

    res.json({
      prompt,
      response: aiResponseText,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error in AI Chat route:', error);
    res.status(500).json({ message: 'AI Assistant request failed.', error: error.message });
  }
});

// POST /api/ai/standup - Generate Daily Standup Summary
router.post('/standup', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    let user = null;
    let tasks = [];
    let todaySession = null;

    if (mongoose.connection.readyState === 1) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      [user, tasks, todaySession] = await Promise.all([
        User.findById(userId),
        Task.find({ assignedTo: userId }),
        Session.findOne({ userId, clockIn: { $gte: startOfDay } }),
      ]);
    }

    const userName = user?.fullName || 'Operator';
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const activeTasks = tasks.filter((t) => t.status !== 'completed');

    const hoursWorked = todaySession ? (todaySession.duration / 60).toFixed(1) : '0.0';

    const completedList =
      completedTasks.length > 0
        ? completedTasks.map((t) => `- ✅ ${t.title}`).join('\n')
        : '- Logged active shift hours and team syncs.';

    const activeList =
      activeTasks.length > 0
        ? activeTasks.map((t) => `- ⏳ ${t.title} (${t.priority || 'Medium'} Priority)`).join('\n')
        : '- Finalize remaining mission capsules and team code reviews.';

    const standupMarkdown = `### 🚀 Daily Standup Report — ${userName}
*Date*: ${new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}

**1. What I accomplished today:**
${completedList}
- Shift Duration Logged: **${hoursWorked} Hours**

**2. What I am working on next:**
${activeList}

**3. Blockers / Dependencies:**
- None currently. Shift telemetry and mission uplink running smoothly.`;

    if (mongoose.connection.readyState === 1 && user) {
      const log = new AiLog({
        userId,
        type: 'standup',
        prompt: 'Generate Standup',
        response: standupMarkdown,
      });
      await log.save().catch((e) => console.error(e));
    }

    res.json({
      standup: standupMarkdown,
      completedCount: completedTasks.length,
      activeCount: activeTasks.length,
      hoursWorked,
    });
  } catch (error) {
    console.error('Error generating standup:', error);
    res.status(500).json({ message: 'Failed to generate standup report.', error: error.message });
  }
});

// GET /api/ai/burnout-risk - Workload & Burnout Radar
router.get('/burnout-risk', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    let sessions = [];
    if (mongoose.connection.readyState === 1) {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      sessions = await Session.find({
        userId,
        clockIn: { $gte: fourteenDaysAgo },
      });
    }

    const totalMinutes = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));
    const totalSessions = sessions.length;
    const avgDailyHours = totalSessions ? parseFloat((totalHours / (totalSessions || 1)).toFixed(1)) : 0;

    const otMinutes = sessions.reduce((acc, s) => acc + (s.overtimeMinutes || 0), 0);
    const otHours = parseFloat((otMinutes / 60).toFixed(1));

    let riskLevel = 'Low';
    let riskColor = 'emerald';
    let riskScore = 25;
    let recommendation = 'Your workload is balanced. Keep maintaining steady rest intervals!';

    if (avgDailyHours > 10 || totalHours > 90 || otHours > 15) {
      riskLevel = 'High';
      riskColor = 'rose';
      riskScore = 85;
      recommendation = '⚠️ High Overtime Detected! Consider requesting a casual disconnect leave to recharge.';
    } else if (avgDailyHours > 8.5 || totalHours > 70 || otHours > 5) {
      riskLevel = 'Moderate';
      riskColor = 'amber';
      riskScore = 55;
      recommendation = 'Workload is slightly elevated. Ensure you conclude shift breaks on schedule.';
    }

    res.json({
      riskLevel,
      riskColor,
      riskScore,
      totalHours,
      avgDailyHours,
      otHours,
      totalSessions,
      recommendation,
    });
  } catch (error) {
    console.error('Error calculating burnout risk:', error);
    res.json({
      riskLevel: 'Low',
      riskColor: 'emerald',
      riskScore: 20,
      totalHours: 0,
      avgDailyHours: 0,
      otHours: 0,
      totalSessions: 0,
      recommendation: 'Workload telemetry normal.',
    });
  }
});

// GET /api/ai/history - Get user's AI query log history
router.get('/history', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const userId = req.user.userId;
    const logs = await AiLog.find({ userId }).sort({ createdAt: -1 }).limit(20);
    res.json(logs || []);
  } catch (error) {
    console.error('Error fetching AI log history:', error);
    res.json([]);
  }
});

export default router;
