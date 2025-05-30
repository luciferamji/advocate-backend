const express = require('express');
const { 
  createUploadLink,
  verifyPin,
  uploadDocument
} = require('../controllers/uploadLink.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.post('/', protect, createUploadLink);

// Public routes
router.post('/:id/verify', verifyPin);
router.post('/:id/upload', uploadDocument);

module.exports = router;