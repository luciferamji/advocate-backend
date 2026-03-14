const { HandlingOffice, Lead } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all handling offices
// @route   GET /api/handling-offices
// @access  Private
exports.getHandlingOffices = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const whereClause = {};
    if (!includeInactive || req.user.role !== 'super-admin') {
      whereClause.status = 'active';
    }

    const offices = await HandlingOffice.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    res.status(200).json({ offices });
  } catch (error) {
    next(new ErrorResponse(error.message, 'OFFICE_LIST_ERROR'));
  }
};

// @desc    Create handling office
// @route   POST /api/handling-offices
// @access  Private (super-admin)
exports.createHandlingOffice = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return next(new ErrorResponse('Office name is required', 'VALIDATION_ERROR'));
    }

    const existing = await HandlingOffice.findOne({ where: { name } });
    if (existing) {
      return next(new ErrorResponse('Office with this name already exists', 'DUPLICATE_OFFICE'));
    }

    const office = await HandlingOffice.create({ name });
    res.status(201).json({ success: true, data: office });
  } catch (error) {
    next(new ErrorResponse(error.message, 'OFFICE_CREATE_ERROR'));
  }
};

// @desc    Update handling office
// @route   PUT /api/handling-offices/:id
// @access  Private (super-admin)
exports.updateHandlingOffice = async (req, res, next) => {
  try {
    const office = await HandlingOffice.findByPk(req.params.id);
    if (!office) {
      return next(new ErrorResponse('Office not found', 'OFFICE_NOT_FOUND'));
    }

    await office.update(req.body);
    res.status(200).json({ success: true, data: office });
  } catch (error) {
    next(new ErrorResponse(error.message, 'OFFICE_UPDATE_ERROR'));
  }
};

// @desc    Delete (deactivate) handling office
// @route   DELETE /api/handling-offices/:id
// @access  Private (super-admin)
exports.deleteHandlingOffice = async (req, res, next) => {
  try {
    const office = await HandlingOffice.findByPk(req.params.id);
    if (!office) {
      return next(new ErrorResponse('Office not found', 'OFFICE_NOT_FOUND'));
    }

    const leadCount = await Lead.count({ where: { handlingOfficeId: office.id } });
    if (leadCount > 0) {
      await office.update({ status: 'inactive' });
      return res.status(200).json({ success: true, message: 'Office deactivated (has linked leads)' });
    }

    await office.destroy();
    res.status(200).json({ success: true, message: 'Office deleted' });
  } catch (error) {
    next(new ErrorResponse(error.message, 'OFFICE_DELETE_ERROR'));
  }
};
