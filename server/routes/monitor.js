import express from 'express';
import User from '../models/User.js';
import Session from '../models/Session.js';
import Task from '../models/Task.js';
import Notification from '../models/Notification.js';
import MonitorAudit from '../models/MonitorAudit.js';
import { verifyToken, isSuperAdmin } from '../middleware/auth.js';
import { getStartOfDayInUTC, getEndOfDayInUTC } from '../utils/timezone.js';

const router = express.Router();

// Helper: Calculate Productivity Score (0-100)
function computeProductivityScore({ isClockedIn, isOnBreak, netWorkingMinutes, totalEvents, idleMinutes, inProgressTasksCount, completedTasksTodayCount }) {
  if (!isClockedIn) return 0;
  if (isOnBreak) return 65; // Standard neutral break rating

  // 1. Activity Velocity Component (0 to 50 pts)
  // Target: 25+ events/min = full 50 pts
  const eventsPerMin = netWorkingMinutes > 0 ? totalEvents / netWorkingMinutes : 0;
  const velocityScore = Math.min(50, Math.round((eventsPerMin / 25) * 50));

  // 2. Mission & Task Engagement Component (0 to 25 pts)
  // Has tasks in progress or finished today
  let taskScore = 10; // Baseline assignment
  if (inProgressTasksCount > 0) taskScore += 10;
  if (completedTasksTodayCount > 0) taskScore += 5;
  taskScore = Math.min(25, taskScore);

  // 3. Shift Consistency Component (0 to 25 pts)
  // Regular cadence
  let consistencyScore = 20;
  if (netWorkingMinutes >= 30) consistencyScore = 25;

  let totalScore = velocityScore + taskScore + consistencyScore;

  // 4. Idle Penalty: deduct 3 points for every minute idle beyond 4 minutes
  if (idleMinutes > 4) {
    const penalty = Math.min(60, (idleMinutes - 4) * 3);
    totalScore -= penalty;
  }

  return Math.max(12, Math.min(100, Math.round(totalScore)));
}

