const { Admin } = require('../models');
const { verifyTempToken } = require('../utils/tokenHandler');

exports.protect = async (req, res, next) => {
  try {
    // First check for regular session
    const sessionId = req.cookies.session;

    if (sessionId) {
      // Get user from session
      const user = await Admin.findOne({
        where: { sessionId },
        attributes: { exclude: ['password'] }
      });
      
      if (user) {
        req.user = user;
        return next();
      }
    }

    // If no valid session, check for temporary token
    const tempToken = req.cookies.temp_token;

    if (tempToken) {
      const decoded = verifyTempToken(tempToken);
      if (decoded && decoded.linkId) {
        req.tempUser = {
          linkId: decoded.linkId,
          isTemp: true
        };
        return next();
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
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