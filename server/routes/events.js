import express from 'express';
import Event from '../models/Event.js';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';
import { decrypt } from '../utils/crypto.js';

const router = express.Router();

// @route   GET /api/events
// @desc    Get communal events and team celebrations for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    // 1. Get all teams the user belongs to
    const userTeams = await Team.find({
      $or: [
        { members: req.user.userId },
        { admins: req.user.userId }
      ]
    });
    
    const userTeamIds = userTeams.map(t => t._id);

    // 2. Fetch manual events targeted to user's teams or created by user
    const events = await Event.find({
      $or: [
        { targetTeams: { $in: userTeamIds } },
        { creator: req.user.userId }
      ]
    })
    .populate('creator', 'fullName employeeId jobTitle')
    .populate('targetTeams', 'name')
    .sort({ date: 1 });

    // Decrypt target team names for response
    const decryptedEvents = events.map(event => {
      const eventObj = event.toObject();
      if (eventObj.targetTeams) {
        eventObj.targetTeams = eventObj.targetTeams.map(t => {
          try {
            t.name = decrypt(t.name);
          } catch (e) {
            // If already decrypted or error
          }
          return t;
        });
      }
      return eventObj;
    });

    // 3. Fetch team members to compute birthdays and anniversaries
    const teamsWithMembers = await Team.find({
      _id: { $in: userTeamIds }
    })
    .populate('members', 'fullName email employeeId jobTitle role dob joiningDate')
    .populate('admins', 'fullName email employeeId jobTitle role dob joiningDate');

    const memberMap = new Map();
    teamsWithMembers.forEach(team => {
      team.members.forEach(m => memberMap.set(m._id.toString(), m));
      team.admins.forEach(a => memberMap.set(a._id.toString(), a));
    });
    
    const uniqueMembers = Array.from(memberMap.values());

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentDate = today.getDate();

    const celebrations = [];

    uniqueMembers.forEach(member => {
      // Birthday check
      if (member.dob) {
        const dobDate = new Date(member.dob);
        const isToday = dobDate.getMonth() === currentMonth && dobDate.getDate() === currentDate;
        
        if (isToday) {
          celebrations.push({
            userId: member._id,
            fullName: member.fullName,
            employeeId: member.employeeId,
            jobTitle: member.jobTitle,
            type: 'birthday',
            isToday: true,
            date: member.dob
          });
        } else if (dobDate.getMonth() === currentMonth) {
          celebrations.push({
            userId: member._id,
            fullName: member.fullName,
            employeeId: member.employeeId,
            jobTitle: member.jobTitle,
            type: 'birthday',
            isToday: false,
            date: member.dob
          });
        }
      }

      // Work anniversary check (joiningDate)
      if (member.joiningDate) {
        const joinDate = new Date(member.joiningDate);
        const isToday = joinDate.getMonth() === currentMonth && joinDate.getDate() === currentDate;
        const years = today.getFullYear() - joinDate.getFullYear();

        if (isToday && years > 0) {
          celebrations.push({
            userId: member._id,
            fullName: member.fullName,
            employeeId: member.employeeId,
            jobTitle: member.jobTitle,
            type: 'anniversary',
            isToday: true,
            years,
            date: member.joiningDate
          });
        } else if (joinDate.getMonth() === currentMonth && years > 0) {
          celebrations.push({
            userId: member._id,
            fullName: member.fullName,
            employeeId: member.employeeId,
            jobTitle: member.jobTitle,
            type: 'anniversary',
            isToday: false,
            years,
            date: member.joiningDate
          });
        }
      }
    });

    res.json({
      events: decryptedEvents,
      celebrations
    });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving events and celebrations', error: error.message });
  }
});

// @route   POST /api/events
// @desc    Publish a new event (Restricted to Admins)
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { title, description, date, targetTeams } = req.body;

  if (!title || !description || !date || !targetTeams || targetTeams.length === 0) {
    return res.status(400).json({ message: 'All event details (title, description, date, target teams) are required.' });
  }

  try {
    const newEvent = new Event({
      title: title.trim(),
      description: description.trim(),
      date: new Date(date),
      targetTeams,
      creator: req.user.userId
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (error) {
    res.status(500).json({ message: 'Error publishing event', error: error.message });
  }
});

// @route   DELETE /api/events/:id
// @desc    Remove an event (Restricted to Admins)
router.delete('/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    // Only allow creator or a superadmin to delete the event
    const user = await User.findById(req.user.userId);
    if (event.creator.toString() !== req.user.userId && user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Permission denied. Only the creator or superadmin can delete this event.' });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event', error: error.message });
  }
});

export default router;
