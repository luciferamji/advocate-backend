const express = require('express');
const { initiateCall } = require('../controllers/call.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.post('/initiate', initiateCall);

module.exports = router;
