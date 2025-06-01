const { Hearing, Case, Client } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

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
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this hearing', 403));
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
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this hearing', 403));
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
    next(error);
  }
};

// @desc    Delete hearing
// @route   DELETE /api/hearings/:id
// @access  Private
exports.deleteHearing = async (req, res, next) => {
  try {
    const hearing = await Hearing.findByPk(req.params.id, {
      include: [{ model: Case, as: 'case' }]
    });

    if (!hearing) {
      return next(new ErrorResponse(`Hearing not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && hearing.case.advocateId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this hearing', 403));
    }

    await hearing.destroy();

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};