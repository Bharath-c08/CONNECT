import express from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { verifyToken, isAdminOrSuperAdmin } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = express.Router();

// @route   POST /api/teams
// @desc    Create a new team (Restricted to Admins)
router.post('/', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { name, description, members } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Team name is required.' });
  }

  try {
    // Uniqueness validation by decrypting existing names
    const allTeams = await Team.find({});
    const teamExists = allTeams.some(
      (t) => decrypt(t.name).toLowerCase() === name.trim().toLowerCase()
    );

    if (teamExists) {
      return res.status(400).json({ message: 'A team with this name already exists.' });
    }

    const encryptedName = encrypt(name.trim());
    const encryptedDescription = encrypt(description ? description.trim() : '');

    const newTeam = new Team({
      name: encryptedName,
      description: encryptedDescription,
      members: members || [],
      admins: [req.user.userId], // Creator is the first team admin
    });

    await newTeam.save();

    // Propagate team to user profiles
    if (members && members.length > 0) {
      await User.updateMany(
        { _id: { $in: members } },
        { $addToSet: { teams: newTeam._id } }
      );
    }
    // Add creator user to team reference too
    await User.findByIdAndUpdate(req.user.userId, { $addToSet: { teams: newTeam._id } });

    // Decrypt fields for returning payload
    const teamResponse = newTeam.toObject();
    teamResponse.name = name.trim();
    teamResponse.description = description ? description.trim() : '';

    res.status(201).json(teamResponse);
  } catch (error) {
    res.status(500).json({ message: 'Error creating team', error: error.message });
  }
});

// @route   GET /api/teams
// @desc    Get all teams (Available to all logged-in users)
router.get('/', verifyToken, async (req, res) => {
  try {
    const teams = await Team.find({})
      .populate('members', 'fullName email employeeId jobTitle role')
      .populate('admins', 'fullName email');

    // Decrypt all teams
    const decryptedTeams = teams.map((t) => {
      const teamObj = t.toObject();
      teamObj.name = decrypt(teamObj.name);
      teamObj.description = decrypt(teamObj.description);
      return teamObj;
    });

    res.json(decryptedTeams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teams', error: error.message });
  }
});

// @route   GET /api/teams/my
// @desc    Get teams that the logged-in user belongs to
router.get('/my', verifyToken, async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [
        { members: req.user.userId },
        { admins: req.user.userId }
      ]
    }).populate('members', 'fullName email employeeId jobTitle role');

    // Decrypt all user teams
    const decryptedTeams = teams.map((t) => {
      const teamObj = t.toObject();
      teamObj.name = decrypt(teamObj.name);
      teamObj.description = decrypt(teamObj.description);
      return teamObj;
    });

    res.json(decryptedTeams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user teams', error: error.message });
  }
});

// @route   PUT /api/teams/:id
// @desc    Update team membership (Restricted to Admins)
router.put('/:id', verifyToken, isAdminOrSuperAdmin, async (req, res) => {
  const { name, description, members } = req.body;

  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Capture old members to sync user schemas
    const oldMembers = team.members.map(m => m.toString());

    if (name) {
      // Uniqueness check for name update
      const allTeams = await Team.find({ _id: { $ne: req.params.id } });
      const duplicateExists = allTeams.some(
        (t) => decrypt(t.name).toLowerCase() === name.trim().toLowerCase()
      );
      if (duplicateExists) {
        return res.status(400).json({ message: 'A team with this name already exists.' });
      }
      team.name = encrypt(name.trim());
    }

    if (description !== undefined) {
      team.description = encrypt(description.trim());
    }

    if (members) {
      team.members = members;
    }

    await team.save();

    // Update user profiles for removed members
    const removedMembers = oldMembers.filter(m => !members.includes(m));
    if (removedMembers.length > 0) {
      await User.updateMany(
        { _id: { $in: removedMembers } },
        { $pull: { teams: team._id } }
      );
    }

    // Update user profiles for new members
    const addedMembers = members.filter(m => !oldMembers.includes(m));
    if (addedMembers.length > 0) {
      await User.updateMany(
        { _id: { $in: addedMembers } },
        { $addToSet: { teams: team._id } }
      );
    }

    // Decrypt the returned object
    const teamObj = team.toObject();
    teamObj.name = name ? name.trim() : decrypt(team.name);
    teamObj.description = description !== undefined ? description.trim() : decrypt(team.description);

    res.json({ message: 'Team updated successfully', team: teamObj });
  } catch (error) {
    res.status(500).json({ message: 'Error updating team', error: error.message });
  }
});

export default router;
