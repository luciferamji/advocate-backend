const { Lead, HandlingOffice, LeadSource, Admin, LeadActivityLog, sequelize } = require('../models');
const ErrorResponse = require('../utils/errorHandler');
const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const { sendEmail } = require('../utils/email');
const { generateConsultationRequestEmail } = require('../emailTemplates/consultationRequest');
const { leadTransferred } = require('../emailTemplates/leadTransferred');
const { isUuid, isSuperAdmin, scopedWhere, canModifyLead } = require('../utils/leadScope');
const { ACTIONS, logLeadActivity } = require('../utils/leadAudit');
const { getSystemUser, pickRoundRobinAdvocate, resolveWebsiteOffice } = require('../services/leadAssignment');

const REASON_MIN = 3;
const REASON_MAX = 500;

const leadIncludes = () => [
  { model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] },
  { model: LeadSource, as: 'leadSource', attributes: ['id', 'name'] },
  { model: Admin, as: 'owner', attributes: ['id', 'name'] },
  { model: Admin, as: 'creator', attributes: ['id', 'name'] }
];

const notFound = () => new ErrorResponse('Lead not found', 'LEAD_NOT_FOUND', null, 404);
const forbidden = (message) => new ErrorResponse(message, 'FORBIDDEN', null, 403);
const badRequest = (message, details = null) => new ErrorResponse(message, 'VALIDATION_ERROR', details, 400);

const toErrorResponse = (error, code) => (error instanceof ErrorResponse ? error : new ErrorResponse(error.message, code));

// Lead visible to the current user, or null (out of scope / unknown id)
const findScopedLead = async (user, id, options = {}) => {
  if (!isUuid(id)) return null;
  return Lead.findOne({ where: scopedWhere(user, { id }), ...options });
};

const sameValue = (a, b) => String(a ?? '') === String(b ?? '');

const notifyAssignee = (to, lead, { fromName, actorName, reason }) => {
  if (!to || !to.email) return;
  Promise.resolve()
    .then(() => sendEmail(leadTransferred({
      to, lead, fromName, actorName, reason,
      appUrl: process.env.FRONTEND_URL
    })))
    .catch(err => console.error('Failed to send lead assignment email:', err.message));
};

// Helper: generate next lead ID (soft-deleted leads still own their ID)
const generateLeadId = async (transaction = null) => {
  const lastLead = await Lead.findOne({
    order: [['createdAt', 'DESC']],
    attributes: ['leadId'],
    paranoid: false,
    transaction
  });
  if (!lastLead) return 'LD-0001';
  const lastNum = parseInt(lastLead.leadId.replace('LD-', ''), 10);
  return `LD-${String(lastNum + 1).padStart(4, '0')}`;
};

// @desc    Create lead
// @route   POST /api/leads
// @access  Private
exports.createLead = async (req, res, next) => {
  try {
    const { fullName, phone, email, reasonForCalling, notes, location, disposition, followUpDate, leadSourceId } = req.body;
    // Advocates always create leads in their own office (when they have one)
    const handlingOfficeId = (!isSuperAdmin(req.user) && req.user.handlingOfficeId) || req.body.handlingOfficeId;

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

    const lead = await sequelize.transaction(async (transaction) => {
      const leadId = await generateLeadId(transaction);
      const created = await Lead.create({
        leadId, fullName, phone, email: email || null, reasonForCalling, notes,
        location: location || null, disposition: disposition || 'New',
        followUpDate: followUpDate || null,
        handlingOfficeId, leadSourceId,
        createdBy: req.user.id,
        assignedTo: req.user.id
      }, { transaction });

      await logLeadActivity({
        leadId: created.id, action: ACTIONS.CREATED, actor: req.user, req, transaction,
        meta: { handlingOfficeId, assignedTo: req.user.id, source: 'app' }
      });
      return created;
    });

    const newLead = await Lead.findByPk(lead.id, { include: leadIncludes() });

    res.status(201).json({ success: true, data: newLead });
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_CREATE_ERROR'));
  }
};


