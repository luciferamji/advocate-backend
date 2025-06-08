const { Invoice, Client } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { generatePdf } = require('../utils/generatePdf');
const { numberToIndianWords } = require('../utils/numberToWords');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
exports.generateInvoice = async (req, res) => {
  try {
    const {
      clientId,
      items,
      total,
      dueDate,
      status,
      comments,
      cgstAmount,
      sgstAmount
    } = req.body;

    if (
      !clientId ||
      !items?.length ||
      !total ||
      !status
    ) {
      return next(
        new ErrorResponse(
          "Please provide all required fields",
          "VALIDATION_ERROR",
          {
            required: [
              "clientId",
              "items",
              "total",
              "courtName",
              "clientContact",
              "status",
            ],
          }
        )
      );
    }

    const invoiceId = `LAWFY-${Date.now().toString()}`;
    const invoiceDate = new Date().toISOString().split("T")[0];
    const amount = Math.round(total);
    const fileName = `${uuidv4()}.pdf`;

    const amountInWords = `${numberToIndianWords(amount)} Only`;

    const cgst = cgstAmount ?? 0;
    const sgst = sgstAmount ?? 0;
    const client = await Client.findByPk(clientId);

    const invoiceData = {
      invoiceId,
      clientName: client.name,
      clientContact: client.contact,
      invoiceDate,
      dueDate,
      amountInWords,
      items,
      total: amount - (cgst + sgst),
      cgst,
      sgst,
      totalWithTax: amount,
    };

    const pdfBuffer = await generatePdf(invoiceData);
    const uploadsDir = path.join(process.env.UPLOAD_DIR || '../uploads');
    const filePath = path.join(uploadsDir, fileName);
    await fs.ensureDir(uploadsDir);
    await fs.writeFile(filePath, pdfBuffer);

    await Invoice.create({
      invoiceId,
      clientId,
      advocateId: client.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      comments: comments || null,
      status: status.toUpperCase(),
      filePath: fileName,
    });
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
    const { page = 1, limit = 10, status, clientId, search = '' } = req.query;

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

    const { rows: invoices, count: total } = await Invoice.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['name']
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
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (
      req.user.role !== 'super-admin' &&
      invoice?.advocateId !== req.user.id
    ) {
      return next(new ErrorResponse('Not authorized to update this invoice', 'UNAUTHORIZED_ACCESS'));
    }

    const [updated] = await Invoice.update(req.body, {
      where: { id: req.params.id }
    });
    if (!updated) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    const updatedInvoice = await Invoice.findByPk(req.params.id);
    res.status(200).json(updatedInvoice);
  } catch (error) {
    console.error("Update invoice error:", error);
    res.status(500).json({ message: "Failed to update invoice" });
  }
};

// @desc    Delete invoice by ID
// @route   DELETE /api/invoices/:id
// @access  Private
exports.deleteInvoice = async (req, res) => {
  try {
    if (req.user.role !== 'super-admin') {
      return next(new ErrorResponse('Not authorized to delete this invoice', 'UNAUTHORIZED_ACCESS'));
    }
    const deleted = await Invoice.destroy({
      where: { id: req.params.id }
    });
    if (!deleted) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.status(200).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Delete invoice error:", error);
    res.status(500).json({ message: "Failed to delete invoice" });
  }
};