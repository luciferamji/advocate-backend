const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Generate session ID
const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate temporary token for document uploads
const generateTempToken = (linkId) => {
  return jwt.sign(
    { linkId },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Verify temporary token
const verifyTempToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Set session cookie and return sessionId
const sendTokenResponse = async (user, statusCode, res) => {
  // Create session ID
  const sessionId = generateSessionId();

  // Cookie options
  const options = {
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000 * 5), // 5 days
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
  generateTempToken,
  verifyTempToken,
  sendTokenResponse
};