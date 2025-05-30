const express = require('express');
const { 
  getCases, 
  getCase, 
  createCase, 
  updateCase, 
  deleteCase, 
  addCaseComment,
  uploadCaseCommentDocument
} = require('../controllers/case.controller');
const { protect, checkOwnership } = require('../middleware/auth.middleware');
const { Case } = require('../models');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.route('/')
  .get(getCases)
  .post(createCase);

router.route('/:id')
  .get(checkOwnership(Case, 'id'), getCase)
  .put(checkOwnership(Case, 'id'), updateCase)
  .delete(checkOwnership(Case, 'id'), deleteCase);

router.post('/:id/comments', checkOwnership(Case, 'id'), addCaseComment);
router.post('/comments/:id/documents', uploadCaseCommentDocument);

module.exports = router;