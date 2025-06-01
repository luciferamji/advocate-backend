const express = require('express');
const {
  getCases,
  createCase,
  getCaseComments,
  createCaseComment
} = require('../controllers/case.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.route('/')
  .get(getCases)
  .post(createCase);

router.route('/:id/comments')
  .get(getCaseComments)
  .post(createCaseComment);

module.exports = router;