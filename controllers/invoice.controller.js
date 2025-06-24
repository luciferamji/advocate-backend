const { Invoice, Client, Sequelize, Admin } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { generatePdf } = require('../utils/generatePdf');
const { numberToIndianWords } = require('../utils/numberToWords');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');
const { generateInitialInvoiceEmail } = require('../emailTemplates/invoiceInitial')
const { sendEmail } = require('../utils/email')

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
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

    await sendEmail(generateInitialInvoiceEmail({
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