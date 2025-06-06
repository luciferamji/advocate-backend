const express = require('express');
const {
  generateInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice
} = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.route('/generate')
  .post(protect, generateInvoice);

router.route('/')
  .get(protect, getInvoices);

router.route('/:id')
  .get(protect, getInvoice)
  .put(protect, updateInvoice)
  .delete(protect, deleteInvoice);

module.exports = router;