const { Hearing, Case, Client, Admin, HearingComment, HearingCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const { upload } = require('../utils/fileUpload');

// @desc    Get all hearings
// @route   GET /api/hearings
// @access  Private
exports.getHearings = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      caseId,
      advocateId,
      clientId,
      startDate,
      endDate,
      status
    } = req.query;

    const whereClause = {};
    const caseWhereClause = {};

    if (caseId) whereClause.caseId = caseId;
    if (status) whereClause.status = status;
    if (advocateId) caseWhereClause.advocateId = advocateId;
    if (clientId) caseWhereClause.clientId = clientId;

    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    // If not super-admin, only show hearings for own cases
    if (req.user.role !== 'super-admin') {
      caseWhereClause.advocateId = req.user.id;
    }

    const hearings = await Hearing.findAndCountAll({
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
        },
        {
          model: HearingComment,
          as: 'comments',
          include: [
            {
              model: Admin,
              as: 'user',
              attributes: ['id', 'name']
            },
            {
              model: HearingCommentDoc,
              as: 'attachments',
              attributes: ['id', 'fileName', 'fileSize', 'fileType', 'filePath']
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['time', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    const formattedHearings = hearings.rows.map(hearing => ({
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
      notes: hearing.notes,
      comments: hearing.comments.map(comment => ({
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
          url: `/uploads/hearings/${doc.filePath}`
        }))
      }))
    }));

    res.status(200).json({
      hearings: formattedHearings,
      total: hearings.count,
      page: parseInt(page),
      limit: parseInt(limit)
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

    // Check if case exists and user has access
    const caseItem = await Case.findByPk(caseId);
    if (!caseItem) {
      return next(new ErrorResponse('Case not found', 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create hearing for this case', 403));
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

    const newHearing = await Hearing.findByPk(hearing.id, {
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

    res.status(201).json({
      id: newHearing.id.toString(),
      caseId: newHearing.case.id.toString(),
      caseName: newHearing.case.title,
      clientId: newHearing.case.client.id.toString(),
      clientName: newHearing.case.client.name,
      date: newHearing.date,
      time: newHearing.time,
      courtName: newHearing.courtName,
      purpose: newHearing.purpose,
      judge: newHearing.judge,
      room: newHearing.room,
      status: newHearing.status,
      notes: newHearing.notes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create hearing comment
// @route   POST /api/hearings/:id/comments
// @access  Private
exports.createHearingComment = async (req, res, next) => {
  try {
    const hearing = await Hearing.findByPk(req.params.id, {
      include: [{ model: Case, as: 'case' }]
    });

    if (!hearing) {
      return next(new ErrorResponse('Hearing not found', 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to comment on this hearing', 403));
    }

    const uploadHandler = upload.array('attachments', 10);

    uploadHandler(req, res, async (err) => {
      if (err) {
        return next(new ErrorResponse(`Problem with file upload: ${err.message}`, 400));
      }

      const comment = await HearingComment.create({
        hearingId: hearing.id,
        text: req.body.content,
        createdBy: req.user.id
      });

      if (req.files && req.files.length > 0) {
        await Promise.all(req.files.map(file =>
          HearingCommentDoc.create({
            hearingCommentId: comment.id,
            filePath: file.filename,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size
          })
        ));
      }

      const newComment = await HearingComment.findByPk(comment.id, {
        include: [
          {
            model: Admin,
            as: 'user',
            attributes: ['id', 'name']
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
        userId: newComment.user.id.toString(),
        userName: newComment.user.name,
        createdAt: newComment.createdAt,
        attachments: newComment.attachments.map(doc => ({
          id: doc.id.toString(),
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          fileType: doc.fileType,
          url: `/uploads/hearings/${doc.filePath}`
        }))
      });
    });
  } catch (error) {
    next(error);
  }
};