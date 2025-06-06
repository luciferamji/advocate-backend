const { Hearing, Case, Client, Admin, HearingComment, HearingCommentDoc,sequelize } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const { upload } = require('../utils/fileUpload');
const { moveFileFromTemp } = require('../utils/fileTransfer');
const { deleteFile } = require('../utils/fileDelete');

// @desc    Get all hearings
// @route   GET /api/hearings
// @access  Private
exports.getHearings = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      caseId,
      startDate,
      endDate
    } = req.query;

    const whereClause = {};

    if (caseId) whereClause.caseId = caseId;

    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    // If not super-admin, only show hearings for own cases
    const caseWhereClause = {};
    if (req.user.role !== 'super-admin') {
      caseWhereClause.advocateId = req.user.id;
    }

    const { count, rows } = await Hearing.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Case,
          as: 'case',
          where: caseWhereClause,
          required: true,
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const hearings = rows.map(hearing => ({
      id: hearing.id.toString(),
      caseId: hearing.case.id.toString(),
      caseName: hearing.case.title,
      clientId: hearing.case.client.id.toString(),
      clientName: hearing.case.client.name,
      date: hearing.date,
      time: hearing.time,
      courtName: hearing.courtName,
      purpose: hearing.purpose,
      judge: hearing.judge,
      room: hearing.room,
      status: hearing.status,
      notes: hearing.notes
    }));

    res.status(200).json({
      hearings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'HEARING_LIST_ERROR'));
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
          as: 'case',
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!hearing) {
      return next(new ErrorResponse('Hearing not found', 'HEARING_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this hearing', 'UNAUTHORIZED_ACCESS'));
    }

    res.status(200).json({
      id: hearing.id.toString(),
      caseId: hearing.case.id.toString(),
      caseName: hearing.case.title,
      clientId: hearing.case.client.id.toString(),
      clientName: hearing.case.client.name,
      date: hearing.date,
      time: hearing.time,
      courtName: hearing.courtName,
      purpose: hearing.purpose,
      judge: hearing.judge,
      room: hearing.room,
      status: hearing.status,
      notes: hearing.notes
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'HEARING_FETCH_ERROR'));
  }
};

// @desc    Create new hearing
// @route   POST /api/hearings
// @access  Private
exports.createHearing = async (req, res, next) => {
  try {
    const {
      caseId,
      date,
      time,
      courtName,
      purpose,
      judge,
      room,
      status,
      notes
    } = req.body;

    if (!caseId || !date || !time || !courtName) {
      return next(new ErrorResponse(
        'Please provide all required fields',
        'VALIDATION_ERROR',
        { required: ['caseId', 'date', 'time', 'courtName'] }
      ));
    }

    // Check if case exists and user has access
    const caseItem = await Case.findByPk(caseId, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND', { caseId }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create hearing for this case', 'UNAUTHORIZED_ACCESS'));
    }

    const hearing = await Hearing.create({
      caseId,
      date,
      time,
      courtName,
      purpose,
      judge,
      room,
      status,
      notes
    });

    res.status(201).json({
      id: hearing.id.toString(),
      caseId: caseItem.id.toString(),
      caseName: caseItem.title,
      clientId: caseItem.client.id.toString(),
      clientName: caseItem.client.name,
      date: hearing.date,
      time: hearing.time,
      courtName: hearing.courtName,
      purpose: hearing.purpose,
      judge: hearing.judge,
      room: hearing.room,
      status: hearing.status,
      notes: hearing.notes
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'HEARING_CREATE_ERROR'));
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
          as: 'case',
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    if (!hearing) {
      return next(new ErrorResponse('Hearing not found', 'HEARING_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this hearing', 'UNAUTHORIZED_ACCESS'));
    }

    // Update hearing
    hearing = await hearing.update(req.body);

    res.status(200).json({
      id: hearing.id.toString(),
      caseId: hearing.case.id.toString(),
      caseName: hearing.case.title,
      clientId: hearing.case.client.id.toString(),
      clientName: hearing.case.client.name,
      date: hearing.date,
      time: hearing.time,
      courtName: hearing.courtName,
      purpose: hearing.purpose,
      judge: hearing.judge,
      room: hearing.room,
      status: hearing.status,
      notes: hearing.notes
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'HEARING_UPDATE_ERROR'));
  }
};

