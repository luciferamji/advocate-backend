const { Admin } = require('../models');
const { verifyTempToken } = require('../utils/tokenHandler');

exports.protect = async (req, res, next) => {
  try {
    const sessionId = req.cookies.session;

    if (!sessionId) {
      return res.status(401).json({ success: false, message: 'No session provided' });
    }

    const user = await Admin.findOne({
      where: { sessionId },
      attributes: { exclude: ['password'] }
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Invalid session or user inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};



exports.protectTemp = (req, res, next) => {
  try {
    const tempToken = req.cookies.temp_token;

    if (!tempToken) {
      return res.status(401).json({ success: false, message: 'No temp token provided' });
    }

    const decoded = verifyTempToken(tempToken);

    if (!decoded || !decoded.linkId) {
      return res.status(401).json({ success: false, message: 'Invalid temp token' });
    }

    req.tempUser = {
      linkId: decoded.linkId,
      isTemp: true
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired temp token' });
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