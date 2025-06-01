const express = require('express');
const { 
  login, 
  logout, 
  getMe, 
  updateDetails, 
  updatePassword 
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/update-details', protect, updateDetails);
router.put('/update-password', protect, updatePassword);

module.exports = router;