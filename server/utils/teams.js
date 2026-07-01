import User from '../models/User.js';
import Team from '../models/Team.js';
import { encrypt, decrypt } from './crypto.js';

export const syncJobRoleTeams = async () => {
  try {
    // 1. Get all active users
    const users = await User.find({});
    
    // 2. Extract unique jobTitles (excluding empty ones)
    const jobTitles = [...new Set(users.map(u => u.jobTitle?.trim()).filter(Boolean))];
    
    // 3. Get all existing teams in DB
    const existingTeams = await Team.find({});
    
    // Convert existing teams into a map of decrypted names to Team documents
    const teamMap = new Map();
    existingTeams.forEach(team => {
      try {
        const decryptedName = decrypt(team.name).trim();
        teamMap.set(decryptedName.toLowerCase(), team);
      } catch (e) {
        // If error decrypting or already plaintext
        teamMap.set(team.name.trim().toLowerCase(), team);
      }
    });

    // 4. Find all admins, superadmins, or "team leader" to be team leaders/admins of all teams
    const globalAdmins = users.filter(u => 
      u.role === 'admin' || 
      u.role === 'superadmin' || 
      u.jobTitle?.toLowerCase().includes('team leader') ||
      u.jobTitle?.toLowerCase().includes('manager')
    ).map(u => u._id);

    // 5. For each unique jobTitle, ensure a team exists and is populated
    for (const title of jobTitles) {
      const normalizedTitle = title.toLowerCase();
      
      // All users with this jobTitle are members of the team
      const members = users.filter(u => u.jobTitle?.trim().toLowerCase() === normalizedTitle).map(u => u._id);
      
      // Admins for this team include the global admins and any member of this team who is a leader/manager
      const teamAdmins = [...new Set([
        ...globalAdmins,
        ...users.filter(u => u.jobTitle?.trim().toLowerCase() === normalizedTitle && (
          u.jobTitle?.toLowerCase().includes('leader') || 
          u.jobTitle?.toLowerCase().includes('manager')
        )).map(u => u._id)
      ])];

      let team = teamMap.get(normalizedTitle);
      
      if (team) {
        // Update members and admins
        team.members = members;
        team.admins = teamAdmins;
        await team.save();
      } else {
        // Create new team
        const newTeam = new Team({
          name: encrypt(title),
          description: encrypt(`Automated communal channel for the ${title} team.`),
          members,
          admins: teamAdmins
        });
        await newTeam.save();
        teamMap.set(normalizedTitle, newTeam);
      }
    }

    // 6. Ensure all users' teams array reference is updated to match the Team documents they belong to
    const allTeams = await Team.find({});
    for (const user of users) {
      const userJobTitle = user.jobTitle?.trim().toLowerCase();
      if (!userJobTitle) continue;
      
      const matchingTeams = allTeams.filter(team => {
        try {
          const decryptedName = decrypt(team.name).trim().toLowerCase();
          return decryptedName === userJobTitle;
        } catch (e) {
          return team.name.trim().toLowerCase() === userJobTitle;
        }
      });
      
      const teamIds = matchingTeams.map(t => t._id);
      
      // Update user.teams
      await User.findByIdAndUpdate(user._id, { $set: { teams: teamIds } });
    }

  } catch (error) {
    console.error('Error in syncJobRoleTeams:', error);
  }
};
