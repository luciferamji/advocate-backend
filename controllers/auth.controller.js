const bcrypt = require('bcryptjs');
const { Admin, Advocate } = require('../models');
const { sendTokenResponse } = require('../utils/tokenHandler');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validate email & password
    if (!email || !password) {
      return next(new ErrorResponse('Please provide email and password', 'INVALID_CREDENTIALS'));
    }
    
    // Check for user
    const user = await Admin.findOne({
      where: { email },
      include: [{
        model: Advocate,
        attributes: ['barNumber', 'specialization']
      }]
    });
    
    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }
    
    if( user.status !== 'active') {
      return next(new ErrorResponse('Your account is not active. Please contact support.', 'ACCOUNT_INACTIVE'));
    }
    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    }
    
    // Generate session and send response
    const sessionId = await sendTokenResponse(user, 200, res);
    
    // Update user's sessionId in database
    await user.update({ sessionId });
  } catch (error) {
    next(new ErrorResponse(error.message, 'AUTH_ERROR'));
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // Clear session from database
    await Admin.update(
      { sessionId: null },
      { where: { id: req.user.id } }
    );

    res.cookie('session', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.status(200).end();
  } catch (error) {
    next(new ErrorResponse(error.message, 'LOGOUT_ERROR'));
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await Admin.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'sessionId'] },
      include: [{
        model: Advocate,
        attributes: ['barNumber', 'specialization']
      }]
    });
    
    if (!user) {
      return next(new ErrorResponse('User not found', 'USER_NOT_FOUND'));
    }
    
    res.status(200).json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      active: user.status,
      advocate: user.advocate ? {
        barNumber: user.advocate.barNumber,
        specialization: user.advocate.specialization
      } : undefined
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'PROFILE_FETCH_ERROR'));
  }
};

// @desc    Update user details
// @route   PUT /api/auth/update-details
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const { name, phone, barNumber, specialization } = req.body;
    
    const user = await Admin.findByPk(req.user.id, {
      include: [{
        model: Advocate,
        required: false
      }]
    });
    
    if (!user) {
      return next(new ErrorResponse('User not found', 'USER_NOT_FOUND'));
    }
    
    // Update basic details
    user.name = name || user.name;
    user.phone = phone || user.phone;
    
    // Update advocate details if applicable
    if (user.role === 'advocate' && (barNumber || specialization)) {
      if (user.advocate) {
        await user.advocate.update({
          barNumber: barNumber || user.advocate.barNumber,
          specialization: specialization || user.advocate.specialization
        });
      } else {
        await Advocate.create({
          adminId: user.id,
          barNumber,
          specialization
        });
      }
    }
    
    await user.save();
    
    // Fetch updated user
    const updatedUser = await Admin.findByPk(user.id, {
      attributes: { exclude: ['password', 'sessionId'] },
      include: [{
        model: Advocate,
        attributes: ['barNumber', 'specialization']
      }]
    });
    
    res.status(200).json({
      id: updatedUser.id.toString(),
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone,
      advocate: updatedUser.advocate ? {
        barNumber: updatedUser.advocate.barNumber,
        specialization: updatedUser.advocate.specialization
      } : undefined
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'PROFILE_UPDATE_ERROR'));
  }
};

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return next(new ErrorResponse('Please provide both current and new password', 'INVALID_PASSWORD_DATA'));
    }
    
    const user = await Admin.findByPk(req.user.id);
    
    if (!user) {
      return next(new ErrorResponse('User not found', 'USER_NOT_FOUND'));
    }
    
    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return next(new ErrorResponse('Current password is incorrect', 'INVALID_CURRENT_PASSWORD'));
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    await user.save();
    
    res.status(200).json({
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      advocate: user.advocate ? {
        barNumber: user.advocate.barNumber,
        specialization: user.advocate.specialization
      } : undefined
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'PASSWORD_UPDATE_ERROR'));
  }
};