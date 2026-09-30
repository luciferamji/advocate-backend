const express = require('express');
const {
  createLead, getLeads, getLeadById, updateLead, deleteLead, restoreLead, transferLead,
  getAssignableAdvocates, getLeadStats, exportLeads, requestConsultation
} = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Public route - consultation request from website
router.route('/consultation')
  .post(requestConsultation);

// Stats are scoped per user (advocates see their own scope)
router.route('/stats')
  .get(protect, getLeadStats);

router.route('/export')
  .get(protect, authorize('super-admin'), exportLeads);

router.route('/assignable-advocates')
  .get(protect, getAssignableAdvocates);

router.route('/')
  .get(protect, getLeads)
  .post(protect, createLead);

router.route('/:id/transfer')
  .post(protect, transferLead);

router.route('/:id/restore')
  .post(protect, authorize('super-admin'), restoreLead);

router.route('/:id')
  .get(protect, getLeadById)
  .put(protect, updateLead)
  .delete(protect, authorize('super-admin'), deleteLead);

module.exports = router;
