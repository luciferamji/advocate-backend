const express = require('express');
const { 
  getCalendarData, 
  getTodaysHearings, 
  getUpcomingHearings 
} = require('../controllers/calendar.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);

router.get('/', getCalendarData);
router.get('/today', getTodaysHearings);
router.get('/upcoming', getUpcomingHearings);

module.exports = router;