const { Lead, HandlingOffice, LeadSource, Admin, LeadActivityLog, sequelize } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');

// Helper: generate next lead ID
const generateLeadId = async () => {
  const lastLead = await Lead.findOne({
    order: [['createdAt', 'DESC']],
    attributes: ['leadId']
  });
  if (!lastLead) return 'LD-0001';
  const lastNum = parseInt(lastLead.leadId.replace('LD-', ''), 10);
  return `LD-${String(lastNum + 1).padStart(4, '0')}`;
};

// Helper: log activity
const logActivity = async (leadId, action, field, oldValue, newValue, changedBy, transaction = null) => {
  await LeadActivityLog.create({
    leadId, action, field,
    oldValue: oldValue != null ? String(oldValue) : null,
    newValue: newValue != null ? String(newValue) : null,
    changedBy
  }, { transaction });
};

// @desc    Create lead
// @route   POST /api/leads
// @access  Private
exports.createLead = async (req, res, next) => {
  try {
    const { fullName, phone, email, reasonForCalling, notes, location, disposition, followUpDate, handlingOfficeId, leadSourceId } = req.body;

    if (!fullName || !phone || !reasonForCalling || !handlingOfficeId || !leadSourceId) {
      return next(new ErrorResponse('Please provide all required fields', 'VALIDATION_ERROR', {
        required: ['fullName', 'phone', 'reasonForCalling', 'handlingOfficeId', 'leadSourceId']
      }));
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      return next(new ErrorResponse('Phone number must be exactly 10 digits', 'VALIDATION_ERROR'));
    }

    if (disposition === 'Call Back' && !followUpDate) {
      return next(new ErrorResponse('Follow-up date is required when disposition is Call Back', 'VALIDATION_ERROR'));
    }

    const leadId = await generateLeadId();

    const lead = await Lead.create({
      leadId, fullName, phone, email: email || null, reasonForCalling, notes,
      location: location || null, disposition: disposition || 'New',
      followUpDate: followUpDate || null,
      handlingOfficeId, leadSourceId,
      createdBy: req.user.id
    });

    await logActivity(lead.id, 'Lead created', null, null, null, req.user.id);

    const newLead = await Lead.findByPk(lead.id, {
      include: [
        { model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] },
        { model: LeadSource, as: 'leadSource', attributes: ['id', 'name'] },
        { model: Admin, as: 'owner', attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json({ success: true, data: newLead });
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_CREATE_ERROR'));
  }
};


// @desc    Get all leads with filters
// @route   GET /api/leads
// @access  Private
exports.getLeads = async (req, res, next) => {
  try {
    const {
      page = 0, limit = 10, search = '',
      disposition = '', handlingOfficeId = '', leadSourceId = '',
      startDate = '', endDate = '', ownerId = '', followUpToday = ''
    } = req.query;

    const whereClause = {};

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { leadId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (disposition) {
      const dispositions = disposition.split(',');
      whereClause.disposition = { [Op.in]: dispositions };
    }

    if (handlingOfficeId) {
      const offices = handlingOfficeId.split(',');
      whereClause.handlingOfficeId = { [Op.in]: offices };
    }

    if (leadSourceId) {
      const sources = leadSourceId.split(',');
      whereClause.leadSourceId = { [Op.in]: sources };
    }

    if (startDate && endDate) {
      whereClause.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')] };
    } else if (startDate) {
      whereClause.createdAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      whereClause.createdAt = { [Op.lte]: new Date(endDate + 'T23:59:59.999Z') };
    }

    if (followUpToday === 'true') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      whereClause.followUpDate = { [Op.between]: [todayStart, todayEnd] };
    }

    if (ownerId && req.user.role === 'super-admin') {
      whereClause.createdBy = ownerId;
    }

    const include = [
      { model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] },
      { model: LeadSource, as: 'leadSource', attributes: ['id', 'name'] },
      { model: Admin, as: 'owner', attributes: ['id', 'name'] }
    ];

    const { count, rows } = await Lead.findAndCountAll({
      where: whereClause,
      include,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(page) * parseInt(limit),
      distinct: true
    });

    res.status(200).json({
      leads: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_LIST_ERROR'));
  }
};

// @desc    Get single lead with activity log
// @route   GET /api/leads/:id
// @access  Private
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] },
        { model: LeadSource, as: 'leadSource', attributes: ['id', 'name'] },
        { model: Admin, as: 'owner', attributes: ['id', 'name'] },
        {
          model: LeadActivityLog, as: 'activityLogs',
          include: [{ model: Admin, as: 'changedByUser', attributes: ['id', 'name'] }],
          order: [['createdAt', 'DESC']]
        }
      ]
    });

    if (!lead) {
      return next(new ErrorResponse('Lead not found', 'LEAD_NOT_FOUND'));
    }

    res.status(200).json(lead);
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_FETCH_ERROR'));
  }
};


// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
exports.updateLead = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return next(new ErrorResponse('Lead not found', 'LEAD_NOT_FOUND'));
    }

    const isSuperAdmin = req.user.role === 'super-admin';
    const allowedFields = isSuperAdmin
      ? ['fullName', 'phone', 'email', 'reasonForCalling', 'notes', 'location', 'disposition', 'followUpDate', 'handlingOfficeId', 'leadSourceId']
      : ['disposition', 'followUpDate', 'notes'];

    // Validate Call Back requires followUpDate
    const newDisposition = req.body.disposition || lead.disposition;
    if (newDisposition === 'Call Back' && !req.body.followUpDate && !lead.followUpDate) {
      await transaction.rollback();
      return next(new ErrorResponse('Follow-up date is required when disposition is Call Back', 'VALIDATION_ERROR'));
    }

    // Log changes
    for (const field of allowedFields) {
      if (req.body[field] !== undefined && String(req.body[field]) !== String(lead[field])) {
        await logActivity(lead.id, `${field} updated`, field, lead[field], req.body[field], req.user.id, transaction);
      }
    }

    // Filter to only allowed fields
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // Convert empty strings to null for nullable fields
        if ((field === 'followUpDate' || field === 'email' || field === 'notes' || field === 'location') && !req.body[field]) {
          updateData[field] = null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    await lead.update(updateData, { transaction });
    await transaction.commit();

    const updatedLead = await Lead.findByPk(lead.id, {
      include: [
        { model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] },
        { model: LeadSource, as: 'leadSource', attributes: ['id', 'name'] },
        { model: Admin, as: 'owner', attributes: ['id', 'name'] }
      ]
    });

    res.status(200).json({ success: true, data: updatedLead });
  } catch (error) {
    await transaction.rollback();
    next(new ErrorResponse(error.message, 'LEAD_UPDATE_ERROR'));
  }
};

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private (super-admin)
exports.deleteLead = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return next(new ErrorResponse('Lead not found', 'LEAD_NOT_FOUND'));
    }

    await LeadActivityLog.destroy({ where: { leadId: lead.id }, transaction });
    await lead.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    await transaction.rollback();
    next(new ErrorResponse(error.message, 'LEAD_DELETE_ERROR'));
  }
};


// @desc    Get lead stats (super-admin)
// @route   GET /api/leads/stats
// @access  Private (super-admin)
exports.getLeadStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalAll, totalThisMonth, totalLastMonth, totalThisWeek, totalToday,
      dispositionBreakdown, officeBreakdown, sourceBreakdown,
      overdueFollowUps, todayFollowUps, ownerBreakdown
    ] = await Promise.all([
      Lead.count(),
      Lead.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      Lead.count({ where: { createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } } }),
      Lead.count({ where: { createdAt: { [Op.gte]: startOfWeek } } }),
      Lead.count({ where: { createdAt: { [Op.gte]: todayStart } } }),
      Lead.findAll({
        attributes: ['disposition', [sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        group: ['disposition'], raw: true
      }),
      Lead.findAll({
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: HandlingOffice, as: 'handlingOffice', attributes: ['name'] }],
        group: ['handlingOffice.id', 'handlingOffice.name'], raw: true
      }),
      Lead.findAll({
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: LeadSource, as: 'leadSource', attributes: ['name'] }],
        group: ['leadSource.id', 'leadSource.name'], raw: true
      }),
      Lead.count({
        where: { disposition: 'Call Back', followUpDate: { [Op.lt]: new Date() } }
      }),
      Lead.count({
        where: {
          disposition: 'Call Back',
          followUpDate: {
            [Op.between]: [todayStart, new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)]
          }
        }
      }),
      Lead.findAll({
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: Admin, as: 'owner', attributes: ['name'] }],
        group: ['owner.id', 'owner.name'], raw: true
      })
    ]);

    const onboardedCount = await Lead.count({ where: { disposition: 'Onboarded' } });
    const conversionRate = totalAll > 0 ? ((onboardedCount / totalAll) * 100).toFixed(1) : 0;

    // Month-over-month growth
    const monthGrowth = totalLastMonth > 0
      ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(1)
      : totalThisMonth > 0 ? '100.0' : '0.0';

    res.status(200).json({
      totalAll, totalThisMonth, totalLastMonth, totalThisWeek, totalToday,
      dispositionBreakdown, officeBreakdown, sourceBreakdown, ownerBreakdown,
      conversionRate: parseFloat(conversionRate),
      overdueFollowUps, todayFollowUps,
      monthGrowth: parseFloat(monthGrowth)
    });
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_STATS_ERROR'));
  }
};

// @desc    Export leads to Excel
// @route   GET /api/leads/export
// @access  Private (super-admin)
exports.exportLeads = async (req, res, next) => {
  try {
    const { startDate, endDate, handlingOfficeId } = req.query;

    if (!startDate || !endDate) {
      return next(new ErrorResponse('Start date and end date are required', 'VALIDATION_ERROR'));
    }

    const whereClause = {
      createdAt: {
        [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')]
      }
    };

    if (handlingOfficeId) {
      whereClause.handlingOfficeId = handlingOfficeId;
    }

    const leads = await Lead.findAll({
      where: whereClause,
      include: [
        { model: HandlingOffice, as: 'handlingOffice', attributes: ['name'] },
        { model: LeadSource, as: 'leadSource', attributes: ['name'] },
        { model: Admin, as: 'owner', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Leads');

    worksheet.columns = [
      { header: 'Lead ID', key: 'leadId', width: 12 },
      { header: 'Full Name', key: 'fullName', width: 20 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Reason for Calling', key: 'reasonForCalling', width: 30 },
      { header: 'Lead Source', key: 'leadSource', width: 15 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Disposition', key: 'disposition', width: 15 },
      { header: 'Follow-Up Date', key: 'followUpDate', width: 15 },
      { header: 'Handling Office', key: 'handlingOffice', width: 15 },
      { header: 'Owner', key: 'owner', width: 20 },
      { header: 'Created Date', key: 'createdAt', width: 20 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    leads.forEach(lead => {
      worksheet.addRow({
        leadId: lead.leadId,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email || '',
        reasonForCalling: lead.reasonForCalling,
        leadSource: lead.leadSource?.name || '',
        notes: lead.notes || '',
        location: lead.location || '',
        disposition: lead.disposition,
        followUpDate: lead.followUpDate || '',
        handlingOffice: lead.handlingOffice?.name || '',
        owner: lead.owner?.name || '',
        createdAt: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=leads_${startDate}_to_${endDate}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_EXPORT_ERROR'));
  }
};
