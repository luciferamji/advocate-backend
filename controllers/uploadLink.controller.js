const { UploadLink, Case, CaseComment, CaseCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const sendEmail = require('../utils/email');
const bcrypt = require('bcryptjs');
const upload = require('../utils/fileUpload');

// @desc    Create upload link
// @route   POST /api/upload-links
// @access  Private/Advocate
exports.createUploadLink = async (req, res, next) => {
  try {
    const { caseId, email, phone, expiryHours = 24 } = req.body;

    if (!caseId || !email || !phone) {
      return next(new ErrorResponse(
        'Please provide all required fields',
        'VALIDATION_ERROR',
        { required: ['caseId', 'email', 'phone'] }
      ));
    }

    // Check if case exists and user has access
    const caseItem = await Case.findByPk(caseId);
    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND', { caseId }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create upload link for this case', 'UNAUTHORIZED_ACCESS'));
    }

    // Create upload link
    const uploadLink = await UploadLink.create({
      caseId,
      createdBy: req.user.id,
      email,
      phone,
      expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
    });

    // Send email with link and PIN
    const uploadUrl = `${process.env.FRONTEND_URL}/upload/${uploadLink.id}`;
    await sendEmail({
      email,
      subject: 'Document Upload Link',
      html: `
        <p>Hello,</p>
        <p>You have been requested to upload documents. Please use the following details:</p>
        <p>Link: <a href="${uploadUrl}">${uploadUrl}</a></p>
        <p>PIN: ${uploadLink.plainPin}</p>
        <p>This link will expire in ${expiryHours} hours and can only be used once.</p>
      `
    });

    // Remove plain PIN from response
    const response = uploadLink.toJSON();
    delete response.pin;
    delete response.plainPin;

    res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'UPLOAD_LINK_CREATE_ERROR'));
  }
};

// @desc    Verify PIN
// @route   POST /api/upload-links/:id/verify
// @access  Public
exports.verifyPin = async (req, res, next) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return next(new ErrorResponse('PIN is required', 'VALIDATION_ERROR'));
    }

    const link = await UploadLink.findByPk(req.params.id);

    if (!link) {
      return next(new ErrorResponse('Invalid upload link', 'LINK_NOT_FOUND'));
    }

    if (link.used) {
      return next(new ErrorResponse('This upload link has already been used', 'LINK_ALREADY_USED'));
    }

    if (new Date() > link.expiresAt) {
      return next(new ErrorResponse('This upload link has expired', 'LINK_EXPIRED'));
    }

    const isMatch = await bcrypt.compare(pin, link.pin);
    if (!isMatch) {
      return next(new ErrorResponse('Invalid PIN', 'INVALID_PIN'));
    }

    res.status(200).json({
      success: true,
      message: 'PIN verified successfully'
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'PIN_VERIFICATION_ERROR'));
  }
};

// @desc    Upload document
// @route   POST /api/upload-links/:id/upload
// @access  Public
exports.uploadDocument = async (req, res, next) => {
  try {
    const link = await UploadLink.findByPk(req.params.id);

    if (!link) {
      return next(new ErrorResponse('Invalid upload link', 'LINK_NOT_FOUND'));
    }

    if (link.used) {
      return next(new ErrorResponse('This upload link has already been used', 'LINK_ALREADY_USED'));
    }

    if (new Date() > link.expiresAt) {
      return next(new ErrorResponse('This upload link has expired', 'LINK_EXPIRED'));
    }

    // Handle file upload
    const uploadHandler = upload.single('document');

    uploadHandler(req, res, async (err) => {
      if (err) {
        return next(new ErrorResponse(
          'Problem with file upload',
          'FILE_UPLOAD_ERROR',
          { details: err.message }
        ));
      }

      if (!req.file) {
        return next(new ErrorResponse('Please upload a file', 'NO_FILE_UPLOADED'));
      }

      // Create case comment
      const comment = await CaseComment.create({
        caseId: link.caseId,
        text: 'Document uploaded via secure link',
        createdBy: link.createdBy
      });

      // Create document record
      const document = await CaseCommentDoc.create({
        caseCommentId: comment.id,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      });

      // Mark link as used
      link.used = true;
      await link.save();

      res.status(201).json({
        success: true,
        data: {
          comment,
          document
        }
      });
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'DOCUMENT_UPLOAD_ERROR'));
  }
};