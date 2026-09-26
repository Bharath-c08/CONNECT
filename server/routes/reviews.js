import express from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reviews - List reviews
router.get('/', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }
    const { revieweeId, period } = req.query;
    const filter = {};

    if (revieweeId) filter.revieweeId = revieweeId;
    if (period) filter.period = period;

    const reviews = await Review.find(filter)
      .populate('revieweeId', 'fullName jobTitle employeeId')
      .populate('reviewerId', 'fullName jobTitle employeeId')
      .sort({ createdAt: -1 });

    res.json(reviews || []);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.json([]);
  }
});

// GET /api/reviews/summary/:userId - Aggregated radar ratings for a user
router.get('/summary/:userId', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        totalReviews: 0,
        radarData: [
          { subject: 'Technical', A: 4, fullMark: 5 },
          { subject: 'Communication', A: 4, fullMark: 5 },
          { subject: 'Leadership', A: 3.5, fullMark: 5 },
          { subject: 'Punctuality', A: 4.5, fullMark: 5 },
          { subject: 'Teamwork', A: 4, fullMark: 5 },
        ],
      });
    }

    const { userId } = req.params;

    const reviews = await Review.find({ revieweeId: userId, status: 'submitted' });

    if (!reviews || reviews.length === 0) {
      return res.json({
        totalReviews: 0,
        radarData: [
          { subject: 'Technical', A: 4, fullMark: 5 },
          { subject: 'Communication', A: 4, fullMark: 5 },
          { subject: 'Leadership', A: 3.5, fullMark: 5 },
          { subject: 'Punctuality', A: 4.5, fullMark: 5 },
          { subject: 'Teamwork', A: 4, fullMark: 5 },
        ],
      });
    }

    const totals = { technical: 0, communication: 0, leadership: 0, punctuality: 0, teamwork: 0 };
    reviews.forEach((r) => {
      totals.technical += r.ratings?.technical || 0;
      totals.communication += r.ratings?.communication || 0;
      totals.leadership += r.ratings?.leadership || 0;
      totals.punctuality += r.ratings?.punctuality || 0;
      totals.teamwork += r.ratings?.teamwork || 0;
    });

    const count = reviews.length;
    const radarData = [
      { subject: 'Technical', A: Number((totals.technical / count).toFixed(1)), fullMark: 5 },
      { subject: 'Communication', A: Number((totals.communication / count).toFixed(1)), fullMark: 5 },
      { subject: 'Leadership', A: Number((totals.leadership / count).toFixed(1)), fullMark: 5 },
      { subject: 'Punctuality', A: Number((totals.punctuality / count).toFixed(1)), fullMark: 5 },
      { subject: 'Teamwork', A: Number((totals.teamwork / count).toFixed(1)), fullMark: 5 },
    ];

    res.json({
      totalReviews: count,
      radarData,
    });
  } catch (error) {
    console.error('Error fetching review summary:', error);
    res.json({
      totalReviews: 0,
      radarData: [
        { subject: 'Technical', A: 4, fullMark: 5 },
        { subject: 'Communication', A: 4, fullMark: 5 },
        { subject: 'Leadership', A: 3.5, fullMark: 5 },
        { subject: 'Punctuality', A: 4.5, fullMark: 5 },
        { subject: 'Teamwork', A: 4, fullMark: 5 },
      ],
    });
  }
});

// POST /api/reviews - Submit a 360 review
router.post('/', verifyToken, async (req, res) => {
  try {
    const { revieweeId, reviewType, period, ratings, feedback, strengths, improvements } = req.body;
    const reviewerId = req.user.userId;

    if (!revieweeId || !ratings) {
      return res.status(400).json({ message: 'Reviewee and ratings are required.' });
    }

    const review = new Review({
      revieweeId,
      reviewerId,
      reviewType: reviewType || 'peer',
      period: period || '2026-Q3',
      ratings: {
        technical: Number(ratings.technical) || 4,
        communication: Number(ratings.communication) || 4,
        leadership: Number(ratings.leadership) || 4,
        punctuality: Number(ratings.punctuality) || 4,
        teamwork: Number(ratings.teamwork) || 4,
      },
      feedback,
      strengths,
      improvements,
      status: 'submitted',
    });

    await review.save();

    const populatedReview = await Review.findById(review._id)
      .populate('revieweeId', 'fullName jobTitle employeeId')
      .populate('reviewerId', 'fullName jobTitle employeeId');

    // Notify reviewee if not self review
    if (reviewerId.toString() !== revieweeId.toString()) {
      const notif = new Notification({
        recipientId: revieweeId,
        type: 'system',
        title: '📝 New Performance Review Submitted',
        message: `${populatedReview.reviewerId.fullName} submitted a 360 review for your ${period || 'current'} evaluation cycle.`,
        link: '/dashboard/okrs',
      });
      await notif.save();

      const io = req.app.get('io');
      if (io) {
        io.to(revieweeId.toString()).emit('new-notification', notif);
      }
    }

    res.status(201).json(populatedReview);
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ message: 'Failed to submit review.', error: error.message });
  }
});

export default router;
