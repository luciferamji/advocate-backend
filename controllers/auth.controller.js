const bcrypt = require('bcryptjs');
const { Admin, Advocate } = require('../models');
const { sendTokenResponse } = require('../utils/tokenHandler');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
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
      role: 'advocate' // Default role for registration
    });
    
    // Create advocate entry
    if (user.role === 'advocate') {
      await Advocate.create({
        adminId: user.id
      });
    }
    
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    
    const { email, password } = req.body;
    // Validate email & password
    if (!email || !password) {
      return next(new ErrorResponse('Please provide email and password', 400));
    }
    
    // Check for user
    const user = await Admin.findOne({ where: { email } });
    
    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }
    
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res, next) => {
  try {
    res.cookie('jwt', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await Admin.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: req.user.role === 'advocate' ? [
        { model: Advocate }
      ] : []
    });
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    
    const user = await Admin.findByPk(req.user.id);
    
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
    
    await user.save();
    
    res.status(200).json({
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

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Check current password
    const user = await Admin.findByPk(req.user.id);
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return next(new ErrorResponse('Password is incorrect', 401));
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};