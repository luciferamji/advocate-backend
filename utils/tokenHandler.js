const crypto = require('crypto');

// Generate session ID
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Set session cookie and return sessionId
const sendTokenResponse = async (user, statusCode, res) => {
  // Create session ID
  const sessionId = generateSessionId();

  // Cookie options
  const options = {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  // Prepare user response
  const userResponse = {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    advocate: user.advocate ? {
      barNumber: user.advocate.barNumber,
      specialization: user.advocate.specialization
    } : undefined
  };

  res
    .status(statusCode)
    .cookie('session', sessionId, options)
    .json(userResponse);

  return sessionId;
};

module.exports = {
  generateSessionId,
  sendTokenResponse
};