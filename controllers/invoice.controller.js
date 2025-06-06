const path = require("path");
const ejs = require("ejs");
const fs = require("fs");
const { generatePdf } = require("../utils/generatePdf");
const { Invoice } = require("../models");
const { sequelize } = require("../models");
const numberToWords = require("number-to-words");

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
      clientName,
      clientContact,
      status,
      comments,
    } = req.body;

    if (
      !clientId ||
      !items?.length ||
      !total ||
      !clientName ||
      !clientContact ||
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

    const amountInWords =
      numberToWords.toWords(amount).replace(/\b\w/g, (c) => c.toUpperCase()) +
      " Only";

    await Invoice.create({
      invoiceId,
      clientId,
      advocateId: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      comments: comments || null,
      status: status.toUpperCase(),
    });

    const invoiceData = {
      invoiceId,
      clientName,
      clientContact,
      invoiceDate,
      dueDate,
      amountInWords,
      items,
      total: amount,
    };

    const pdfBuffer = await generatePdf(invoiceData);

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
    const { page = 1, limit = 10, status, clientId, advocateId } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (advocateId) filter.advocateId = advocateId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows: invoices, count: total } = await Invoice.findAndCountAll({
      where: filter,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      invoices,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    res.status(500).json({ message: "Failed to get invoices" });
  }
};

// @desc    Update invoice by ID
// @route   PUT /api/invoices/:id
// @access  Private
exports.updateInvoice = async (req, res) => {
  try {
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