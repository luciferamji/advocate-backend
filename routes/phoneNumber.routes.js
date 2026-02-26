const express = require('express');
const {
  getPhoneNumbers,
  getPhoneNumber,
  createPhoneNumber,
  updatePhoneNumber,
  deletePhoneNumber
} = require('../controllers/phoneNumber.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Routes accessible by all authenticated users
router.get('/', getPhoneNumbers);
router.get('/:id', getPhoneNumber);

// Routes only for super-admin
router.post('/', authorize('super-admin'), createPhoneNumber);
router.put('/:id', authorize('super-admin'), updatePhoneNumber);
router.delete('/:id', authorize('super-admin'), deletePhoneNumber);

module.exports = router;
