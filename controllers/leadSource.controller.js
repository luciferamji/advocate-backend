const { LeadSource, Lead } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all lead sources
// @route   GET /api/lead-sources
// @access  Private
exports.getLeadSources = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const whereClause = {};
    if (!includeInactive || req.user.role !== 'super-admin') {
      whereClause.status = 'active';
    }

    const sources = await LeadSource.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });

    res.status(200).json({ sources });
  } catch (error) {
    next(new ErrorResponse(error.message, 'SOURCE_LIST_ERROR'));
  }
};

// @desc    Create lead source
// @route   POST /api/lead-sources
// @access  Private (super-admin)
exports.createLeadSource = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return next(new ErrorResponse('Source name is required', 'VALIDATION_ERROR'));
    }

    const existing = await LeadSource.findOne({ where: { name } });
    if (existing) {
      return next(new ErrorResponse('Source with this name already exists', 'DUPLICATE_SOURCE'));
    }

    const source = await LeadSource.create({ name });
    res.status(201).json({ success: true, data: source });
  } catch (error) {
    next(new ErrorResponse(error.message, 'SOURCE_CREATE_ERROR'));
  }
};

// @desc    Update lead source
// @route   PUT /api/lead-sources/:id
// @access  Private (super-admin)
exports.updateLeadSource = async (req, res, next) => {
  try {
    const source = await LeadSource.findByPk(req.params.id);
    if (!source) {
      return next(new ErrorResponse('Source not found', 'SOURCE_NOT_FOUND'));
    }

    await source.update(req.body);
    res.status(200).json({ success: true, data: source });
  } catch (error) {
    next(new ErrorResponse(error.message, 'SOURCE_UPDATE_ERROR'));
  }
};

// @desc    Delete (deactivate) lead source
// @route   DELETE /api/lead-sources/:id
// @access  Private (super-admin)
exports.deleteLeadSource = async (req, res, next) => {
  try {
    const source = await LeadSource.findByPk(req.params.id);
    if (!source) {
      return next(new ErrorResponse('Source not found', 'SOURCE_NOT_FOUND'));
    }

    const leadCount = await Lead.count({ where: { leadSourceId: source.id } });
    if (leadCount > 0) {
      await source.update({ status: 'inactive' });
      return res.status(200).json({ success: true, message: 'Source deactivated (has linked leads)' });
    }

    await source.destroy();
    res.status(200).json({ success: true, message: 'Source deleted' });
  } catch (error) {
    next(new ErrorResponse(error.message, 'SOURCE_DELETE_ERROR'));
  }
};
