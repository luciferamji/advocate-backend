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