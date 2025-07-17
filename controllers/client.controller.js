const { Client, Case, Admin, sequelize, Invoice } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

const validateAdvocate = async (adminId) => {
  const admin = await Admin.findOne({ where: { id: adminId, role: 'advocate' } });
  return !!admin;
};


// @desc    Search clients
// @route   GET /api/clients/search
// @access  Private
exports.searchClients = async (req, res, next) => {
  try {
    const { search = '', limit = 10 } = req.query;

    const whereClause = {
      [Op.or]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { clientId: { [Op.iLike]: `%${search}%` } }
      ]
    };

    // If not super-admin, only show own clients
    if (req.user.role !== 'super-admin') {
      whereClause.createdBy = req.user.id;
    }

    const clients = await Client.findAll({
      where: whereClause,
      limit: parseInt(limit),
      order: [['name', 'ASC']],
      attributes: ['id', 'clientId', 'name', 'email', 'phone']
    });

    const formattedClients = clients.map(client => ({
      id: client.id.toString(),
      clientId: client.clientId,
      name: client.name,
      email: client.email || '',
      phone: client.phone || ''
    }));

    res.status(200).json({
      success: true,
      data: formattedClients
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CLIENT_SEARCH_ERROR'));
  }
};

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res, next) => {
  try {
    const {
      page = 0,
      limit = 10,
      search = '',
      advocateId = '',
    } = req.query;

    const whereClause = {};

    // If not super-admin, only show own clients
    if (req.user.role !== 'super-admin') {
      whereClause.createdBy = req.user.id;
    }
    else {
      if (advocateId) {
        whereClause.createdBy = advocateId;
      }
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
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)
              FROM "case" AS c
              WHERE c."clientId" = "client"."id"
            )`),
            'caseCount'
          ]
        ]
      },
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
      caseCount: parseInt(client.get('caseCount')) || 0,
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
    next(new ErrorResponse(error.message, 'CLIENT_LIST_ERROR'));
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
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email'],
        }
      ]
    });

    if (!client) {
      return next(new ErrorResponse('Client not found', 'CLIENT_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to access this client', 'UNAUTHORIZED_ACCESS'));
    }

    const formattedClient = {
      id: client.id.toString(),
      name: client.name,
      clientId: client.clientId,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      createdBy: {
        id: client.admin.id.toString(),
        name: client.admin.name,
        email: client.admin.email || ''
      },
      createdAt: client.createdAt
    };

    res.status(200).json(formattedClient);
  } catch (error) {
    next(new ErrorResponse(error.message, 'CLIENT_FETCH_ERROR'));
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res, next) => {
  try {
    const { name, email, phone, address } = req.body;

    if (!name) {
      return next(new ErrorResponse('Name is required', 'VALIDATION_ERROR'));
    }

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
    next(new ErrorResponse(error.message, 'CLIENT_CREATE_ERROR'));
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
      return next(new ErrorResponse('Client not found', 'CLIENT_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this client', 'UNAUTHORIZED_ACCESS'));
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
    next(new ErrorResponse(error.message, 'CLIENT_UPDATE_ERROR'));
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Private
exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByPk(req.params.id);

    if (!client) {
      return next(new ErrorResponse('Client not found', 'CLIENT_NOT_FOUND', { id: req.params.id }));
    }

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this client', 'UNAUTHORIZED_ACCESS'));
    }

    const caseCount = await Case.count({ where: { clientId: client.id } });

    // Check if client has cases
    if (caseCount > 0) {
      return next(new ErrorResponse(
        'Cannot delete client with associated cases, case count : ' + caseCount,
        'CLIENT_HAS_CASES',
        { caseCount }
      ));
    }

    const invoiceCount = await Invoice.count({ where: { clientId: client.id } });
    if (invoiceCount > 0) {
      return next(
        new ErrorResponse(
          'Cannot delete client with associated invoices, invoice count : ' + invoiceCount,
          'CLIENT_HAS_INVOICES',
          { invoiceCount }
        )
      );
    }

    await client.destroy();

    res.status(200).end();
  } catch (error) {
    next(new ErrorResponse(error.message, 'CLIENT_DELETE_ERROR'));
  }
};


exports.assignClientToAdvocate = async (req, res, next) => {
  const { clientId } = req.params;
  const { newAdvocateId } = req.body;

  const t = await sequelize.transaction();

  try {

    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin') {
      return next(new ErrorResponse('Not authorized to update this client', 'UNAUTHORIZED_ACCESS'));
    }
    // Validate new advocate
    const isValid = await validateAdvocate(newAdvocateId);
    if (!isValid) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid advocate ID' });
    }

    const client = await Client.findByPk(clientId, { transaction: t });
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    await client.update({ createdBy: newAdvocateId }, { transaction: t });

    await Case.update(
      { advocateId: newAdvocateId },
      { where: { clientId }, transaction: t }
    );

    await Invoice.update(
      { advocateId: newAdvocateId },
      { where: { clientId }, transaction: t }
    );

    await t.commit();
    res.status(200).json({ message: 'Client and cases reassigned to new advocate' });
  } catch (err) {
    await t.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};