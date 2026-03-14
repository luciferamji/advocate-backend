const express = require('express');
const {
  getLeadSources, createLeadSource, updateLeadSource, deleteLeadSource
} = require('../controllers/leadSource.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/')
  .get(protect, getLeadSources)
  .post(protect, authorize('super-admin'), createLeadSource);

router.route('/:id')
  .put(protect, authorize('super-admin'), updateLeadSource)
  .delete(protect, authorize('super-admin'), deleteLeadSource);

module.exports = router;
