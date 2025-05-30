const { Client, Admin, Case } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Private
exports.getClients = async (req, res, next) => {
  try {
    let query = {};
    
    // If not super-admin, only show own clients
    if (req.user.role !== 'super-admin') {
      query.createdBy = req.user.id;
    }
    
    const clients = await Client.findAll({
      where: query,
      include: [
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
    
    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
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
          model: Admin,
          as: 'admin',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Case,
          as: 'cases'
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
    
    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Private
exports.createClient = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;
    
    // Check if client ID already exists
    const existingClient = await Client.findOne({
      where: { clientId: req.body.clientId }
    });
    
    if (existingClient) {
      return next(new ErrorResponse('Client ID already exists', 400));
    }
    
    const client = await Client.create(req.body);
    
    res.status(201).json({
      success: true,
      data: client
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
    let client = await Client.findByPk(req.params.id);
    
    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to update this client', 403));
    }
    
    // Check if updating clientId and if it already exists
    if (req.body.clientId && req.body.clientId !== client.clientId) {
      const existingClient = await Client.findOne({
        where: { clientId: req.body.clientId }
      });
      
      if (existingClient) {
        return next(new ErrorResponse('Client ID already exists', 400));
      }
    }
    
    // Update client
    client = await client.update(req.body);
    
    res.status(200).json({
      success: true,
      data: client
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
    const client = await Client.findByPk(req.params.id);
    
    if (!client) {
      return next(new ErrorResponse(`Client not found with id of ${req.params.id}`, 404));
    }
    
    // Check ownership if not super-admin
    if (req.user.role !== 'super-admin' && client.createdBy !== req.user.id) {
      return next(new ErrorResponse('Not authorized to delete this client', 403));
    }
    
    // Check if client has cases
    const cases = await Case.count({ where: { clientId: client.id } });
    
    if (cases > 0) {
      return next(new ErrorResponse('Cannot delete client with associated cases', 400));
    }
    
    await client.destroy();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};