const { Invoice, Client, Sequelize, Admin, sequelize } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { generatePdf } = require('../utils/generatePdf');
const { numberToIndianWords } = require('../utils/numberToWords');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const { generateInitialInvoiceEmail } = require('../emailTemplates/invoiceInitial')
const { generateInvoiceStatusUpdateEmail } = require('../emailTemplates/invoiceStatusupdate');
const { sendEmail } = require('../utils/email')

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const padSerial = (num, length = 11) => {
  return `LAWFY${num.toString().padStart(length, '0')}`;
};

exports.generateInvoice = async (req, res, next) => {
  try {
    const {
      clientId,
      items,
      total,
      dueDate,
      status,
      comments,
      cgst,
      sgst,
      igst,
      clientGstNo,
    } = req.body;

    if (!clientId || !items?.length || !total || !status) {
      return next(
        new ErrorResponse(
          "Please provide all required fields",
          "VALIDATION_ERROR",
          {
            required: ["clientId", "items", "total", "status"],
          }
        )
      );
    }


    const lastInvoice = await Invoice.findOne({
      order: [['serialNumber', 'DESC']],
    });

    const newSerialNumber = lastInvoice?.serialNumber
      ? Number(lastInvoice.serialNumber) + 1
      : 1000;

    const invoiceId = padSerial(newSerialNumber);
    const invoiceDate = new Date().toISOString().split("T")[0];
    const amount = Number(parseFloat(total).toFixed(2));
    const fileName = `${uuidv4()}.pdf`;
    const cgstN = cgst ? Number(parseFloat(cgst).toFixed(2)) : 0;
    const sgstN = sgst ? Number(parseFloat(sgst).toFixed(2)) : 0;
    const igstN = igst ? Number(parseFloat(igst).toFixed(2)) : 0;
    const amountInWords = `${numberToIndianWords(amount)} Only`;

    const client = await Client.findByPk(clientId);
    if (!client) {
      return next(new ErrorResponse("Client not found", "NOT_FOUND"));
    }

    const advocate = await Admin.findByPk(client.createdBy);
    if (!advocate) {
      return next(new ErrorResponse("Advocate not found", "NOT_FOUND"));
    }

    const invoiceData = {
      invoiceId,
      clientName: client.name,
      clientContact: client.phone,
      clientAddress: client.address,
      invoiceDate,
      dueDate,
      amountInWords,
      items,
      total: amount - (cgstN + sgstN + igstN),
      isGst: cgstN > 0 || sgstN > 0 || igstN > 0,
      cgst: cgstN,
      sgst: sgstN,
      igst: igstN,
      totalWithTax: amount,
      clientGstNo
    };

    const pdfBuffer = await generatePdf(invoiceData, 'invoiceTemplate.ejs');
    const uploadsDir = path.join(process.env.UPLOAD_DIR || '../uploads');
    const filePath = path.join(uploadsDir, fileName);
    await fs.ensureDir(uploadsDir);
    await fs.writeFile(filePath, pdfBuffer);

    await Invoice.create({
      serialNumber: newSerialNumber,
      invoiceId,
      clientId,
      advocateId: client.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      comments: comments || null,
      status: status.toUpperCase(),
      filePath: fileName,
      amount: amount,
      paidAmount: 0,
    });

    sendEmail(generateInitialInvoiceEmail({
      clientName: client.name,
      clientEmail: client.email,
      advocateEmail: advocate.email,
      invoiceId,
      dueDate: new Date(dueDate).toISOString().split("T")[0],
      invoiceAttachmentPath: filePath
    }));

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=invoice.pdf");
    res.status(200).end(pdfBuffer);
  } catch (error) {
    console.error("Invoice generation error:", error);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
};


// @desc    Get invoice by ID
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.status(200).json(invoice);
  } catch (error) {
    console.error("Get invoice error:", error);
    res.status(500).json({ message: "Failed to get invoice" });
  }
};

// @desc    Get all invoices with pagination and filtering
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, clientId, search = '', sortField = 'createdAt', sortOrder = 'DESC' } = req.query;

    const where = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (req.user.role !== 'super-admin') {
      where.advocateId = req.user.id;
    }

    if (search) {
      where[Op.or] = [
        { invoiceId: { [Op.iLike]: `%${search}%` } },
        Sequelize.where(Sequelize.col('client.name'), {
          [Op.iLike]: `%${search}%`
        })
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedFields = ['createdAt', 'dueDate'];
    const orderField = allowedFields.includes(sortField) ? sortField : 'createdAt';
    const orderDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    order = [[orderField, orderDirection]];
    let { rows: invoices, count: total } = await Invoice.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['name', 'phone'],
        }
      ]
    });
    res.status(200).json({
      invoices,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ message: "Failed to get invoices" });
  }
};


