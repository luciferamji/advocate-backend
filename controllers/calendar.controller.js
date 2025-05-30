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
      query.hearingDate = {
        [Op.between]: [
          new Date(req.query.startDate),
          new Date(req.query.endDate)
        ]
      };
    } else if (req.query.startDate) {
      query.hearingDate = {
        [Op.gte]: new Date(req.query.startDate)
      };
    } else if (req.query.endDate) {
      query.hearingDate = {
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
      order: [['hearingDate', 'ASC']]
    });
    
    // Format the data for calendar view
    const calendarData = hearings.map(hearing => {
      return {
        id: hearing.id,
        title: `Case: ${hearing.case.caseId}`,
        start: hearing.hearingDate,
        client: {
          id: hearing.case.client.id,
          name: hearing.case.client.name,
          clientId: hearing.case.client.clientId
        },
        case: {
          id: hearing.case.id,
          caseId: hearing.case.caseId,
          courtDetails: hearing.case.courtDetails
        },
        notes: hearing.notes,
        status: hearing.status
      };
    });
    
    res.status(200).json({
      success: true,
      count: calendarData.length,
      data: calendarData
    });
  } catch (error) {
    next(error);
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
        hearingDate: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
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
      order: [['hearingDate', 'ASC']]
    });
    
    // Format the data
    const todaysHearings = hearings.map(hearing => {
      return {
        id: hearing.id,
        time: hearing.hearingDate,
        client: hearing.case.client.name,
        case: hearing.case.caseId,
        courtDetails: hearing.case.courtDetails,
        status: hearing.status
      };
    });
    
    res.status(200).json({
      success: true,
      count: todaysHearings.length,
      data: todaysHearings
    });
  } catch (error) {
    next(error);
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
    
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + days);
    
    const hearings = await Hearing.findAll({
      where: {
        hearingDate: {
          [Op.gte]: today,
          [Op.lt]: endDate
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
      order: [['hearingDate', 'ASC']]
    });
    
    // Format the data and group by date
    const upcomingHearings = {};
    
    hearings.forEach(hearing => {
      const date = hearing.hearingDate.toISOString().split('T')[0];
      
      if (!upcomingHearings[date]) {
        upcomingHearings[date] = [];
      }
      
      upcomingHearings[date].push({
        id: hearing.id,
        time: hearing.hearingDate,
        client: hearing.case.client.name,
        case: hearing.case.caseId,
        courtDetails: hearing.case.courtDetails,
        status: hearing.status
      });
    });
    
    res.status(200).json({
      success: true,
      data: upcomingHearings
    });
  } catch (error) {
    next(error);
  }
};