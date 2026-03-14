const express = require('express');
const {
  getHandlingOffices, createHandlingOffice, updateHandlingOffice, deleteHandlingOffice
} = require('../controllers/handlingOffice.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(protect, getHandlingOffices)
  .post(protect, authorize('super-admin'), createHandlingOffice);

router.route('/:id')
  .put(protect, authorize('super-admin'), updateHandlingOffice)
  .delete(protect, authorize('super-admin'), deleteHandlingOffice);

module.exports = router;
