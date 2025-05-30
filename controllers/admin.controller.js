const bcrypt = require('bcryptjs');
const { Admin, Advocate } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all admin users
// @route   GET /api/admin/users
// @access  Private/Super-Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await Admin.findAll({
      attributes: { exclude: ['password'] },
      include: [
        { model: Advocate, required: false }
      ]
    });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Private/Super-Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await Admin.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Advocate, required: false }
      ]
    });
    
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create user
// @route   POST /api/admin/users
// @access  Private/Super-Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    
    // Check if user exists
    const existingUser = await Admin.findOne({ where: { email } });
    
    if (existingUser) {
      return next(new ErrorResponse('Email already in use', 400));
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = await Admin.create({
      name,
      email,
      password: hashedPassword,
      role
    });
    
    // Create advocate entry if role is advocate
    if (role === 'advocate') {
      await Advocate.create({
        adminId: user.id,
        ...req.body.advocate
      });
    }
    
    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private/Super-Admin
exports.updateUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;
    
    let user = await Admin.findByPk(req.params.id);
    
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }
    
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await Admin.findOne({ where: { email } });
      
      if (existingUser) {
        return next(new ErrorResponse('Email already in use', 400));
      }
    }
    
    // Update user
    user.name = name || user.name;
    user.email = email || user.email;
    
    // Handle role change
    if (role && role !== user.role) {
      user.role = role;
      
      // If changing to advocate, create advocate entry
      if (role === 'advocate') {
        const advocateExists = await Advocate.findOne({ where: { adminId: user.id } });
        
        if (!advocateExists) {
          await Advocate.create({
            adminId: user.id,
            ...req.body.advocate
          });
        }
      }
    }
    
    // Update advocate details if provided
    if (user.role === 'advocate' && req.body.advocate) {
      let advocate = await Advocate.findOne({ where: { adminId: user.id } });
      
      if (advocate) {
        advocate = await advocate.update(req.body.advocate);
      }
    }
    
    await user.save();
    
    // Fetch updated user with advocate data
    const updatedUser = await Admin.findByPk(user.id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Advocate, required: false }
      ]
    });
    
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Super-Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await Admin.findByPk(req.params.id);
    
    if (!user) {
      return next(new ErrorResponse(`User not found with id of ${req.params.id}`, 404));
    }
    
    // Delete advocate entry if exists
    if (user.role === 'advocate') {
      await Advocate.destroy({ where: { adminId: user.id } });
    }
    
    await user.destroy();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};