// @desc    Update invoice by ID
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res, next) => {
  const t = await sequelize.transaction(); // start transaction
  try {
    let invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client', attributes: ['name', 'email'] },
        { model: Admin, as: 'advocate', attributes: ['email'] }
      ]
    });

    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (
      req.user.role !== 'super-admin' &&
      invoice.advocateId !== req.user.id
    ) {
      await t.rollback();
      return next(new ErrorResponse('Not authorized to update this invoice', 'UNAUTHORIZED_ACCESS'));
    }

    const {
      status,
      comments,
      paymentMode,
      transactionId,
      cancellationReason
    } = req.body;

    const currentStatus = invoice.status;
    const currentPaid = parseFloat(invoice.paidAmount || 0);
    const totalAmount = parseFloat(invoice.amount || 0);

    // Status change validation
    if (status && status !== currentStatus) {
      // PAID invoices cannot be changed
      if (currentStatus === 'PAID') {
        await t.rollback();
        return res.status(400).json({
          message: 'Cannot change status of fully paid invoice. Contact super admin to modify payments.'
        });
      }

      // CANCELLED invoices cannot be changed
      if (currentStatus === 'CANCELLED') {
        await t.rollback();
        return res.status(400).json({
          message: 'Cannot change status of cancelled invoice.'
        });
      }

      // Validate status transitions
      if (status === 'PAID') {
        // Can mark as PAID from UNPAID or PARTIALLY_PAID
        if (!['UNPAID', 'PARTIALLY_PAID'].includes(currentStatus)) {
          await t.rollback();
          return res.status(400).json({
            message: `Cannot mark invoice as PAID from ${currentStatus} status.`
          });
        }
        
        // If marking as PAID, must provide payment details
        if (!paymentMode) {
          await t.rollback();
          return res.status(400).json({
            message: 'Payment mode is required when marking invoice as PAID.'
          });
        }
      }

      // Validate CANCELLED transition
      if (status === 'CANCELLED') {
        // Can cancel from UNPAID or PARTIALLY_PAID
        if (!['UNPAID', 'PARTIALLY_PAID'].includes(currentStatus)) {
          await t.rollback();
          return res.status(400).json({
            message: `Cannot cancel invoice from ${currentStatus} status.`
          });
        }

        // Require cancellation reason
        if (!cancellationReason && !comments) {
          await t.rollback();
          return res.status(400).json({
            message: 'Cancellation reason is required when cancelling invoice.'
          });
        }
      }
    }

    const statusChanged = status && status !== currentStatus;

    // If marking as PAID, create payment record for remaining amount
    if (status === 'PAID' && currentStatus !== 'PAID') {
      const remainingAmount = totalAmount - currentPaid;
      
      if (remainingAmount > 0) {
        const { InvoicePayment } = require('../models');
        await InvoicePayment.create({
          invoiceId: req.params.id,
          amount: remainingAmount,
          paymentMode,
          transactionId: transactionId || null,
          comments: comments || 'Final payment - marked as paid',
          paymentDate: new Date(),
          createdBy: req.user.id
        }, { transaction: t });

        // Update invoice - keep existing comments, don't overwrite
        await Invoice.update(
          {
            paidAmount: totalAmount,
            status: 'PAID'
          },
          {
            where: { id: req.params.id },
            transaction: t
          }
        );
      } else {
        // Already fully paid, just update status
        await Invoice.update(
          {
            status: 'PAID'
          },
          {
            where: { id: req.params.id },
            transaction: t
          }
        );
      }
    } else if (status === 'CANCELLED') {
      // Update to cancelled with reason
      // Store cancellation reason in dedicated field
      // Keep original invoice comments intact
      await Invoice.update(
        {
          status: 'CANCELLED',
          cancellationReason: cancellationReason || comments
        },
        {
          where: { id: req.params.id },
          transaction: t
        }
      );
    } else {
      // Regular update (just updating comments, no status change)
      const updateData = {};
      
      if (comments !== undefined) {
        updateData.comments = comments;
      }
      
      if (Object.keys(updateData).length > 0) {
        await Invoice.update(
          updateData,
          {
            where: { id: req.params.id },
            transaction: t
          }
        );
      }
    }

    // Refetch updated invoice within transaction
    invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Client, as: 'client', attributes: ['name', 'email'] },
        { model: Admin, as: 'advocate', attributes: ['email'] }
      ],
      transaction: t
    });

    // Commit transaction before sending email (optional: or keep in txn if needed)
    await t.commit();

    // Send email only if status changed
    if (statusChanged) {
      sendEmail(
        generateInvoiceStatusUpdateEmail({
          clientName: invoice.client.name,
          clientEmail: invoice.client.email,
          advocateEmail: invoice.advocate.email,
          invoiceId: invoice.invoiceId,
          status: invoice.status
        })
      );
    }

    res.status(200).json(invoice);
  } catch (error) {
    console.error('Update invoice error:', error);
    await t.rollback();
    res.status(500).json({ message: 'Failed to update invoice' });
  }
};

// @desc    Delete invoice by ID
// @route   DELETE /api/invoices/:id
// @access  Private (Super Admin only)
exports.deleteInvoice = async (req, res, next) => {
  const t = await sequelize.transaction();
  
  try {
    if (req.user.role !== 'super-admin') {
      await t.rollback();
      return next(new ErrorResponse('Not authorized to delete this invoice', 'UNAUTHORIZED_ACCESS'));
    }

    const invoice = await Invoice.findByPk(req.params.id, { transaction: t });
    
    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Delete all associated payments first
    const { InvoicePayment } = require('../models');
    await InvoicePayment.destroy({
      where: { invoiceId: req.params.id },
      transaction: t
    });

    // Then delete the invoice
    await Invoice.destroy({
      where: { id: req.params.id },
      transaction: t
    });

    await t.commit();
    res.status(200).json({ message: "Invoice and associated payments deleted successfully" });
  } catch (error) {
    await t.rollback();
    console.error("Delete invoice error:", error);
    res.status(500).json({ message: "Failed to delete invoice" });
  }
};