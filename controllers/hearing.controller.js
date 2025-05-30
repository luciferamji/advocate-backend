const { Hearing, Case, HearingComment, HearingCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const upload = require('../utils/fileUpload');
const { Op } = require('sequelize');

// @desc    Get all hearings
// @route   GET /api/hearings
// @access  Private
exports.getHearings = async (req, res, next) => {
  try {
    let query = {};
    
    // Filter by case if provided
    if (req.query.caseId) {
      query.caseId = req.query.caseId;
    }
    
    // Filter by date range if provided
    if (req.query.startDate && req.query.endDate) {
      query.hearingDate = {
        [Op.between]: [
          new Date(req.query.startDate),
          new Date(req.query.endDate)
        ]
      };
    } else if (req.query.startDate) {
      query.hearingDate = {
        [Op.gte]: new Date(req.query.startDate)
      };
    } else if (req.query.endDate) {
      query.hearingDate = {
        [Op.lte]: new Date(req.query.endDate)
      };
    }
    
    const hearings = await Hearing.findAll({
      where: query,
      include: [
        {
          model: Case,
          as: 'case',
          where: req.user.role !== 'super-admin' ? { createdBy: req.user.id } : {},
          required: true
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      count: hearings.length,
      data: hearings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single hearing
// @route   GET /api/hearings/:id
// @access  Private
exports.getHearing = async (req, res, next) => {
  try {
    const hearing = await Hearing.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'case'
        },
        {
          model: HearingComment,
          as: 'comments',
          include: [
            {
              model: HearingCommentDoc,
              as: 'documents'
            }
          ]
        }
      ]
    });
    
    if (!hearing) {
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this hearing', 403));
    }
    
    res.status(200).json({
      success: true,
      data: hearing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new hearing
// @route   POST /api/hearings
// @access  Private
exports.createHearing = async (req, res, next) => {
  try {
    // Check if case exists
    const caseItem = await Case.findByPk(req.body.caseId);
    
    if (!caseItem) {
      return next(new ErrorResponse(`Case not found with id of ${req.body.caseId}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create hearing for this case', 403));
    }
    
    const hearing = await Hearing.create(req.body);
    
    res.status(201).json({
      success: true,
      data: hearing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update hearing
// @route   PUT /api/hearings/:id
// @access  Private
exports.updateHearing = async (req, res, next) => {
  try {
    let hearing = await Hearing.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'case'
        }
      ]
    });
    
    if (!hearing) {
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this hearing', 403));
    }
    
    // Update hearing
    hearing = await hearing.update(req.body);
    
    res.status(200).json({
      success: true,
      data: hearing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete hearing
// @route   DELETE /api/hearings/:id
// @access  Private
exports.deleteHearing = async (req, res, next) => {
  try {
    const hearing = await Hearing.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'case'
        }
      ]
    });
    
    if (!hearing) {
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this hearing', 403));
    }
    
    await hearing.destroy();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to hearing
// @route   POST /api/hearings/:id/comments
// @access  Private
exports.addHearingComment = async (req, res, next) => {
  try {
    const hearing = await Hearing.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'case'
        }
      ]
    });
    
    if (!hearing) {
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to add comment to this hearing', 403));
    }
    
    // Create comment
    const comment = await HearingComment.create({
      hearingId: hearing.id,
      text: req.body.text,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload document to hearing comment
// @route   POST /api/hearings/comments/:id/documents
// @access  Private
exports.uploadHearingCommentDocument = async (req, res, next) => {
  try {
    const comment = await HearingComment.findByPk(req.params.id, {
      include: [
        {
          model: Hearing,
          as: 'hearing',
          include: [
            {
              model: Case,
              as: 'case'
            }
          ]
        }
      ]
    });
    
    if (!comment) {
      return next(new ErrorResponse(`Comment not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && comment.hearing.case.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to upload document to this comment', 403));
    }
    
    // Handle file upload
    const uploadHandler = upload.single('document');
    
    uploadHandler(req, res, async (err) => {
      if (err) {
        return next(new ErrorResponse(`Problem with file upload: ${err.message}`, 400));
      }
      
      if (!req.file) {
        return next(new ErrorResponse('Please upload a file', 400));
      }
      
      // Create document record
      const document = await HearingCommentDoc.create({
        hearingCommentId: comment.id,
        filePath: req.file.path,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size
      });
      
      res.status(201).json({
        success: true,
        data: document
      });
    });
  } catch (error) {
    next(error);
  }
};