// @route   GET /api/monitor/operators
// @desc    Get real-time performance telemetry and shift status for all workforce members (Super Admin only)
router.get('/operators', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const onlineUsersMap = req.app.get('onlineUsers') || new Map();
    const clientTimezone = req.query.timezone || 'Asia/Kolkata';

    const now = new Date();
    const todayStart = getStartOfDayInUTC(now, clientTimezone);
    const todayEnd = getEndOfDayInUTC(now, clientTimezone);

    // Fetch all workforce users except current superadmin (or include all)
    const users = await User.find({})
      .select('fullName employeeId email jobTitle role profilePhoto phone breakLimitMinutes regularShiftLimit shiftStartTime shiftEndTime teams')
      .populate('teams', 'name code')
      .lean();

    // Fetch all active/on_break sessions right now
    const activeSessions = await Session.find({
      status: { $in: ['active', 'on_break'] }
    }).lean();

    const activeSessionMap = new Map();
    activeSessions.forEach(s => {
      activeSessionMap.set(s.userId.toString(), s);
    });

    // Fetch in-progress tasks
    const activeTasks = await Task.find({
      status: 'in-progress'
    }).select('title priority assignedTo dueDate').lean();

    // Fetch completed tasks today
    const completedTasksToday = await Task.find({
      status: 'completed',
      updatedAt: { $gte: todayStart, $lte: todayEnd }
    }).select('title assignedTo').lean();

    const operatorsData = users.map(user => {
      const userIdStr = user._id.toString();
      const isOnline = onlineUsersMap.has(userIdStr) && onlineUsersMap.get(userIdStr).size > 0;
      const session = activeSessionMap.get(userIdStr);

      const userTasks = activeTasks.filter(t => 
        t.assignedTo && t.assignedTo.some(id => id.toString() === userIdStr)
      );

      const userCompletedCount = completedTasksToday.filter(t =>
        t.assignedTo && t.assignedTo.some(id => id.toString() === userIdStr)
      ).length;

      let isClockedIn = false;
      let isOnBreak = false;
      let shiftElapsedMinutes = 0;
      let breakElapsedMinutes = 0;
      let netWorkingMinutes = 0;
      let idleMinutes = 0;
      let totalEvents = 0;
      let eventsPerMinute = 0;
      let activityStats = {
        mouseMovements: 0,
        mouseClicks: 0,
        keyPresses: 0,
        lastActivityAt: null
      };
      let performanceTelemetry = {
        cpuLatencyMs: 0,
        memoryUsageMb: 0,
        monitoringStatus: 'Stopped'
      };

      if (session) {
        isClockedIn = true;
        isOnBreak = session.status === 'on_break';

        const clockInTime = new Date(session.clockIn).getTime();
        shiftElapsedMinutes = Math.max(0, Math.floor((now.getTime() - clockInTime) / 60000));

        // Calculate total break minutes
        if (session.breaks && Array.isArray(session.breaks)) {
          session.breaks.forEach(b => {
            const bStart = new Date(b.startedAt).getTime();
            const bEnd = b.endedAt ? new Date(b.endedAt).getTime() : now.getTime();
            breakElapsedMinutes += Math.max(0, Math.floor((bEnd - bStart) / 60000));
          });
        }

        netWorkingMinutes = Math.max(1, shiftElapsedMinutes - breakElapsedMinutes);

        if (session.activityStats) {
          activityStats = {
            mouseMovements: session.activityStats.mouseMovements || 0,
            mouseClicks: session.activityStats.mouseClicks || 0,
            keyPresses: session.activityStats.keyPresses || 0,
            lastActivityAt: session.lastActivityAt || session.clockIn
          };
          totalEvents = activityStats.mouseMovements + activityStats.mouseClicks + activityStats.keyPresses;
          eventsPerMinute = Math.round((totalEvents / netWorkingMinutes) * 10) / 10;
        }

        if (session.lastActivityAt) {
          const lastActiveMs = new Date(session.lastActivityAt).getTime();
          idleMinutes = Math.max(0, Math.floor((now.getTime() - lastActiveMs) / 60000));
        } else {
          idleMinutes = Math.max(0, Math.floor((now.getTime() - clockInTime) / 60000));
        }

        if (session.performanceTelemetry) {
          performanceTelemetry = {
            cpuLatencyMs: session.performanceTelemetry.cpuLatencyMs || 0.8,
            memoryUsageMb: session.performanceTelemetry.memoryUsageMb || 34.0,
            monitoringStatus: session.performanceTelemetry.monitoringStatus || 'Active'
          };
        }
      }

      // Compute Productivity Score
      const productivityScore = computeProductivityScore({
        isClockedIn,
        isOnBreak,
        netWorkingMinutes,
        totalEvents,
        idleMinutes,
        inProgressTasksCount: userTasks.length,
        completedTasksTodayCount: userCompletedCount
      });

      // Operational Status Flag
      let workingStatus = 'offline';
      if (isClockedIn) {
        if (isOnBreak) {
          workingStatus = 'on_break';
        } else if (idleMinutes >= 15) {
          workingStatus = 'extended_idle';
        } else if (idleMinutes >= 5) {
          workingStatus = 'idle_warning';
        } else {
          workingStatus = 'active_working';
        }
      }

      return {
        _id: user._id,
        fullName: user.fullName,
        employeeId: user.employeeId,
        email: user.email,
        jobTitle: user.jobTitle || 'Operator',
        role: user.role,
        profilePhoto: user.profilePhoto || '',
        phone: user.phone || '',
        teams: user.teams || [],
        isOnline,
        isClockedIn,
        isOnBreak,
        workingStatus, // 'active_working' | 'idle_warning' | 'extended_idle' | 'on_break' | 'offline'
        sessionId: session ? session._id : null,
        clockInTime: session ? session.clockIn : null,
        shiftElapsedMinutes,
        breakElapsedMinutes,
        netWorkingMinutes,
        idleMinutes,
        totalEvents,
        eventsPerMinute,
        activityStats,
        performanceTelemetry,
        productivityScore,
        activeTasks: userTasks,
        completedTasksTodayCount: userCompletedCount,
        regularShiftLimit: user.regularShiftLimit || 8,
        breakLimitMinutes: user.breakLimitMinutes || 60,
      };
    });

    res.json(operatorsData);
  } catch (error) {
    console.error('Error fetching monitor operators:', error);
    res.status(500).json({ message: 'Error retrieving monitoring telemetry', error: error.message });
  }
});

