const { Admin, Advocate, Case, Client } = require('../models');
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

    const offset = parseInt(page) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    const whereClause = {};
    const adminWhereClause = {};

    if (status) {
      adminWhereClause.status = status;
    }

    if (search) {
      adminWhereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const advocates = await Admin.findAndCountAll({
      where: {
        role: 'advocate',
        ...adminWhereClause
      },
      include: [
        {
          model: Advocate,
          required: true,
          where: whereClause
        },
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parsedLimit,
      offset: offset,
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
      total: advocates.count,
      page: parseInt(page),
      limit: parsedLimit
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
          include: [
            {
              model: Client,
              as: 'client',
              attributes: ['name']
            },
            {
              model: Hearing,
              as: 'hearings',
              required: false,
              where: {
                status: 'scheduled'
              },
              order: [['hearingDate', 'ASC']],
              limit: 1
            }
          ]
        }
      ]
    });

    if (!advocate) {
      return next(new ErrorResponse(`Advocate not found with id of ${req.params.id}`, 404));
    }

    const formattedCases = advocate.cases.map(caseItem => ({
      id: caseItem.id.toString(),
      caseNumber: caseItem.caseId,
      title: caseItem.title || '',
      clientName: caseItem.client.name,
      status: caseItem.status.toUpperCase(),
      nextHearing: caseItem.hearings[0]?.hearingDate || undefined
    }));

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
      cases: formattedCases
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
    const { name, email, phone, barNumber, specialization, status } = req.body;

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
      status
    });

    // Create advocate profile
    await Advocate.create({
      adminId: admin.id,
      barNumber,
      specialization
    });

    // TODO: Send email with credentials

    res.status(201).json({
      id: admin.id.toString(),
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      barNumber,
      specialization,
      status: admin.status,
      joinDate: admin.createdAt,
      caseCount: 0
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
    const { name, phone, barNumber, specialization, status } = req.body;

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

    // Update admin details
    if (name) advocate.name = name;
    if (phone) advocate.phone = phone;
    if (status) advocate.status = status;
    await advocate.save();

    // Update advocate details
    if (barNumber) advocate.advocate.barNumber = barNumber;
    if (specialization) advocate.advocate.specialization = specialization;
    await advocate.advocate.save();

    res.status(200).json({
      id: advocate.id.toString(),
      name: advocate.name,
      email: advocate.email,
      phone: advocate.phone,
      barNumber: advocate.advocate.barNumber,
      specialization: advocate.advocate.specialization,
      status: advocate.status,
      joinDate: advocate.createdAt,
      caseCount: await Case.count({ where: { createdBy: advocate.id } })
    });
  } catch (error) {
    next(error);
  }
};