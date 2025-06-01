const { Case, Client, Hearing } = require('../models');
const { Op } = require('sequelize');

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
    next(error);
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
    next(error);
  }
};