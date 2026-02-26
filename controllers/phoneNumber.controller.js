const { PhoneNumber } = require('../models');
const ErrorResponse = require('../utils/errorHandler');

// @desc    Get all phone numbers
// @route   GET /api/phone-numbers
// @access  Private
exports.getPhoneNumbers = async (req, res, next) => {
  try {
    const phoneNumbers = await PhoneNumber.findAll({
      attributes: req.user.role === 'super-admin' 
        ? undefined  // Super admin gets all fields
        : { exclude: ['alohaaNumber'] },  // Advocates don't see alohaaNumber
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      count: phoneNumbers.length,
      data: phoneNumbers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single phone number
// @route   GET /api/phone-numbers/:id
// @access  Private
exports.getPhoneNumber = async (req, res, next) => {
  try {
    const phoneNumber = await PhoneNumber.findByPk(req.params.id, {
      attributes: req.user.role === 'super-admin' 
        ? undefined  // Super admin gets all fields
        : { exclude: ['alohaaNumber'] }  // Advocates don't see alohaaNumber
    });
    
    if (!phoneNumber) {
      return next(new ErrorResponse(`Phone number not found with id of ${req.params.id}`, 404));
    }
    
    res.status(200).json({
      success: true,
      data: phoneNumber
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create phone number
// @route   POST /api/phone-numbers
// @access  Private/Super-Admin
exports.createPhoneNumber = async (req, res, next) => {
  try {
    const { name, office, place, phoneNumber, alohaaNumber } = req.body;
    
    // Validate phone number format (10 digits)
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return next(new ErrorResponse('Phone number must be 10 digits without country code', 400));
    }
    
    // Validate alohaa number format (10 digits)
    if (!/^[0-9]{10}$/.test(alohaaNumber)) {
      return next(new ErrorResponse('Alohaa number must be 10 digits without country code', 400));
    }
    
    const newPhoneNumber = await PhoneNumber.create({
      name,
      office,
      place,
      phoneNumber,
      alohaaNumber,
      createdBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: newPhoneNumber
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update phone number
// @route   PUT /api/phone-numbers/:id
// @access  Private/Super-Admin
exports.updatePhoneNumber = async (req, res, next) => {
  try {
    const { name, office, place, phoneNumber, alohaaNumber } = req.body;
    
    let phoneNumberRecord = await PhoneNumber.findByPk(req.params.id);
    
    if (!phoneNumberRecord) {
      return next(new ErrorResponse(`Phone number not found with id of ${req.params.id}`, 404));
    }
    
    // Validate phone number format if provided
    if (phoneNumber && !/^[0-9]{10}$/.test(phoneNumber)) {
      return next(new ErrorResponse('Phone number must be 10 digits without country code', 400));
    }
    
    // Validate alohaa number format if provided
    if (alohaaNumber && !/^[0-9]{10}$/.test(alohaaNumber)) {
      return next(new ErrorResponse('Alohaa number must be 10 digits without country code', 400));
    }
    
    phoneNumberRecord = await phoneNumberRecord.update({
      name: name || phoneNumberRecord.name,
      office: office || phoneNumberRecord.office,
      place: place || phoneNumberRecord.place,
      phoneNumber: phoneNumber || phoneNumberRecord.phoneNumber,
      alohaaNumber: alohaaNumber || phoneNumberRecord.alohaaNumber
    });
    
    res.status(200).json({
      success: true,
      data: phoneNumberRecord
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete phone number
// @route   DELETE /api/phone-numbers/:id
// @access  Private/Super-Admin
exports.deletePhoneNumber = async (req, res, next) => {
  try {
    const phoneNumber = await PhoneNumber.findByPk(req.params.id);
    
    if (!phoneNumber) {
      return next(new ErrorResponse(`Phone number not found with id of ${req.params.id}`, 404));
    }
    
    await phoneNumber.destroy();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};
