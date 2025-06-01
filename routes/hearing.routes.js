const express = require('express');
const {
  getHearings,
  createHearing,
  createHearingComment
} = require('../controllers/hearing.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.route('/')
  .get(getHearings)
  .post(createHearing);

router.post('/:id/comments', createHearingComment);

module.exports = router;