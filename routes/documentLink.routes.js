const express = require('express');
const {
  createDocumentLink,
  getDocumentLinks,
  getDocumentLink,
  verifyOtp,
  uploadDocuments
} = require('../controllers/documentLink.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.route('/')
  .post(protect, createDocumentLink)
  .get(protect, getDocumentLinks);

// Public routes
router.get('/:id', getDocumentLink);
router.post('/:id/verify', verifyOtp);
router.post('/:id/upload', uploadDocuments);

module.exports = router;