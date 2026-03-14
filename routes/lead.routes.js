const express = require('express');
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead,
  getLeadStats, exportLeads
} = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router.route('/stats')
  .get(protect, authorize('super-admin'), getLeadStats);

router.route('/export')
  .get(protect, authorize('super-admin'), exportLeads);

router.route('/')
  .get(protect, getLeads)
  .post(protect, createLead);

router.route('/:id')
  .get(protect, getLeadById)
  .put(protect, updateLead)
  .delete(protect, authorize('super-admin'), deleteLead);

module.exports = router;
