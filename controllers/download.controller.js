const path = require('path');
const fs = require('fs');
const { CaseCommentDoc, HearingCommentDoc, Case, Hearing } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Download file
// @route   GET /api/download/:fileId
// @access  Private
exports.downloadFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    // Check both case and hearing comment docs
    let file = await CaseCommentDoc.findByPk(fileId, {
      include: [{
        model: CaseComment,
        as: 'comment',
        include: [{
          model: Case,
          as: 'case'
        }]
      }]
    });

    if (!file) {
      file = await HearingCommentDoc.findByPk(fileId, {
        include: [{
          model: HearingComment,
          as: 'comment',
          include: [{
            model: Hearing,
            as: 'hearing',
            include: [{
              model: Case,
              as: 'case'
            }]
          }]
        }]
      });
    }

    if (!file) {
      return next(new ErrorResponse('File not found', 'FILE_NOT_FOUND'));
    }

    // Check access rights
    if (req.user.role !== 'super-admin') {
      const caseItem = file.comment.case || file.comment.hearing.case;
      if (caseItem.createdBy !== req.user.id) {
        return next(new ErrorResponse('Not authorized to download this file', 'UNAUTHORIZED_ACCESS'));
      }
    }

    const filePath = path.join(process.env.UPLOAD_DIR || '../uploads', file.filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return next(new ErrorResponse('File not found on server', 'FILE_NOT_FOUND'));
    }

    // Set headers
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);

    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Handle errors
    fileStream.on('error', (error) => {
      next(new ErrorResponse('Error streaming file', 'FILE_STREAM_ERROR'));
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'FILE_DOWNLOAD_ERROR'));
  }
};