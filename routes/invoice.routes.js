const express = require('express');
const {
  generateInvoice,
  getInvoices
} = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router();

// Protected routes
router.route('/generate')
  .post(protect, generateInvoice);

module.exports = router;