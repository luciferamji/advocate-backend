const { DocumentLink, Case, Hearing, Client, CaseComment, HearingComment } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { sendEmail } = require('../utils/email');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

// @desc    Create document link
// @route   POST /api/document-links
// @access  Private
exports.createDocumentLink = async (req, res, next) => {
  try {
    const { caseId, hearingId, title, description, expiresIn } = req.body;

    if (!caseId || !title || !expiresIn) {
      return next(new ErrorResponse(
        'Please provide all required fields',
        'VALIDATION_ERROR',
        { required: ['caseId', 'title', 'expiresIn'] }
      ));
    }

    // Verify case exists and user has access
    const caseItem = await Case.findByPk(caseId, {
      include: [{ model: Client, as: 'client' }]
    });

    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND'));
    }

    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized', 'UNAUTHORIZED_ACCESS'));
    }

    // If hearingId provided, verify it exists and belongs to the case
    if (hearingId) {
      const hearing = await Hearing.findOne({
        where: { id: hearingId, caseId }
      });

      if (!hearing) {
        return next(new ErrorResponse('Invalid hearing ID', 'HEARING_NOT_FOUND'));
      }
    }

    // Create document link
    const link = await DocumentLink.create({
      caseId,
      hearingId,
      title,
      description,
      expiresAt: new Date(Date.now() + (expiresIn * 60 * 60 * 1000)),
      createdBy: req.user.id
    });

    // Send email with OTP
    const uploadUrl = `${process.env.FRONTEND_URL}/upload-documents/${link.id}`;
    await sendEmail({
      email: caseItem.client.email,
      subject: 'Document Upload Request',
      html: `
        <h2>Document Upload Request</h2>
        <p>You have received a request to upload documents for case: ${caseItem.caseNumber}</p>
        <p><strong>Title:</strong> ${title}</p>
        ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
        <p><strong>Upload Link:</strong> <a href="${uploadUrl}">${uploadUrl}</a></p>
        <p><strong>OTP:</strong> ${link.plainOtp}</p>
        <p>This link will expire in ${expiresIn} hours.</p>
      `
    });

    // Remove plain OTP before sending response
    const response = link.toJSON();
    delete response.otp;
    delete response.plainOtp;

    res.status(201).json(response);
  } catch (error) {
    next(new ErrorResponse(error.message, 'DOCUMENT_LINK_CREATE_ERROR'));
  }
};

// @desc    Get document links
// @route   GET /api/document-links
// @access  Private
exports.getDocumentLinks = async (req, res, next) => {
  try {
    const {
      status,
      caseId,
      page = 0,
      limit = 10
    } = req.query;

    const whereClause = {};

    if (status) whereClause.status = status;
    if (caseId) whereClause.caseId = caseId;

    // If not super-admin, only show own links
    if (req.user.role !== 'super-admin') {
      whereClause.createdBy = req.user.id;
    }

    const { count, rows } = await DocumentLink.findAndCountAll({
      where: whereClause,
      include: [{
        model: Case,
        as: 'case',
        attributes: ['caseNumber', 'title']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      attributes: { exclude: ['otp'] }
    });

    res.status(200).json({
      links: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'DOCUMENT_LINKS_FETCH_ERROR'));
  }
};

// @desc    Verify OTP
// @route   POST /api/document-links/:id/verify
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return next(new ErrorResponse('OTP is required', 'VALIDATION_ERROR'));
    }

    const link = await DocumentLink.findByPk(req.params.id);

    if (!link) {
      return next(new ErrorResponse('Invalid link', 'LINK_NOT_FOUND'));
    }

    if (link.status !== 'active') {
      return next(new ErrorResponse('Link is no longer active', 'LINK_INACTIVE'));
    }

    if (new Date() > link.expiresAt) {
      link.status = 'expired';
      await link.save();
      return next(new ErrorResponse('Link has expired', 'LINK_EXPIRED'));
    }

    const isMatch = await bcrypt.compare(otp, link.otp);
    
    res.status(200).json({
      verified: isMatch
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'OTP_VERIFICATION_ERROR'));
  }
};

// @desc    Upload documents
// @route   POST /api/document-links/:id/upload
// @access  Public
exports.uploadDocuments = async (req, res, next) => {
  try {
    const link = await DocumentLink.findByPk(req.params.id, {
      include: [{ model: Case, as: 'case' }]
    });

    if (!link) {
      return next(new ErrorResponse('Invalid link', 'LINK_NOT_FOUND'));
    }

    if (link.status !== 'active') {
      return next(new ErrorResponse('Link is no longer active', 'LINK_INACTIVE'));
    }

    if (new Date() > link.expiresAt) {
      link.status = 'expired';
      await link.save();
      return next(new ErrorResponse('Link has expired', 'LINK_EXPIRED'));
    }

    const { comment } = req.body;
    if (!comment) {
      return next(new ErrorResponse('Comment is required', 'VALIDATION_ERROR'));
    }

    // Create comment based on whether it's for a case or hearing
    if (link.hearingId) {
      await HearingComment.create({
        hearingId: link.hearingId,
        text: comment,
        clientName: link.case.client.name,
        clientEmail: link.case.client.email
      });
    } else {
      await CaseComment.create({
        caseId: link.caseId,
        text: comment,
        clientName: link.case.client.name,
        clientEmail: link.case.client.email
      });
    }

    // Mark link as used
    link.status = 'used';
    await link.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully'
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'DOCUMENT_UPLOAD_ERROR'));
  }
};