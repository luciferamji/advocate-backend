const bcrypt = require('bcryptjs');
const { Admin, Advocate, Case } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

// @desc    Get all advocates
// @route   GET /api/advocates
// @access  Private/Super-Admin
exports.getAdvocates = async (req, res, next) => {
  try {
    const { 
      page = 0, 
      limit = 10, 
      search = '', 
      status = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const whereClause = {
      role: 'advocate'
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const advocates = await Admin.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Advocate,
          required: true
        },
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    const formattedAdvocates = advocates.rows.map(admin => ({
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      barNumber: admin.advocate?.barNumber || '',
      specialization: admin.advocate?.specialization || '',
      status: admin.status || 'active',
      joinDate: admin.createdAt,
      caseCount: admin.cases?.length || 0
    }));

    res.status(200).json({
      advocates: formattedAdvocates,
      pagination: {
        total: advocates.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(advocates.count / parseInt(limit))
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
    const advocate = await Admin.findOne({
      where: {
        id: req.params.id,
        role: 'advocate'
      },
      include: [
        {
          model: Advocate,
          required: true
        },
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ]
    });

    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }

    res.status(200).json({
      id: advocate.id.toString(),
      name: advocate.name,
      email: advocate.email,
      phone: advocate.phone || '',
      barNumber: advocate.advocate.barNumber,
      specialization: advocate.advocate.specialization || '',
      status: advocate.status || 'active',
      joinDate: advocate.createdAt,
      caseCount: advocate.cases.length,
      cases: advocate.cases.map(caseItem => ({
        id: caseItem.id.toString(),
        caseNumber: caseItem.caseNumber,
        title: caseItem.title,
        status: caseItem.status,
        createdAt: caseItem.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create advocate
// @route   POST /api/advocates
// @access  Private/Super-Admin
exports.createAdvocate = async (req, res, next) => {
  try {
    const { name, email, phone, barNumber, specialization } = req.body;

    // Check if email exists
    const existingUser = await Admin.findOne({ where: { email } });
    if (existingUser) {
      return next(new ErrorResponse('Email already in use', 400));
    }

    // Generate random password
    const password = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = await Admin.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'advocate',
      status: 'active'
    });

    // Create advocate profile
    await Advocate.create({
      adminId: admin.id,
      barNumber,
      specialization
    });

    res.status(201).json({
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      barNumber,
      specialization: specialization || '',
      status: admin.status,
      joinDate: admin.createdAt,
      password // Include temporary password in response
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update advocate
// @route   PUT /api/advocates/:id
// @access  Private/Super-Admin
exports.updateAdvocate = async (req, res, next) => {
  try {
    const advocate = await Admin.findOne({
      where: {
        id: req.params.id,
        role: 'advocate'
      },
      include: [
        {
          model: Advocate,
          required: true
        }
      ]
    });

    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }

    const { name, email, phone, barNumber, specialization, status } = req.body;

    // Check if email is being changed and already exists
    if (email && email !== advocate.email) {
      const existingUser = await Admin.findOne({ where: { email } });
      if (existingUser) {
        return next(new ErrorResponse('Email already in use', 400));
      }
    }

    // Update admin details
    advocate.name = name || advocate.name;
    advocate.email = email || advocate.email;
    advocate.phone = phone || advocate.phone;
    advocate.status = status || advocate.status;
    await advocate.save();

    // Update advocate details
    advocate.advocate.barNumber = barNumber || advocate.advocate.barNumber;
    advocate.advocate.specialization = specialization || advocate.advocate.specialization;
    await advocate.advocate.save();

    res.status(200).json({
      id: advocate.id.toString(),
      name: advocate.name,
      email: advocate.email,
      phone: advocate.phone || '',
      barNumber: advocate.advocate.barNumber,
      specialization: advocate.advocate.specialization || '',
      status: advocate.status,
      joinDate: advocate.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete advocate
// @route   DELETE /api/advocates/:id
// @access  Private/Super-Admin
exports.deleteAdvocate = async (req, res, next) => {
  try {
    const advocate = await Admin.findOne({
      where: {
        id: req.params.id,
        role: 'advocate'
      },
      include: [
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ]
    });

    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }

    // Check if advocate has any cases
    if (advocate.cases.length > 0) {
      return next(new ErrorResponse('Cannot delete advocate with active cases', 400));
    }

    // Delete advocate profile and admin user
    await Advocate.destroy({ where: { adminId: advocate.id } });
    await advocate.destroy();

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};