const { Hearing, Case, Client } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');

// @desc    Get calendar data
// @route   GET /api/calendar
// @access  Private
exports.getCalendarData = async (req, res, next) => {
  try {
    let query = {};
    let caseQuery = {};
    let clientQuery = {};
    
    // If not super-admin, only show own hearings
    if (req.user.role !== 'super-admin') {
      caseQuery.createdBy = req.user.id;
    }
    
    // Filter by case if provided
    if (req.query.caseId) {
      query.caseId = req.query.caseId;
    }
    
    // Filter by client if provided
    if (req.query.clientId) {
      clientQuery.id = req.query.clientId;
    }
    
    // Filter by date range if provided
    if (req.query.startDate && req.query.endDate) {
      query.date = {
        [Op.between]: [
          new Date(req.query.startDate),
          new Date(req.query.endDate)
        ]
      };
    } else if (req.query.startDate) {
      query.date = {
        [Op.gte]: new Date(req.query.startDate)
      };
    } else if (req.query.endDate) {
      query.date = {
        [Op.lte]: new Date(req.query.endDate)
      };
    }
    
    const hearings = await Hearing.findAll({
      where: query,
      include: [
        {
          model: Case,
          as: 'case',
          where: caseQuery,
          required: true,
          include: [
            {
              model: Client,
              as: 'client',
              where: clientQuery,
              required: Object.keys(clientQuery).length > 0
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['time', 'ASC']]
    });
    
    // Format the data for calendar view
    const calendarData = hearings.map(hearing => ({
      id: hearing.id.toString(),
      title: `Case: ${hearing.case.caseNumber}`,
      start: new Date(hearing.date.toISOString().split('T')[0] + 'T' + hearing.time),
      client: {
        id: hearing.case.client.id.toString(),
        name: hearing.case.client.name,
        clientId: hearing.case.client.clientId
      },
      case: {
        id: hearing.case.id.toString(),
        caseNumber: hearing.case.caseNumber,
        courtDetails: hearing.case.courtName
      },
      notes: hearing.notes,
      status: hearing.status
    }));
    
    res.status(200).json({
      success: true,
      count: calendarData.length,
      data: calendarData
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'CALENDAR_FETCH_ERROR'));
  }
};

// @desc    Get today's hearings
// @route   GET /api/calendar/today
// @access  Private
exports.getTodaysHearings = async (req, res, next) => {
  try {
    let caseQuery = {};
    
    // If not super-admin, only show own hearings
    if (req.user.role !== 'super-admin') {
      caseQuery.createdBy = req.user.id;
    }
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const hearings = await Hearing.findAll({
      where: {
        date: today
      },
      include: [
        {
          model: Case,
          as: 'case',
          where: caseQuery,
          required: true,
          include: [
            {
              model: Client,
              as: 'client'
            }
          ]
        }
      ],
      order: [['time', 'ASC']]
    });
    
    // Format the data
    const todaysHearings = hearings.map(hearing => ({
      id: hearing.id.toString(),
      time: hearing.time,
      client: hearing.case.client.name,
      case: hearing.case.caseNumber,
      courtDetails: hearing.case.courtName,
      status: hearing.status
    }));
    
    res.status(200).json({
      success: true,
      count: todaysHearings.length,
      data: todaysHearings
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'TODAYS_HEARINGS_FETCH_ERROR'));
  }
};

// @desc    Get upcoming hearings
// @route   GET /api/calendar/upcoming
// @access  Private
exports.getUpcomingHearings = async (req, res, next) => {
  try {
    let caseQuery = {};
    
    // If not super-admin, only show own hearings
    if (req.user.role !== 'super-admin') {
      caseQuery.createdBy = req.user.id;
    }
    
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Default to next 7 days if not specified
    const days = req.query.days ? parseInt(req.query.days) : 7;
    
    if (isNaN(days) || days < 1) {
      return next(new ErrorResponse('Invalid days parameter', 'INVALID_PARAMETER', { parameter: 'days' }));
    }
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    
    const hearings = await Hearing.findAll({
      where: {
        date: {
          [Op.between]: [today, endDate]
        }
      },
      include: [
        {
          model: Case,
          as: 'case',
          where: caseQuery,
          required: true,
          include: [
            {
              model: Client,
              as: 'client'
            }
          ]
        }
      ],
      order: [['date', 'ASC'], ['time', 'ASC']]
    });
    
    // Format the data and group by date
    const upcomingHearings = {};
    
    hearings.forEach(hearing => {
      const date = hearing.date.toISOString().split('T')[0];
      
      if (!upcomingHearings[date]) {
        upcomingHearings[date] = [];
      }
      
      upcomingHearings[date].push({
        id: hearing.id.toString(),
        time: hearing.time,
        client: hearing.case.client.name,
        case: hearing.case.caseNumber,
        courtDetails: hearing.case.courtName,
        status: hearing.status
      });
    });
    
    res.status(200).json({
      success: true,
      data: upcomingHearings
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'UPCOMING_HEARINGS_FETCH_ERROR'));
  }
};