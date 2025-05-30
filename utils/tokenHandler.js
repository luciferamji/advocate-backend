const jwt = require('jsonwebtoken');

// Generate JWT token
exports.generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Set token cookie
exports.sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = this.generateToken(user.id);

  // Cookie options
  const options = {
    expires: new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res
    .status(statusCode)
    .cookie('jwt', token, options)
    .json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
};