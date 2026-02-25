const { InvoicePayment, Invoice, Admin, sequelize } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

// @desc    Add payment to invoice
// @route   POST /api/invoices/:invoiceId/payments
// @access  Private
exports.addPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    const { invoiceId } = req.params;
    const { amount, paymentMode, transactionId, comments, paymentDate } = req.body;

    if (!amount || !paymentMode) {
      await t.rollback();
      return next(new ErrorResponse('Amount and payment mode are required', 'VALIDATION_ERROR'));
    }

    const invoice = await Invoice.findByPk(invoiceId, { transaction: t });
    
    if (!invoice) {
      await t.rollback();
      return next(new ErrorResponse('Invoice not found', 'NOT_FOUND'));
    }

    if (req.user.role !== 'super-admin' && invoice.advocateId !== req.user.id) {
      await t.rollback();
      return next(new ErrorResponse('Not authorized to add payment to this invoice', 'UNAUTHORIZED_ACCESS'));
    }

    if (invoice.status === 'PAID') {
      await t.rollback();
      return res.status(400).json({ message: 'Invoice is already fully paid' });
    }

    if (invoice.status === 'CANCELLED') {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot add payment to cancelled invoice' });
    }

    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(invoice.paidAmount || 0);
    const totalAmount = parseFloat(invoice.amount || 0);
    const remaining = Math.round((totalAmount - currentPaid) * 100) / 100;

    // Allow small floating point tolerance (0.01)
    if (paymentAmount > remaining + 0.01) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds remaining amount (₹${remaining.toFixed(2)})` 
      });
    }

    // Create payment record
    const payment = await InvoicePayment.create({
      invoiceId,
      amount: paymentAmount,
      paymentMode,
      transactionId: transactionId || null,
      comments: comments || null,
      paymentDate: paymentDate || new Date(),
      createdBy: req.user.id
    }, { transaction: t });

    // Update invoice paid amount and status
    const newPaidAmount = Math.round((currentPaid + paymentAmount) * 100) / 100;
    let newStatus = invoice.status;
    
    // Use tolerance for floating point comparison
    if (newPaidAmount >= totalAmount - 0.01) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await Invoice.update(
      { 
        paidAmount: newPaidAmount,
        status: newStatus
      },
      { 
        where: { id: invoiceId },
        transaction: t 
      }
    );

    // Fetch invoice with client and advocate details for email (before commit)
    const invoiceWithDetails = await Invoice.findByPk(invoiceId, {
      include: [
        { model: Client, as: 'client', attributes: ['name', 'email'] },
        { model: Admin, as: 'advocate', attributes: ['email'] }
      ],
      transaction: t
    });

    await t.commit();

    // Fetch payment with creator details (after commit, no transaction needed)
    const paymentWithDetails = await InvoicePayment.findByPk(payment.id, {
      include: [
        { model: Admin, as: 'creator', attributes: ['id', 'name', 'email'] }
      ]
    });

    // Send payment received email
    const { sendEmail } = require('../utils/email');
    const { generatePaymentReceivedEmail } = require('../emailTemplates/paymentReceived');
    
    sendEmail(generatePaymentReceivedEmail({
      clientName: invoiceWithDetails.client.name,
      clientEmail: invoiceWithDetails.client.email,
      advocateEmail: invoiceWithDetails.advocate.email,
      invoiceId: invoiceWithDetails.invoiceId,
      paymentAmount: paymentAmount,
      totalAmount: totalAmount,
      paidAmount: newPaidAmount,
      remainingAmount: totalAmount - newPaidAmount,
      paymentMode: paymentMode,
      transactionId: transactionId || null,
      status: newStatus
    }));

    res.status(201).json({
      payment: paymentWithDetails,
      invoice: {
        paidAmount: newPaidAmount,
        remainingAmount: totalAmount - newPaidAmount,
        status: newStatus
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Add payment error:', error);
    res.status(500).json({ message: 'Failed to add payment' });
  }
};

// @desc    Get all payments for an invoice
// @route   GET /api/invoices/:invoiceId/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findByPk(invoiceId);
    
    if (!invoice) {
      return next(new ErrorResponse('Invoice not found', 'NOT_FOUND'));
    }

    if (req.user.role !== 'super-admin' && invoice.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to view payments for this invoice', 'UNAUTHORIZED_ACCESS'));
    }

    const payments = await InvoicePayment.findAll({
      where: { invoiceId },
      include: [
        { model: Admin, as: 'creator', attributes: ['id', 'name', 'email'] }
      ],
      order: [['paymentDate', 'DESC']]
    });

    res.status(200).json({
      payments,
      summary: {
        totalAmount: parseFloat(invoice.amount || 0),
        paidAmount: parseFloat(invoice.paidAmount || 0),
        remainingAmount: parseFloat(invoice.amount || 0) - parseFloat(invoice.paidAmount || 0),
        status: invoice.status
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ message: 'Failed to get payments' });
  }
};

// @desc    Update payment
// @route   PUT /api/invoices/:invoiceId/payments/:paymentId
// @access  Super Admin only
exports.updatePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    if (req.user.role !== 'super-admin') {
      await t.rollback();
      return next(new ErrorResponse('Only super admin can update payments', 'UNAUTHORIZED_ACCESS'));
    }

    const { invoiceId, paymentId } = req.params;
    const { amount, paymentMode, transactionId, comments, paymentDate } = req.body;

    const payment = await InvoicePayment.findOne({
      where: { id: paymentId, invoiceId },
      transaction: t
    });

    if (!payment) {
      await t.rollback();
      return next(new ErrorResponse('Payment not found', 'NOT_FOUND'));
    }

    const invoice = await Invoice.findByPk(invoiceId, { transaction: t });
    const oldAmount = parseFloat(payment.amount);
    const newAmount = amount ? parseFloat(amount) : oldAmount;
    const amountDiff = newAmount - oldAmount;

    // Recalculate paid amount
    const currentPaid = parseFloat(invoice.paidAmount || 0);
    const newPaidAmount = currentPaid + amountDiff;
    const totalAmount = parseFloat(invoice.amount || 0);

    if (newPaidAmount > totalAmount) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Updated payment would exceed invoice total (₹${totalAmount})` 
      });
    }

    // Update payment
    await InvoicePayment.update(
      {
        amount: newAmount,
        paymentMode: paymentMode || payment.paymentMode,
        transactionId: transactionId !== undefined ? transactionId : payment.transactionId,
        comments: comments !== undefined ? comments : payment.comments,
        paymentDate: paymentDate || payment.paymentDate
      },
      { 
        where: { id: paymentId },
        transaction: t 
      }
    );

    // Update invoice status
    let newStatus = invoice.status;
    if (newPaidAmount >= totalAmount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else {
      newStatus = 'UNPAID';
    }

    await Invoice.update(
      { 
        paidAmount: newPaidAmount,
        status: newStatus
      },
      { 
        where: { id: invoiceId },
        transaction: t 
      }
    );

    await t.commit();

    const updatedPayment = await InvoicePayment.findByPk(paymentId, {
      include: [
        { model: Admin, as: 'creator', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(200).json({
      payment: updatedPayment,
      invoice: {
        paidAmount: newPaidAmount,
        remainingAmount: totalAmount - newPaidAmount,
        status: newStatus
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Update payment error:', error);
    res.status(500).json({ message: 'Failed to update payment' });
  }
};

// @desc    Delete payment
// @route   DELETE /api/invoices/:invoiceId/payments/:paymentId
// @access  Super Admin only
exports.deletePayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    if (req.user.role !== 'super-admin') {
      await t.rollback();
      return next(new ErrorResponse('Only super admin can delete payments', 'UNAUTHORIZED_ACCESS'));
    }

    const { invoiceId, paymentId } = req.params;

    const payment = await InvoicePayment.findOne({
      where: { id: paymentId, invoiceId },
      transaction: t
    });

    if (!payment) {
      await t.rollback();
      return next(new ErrorResponse('Payment not found', 'NOT_FOUND'));
    }

    const invoice = await Invoice.findByPk(invoiceId, { transaction: t });
    const paymentAmount = parseFloat(payment.amount);
    const currentPaid = parseFloat(invoice.paidAmount || 0);
    const newPaidAmount = currentPaid - paymentAmount;
    const totalAmount = parseFloat(invoice.amount || 0);

    // Delete payment
    await InvoicePayment.destroy({
      where: { id: paymentId },
      transaction: t
    });

    // Update invoice status
    let newStatus = invoice.status;
    if (newPaidAmount >= totalAmount) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    } else {
      newStatus = 'UNPAID';
    }

    await Invoice.update(
      { 
        paidAmount: newPaidAmount,
        status: newStatus
      },
      { 
        where: { id: invoiceId },
        transaction: t 
      }
    );

    await t.commit();

    res.status(200).json({
      message: 'Payment deleted successfully',
      invoice: {
        paidAmount: newPaidAmount,
        remainingAmount: totalAmount - newPaidAmount,
        status: newStatus
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Delete payment error:', error);
    res.status(500).json({ message: 'Failed to delete payment' });
  }
};
