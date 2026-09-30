const { Op } = require('sequelize');
const { LeadActivityLog } = require('../models');

// Action codes written to lead_activity_logs (older rows may contain legacy
// free-text actions such as "Lead created" / "disposition updated").
const ACTIONS = Object.freeze({
  CREATED: 'CREATED',
  UPDATED: 'UPDATED',
  TRANSFERRED: 'TRANSFERRED',
  OFFICE_CHANGED: 'OFFICE_CHANGED',
  DELETED: 'DELETED',
  RESTORED: 'RESTORED'
});

const RETENTION_YEARS = 3;

const requestContext = (req) => (req ? {
  ip: req.ip || null,
  userAgent: (req.get && req.get('user-agent')) ? req.get('user-agent').slice(0, 1000) : null
} : { ip: null, userAgent: null });

const str = (v) => (v != null ? String(v) : null);

// Append-only: there is intentionally no update/delete helper for audit rows.
const logLeadActivity = async ({
  leadId, action, actor, actorRole, req = null,
  field = null, oldValue = null, newValue = null, reason = null, meta = null, transaction = null
}) => {
  if (!ACTIONS[action]) throw new Error(`Unknown lead audit action: ${action}`);
  return LeadActivityLog.create({
    leadId,
    action,
    field,
    oldValue: str(oldValue),
    newValue: str(newValue),
    changedBy: actor.id,
    actorRole: actorRole || actor.role || null,
    reason,
    meta,
    ...requestContext(req)
  }, { transaction });
};

// Retention: delete audit rows older than 3 years (the DB trigger only allows
// deleting rows past this age). Run daily by cron/leadAuditRetentionCron.js;
// can also be run by hand: node -e "require('./utils/leadAudit').purgeOldLeadActivityLogs().then(console.log).then(()=>process.exit())"
const purgeOldLeadActivityLogs = async (now = new Date()) => {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  // one day of slack so app/DB clock differences never hit the trigger
  cutoff.setDate(cutoff.getDate() - 1);
  return LeadActivityLog.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
};

module.exports = { ACTIONS, RETENTION_YEARS, logLeadActivity, purgeOldLeadActivityLogs };
