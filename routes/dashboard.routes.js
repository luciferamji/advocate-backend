const express = require('express');
const { 
  getDashboardStats, 
  getRecentItems,
  downloadTodayHearingsPdf
} = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/recent', getRecentItems);
router.get('/hearing/download', downloadTodayHearingsPdf);

module.exports = router;