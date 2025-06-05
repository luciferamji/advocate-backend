const express = require('express');
const {
  createDocumentLink,
  getDocumentLinks,
  getDocumentLink,
  verifyOtp,
  createComment
} = require('../controllers/documentLink.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkChunk, uploadChunk, completeUpload } = require('../controllers/upload.controller');
const router = express.Router();

// Protected routes
router.route('/')
  .post(protect, createDocumentLink)
  .get(protect, getDocumentLinks);

// Public routes
router.get('/:id', getDocumentLink);
router.post('/:id/verify', verifyOtp);
router.post('/:id/comments', createComment);
router.get('/upload/chunk', protect, checkChunk);
router.post('/upload/chunk', protect, uploadChunk);
router.post('/upload/complete', protect, completeUpload);

module.exports = router;