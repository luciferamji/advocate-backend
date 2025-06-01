const { Case, Client, Admin, CaseComment, CaseCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const { upload } = require('../utils/fileUpload');

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
      whereClause.createdBy = req.user.id;
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
    next(error);
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
      return next(new ErrorResponse(`Case not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this case', 403));
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
    next(error);
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
      description,
      clientId,
      courtName,
      status,
      nextHearing
    } = req.body;

    // Check if case number exists
    const existingCase = await Case.findOne({ where: { caseNumber } });
    if (existingCase) {
      return next(new ErrorResponse('Case number already exists', 400));
    }

    const caseItem = await Case.create({
      title,
      caseNumber,
      description,
      clientId,
      courtName,
      status,
      nextHearing,
      createdBy: req.user.id
    });

    const newCase = await Case.findByPk(caseItem.id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }
      ]
    });

    res.status(201).json({
      id: newCase.id.toString(),
      caseNumber: newCase.caseNumber,
      title: newCase.title,
      description: newCase.description,
      clientId: newCase.client.id.toString(),
      clientName: newCase.client.name,
      courtName: newCase.courtName,
      status: newCase.status,
      nextHearing: newCase.nextHearing,
      createdAt: newCase.createdAt,
      updatedAt: newCase.updatedAt
    });
  } catch (error) {
    next(error);
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
      return next(new ErrorResponse(`Case not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this case', 403));
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
    next(error);
  }
};

// @desc    Delete case
// @route   DELETE /api/cases/:id
// @access  Private
exports.deleteCase = async (req, res, next) => {
  try {
    const caseItem = await Case.findByPk(req.params.id);

    if (!caseItem) {
      return next(new ErrorResponse(`Case not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this case', 403));
    }

    await caseItem.destroy();

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};

// @desc    Get case comments
// @route   GET /api/cases/:id/comments
// @access  Private
exports.getCaseComments = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10
    } = req.query;

    const comments = await CaseComment.findAndCountAll({
      where: { caseId: req.params.id },
      include: [
        {
          model: Admin,
          as: 'user',
          attributes: ['id', 'name']
        },
        {
          model: CaseCommentDoc,
          as: 'attachments',
          attributes: ['id', 'fileName', 'fileSize', 'fileType', 'filePath']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit)
    });

    const formattedComments = comments.rows.map(comment => ({
      id: comment.id.toString(),
      content: comment.text,
      userId: comment.user.id.toString(),
      userName: comment.user.name,
      createdAt: comment.createdAt,
      attachments: comment.attachments.map(doc => ({
        id: doc.id.toString(),
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        url: `/uploads/cases/${doc.filePath}`
      }))
    }));

    res.status(200).json({
      comments: formattedComments,
      total: comments.count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create case comment
// @route   POST /api/cases/:id/comments
// @access  Private
exports.createCaseComment = async (req, res, next) => {
  try {
    const uploadHandler = upload.array('attachments', 10);

    uploadHandler(req, res, async (err) => {
      if (err) {
        return next(new ErrorResponse(`Problem with file upload: ${err.message}`, 400));
      }

      const comment = await CaseComment.create({
        caseId: req.params.id,
        text: req.body.content,
        createdBy: req.user.id
      });

      if (req.files && req.files.length > 0) {
        await Promise.all(req.files.map(file =>
          CaseCommentDoc.create({
            caseCommentId: comment.id,
            filePath: file.filename,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size
          })
        ));
      }

      const newComment = await CaseComment.findByPk(comment.id, {
        include: [
          {
            model: Admin,
            as: 'user',
            attributes: ['id', 'name']
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
        userId: newComment.user.id.toString(),
        userName: newComment.user.name,
        createdAt: newComment.createdAt,
        attachments: newComment.attachments.map(doc => ({
          id: doc.id.toString(),
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          fileType: doc.fileType,
          url: `/uploads/cases/${doc.filePath}`
        }))
      });
    });
  } catch (error) {
    next(error);
  }
};