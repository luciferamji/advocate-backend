const bcrypt = require('bcryptjs');
const { Admin, Advocate, Case, Client, sequelize, Invoice } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const { sendEmail} = require('../utils/email');
const {advocateWelcome} = require('../emailTemplates/AdvocateOnboarding');


const validateAdvocate = async (adminId) => {
  const admin = await Admin.findOne({ where: { id: adminId, role: 'advocate' } });
  return !!admin;
};

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
    next(new ErrorResponse(error.message, 'ADVOCATE_LIST_ERROR'));
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
      return next(new ErrorResponse('Advocate not found', 'ADVOCATE_NOT_FOUND', { id: req.params.id }));
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
    next(new ErrorResponse(error.message, 'ADVOCATE_FETCH_ERROR'));
  }
};

// @desc    Create advocate
// @route   POST /api/advocates
// @access  Private/Super-Admin
exports.createAdvocate = async (req, res, next) => {
  try {
    const { name, email, phone, barNumber, specialization } = req.body;

    if (!name || !email || !barNumber) {
      return next(new ErrorResponse(
        'Please provide all required fields',
        'VALIDATION_ERROR',
        { required: ['name', 'email', 'barNumber'] }
      ));
    }

    // Check if email exists
    const existingUser = await Admin.findOne({ where: { email } });
    if (existingUser) {
      return next(new ErrorResponse('Email already in use', 'EMAIL_EXISTS', { email }));
    }

    // Generate strong random password
    const password = Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10) +
      '@' + Math.floor(Math.random() * 100);

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

    // Send welcome email with credentials
    try {
      const emailTemplate = advocateWelcome(name, email, password);
      await sendEmail(emailTemplate);
    } catch (emailError) {
      // Log email error but don't stop the response
      console.error('Failed to send welcome email:', emailError);
    }

    res.status(201).json({
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone || '',
      barNumber,
      specialization: specialization || '',
      status: admin.status,
      joinDate: admin.createdAt
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'ADVOCATE_CREATE_ERROR'));
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
      return next(new ErrorResponse('Advocate not found', 'ADVOCATE_NOT_FOUND', { id: req.params.id }));
    }

    const { name, email, phone, barNumber, specialization, status } = req.body;

    // Check if email is being changed and already exists
    if (email && email !== advocate.email) {
      const existingUser = await Admin.findOne({ where: { email } });
      if (existingUser) {
        return next(new ErrorResponse('Email already in use', 'EMAIL_EXISTS', { email }));
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
    next(new ErrorResponse(error.message, 'ADVOCATE_UPDATE_ERROR'));
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
      return next(new ErrorResponse('Advocate not found', 'ADVOCATE_NOT_FOUND', { id: req.params.id }));
    }

    // Check if advocate has any cases
    if (advocate.cases.length > 0) {
      return next(new ErrorResponse(
        'Cannot delete advocate with active cases',
        'ADVOCATE_HAS_CASES',
        { caseCount: advocate.cases.length }
      ));
    }

    // Delete advocate profile and admin user
    await Advocate.destroy({ where: { adminId: advocate.id } });
    await advocate.destroy();

    res.status(200).end();
  } catch (error) {
    next(new ErrorResponse(error.message, 'ADVOCATE_DELETE_ERROR'));
  }
};

exports.reassignAdvocateClients = async (req, res, next) => {
  const { advocateId } = req.params;
  const { newAdvocateId } = req.body;

  const t = await sequelize.transaction();

  try {
    const isValid = await validateAdvocate(newAdvocateId);
    if (!isValid) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid advocate ID' });
    }

    const clients = await Client.findAll({ where: { createdBy: advocateId }, transaction: t });
    if (clients.length === 0) {
      await t.rollback();
      return res.status(404).json({ message: 'No clients found for this advocate' });
    }

    const clientIds = clients.map(c => c.id);

    await Client.update(
      { createdBy: newAdvocateId },
      { where: { createdBy: advocateId }, transaction: t }
    );

    await Case.update(
      { advocateId: newAdvocateId },
      { where: { clientId: clientIds }, transaction: t }
    );

  await Invoice.update(
      { advocateId: newAdvocateId },
      { where: { advocateId }, transaction: t }
    );

    await t.commit();
    res.status(200).json({ message: 'All clients and cases reassigned to new advocate' });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
