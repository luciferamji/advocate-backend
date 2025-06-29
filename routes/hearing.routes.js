const express = require('express');
const {
  getHearings,
  getHearing,
  createHearing,
  updateHearing,
  deleteHearing,
  getHearingComments,
  createHearingComment,
  deleteHearingComment
} = require('../controllers/hearing.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/comments/:commentId')
  .delete(protect, deleteHearingComment);

// Protected routes
router.route('/')
  .get(protect, getHearings)
  .post(protect, createHearing);

router.route('/:id')
  .get(protect, getHearing)
  .put(protect, updateHearing)
  .delete(protect, deleteHearing);

// Public routes for comments
router.route('/:id/comments')
  .get(protect,getHearingComments)
  .post(protect,createHearingComment);

module.exports = router;