// @desc    Get all leads with filters (scoped to the user)
// @route   GET /api/leads
// @access  Private
exports.getLeads = async (req, res, next) => {
  try {
    const {
      page = 0, limit = 10, search = '',
      disposition = '', handlingOfficeId = '', leadSourceId = '',
      startDate = '', endDate = '', ownerId = '', assignedTo = '', followUpToday = ''
    } = req.query;

    const filters = {};

    if (search) {
      filters[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { leadId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (disposition) {
      filters.disposition = { [Op.in]: disposition.split(',') };
    }

    if (handlingOfficeId === 'none') {
      // "Not routed": website leads without an office (only super-admins can see them)
      filters.handlingOfficeId = { [Op.is]: null };
    } else if (handlingOfficeId) {
      const offices = handlingOfficeId.split(',').filter(isUuid);
      filters.handlingOfficeId = { [Op.in]: offices };
    }

    if (leadSourceId) {
      const sources = leadSourceId.split(',').filter(isUuid);
      filters.leadSourceId = { [Op.in]: sources };
    }

    if (startDate && endDate) {
      filters.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')] };
    } else if (startDate) {
      filters.createdAt = { [Op.gte]: new Date(startDate) };
    } else if (endDate) {
      filters.createdAt = { [Op.lte]: new Date(endDate + 'T23:59:59.999Z') };
    }

    if (followUpToday === 'true') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      filters.followUpDate = { [Op.between]: [todayStart, todayEnd] };
    }

    // "ownerId" is the legacy name of the assignee filter
    const assigneeFilter = assignedTo || ownerId;
    if (assigneeFilter) {
      const ids = assigneeFilter.split(',').filter(isUuid);
      filters.assignedTo = { [Op.in]: ids };
    }

    const { count, rows } = await Lead.findAndCountAll({
      where: scopedWhere(req.user, filters),
      include: leadIncludes(),
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

// @desc    Active advocates a lead can be transferred to
// @route   GET /api/leads/assignable-advocates?officeId=
// @access  Private (advocate: own office only)
exports.getAssignableAdvocates = async (req, res, next) => {
  try {
    const { officeId } = req.query;
    const where = { role: 'advocate', status: 'active' };

    if (isSuperAdmin(req.user)) {
      if (officeId) {
        if (!isUuid(officeId)) return next(badRequest('Invalid officeId'));
        where.handlingOfficeId = officeId;
      }
    } else {
      if (!req.user.handlingOfficeId) {
        return res.status(200).json({ advocates: [] });
      }
      if (officeId && officeId !== req.user.handlingOfficeId) {
        return next(forbidden('You can only transfer leads within your office'));
      }
      where.handlingOfficeId = req.user.handlingOfficeId;
      where.id = { [Op.ne]: req.user.id };
    }

    const advocates = await Admin.findAll({
      where,
      attributes: ['id', 'name', 'email', 'handlingOfficeId'],
      include: [{ model: HandlingOffice, as: 'handlingOffice', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']]
    });

    res.status(200).json({ advocates });
  } catch (error) {
    next(new ErrorResponse(error.message, 'ASSIGNABLE_ADVOCATES_ERROR'));
  }
};

// @desc    Get single lead with activity log
// @route   GET /api/leads/:id
// @access  Private (scoped)
exports.getLeadById = async (req, res, next) => {
  try {
    const lead = await findScopedLead(req.user, req.params.id, {
      include: [
        ...leadIncludes(),
        {
          model: LeadActivityLog, as: 'activityLogs',
          include: [{ model: Admin, as: 'changedByUser', attributes: ['id', 'name'] }]
        }
      ],
      order: [[{ model: LeadActivityLog, as: 'activityLogs' }, 'createdAt', 'DESC']]
    });

    if (!lead) {
      return next(notFound());
    }

    res.status(200).json(lead);
  } catch (error) {
    next(new ErrorResponse(error.message, 'LEAD_FETCH_ERROR'));
  }
};


// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private (super-admin: any lead; advocate: leads assigned to them)
exports.updateLead = async (req, res, next) => {
  try {
    const superAdmin = isSuperAdmin(req.user);

    const leadId = await sequelize.transaction(async (transaction) => {
      const lead = await findScopedLead(req.user, req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) throw notFound();
      if (!canModifyLead(req.user, lead)) throw forbidden('You can only edit leads assigned to you');

      const allowedFields = superAdmin
        ? ['fullName', 'phone', 'email', 'reasonForCalling', 'notes', 'location', 'disposition', 'followUpDate', 'handlingOfficeId', 'leadSourceId']
        : ['disposition', 'followUpDate', 'notes'];

      // Validate Call Back requires followUpDate
      const newDisposition = req.body.disposition || lead.disposition;
      if (newDisposition === 'Call Back' && !req.body.followUpDate && !lead.followUpDate) {
        throw new ErrorResponse('Follow-up date is required when disposition is Call Back', 'VALIDATION_ERROR', null, 400);
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

      // Audit changes
      for (const field of Object.keys(updateData)) {
        if (sameValue(updateData[field], lead[field])) continue;
        if (field === 'handlingOfficeId') {
          const [fromOffice, toOffice] = await Promise.all([
            HandlingOffice.findByPk(lead.handlingOfficeId, { transaction }),
            isUuid(updateData.handlingOfficeId) ? HandlingOffice.findByPk(updateData.handlingOfficeId, { transaction }) : null
          ]);
          if (!toOffice) throw badRequest('Handling office not found');
          await logLeadActivity({
            leadId: lead.id, action: ACTIONS.OFFICE_CHANGED, actor: req.user, req, transaction,
            field, oldValue: lead.handlingOfficeId, newValue: toOffice.id,
            meta: {
              fromOfficeId: fromOffice?.id || lead.handlingOfficeId, fromOfficeName: fromOffice?.name || null,
              toOfficeId: toOffice.id, toOfficeName: toOffice.name
            }
          });
        } else {
          await logLeadActivity({
            leadId: lead.id, action: ACTIONS.UPDATED, actor: req.user, req, transaction,
            field, oldValue: lead[field], newValue: updateData[field]
          });
        }
      }

      await lead.update(updateData, { transaction });
      return lead.id;
    });

    const updatedLead = await Lead.findByPk(leadId, { include: leadIncludes() });

    res.status(200).json({ success: true, data: updatedLead });
  } catch (error) {
    next(toErrorResponse(error, 'LEAD_UPDATE_ERROR'));
  }
};

// @desc    Transfer lead to another advocate (and/or office for super-admin)
// @route   POST /api/leads/:id/transfer  { toAdvocateId, reason, toOfficeId? }
// @access  Private (advocate: own leads, to an active advocate of the same office;
//          super-admin: any lead, any active advocate, may change office)
exports.transferLead = async (req, res, next) => {
  try {
    const superAdmin = isSuperAdmin(req.user);
    const { toAdvocateId, toOfficeId } = req.body || {};
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
      throw badRequest(`A reason of ${REASON_MIN}-${REASON_MAX} characters is required`);
    }
    if (toOfficeId && !superAdmin) {
      throw forbidden('Only a super-admin can move a lead to another office');
    }
    if (!toAdvocateId && !toOfficeId) {
      throw badRequest('toAdvocateId is required');
    }
    if ((toAdvocateId && !isUuid(toAdvocateId)) || (toOfficeId && !isUuid(toOfficeId))) {
      throw badRequest('Invalid advocate or office id');
    }

    const result = await sequelize.transaction(async (transaction) => {
      const lead = await findScopedLead(req.user, req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) throw notFound();
      if (!canModifyLead(req.user, lead)) throw forbidden('You can only transfer leads assigned to you');

      let target = null;
      if (toAdvocateId) {
        target = await Admin.findOne({
          where: { id: toAdvocateId, role: 'advocate' },
          attributes: ['id', 'name', 'email', 'status', 'handlingOfficeId'],
          transaction
        });
        if (!target) throw badRequest('Target advocate not found');
        if (target.status !== 'active') throw badRequest('Target advocate is inactive');
        if (target.id === lead.assignedTo) throw badRequest('Lead is already assigned to this advocate');
        if (!superAdmin) {
          if (!req.user.handlingOfficeId) {
            throw forbidden('You are not assigned to an office yet; ask a super-admin to transfer this lead');
          }
          if (target.handlingOfficeId !== req.user.handlingOfficeId) {
            throw forbidden('You can only transfer leads to an advocate in your office');
          }
        }
      }

      let toOffice = null;
      // An unrouted lead (no office, e.g. a website lead without a city) takes the new advocate's office.
      const wantedOfficeId = toOfficeId || (!lead.handlingOfficeId && target && target.handlingOfficeId) || null;
      if (wantedOfficeId && wantedOfficeId !== lead.handlingOfficeId) {
        toOffice = await HandlingOffice.findOne({ where: { id: wantedOfficeId, status: 'active' }, transaction });
        if (!toOffice) throw badRequest('Target office not found or inactive');
      }
      if (!target && !toOffice) throw badRequest('Nothing to transfer');

      const [previousAssignee, fromOffice] = await Promise.all([
        Admin.findByPk(lead.assignedTo, { attributes: ['id', 'name'], transaction }),
        HandlingOffice.findByPk(lead.handlingOfficeId, { attributes: ['id', 'name'], transaction })
      ]);

      const updateData = {};
      if (toOffice) updateData.handlingOfficeId = toOffice.id;
      if (target) updateData.assignedTo = target.id;
      const fromAdvocateId = lead.assignedTo;
      const fromOfficeId = lead.handlingOfficeId;
      await lead.update(updateData, { transaction });

      if (toOffice) {
        await logLeadActivity({
          leadId: lead.id, action: ACTIONS.OFFICE_CHANGED, actor: req.user, req, transaction, reason,
          field: 'handlingOfficeId', oldValue: fromOfficeId, newValue: toOffice.id,
          meta: {
            fromOfficeId, fromOfficeName: fromOffice?.name || null,
            toOfficeId: toOffice.id, toOfficeName: toOffice.name
          }
        });
      }
      if (target) {
        const office = toOffice || fromOffice;
        await logLeadActivity({
          leadId: lead.id, action: ACTIONS.TRANSFERRED, actor: req.user, req, transaction, reason,
          field: 'assignedTo', oldValue: fromAdvocateId, newValue: target.id,
          meta: {
            fromAdvocateId, fromAdvocateName: previousAssignee?.name || null,
            toAdvocateId: target.id, toAdvocateName: target.name,
            officeId: office?.id || null, officeName: office?.name || null,
            crossOffice: !!(target.handlingOfficeId && office && target.handlingOfficeId !== office.id)
          }
        });
      }
      return { lead, target, previousAssignee };
    });

    // In-app notifications don't exist in this app; notify the receiver by email.
    if (result.target) {
      notifyAssignee(result.target, result.lead, {
        fromName: result.previousAssignee?.name, actorName: req.user.name, reason
      });
    }

    const updatedLead = await Lead.findByPk(result.lead.id, { include: leadIncludes() });
    res.status(200).json({ success: true, data: updatedLead });
  } catch (error) {
    next(toErrorResponse(error, 'LEAD_TRANSFER_ERROR'));
  }
};

// @desc    Delete lead (soft delete; audit trail is kept)
// @route   DELETE /api/leads/:id
// @access  Private (super-admin)
exports.deleteLead = async (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, REASON_MAX) : null;
    await sequelize.transaction(async (transaction) => {
      const lead = await findScopedLead(req.user, req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!lead) throw notFound();
      await logLeadActivity({
        leadId: lead.id, action: ACTIONS.DELETED, actor: req.user, req, transaction, reason: reason || null
      });
      await lead.destroy({ transaction });
    });

    res.status(200).json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    next(toErrorResponse(error, 'LEAD_DELETE_ERROR'));
  }
};

// @desc    Restore a soft-deleted lead
// @route   POST /api/leads/:id/restore
// @access  Private (super-admin)
exports.restoreLead = async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) throw notFound();
    await sequelize.transaction(async (transaction) => {
      const lead = await Lead.findOne({
        where: { id: req.params.id }, paranoid: false, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!lead) throw notFound();
      if (!lead.deletedAt) throw badRequest('Lead is not deleted');
      await lead.restore({ transaction });
      await logLeadActivity({ leadId: lead.id, action: ACTIONS.RESTORED, actor: req.user, req, transaction });
    });

    const lead = await Lead.findByPk(req.params.id, { include: leadIncludes() });
    res.status(200).json({ success: true, data: lead });
  } catch (error) {
    next(toErrorResponse(error, 'LEAD_RESTORE_ERROR'));
  }
};


// @desc    Get lead stats (scoped: super-admin = all, advocate = own + office)
// @route   GET /api/leads/stats
// @access  Private
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

    const w = (clause) => scopedWhere(req.user, clause);

    const [
      totalAll, totalThisMonth, totalLastMonth, totalThisWeek, totalToday,
      dispositionBreakdown, officeBreakdown, sourceBreakdown,
      overdueFollowUps, todayFollowUps, ownerBreakdown, onboardedCount
    ] = await Promise.all([
      Lead.count({ where: w() }),
      Lead.count({ where: w({ createdAt: { [Op.gte]: startOfMonth } }) }),
      Lead.count({ where: w({ createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] } }) }),
      Lead.count({ where: w({ createdAt: { [Op.gte]: startOfWeek } }) }),
      Lead.count({ where: w({ createdAt: { [Op.gte]: todayStart } }) }),
      Lead.findAll({
        where: w(),
        attributes: ['disposition', [sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        group: ['disposition'], raw: true
      }),
      Lead.findAll({
        where: w(),
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: HandlingOffice, as: 'handlingOffice', attributes: ['name'] }],
        group: ['handlingOffice.id', 'handlingOffice.name'], raw: true
      }),
      Lead.findAll({
        where: w(),
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: LeadSource, as: 'leadSource', attributes: ['name'] }],
        group: ['leadSource.id', 'leadSource.name'], raw: true
      }),
      Lead.count({
        where: w({ disposition: 'Call Back', followUpDate: { [Op.lt]: new Date() } })
      }),
      Lead.count({
        where: w({
          disposition: 'Call Back',
          followUpDate: {
            [Op.between]: [todayStart, new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)]
          }
        })
      }),
      Lead.findAll({
        where: w(),
        attributes: [[sequelize.fn('COUNT', sequelize.col('lead.id')), 'count']],
        include: [{ model: Admin, as: 'owner', attributes: ['name'] }],
        group: ['owner.id', 'owner.name'], raw: true
      }),
      Lead.count({ where: w({ disposition: 'Onboarded' }) })
    ]);

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

    const filters = {
      createdAt: {
        [Op.between]: [new Date(startDate), new Date(endDate + 'T23:59:59.999Z')]
      }
    };

    if (handlingOfficeId && isUuid(handlingOfficeId)) {
      filters.handlingOfficeId = handlingOfficeId;
    }

    const leads = await Lead.findAll({
      where: scopedWhere(req.user, filters),
      include: [
        { model: HandlingOffice, as: 'handlingOffice', attributes: ['name'] },
        { model: LeadSource, as: 'leadSource', attributes: ['name'] },
        { model: Admin, as: 'owner', attributes: ['name'] },
        { model: Admin, as: 'creator', attributes: ['name'] }
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
      { header: 'Assigned To', key: 'owner', width: 20 },
      { header: 'Created By', key: 'creator', width: 20 },
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
        creator: lead.creator?.name || '',
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


// @desc    Request consultation (public - from www.lawfyco.com)
// @route   POST /api/leads/consultation
// @access  Public
// Routing: office from the location/city text (Bangalore == Bengaluru), then
// round-robin among the office's ACTIVE advocates. No city / no matching office -> no office, assigned to
// the system super-admin (super-admins only) until transferred; office without an active advocate ->
// kept in that office, assigned to the system super-admin. Both flagged in audit meta.
exports.requestConsultation = async (req, res, next) => {
  try {
    const { fullName, phone, email, areaOfLaw, preferredDate, preferredTime, legalMatter } = req.body;
    const rawLocation = req.body.location || req.body.city || '';
    const location = typeof rawLocation === 'string' ? rawLocation.trim().slice(0, 255) : '';

    if (!fullName || !phone || !areaOfLaw || !preferredDate || !preferredTime || !legalMatter) {
      return next(new ErrorResponse('All required fields must be provided', 'VALIDATION_ERROR', {
        required: ['fullName', 'phone', 'areaOfLaw', 'preferredDate', 'preferredTime', 'legalMatter']
      }));
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      return next(new ErrorResponse('Phone number must be exactly 10 digits', 'VALIDATION_ERROR'));
    }

    // Check for duplicate: same phone with active dispositions
    const existingLead = await Lead.findOne({
      where: { phone, disposition: 'New' }
    });

    if (existingLead) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        leadId: existingLead.leadId,
        message: 'We already have your consultation request. Our team will reach out to you soon.'
      });
    }

    // Find or create "Website" lead source
    let leadSource = await LeadSource.findOne({ where: { name: 'Website' } });
    if (!leadSource) {
      leadSource = await LeadSource.create({ name: 'Website', status: 'active' });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const systemUser = await getSystemUser(transaction);
      const { office, matched } = await resolveWebsiteOffice(location, transaction);

      if (!leadSource || !systemUser) {
        throw new ErrorResponse('System configuration incomplete. Please contact support.', 'CONFIG_ERROR');
      }

      const advocate = matched ? await pickRoundRobinAdvocate(office.id, transaction) : null;
      const assignee = advocate || systemUser;
      const routing = advocate
        ? 'round_robin'
        : (matched ? 'fallback_no_active_advocate' : 'fallback_no_office_match');

      const leadId = await generateLeadId(transaction);
      const lead = await Lead.create({
        leadId,
        fullName,
        phone,
        email,
        reasonForCalling: `[${areaOfLaw}] ${legalMatter}`,
        notes: `Consultation request from www.lawfyco.com\nArea of Law: ${areaOfLaw}\nPreferred Date: ${preferredDate}\nPreferred Time: ${preferredTime}`,
        location: location || null,
        disposition: 'New',
        followUpDate: preferredDate,
        handlingOfficeId: office ? office.id : null,
        leadSourceId: leadSource.id,
        createdBy: systemUser.id,
        assignedTo: assignee.id
      }, { transaction });

      await logLeadActivity({
        leadId: lead.id, action: ACTIONS.CREATED, actor: systemUser, actorRole: 'system', req, transaction,
        meta: {
          source: 'website', routing, fallbackToSystem: !advocate,
          location: location || null, officeMatched: matched,
          handlingOfficeId: office ? office.id : null, handlingOfficeName: office ? office.name : null,
          assignedTo: assignee.id, assignedToName: assignee.name
        }
      });
      return { lead, advocate };
    });

    // Send notification email
    sendEmail(generateConsultationRequestEmail({
      fullName,
      phone,
      email,
      areaOfLaw,
      preferredDate,
      preferredTime,
      legalMatter,
      leadId: result.lead.leadId
    })).catch(err => console.error('Failed to send consultation email:', err.message));

    if (result.advocate) {
      notifyAssignee(result.advocate, result.lead, {
        actorName: 'Website (automatic assignment)', reason: 'New consultation request from www.lawfyco.com'
      });
    }

    res.status(201).json({
      success: true,
      leadId: result.lead.leadId,
      message: 'Consultation request submitted successfully. Our team will contact you shortly.'
    });
  } catch (error) {
    next(toErrorResponse(error, 'CONSULTATION_REQUEST_ERROR'));
  }
};
