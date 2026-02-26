const express = require('express');
const {
  generateInvoice,
  getInvoices,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  downloadInvoicesExcel
} = require('../controllers/invoice.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Nested payment routes
const paymentRouter = require('./invoicePayment.routes');
router.use('/:invoiceId/payments', paymentRouter);

// Protected routes
router.route('/generate')
  .post(protect, generateInvoice);

router.route('/download/excel')
  .get(protect, authorize('super-admin'), downloadInvoicesExcel);

router.route('/')
  .get(protect, getInvoices);

router.route('/:id')
  .get(protect, getInvoice)
  .put(protect, updateInvoice)
  .delete(protect, deleteInvoice);

module.exports = router;