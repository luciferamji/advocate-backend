const { Case, Client, Hearing } = require('../models');
const { Op } = require('sequelize');
const ErrorResponse = require('../utils/errorHandler');
const { generatePdf } = require('../utils/generatePdf');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
  try {
    const whereClause = req.user.role !== 'super-admin' ? { advocateId: req.user.id } : {};
    const clientWhereClause = req.user.role !== 'super-admin' ? { createdBy: req.user.id } : {};

    const [totalClients, totalCases, activeCases, upcomingHearings] = await Promise.all([
      Client.count({ where: clientWhereClause }),
      Case.count({ where: whereClause }),
      Case.count({ where: { ...whereClause, status: 'OPEN' } }),
      Hearing.count({
        where: {
          date: { [Op.gte]: new Date() },
          status: 'scheduled'
        },
        include: [{
          model: Case,
          as: 'case',
          where: whereClause,
          required: true
        }]
      })
    ]);

    res.status(200).json({
      totalClients,
      totalCases,
      activeCases,
      upcomingHearings
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'DASHBOARD_STATS_ERROR'));
  }
};

// @desc    Get recent cases and upcoming hearings
// @route   GET /api/dashboard/recent
// @access  Private
exports.getRecentItems = async (req, res, next) => {
  try {
    const whereClause = req.user.role !== 'super-admin' ? { advocateId: req.user.id } : {};

    const [recentCases, upcomingHearings] = await Promise.all([
      Case.findAll({
        where: whereClause,
        include: [{
          model: Client,
          as: 'client',
          attributes: ['id', 'name']
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      Hearing.findAll({
        where: {
          date: { [Op.gte]: new Date() },
          status: 'scheduled'
        },
        include: [{
          model: Case,
          as: 'case',
          where: whereClause,
          required: true,
          include: [{
            model: Client,
            as: 'client',
            attributes: ['id', 'name']
          }]
        }],
        order: [['date', 'ASC'], ['time', 'ASC']],
        limit: 5
      })
    ]);

    const formattedCases = recentCases.map(caseItem => ({
      id: caseItem.id.toString(),
      caseNumber: caseItem.caseNumber,
      title: caseItem.title,
      clientId: caseItem.client.id.toString(),
      clientName: caseItem.client.name,
      status: caseItem.status,
      createdAt: caseItem.createdAt
    }));

    const formattedHearings = upcomingHearings.map(hearing => ({
      id: hearing.id.toString(),
      caseId: hearing.case.id.toString(),
      caseName: hearing.case.title,
      clientId: hearing.case.client.id.toString(),
      clientName: hearing.case.client.name,
      date: hearing.date,
      time: hearing.time,
      courtName: hearing.courtName,
      status: hearing.status
    }));

    res.status(200).json({
      recentCases: formattedCases,
      upcomingHearings: formattedHearings
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'DASHBOARD_RECENT_ERROR'));
  }
};

exports.downloadTodayHearingsPdf = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];;

    const whereClause = {

    };

    if (req.user.role !== 'super-admin') {
      whereClause['advocateId'] = req.user.id;
    }

    const hearings = await Hearing.findAll({
      where: {
        date: today
      },
      include: [{
        model: Case,
        as: 'case',
        where: whereClause,
        attributes: ['id', 'title', 'caseNumber'],
        include: [
          {
            model: Client,
            as: 'client',
            attributes: ['id', 'name', 'phone']
          }
        ]
      }],
      order: [['date', 'ASC'], ['time', 'ASC']]
    });

    if (hearings.length === 0) {
      return res.status(404).json({ message: 'No hearings scheduled for today' });
    }

    const data = {
      hearings: hearings.map(h => ({
        id: h.id.toString(),
        caseId: h.case.id.toString(),
        caseName: h.case.title,
        clientPhone: h.case.client.phone.toString(),
        clientName: h.case.client.name,
        date: h.date,
        time: h.time,
        courtName: h.courtName,
        purpose: h.purpose,
        judge: h.judge
      })),
      name: req.user.name || 'Advocate',
      today: today,
    };

    const pdfBuffer = await generatePdf(data, 'dailyHearingTemplate.ejs');
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=hearing.pdf");
    res.status(200).end(pdfBuffer);
  } catch (error) {
    next(new ErrorResponse(error.message, 'DASHBOARD_TODAY_HEARINGS_PDF_ERROR'));
  }
};