const express = require('express');
const {
  createDocumentLink,
  getDocumentLinks,
  getDocumentLink,
  verifyOtp,
  createComment
} = require('../controllers/documentLink.controller');
const { protect ,protectTemp} = require('../middleware/auth.middleware');
const { checkChunk, uploadChunk, completeUpload } = require('../controllers/upload.controller');
const { getClientsTemp } = require('../controllers/client.controller');
const router = express.Router();

// Protected routes
router.route('/')
  .post(protect, createDocumentLink)
  .get(protect, getDocumentLinks);

// Public routes
router.get('/:id', getDocumentLink);
router.post('/:id/verify', verifyOtp);
router.post('/:id/comments', protectTemp, createComment);
router.get('/upload/chunk', protectTemp, checkChunk);
router.post('/upload/chunk', protectTemp, uploadChunk);
router.post('/upload/complete', protectTemp, completeUpload);
// router.get('/client',getClientsTemp)

module.exports = router;