const { Client, Case } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      search = ''
    } = req.query;

    const whereClause = {};

    // If not super-admin, only show own clients
    if (req.user.role !== 'super-admin') {
      whereClause.createdBy = req.user.id;
    }

    // Add search condition
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { clientId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Client.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const clients = rows.map(client => ({
      id: client.id.toString(),
      name: client.name,
      clientId: client.clientId,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      caseCount: client.cases?.length || 0,
      createdAt: client.createdAt
    }));

    res.status(200).json({
      clients,
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

// @desc    Get single client
// @route   GET /api/clients/:id
// @access  Private
exports.getClient = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'cases',
          attributes: ['id', 'caseNumber', 'title', 'status', 'createdAt']
        }
      ]
    });

    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this client', 403));
    }

    const formattedClient = {
      id: client.id.toString(),
      name: client.name,
      clientId: client.clientId,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      cases: client.cases.map(caseItem => ({
        id: caseItem.id.toString(),
        caseNumber: caseItem.caseNumber,
        title: caseItem.title,
        status: caseItem.status,
        createdAt: caseItem.createdAt
      })),
      createdAt: client.createdAt
    };

    res.status(200).json(formattedClient);
  } catch (error) {
    next(error);
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    // Generate unique client ID
    const clientId = `CL${Date.now().toString().slice(-6)}`;

    const client = await Client.create({
      name,
      clientId,
      email,
      phone,
      address,
      createdBy: req.user.id
    });

    res.status(201).json({
      id: client.id.toString(),
      name: client.name,
      clientId: client.clientId,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      caseCount: 0,
      createdAt: client.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Private
exports.updateClient = async (req, res, next) => {
  try {
    let client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ]
    });

    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this client', 403));
    }

    // Update client
    client = await client.update(req.body);

    res.status(200).json({
      id: client.id.toString(),
      name: client.name,
      clientId: client.clientId,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      caseCount: client.cases?.length || 0,
      createdAt: client.createdAt
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [
        {
          model: Case,
          as: 'cases',
          required: false
        }
      ]
    });

    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.params.id}`, 404));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this client', 403));
    }

    // Check if client has cases
    if (client.cases?.length > 0) {
      return next(new ErrorResponse('Cannot delete client with associated cases', 400));
    }

    await client.destroy();

    res.status(200).end();
  } catch (error) {
    next(error);
  }
};