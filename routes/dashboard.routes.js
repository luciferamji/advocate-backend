const express = require('express');
const { 
  getDashboardStats, 
  getRecentItems 
} = require('../controllers/dashboard.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/recent', getRecentItems);

module.exports = router;