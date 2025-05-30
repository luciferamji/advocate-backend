const { Case, Client, Admin, Hearing, CaseComment, CaseCommentDoc } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const upload = require('../utils/fileUpload');

// @desc    Get all cases
// @route   GET /api/cases
// @access  Private
exports.getCases = async (req, res, next) => {
  try {
    let query = {};
    
    // If not super-admin, only show own cases
    if (req.user.role !== 'super-admin') {
      query.createdBy = req.user.id;
    }
    
    // Filter by client if provided
    if (req.query.clientId) {
      query.clientId = req.query.clientId;
    }
    
    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    const cases = await Case.findAll({
      where: query,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['id', 'name', 'clientId', 'email', 'phone']
        },
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      count: cases.length,
      data: cases
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
          attributes: ['id', 'name', 'clientId', 'email', 'phone']
        },
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Hearing,
          as: 'hearings'
        },
        {
          model: CaseComment,
          as: 'comments',
          include: [
            {
              model: CaseCommentDoc,
              as: 'documents'
            }
          ]
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
      success: true,
      data: caseItem
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
    // Add user to req.body
    req.body.createdBy = req.user.id;
    
    // Check if client exists
    const client = await Client.findByPk(req.body.clientId);
    
    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.body.clientId}`, 404));
    }
    
    // Check ownership of client if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to create case for this client', 403));
    }
    
    // Check if case ID already exists
    const existingCase = await Case.findOne({
      where: { caseId: req.body.caseId }
    });
    
    if (existingCase) {
      return next(new ErrorResponse('Case ID already exists', 400));
    }
    
    const caseItem = await Case.create(req.body);
    
    res.status(201).json({
      success: true,
      data: caseItem
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
    let caseItem = await Case.findByPk(req.params.id);
    
    if (!caseItem) {
      return next(new ErrorResponse(`Case not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && caseItem.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this case', 403));
    }
    
    // Check if updating caseId and if it already exists
    if (req.body.caseId && req.body.caseId !== caseItem.caseId) {
      const existingCase = await Case.findOne({
        where: { caseId: req.body.caseId }
      });
      
      if (existingCase) {
        return next(new ErrorResponse('Case ID already exists', 400));
      }
    }
    
    // Update case
    caseItem = await caseItem.update(req.body);
    
    res.status(200).json({
      success: true,
      data: caseItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete case
// @route   DELETE /api/cases/:id
// @access  Private/Super-Admin
exports.deleteCase = async (req, res, next) => {
  try {
    // Check if user is super-admin
    if (req.user.role !== 'super-admin') {
      return next(new ErrorResponse('Not authorized to delete cases', 403));
    }

    const caseItem = await Case.findByPk(req.params.id);
    
    if (!caseItem) {
      return next(new ErrorResponse(`Case not found with id of ${req.params.id}`, 404));
    }
    
    await caseItem.destroy();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};