const { Admin, Advocate } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all advocates
// @route   GET /api/advocates
// @access  Private/Super-Admin
exports.getAdvocates = async (req, res, next) => {
  try {
    const advocates = await Advocate.findAll({
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      count: advocates.length,
      data: advocates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single advocate
// @route   GET /api/advocates/:id
// @access  Private/Super-Admin
exports.getAdvocate = async (req, res, next) => {
  try {
    const advocate = await Advocate.findByPk(req.params.id, {
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });
    
    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: advocate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update advocate details
// @route   PUT /api/advocates/:id
// @access  Private/Super-Admin or Owner
exports.updateAdvocate = async (req, res, next) => {
  try {
    let advocate = await Advocate.findByPk(req.params.id);
    
    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && advocate.adminId !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this advocate', 403));
    }
    
    // Update advocate
    advocate = await advocate.update(req.body);
    
    // Fetch updated advocate with admin data
    const updatedAdvocate = await Advocate.findByPk(advocate.id, {
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: updatedAdvocate
    });
  } catch (error) {
    next(error);
  }
};