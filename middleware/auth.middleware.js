const jwt = require('jsonwebtoken');
const { Admin } = require('../models');

exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await Admin.findByPk(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Attach user to request object
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

exports.checkOwnership = (model, paramField, userField = 'createdBy') => {
  return async (req, res, next) => {
    try {
      const resource = await model.findByPk(req.params[paramField]);
      
      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }
      
      // Super-admin can access all resources
      if (req.user.role === 'super-admin') {
        return next();
      }
      
      // Check if user owns the resource
      if (resource[userField] !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource'
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};