// @route   GET /api/monitor/analytics
// @desc    Get aggregate workforce productivity statistics and charts (Super Admin only)
router.get('/analytics', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const onlineUsersMap = req.app.get('onlineUsers') || new Map();
    const activeSessions = await Session.find({
      status: { $in: ['active', 'on_break'] }
    }).populate('userId', 'fullName employeeId jobTitle role').lean();

    const totalUsers = await User.countDocuments();
    const totalClockedIn = activeSessions.length;
    let onBreakCount = 0;
    let idleWarningCount = 0;
    let activeWorkingCount = 0;
    let totalScoreSum = 0;
    let totalEventsCompany = 0;

    const now = Date.now();

    const operatorLeaderboard = [];

    activeSessions.forEach(s => {
      if (s.status === 'on_break') {
        onBreakCount++;
      } else {
        const lastActiveMs = s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : new Date(s.clockIn).getTime();
        const idleMins = Math.floor((now - lastActiveMs) / 60000);
        if (idleMins >= 5) {
          idleWarningCount++;
        } else {
          activeWorkingCount++;
        }
      }

      const totalEv = (s.activityStats?.mouseMovements || 0) + (s.activityStats?.mouseClicks || 0) + (s.activityStats?.keyPresses || 0);
      totalEventsCompany += totalEv;

      const elapsed = Math.max(1, Math.floor((now - new Date(s.clockIn).getTime()) / 60000));
      const evPerMin = Math.round((totalEv / elapsed) * 10) / 10;
      const score = computeProductivityScore({
        isClockedIn: true,
        isOnBreak: s.status === 'on_break',
        netWorkingMinutes: elapsed,
        totalEvents: totalEv,
        idleMinutes: s.lastActivityAt ? Math.floor((now - new Date(s.lastActivityAt).getTime()) / 60000) : 0,
        inProgressTasksCount: 1,
        completedTasksTodayCount: 0
      });

      totalScoreSum += score;

      if (s.userId) {
        operatorLeaderboard.push({
          userId: s.userId._id,
          fullName: s.userId.fullName,
          employeeId: s.userId.employeeId,
          jobTitle: s.userId.jobTitle,
          productivityScore: score,
          eventsPerMinute: evPerMin,
          totalEvents: totalEv,
          shiftDurationMinutes: elapsed
        });
      }
    });

    const avgProductivityScore = totalClockedIn > 0 ? Math.round(totalScoreSum / totalClockedIn) : 82;

    // Sort leaderboard desc
    operatorLeaderboard.sort((a, b) => b.productivityScore - a.productivityScore);

    // Productivity bracket distribution
    const brackets = {
      highFocus: operatorLeaderboard.filter(o => o.productivityScore >= 80).length,
      steadyFocus: operatorLeaderboard.filter(o => o.productivityScore >= 60 && o.productivityScore < 80).length,
      moderate: operatorLeaderboard.filter(o => o.productivityScore >= 40 && o.productivityScore < 60).length,
      attentionNeeded: operatorLeaderboard.filter(o => o.productivityScore < 40).length
    };

    // Simulated hourly activity trend for charts (last 8 hours)
    const currentHour = new Date().getHours();
    const hourlyActivityTrend = [];
    for (let i = 7; i >= 0; i--) {
      const hr = (currentHour - i + 24) % 24;
      const label = `${hr.toString().padStart(2, '0')}:00`;
      const baseActivity = Math.max(15, totalEventsCompany > 0 ? Math.round(totalEventsCompany / 8) : 140);
      const randomVariance = Math.round((Math.sin(i * 1.5) * 0.3 + 0.9) * baseActivity);
      hourlyActivityTrend.push({
        time: label,
        activityEvents: randomVariance,
        productivityIndex: Math.min(100, Math.max(50, Math.round(avgProductivityScore + (Math.sin(i) * 8))))
      });
    }

    res.json({
      totalUsers,
      totalClockedIn,
      activeWorkingCount,
      onBreakCount,
      idleWarningCount,
      offlineCount: Math.max(0, totalUsers - totalClockedIn),
      avgProductivityScore,
      totalEventsCompany,
      brackets,
      leaderboard: operatorLeaderboard.slice(0, 5),
      attentionList: operatorLeaderboard.filter(o => o.productivityScore < 60),
      hourlyActivityTrend
    });
  } catch (error) {
    console.error('Error fetching monitor analytics:', error);
    res.status(500).json({ message: 'Error retrieving analytics telemetry', error: error.message });
  }
});

