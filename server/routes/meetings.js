import express from 'express';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/meetings
// @desc    Create/schedule a new meeting & send notification alerts to invitees
router.post('/', verifyToken, async (req, res) => {
  const { title, description, meetingId, startTime, endTime, participants } = req.body;

  if (!title || !meetingId || !startTime || !endTime) {
    return res.status(400).json({ message: 'Title, meetingId, startTime, and endTime are required.' });
  }

  try {
    const existing = await Meeting.findOne({ meetingId });
    if (existing) {
      return res.status(400).json({ message: 'A meeting with this ID already exists.' });
    }

    const newMeeting = new Meeting({
      title,
      description,
      meetingId,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdBy: req.user.userId,
      participants: participants || []
    });

    await newMeeting.save();

    // Push live notifications to all invited participants
    const io = req.app.get('io');
    if (participants && participants.length > 0) {
      const creator = await User.findById(req.user.userId).select('fullName');
      const creatorName = creator ? creator.fullName : 'System Admin';

      for (const inviteeId of participants) {
        const notif = new Notification({
          recipientId: inviteeId,
          type: 'system',
          title: 'New Meeting Scheduled',
          message: `${creatorName} invited you to a video meeting: ${title}.`,
          link: `/dashboard/meet/${meetingId}`
        });

        await notif.save();

        if (io) {
          io.to(inviteeId.toString()).emit('new-notification', notif);
        }
      }
    }

    res.status(201).json({ message: 'Meeting scheduled successfully', meeting: newMeeting });
  } catch (error) {
    res.status(500).json({ message: 'Error scheduling meeting', error: error.message });
  }
});

// @route   GET /api/meetings/my
// @desc    Retrieve all meetings scheduled for the logged-in user
router.get('/my', verifyToken, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [
        { createdBy: req.user.userId },
        { participants: req.user.userId }
      ]
    })
      .populate('createdBy', 'fullName jobTitle')
      .populate('participants', 'fullName employeeId jobTitle')
      .sort({ startTime: 1 });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching meeting schedules', error: error.message });
  }
});

// @route   GET /api/meetings/:meetingId
// @desc    Get details of a single meeting by slug
router.get('/:meetingId', verifyToken, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.meetingId })
      .populate('createdBy', 'fullName jobTitle')
      .populate('participants', 'fullName employeeId jobTitle');
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting link not found or expired.' });
    }
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving meeting details', error: error.message });
  }
});

// @route   DELETE /api/meetings/:id
// @desc    Delete a meeting by MongoDB ID (only by the creator)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting node not found.' });
    }

    // Check if the current user is the creator
    if (meeting.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied. Only the meeting scheduler can delete this node.' });
    }

    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ message: 'Meeting node successfully de-orbited and cleared from registry.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting meeting node.', error: error.message });
  }
});

export default router;

