const crypto = require('crypto');

// Generate session ID
exports.generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Set session cookie
exports.sendTokenResponse = (user, statusCode, res) => {
  // Create session ID
  const sessionId = this.generateSessionId();

  // Cookie options
  const options = {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res
    .status(statusCode)
    .cookie('session', sessionId, options)
    .json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
};