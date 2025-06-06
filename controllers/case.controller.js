const { Case, Client, Admin, CaseComment, CaseCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const { upload } = require('../utils/fileUpload');
const { moveFileFromTemp } = require('../utils/fileTransfer');

// @desc    Get all cases
// @route   GET /api/cases
// @access  Private
exports.getCases = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      search = '',
      status = '',
      clientId = ''
    } = req.query;

    const whereClause = {};

    if (status) whereClause.status = status;
    if (clientId) whereClause.clientId = clientId;

    if (search) {
      whereClause[Op.or] = [
        { caseNumber: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // If not super-admin, only show own cases
    if (req.user.role !== 'super-admin') {
      whereClause.advocateId = req.user.id;
    }

    const { count, rows } = await Case.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const cases = rows.map(caseItem => ({
      id: caseItem.id.toString(),
      caseNumber: caseItem.caseNumber,
      title: caseItem.title,
      description: caseItem.description,
      clientId: caseItem.client.id.toString(),
      clientName: caseItem.client.name,
      courtName: caseItem.courtName,
      status: caseItem.status,
      nextHearing: caseItem.nextHearing,
      createdAt: caseItem.createdAt,
      updatedAt: caseItem.updatedAt
    }));

    res.status(200).json({
      cases,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CASE_LIST_ERROR'));
  }
};

// @desc    Get single case
// @route   GET /api/cases/:id
// @access  Private
exports.getCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this case', 'UNAUTHORIZED_ACCESS'));
    }

    res.status(200).json({
      id: caseItem.id.toString(),
      caseNumber: caseItem.caseNumber,
      title: caseItem.title,
      description: caseItem.description,
      clientId: caseItem.client.id.toString(),
      clientName: caseItem.client.name,
      courtName: caseItem.courtName,
      status: caseItem.status,
      nextHearing: caseItem.nextHearing,
      createdAt: caseItem.createdAt,
      updatedAt: caseItem.updatedAt
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CASE_FETCH_ERROR'));
  }
};

// @desc    Create new case
// @route   POST /api/cases
// @access  Private
exports.createCase = async (req, res, next) => {
  try {
    const {
      title,
      caseNumber,
      clientId,
      clientName,
      courtName,
      status,
      description,
      nextHearing
    } = req.body;

    // Validate required fields
    if (!title || !caseNumber || !clientId || !courtName) {
      return next(new ErrorResponse(
        'Please provide all required fields',
        'VALIDATION_ERROR',
        { required: ['title', 'caseNumber', 'clientId', 'courtName'] }
      ));
    }

    // Check if case number exists
    const existingCase = await Case.findOne({ where: { caseNumber } });
    if (existingCase) {
      return next(new ErrorResponse('Case number already exists', 'CASE_NUMBER_EXISTS', { caseNumber }));
    }

    // Check if client exists and get the advocate ID
    const client = await Client.findByPk(clientId);
    if (!client) {
      return next(new ErrorResponse('Client not found', 'CLIENT_NOT_FOUND', { clientId }));
    }

    // Check if the user has access to this client
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create case for this client', 'UNAUTHORIZED_ACCESS'));
    }

    // Create case with advocate ID from client's creator
    const caseItem = await Case.create({
      title,
      caseNumber,
      clientId,
      courtName,
      description,
      status: status || 'OPEN',
      nextHearing: nextHearing || null,
      advocateId: client.createdBy // Set advocateId from client's creator
    });

    // Fetch created case with client details
    const newCase = await Case.findByPk(caseItem.id, {
      include: [{
        model: Client,
        as: 'client',
        attributes: ['id', 'name']
      }]
    });

    res.status(201).json({
      success: true,
      data: {
        id: newCase.id.toString(),
        title: newCase.title,
        caseNumber: newCase.caseNumber,
        clientId: newCase.client.id.toString(),
        clientName: newCase.client.name,
        courtName: newCase.courtName,
        status: newCase.status,
        description: newCase.description || '',
        nextHearing: newCase.nextHearing || null,
        createdAt: newCase.createdAt
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CASE_CREATE_ERROR'));
  }
};

// @desc    Update case
// @route   PUT /api/cases/:id
// @access  Private
exports.updateCase = async (req, res, next) => {
  try {
    let caseItem = await Case.findByPk(req.params.id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }
      ]
    });

    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this case', 'UNAUTHORIZED_ACCESS'));
    }

    // Update case
    caseItem = await caseItem.update(req.body);

    res.status(200).json({
      id: caseItem.id.toString(),
      caseNumber: caseItem.caseNumber,
      title: caseItem.title,
      description: caseItem.description,
      clientId: caseItem.client.id.toString(),
      clientName: caseItem.client.name,
      courtName: caseItem.courtName,
      status: caseItem.status,
      nextHearing: caseItem.nextHearing,
      createdAt: caseItem.createdAt,
      updatedAt: caseItem.updatedAt
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CASE_UPDATE_ERROR'));
  }
};

// @desc    Delete case
// @route   DELETE /api/cases/:id
// @access  Private
exports.deleteCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findByPk(req.params.id);

    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this case', 'UNAUTHORIZED_ACCESS'));
    }

    await caseItem.destroy();

    res.status(200).end();
  } catch (error) {
    next(new ErrorResponse(error.message, 'CASE_DELETE_ERROR'));
  }
};

// @desc    Get case comments
// @route   GET /api/cases/:id/comments
// @access  Public
exports.getCaseComments = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;
    const offset = parseInt(page) * parseInt(limit);

    // Step 1: Get the actual count (without JOINs to avoid duplicates)
    const total = await CaseComment.count({
      where: { caseId: req.params.id }
    });

    // Step 2: Get paginated comments with JOINs
    const comments = await CaseComment.findAll({
      where: { caseId: req.params.id },
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
          model: CaseCommentDoc,
          as: 'attachments',
          attributes: ['id', 'fileName', 'fileSize', 'fileType', 'filePath']
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
      ...(comment.adminId ? {
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
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'COMMENT_LIST_ERROR'));
  }
};

// @desc    Create case comment
// @route   POST /api/cases/:id/comments
// @access  Public
exports.createCaseComment = async (req, res, next) => {
  try {
    const { content, clientId, attachments } = req.body;

    // Validate the case exists
    const caseItem = await Case.findByPk(req.params.id);
    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 'CASE_NOT_FOUND'));
    }

    // Create comment with appropriate fields based on user type
    const commentData = {
      caseId: req.params.id,
      text: content
    };

    // If authenticated user (admin/advocate)
    if (req.user) {
      commentData.adminId = req.user.id;
      commentData.creatorType = req.user.role;
    } else {
      return next(new ErrorResponse(
        'Client ID is required',
        'VALIDATION_ERROR',
        { required: ['clientId'] }
      ));

    }

    const comment = await CaseComment.create(commentData);

    // Handle file uploads if present
    if (attachments && attachments.length > 0) {
      // Create document records
      await Promise.all(attachments.map(attachment =>
        CaseCommentDoc.create({
          caseCommentId: comment.id,
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
    const newComment = await CaseComment.findByPk(comment.id, {
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
          model: CaseCommentDoc,
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