// @route   POST /api/monitor/nudge
// @desc    Send instant supervisor productivity nudge or alert to operator (Super Admin only)
router.post('/nudge', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { targetUserId, message, type = 'warning', title = 'Supervisor Performance Alert' } = req.body;

    if (!targetUserId || !message) {
      return res.status(400).json({ message: 'targetUserId and message are required' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target employee not found' });
    }

    const adminUser = await User.findById(req.user.userId);

    // Create Notification
    const notif = new Notification({
      recipientId: targetUserId,
      type: 'system',
      title: title || 'Supervisor Performance Alert',
      message: message,
      link: '/dashboard'
    });
    await notif.save();

    // Log in MonitorAudit
    const audit = new MonitorAudit({
      adminId: req.user.userId,
      targetUserId,
      actionType: 'nudge_sent',
      title,
      details: message
    });
    await audit.save();

    // Emit live socket alert
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).emit('new-notification', notif);
      io.to(targetUserId.toString()).emit('monitor-nudge-received', {
        title,
        message,
        type,
        adminName: adminUser ? adminUser.fullName : 'Super Administrator',
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Performance nudge delivered to operator screen', notif, audit });
  } catch (error) {
    console.error('Error sending monitor nudge:', error);
    res.status(500).json({ message: 'Error delivering performance nudge', error: error.message });
  }
});

// @route   POST /api/monitor/audit
// @desc    Log camera surveillance and audit event (Super Admin only)
router.post('/audit', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { targetUserId, actionType, title, details, snapshotData, metricsSnapshot } = req.body;

    if (!targetUserId || !actionType) {
      return res.status(400).json({ message: 'targetUserId and actionType are required' });
    }

    const audit = new MonitorAudit({
      adminId: req.user.userId,
      targetUserId,
      actionType,
      title: title || '',
      details: details || '',
      snapshotData: snapshotData || '',
      metricsSnapshot: metricsSnapshot || {}
    });

    await audit.save();
    res.json({ success: true, audit });
  } catch (error) {
    console.error('Error logging monitor audit:', error);
    res.status(500).json({ message: 'Error logging surveillance audit', error: error.message });
  }
});

// @route   GET /api/monitor/audit-log
// @desc    Get recent camera surveillance and performance audit records (Super Admin only)
router.get('/audit-log', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const audits = await MonitorAudit.find({})
      .populate('adminId', 'fullName employeeId')
      .populate('targetUserId', 'fullName employeeId jobTitle profilePhoto')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(audits);
  } catch (error) {
    console.error('Error retrieving audit log:', error);
    res.status(500).json({ message: 'Error retrieving surveillance audit log', error: error.message });
  }
});

export default router;
