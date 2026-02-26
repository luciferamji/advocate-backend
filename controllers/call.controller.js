const axios = require('axios');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Initiate a call
// @route   POST /api/calls/initiate
// @access  Private
exports.initiateCall = async (req, res, next) => {
  try {
    const { callerNumber, receiverNumber } = req.body;
    
    // Validate required fields
    if (!callerNumber || !receiverNumber) {
      return next(new ErrorResponse('Caller number and receiver number are required', 400));
    }
    
    // Validate phone number format (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(callerNumber) || !phoneRegex.test(receiverNumber)) {
      return next(new ErrorResponse('Phone numbers must be 10 digits without country code', 400));
    }
    
    // Fetch the phone number record to get the alohaaNumber
    const { PhoneNumber } = require('../models');
    const phoneNumberRecord = await PhoneNumber.findOne({
      where: { phoneNumber: callerNumber }
    });
    
    if (!phoneNumberRecord) {
      return next(new ErrorResponse('Caller number not found in system', 404));
    }
    
    // Get API key from environment
    const apiKey = process.env.ALOHAA_API_KEY;
    if (!apiKey) {
      return next(new ErrorResponse('Call service API key not configured', 500));
    }
    
    // Prepare call data with country code using alohaaNumber as DID
    const callData = {
      caller_number: `91${callerNumber}`,
      receiver_number: `91${receiverNumber}`,
      did_number: `91${phoneNumberRecord.alohaaNumber}`,  // Use alohaaNumber from DB
      is_agent_required: false
    };
    
    // Make API call to Alohaa
    const response = await axios.post(
      'https://outgoing-call.alohaa.ai/v1/external/click-2-call',
      callData,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-metro-api-key': apiKey
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Call initiated successfully',
      data: response.data
    });
  } catch (error) {
    // Handle API errors
    if (error.response) {
      return next(new ErrorResponse(
        error.response.data?.message || 'Failed to initiate call',
        error.response.status
      ));
    }
    
    if (error.code === 'ECONNABORTED') {
      return next(new ErrorResponse('Call service timeout', 504));
    }
    
    next(new ErrorResponse('Failed to initiate call', 500));
  }
};