// @desc    Delete hearing
// @route   DELETE /api/hearings/:id
// @access  Private
exports.deleteHearing = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const hearing = await Hearing.findByPk(req.params.id, { transaction });

    if (!hearing) {
      return next(new ErrorResponse('Hearing not found', 'HEARING_NOT_FOUND', { id: req.params.id }));
    }

    if (req.user.role !== 'super-admin' && hearing.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this hearing', 'UNAUTHORIZED_ACCESS'));
    }

    // 🎯 Get all hearing comments
    const hearingComments = await HearingComment.findAll({
      where: { hearingId: hearing.id },
      attributes: ['id'],
      transaction
    });
    const hearingCommentIds = hearingComments.map(hc => hc.id);

    // 📂 Get hearing comment docs and delete files
    const hearingDocs = await HearingCommentDoc.findAll({
      where: { hearingCommentId: hearingCommentIds },
      attributes: ['filePath'],
      transaction
    });

    await HearingCommentDoc.destroy({
      where: { hearingCommentId: hearingCommentIds },
      transaction
    });

    hearingDocs.forEach(doc => deleteFile(doc.filePath.replace(/^\/+/, '')));

    // 🗑 Delete hearing comments
    await HearingComment.destroy({
      where: { id: hearingCommentIds },
      transaction
    });

    // 🗑 Delete the hearing itself
    await hearing.destroy({ transaction });

    await transaction.commit();
    res.status(200).end();
  } catch (error) {
    await transaction.rollback();
    next(new ErrorResponse(error.message, 'HEARING_DELETE_ERROR'));
  }
};

// @desc    Get hearing comments
// @route   GET /api/hearings/:id/comments
// @access  Public
exports.getHearingComments = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const offset = parseInt(page) * parseInt(limit);

    // Step 1: Get total count without JOINs
    const total = await HearingComment.count({
      where: { hearingId: req.params.id }
    });

    // Step 2: Get paginated rows with includes
    const comments = await HearingComment.findAll({
      where: { hearingId: req.params.id },
      include: [
        {
          model: Admin,
          as: 'user',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: HearingCommentDoc,
          as: 'attachments',
          attributes: ['id', 'fileName', 'fileSize', 'fileType', 'filePath']
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [[sortBy, order.toUpperCase()]],
      limit: parseInt(limit),
      offset
    });

    const formattedComments = comments.map(comment => ({
      id: comment.id.toString(),
      content: comment.text,
      createdAt: comment.createdAt,
      creatorType: comment.creatorType,
      ...(comment.user ? {
        userId: comment.user.id.toString(),
        userName: comment.user.name,
        isAdmin: true
      } : {
        userId: comment.client.id.toString(),
        userName: comment.client.name,
        isAdmin: false
      }),
      attachments: comment.attachments.map(doc => ({
        id: doc.id.toString(),
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        url: `${doc.filePath}`
      }))
    }));

    res.status(200).json({
      comments: formattedComments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'COMMENT_LIST_ERROR'));
  }
};

// @desc    Create hearing comment
// @route   POST /api/hearings/:id/comments
// @access  Public
exports.createHearingComment = async (req, res, next) => {
  try {
    const { content, clientId, attachments } = req.body;

    // Validate the hearing exists
    const hearing = await Hearing.findByPk(req.params.id);
    if (!hearing) {
      return next(new ErrorResponse('Hearing not found', 'HEARING_NOT_FOUND'));
    }

    // Create comment with appropriate fields based on user type
    const commentData = {
      hearingId: req.params.id,
      text: content
    };

    // If authenticated user (admin/advocate)
    if (req.user) {
      commentData.adminId = req.user.id;
      commentData.creatorType = req.user.role;
    } else {
      // If client
      
        return next(new ErrorResponse(
          'Client ID is required',
          'VALIDATION_ERROR',
          { required: ['clientId'] }
        ));
    }

    const comment = await HearingComment.create(commentData);

    // Handle file uploads if present
    if (attachments && attachments.length > 0) {
      // Create document records
      await Promise.all(attachments.map(attachment =>
        HearingCommentDoc.create({
          hearingCommentId: comment.id,
          filePath: attachment.url,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize
        })
      ));

      await Promise.all(attachments.map(attachment =>
        moveFileFromTemp(attachment.url)
      ));
    }

    // Fetch the created comment with all associations
    const newComment = await HearingComment.findByPk(comment.id, {
      include: [
        {
          model: Admin,
          as: 'user',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name'],
          required: false
        },
        {
          model: HearingCommentDoc,
          as: 'attachments',
          attributes: ['id', 'fileName', 'fileSize', 'fileType', 'filePath']
        }
      ]
    });

    res.status(201).json({
      id: newComment.id.toString(),
      content: newComment.text,
      createdAt: newComment.createdAt,
      creatorType: newComment.creatorType,
      ...(newComment.adminId ? {
        userId: newComment.user.id.toString(),
        userName: newComment.user.name
      } : {
        clientId: newComment.client.id.toString(),
        clientName: newComment.client.name,
      }),
      attachments: newComment.attachments.map(doc => ({
        id: doc.id.toString(),
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        url: `${doc.filePath}`
      }))
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'COMMENT_CREATE_ERROR'));
  }
};