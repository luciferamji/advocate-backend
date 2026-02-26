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
    
    // Validate required fields
    if (!name || !office || !place || !phoneNumber || !alohaaNumber) {
      return next(new ErrorResponse('All fields are required: name, office, place, phoneNumber, alohaaNumber', 400));
    }
    
    // Validate field lengths
    if (name.trim().length < 2) {
      return next(new ErrorResponse('Name must be at least 2 characters', 400));
    }
    
    if (office.trim().length < 2) {
      return next(new ErrorResponse('Office must be at least 2 characters', 400));
    }
    
    if (place.trim().length < 2) {
      return next(new ErrorResponse('Place must be at least 2 characters', 400));
    }
    
    // Validate phone number format (10 digits)
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      return next(new ErrorResponse('Phone number must be exactly 10 digits without country code', 400));
    }
    
    // Validate alohaa number format (10 digits)
    if (!/^[0-9]{10}$/.test(alohaaNumber)) {
      return next(new ErrorResponse('Alohaa number must be exactly 10 digits without country code', 400));
    }
    
    // Check for duplicate phone number
    const existingPhone = await PhoneNumber.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      return next(new ErrorResponse('This phone number is already registered', 400));
    }
    
    const newPhoneNumber = await PhoneNumber.create({
      name: name.trim(),
      office: office.trim(),
      place: place.trim(),
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
    
    // Validate field lengths if provided
    if (name !== undefined && name.trim().length < 2) {
      return next(new ErrorResponse('Name must be at least 2 characters', 400));
    }
    
    if (office !== undefined && office.trim().length < 2) {
      return next(new ErrorResponse('Office must be at least 2 characters', 400));
    }
    
    if (place !== undefined && place.trim().length < 2) {
      return next(new ErrorResponse('Place must be at least 2 characters', 400));
    }
    
    // Validate phone number format if provided
    if (phoneNumber !== undefined) {
      if (!/^[0-9]{10}$/.test(phoneNumber)) {
        return next(new ErrorResponse('Phone number must be exactly 10 digits without country code', 400));
      }
      
      // Check for duplicate phone number (excluding current record)
      const existingPhone = await PhoneNumber.findOne({ 
        where: { 
          phoneNumber,
          id: { [require('sequelize').Op.ne]: req.params.id }
        } 
      });
      
      if (existingPhone) {
        return next(new ErrorResponse('This phone number is already registered', 400));
      }
    }
    
    // Validate alohaa number format if provided
    if (alohaaNumber !== undefined && !/^[0-9]{10}$/.test(alohaaNumber)) {
      return next(new ErrorResponse('Alohaa number must be exactly 10 digits without country code', 400));
    }
    
    phoneNumberRecord = await phoneNumberRecord.update({
      name: name !== undefined ? name.trim() : phoneNumberRecord.name,
      office: office !== undefined ? office.trim() : phoneNumberRecord.office,
      place: place !== undefined ? place.trim() : phoneNumberRecord.place,
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
