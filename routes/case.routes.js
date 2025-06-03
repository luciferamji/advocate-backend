const express = require('express');
const {
  getCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  getCaseComments,
  createCaseComment
} = require('../controllers/case.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.route('/')
  .get(protect, getCases)
  .post(protect, createCase);

router.route('/:id')
  .get(protect, getCase)
  .put(protect, updateCase)
  .delete(protect, deleteCase);

// Public routes for comments
router.route('/:id/comments')
  .get(protect,getCaseComments)
  .post(protect,createCaseComment);

module.exports = router;