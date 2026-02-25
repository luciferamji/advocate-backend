const express = require('express');
const {
  addPayment,
  getPayments,
  updatePayment,
  deletePayment
} = require('../controllers/invoicePayment.controller');
const { protect } = require('../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

// All routes are protected
router.use(protect);

router.route('/')
  .post(addPayment)
  .get(getPayments);

router.route('/:paymentId')
  .put(updatePayment)
  .delete(deletePayment);

module.exports = router;
