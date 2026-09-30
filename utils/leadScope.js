const { Op } = require('sequelize');

// Single source of truth for which leads a user may see / change.
//
// Visibility:
//   super-admin                -> all leads (list may filter by office / assignee)
//   advocate with an office    -> leads assigned to them + all leads of their office
//   advocate without an office -> only leads assigned to them
// Changes (edit / transfer):
//   super-admin -> any lead; advocate -> only leads assigned to them.
// Out-of-scope leads are reported as 404 (never reveal they exist); in-scope but
// read-only leads are 403.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

const isSuperAdmin = (user) => user && user.role === 'super-admin';

const leadScopeWhere = (user) => {
  if (isSuperAdmin(user)) return {};
  if (user.handlingOfficeId) {
    return {
      [Op.or]: [
        { assignedTo: user.id },
        { handlingOfficeId: user.handlingOfficeId }
      ]
    };
  }
  return { assignedTo: user.id };
};

// Combine the scope with any other where-clause without clobbering Op.or keys
const scopedWhere = (user, ...clauses) => {
  const parts = [leadScopeWhere(user), ...clauses].filter(c => c && Reflect.ownKeys(c).length);
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { [Op.and]: parts };
};

const canModifyLead = (user, lead) => isSuperAdmin(user) || (lead && lead.assignedTo === user.id);

module.exports = { isUuid, isSuperAdmin, leadScopeWhere, scopedWhere, canModifyLead };
