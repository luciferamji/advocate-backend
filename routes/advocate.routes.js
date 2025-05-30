const express = require('express');
const { getAdvocates, getAdvocate, updateAdvocate } = require('../controllers/advocate.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

// Routes that need super-admin
router.get('/', authorize('super-admin'), getAdvocates);
router.get('/:id', authorize('super-admin'), getAdvocate);

// Routes that need either super-admin or ownership
router.put('/:id', updateAdvocate);

module.exports = router;