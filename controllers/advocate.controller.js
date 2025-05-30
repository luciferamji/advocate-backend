const { Admin, Advocate } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all advocates
// @route   GET /api/advocates
// @access  Private/Super-Admin
exports.getAdvocates = async (req, res, next) => {
  try {
    const { page = 0, limit = 10, search = '', status = '' } = req.query;

    const offset = parseInt(page) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause['$Admin.name$'] = {
        [Op.iLike]: `%${search}%`
      };
    }

    const advocates = await Advocate.findAndCountAll({
      include: [
        {
          model: Admin,
          attributes: ['id', 'name', 'email', 'role']
        }
      ],
      where: whereClause,
      limit: parsedLimit,
      offset: offset,
      distinct: true // ensures correct count when using include
    });
      const formattedAdvocates = advocates.rows.map(advocate => {
      const admin = advocate.admin;
      return {
        id: admin?.id?.toString() || '',
        name: admin?.name || 'N/A',
        email: admin?.email || 'N/A',
        phone: admin?.phone || 'N/A',
        barNumber: advocate.barNumber || 'N/A',
        specialization: advocate.specialization || 'N/A',
        status: admin?.status === 'inactive' ? 'inactive' : 'active',
        joinDate: admin?.createdAt ? new Date(admin.createdAt).toISOString() : undefined,
        caseCount: 0 // Add logic here if needed to count cases per advocate
      };
    });
    res.status(200).json({
      success: true,
      data: {
       advocates: formattedAdvocates,
       total:advocates.count,
      }
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