const { Admin, HandlingOffice } = require('../models');
const { findOfficeForLocation } = require('../utils/offices');

// System actor for website leads: the "website@lawfyco.com" account if it
// exists, otherwise the first super-admin.
const getSystemUser = async (transaction) => {
  const website = await Admin.findOne({ where: { email: 'website@lawfyco.com' }, transaction });
  if (website) return website;
  return Admin.findOne({ where: { role: 'super-admin' }, order: [['createdAt', 'ASC']], transaction });
};

const activeAdvocatesOfOffice = (officeId, transaction) => Admin.findAll({
  where: { role: 'advocate', status: 'active', handlingOfficeId: officeId },
  attributes: ['id', 'name', 'email', 'handlingOfficeId'],
  order: [['createdAt', 'ASC'], ['id', 'ASC']],
  transaction
});

// Round-robin among the office's ACTIVE advocates. The office row is locked
// (FOR UPDATE) so concurrent website leads never pick the same cursor.
// Returns the advocate, or null when the office has none (caller falls back).
const pickRoundRobinAdvocate = async (officeId, transaction) => {
  const office = await HandlingOffice.findByPk(officeId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!office) return null;
  const advocates = await activeAdvocatesOfOffice(officeId, transaction);
  if (!advocates.length) return null;

  const lastIndex = advocates.findIndex(a => a.id === office.lastAssignedAdvocateId);
  const next = advocates[(lastIndex + 1) % advocates.length];
  await office.update({ lastAssignedAdvocateId: next.id }, { transaction });
  return next;
};

// Office for a website lead: from the location/city text, otherwise the
// WEBSITE_DEFAULT_OFFICE (by name), otherwise the first active office.
const resolveWebsiteOffice = async (location, transaction) => {
  const offices = await HandlingOffice.findAll({
    where: { status: 'active' }, order: [['name', 'ASC']], transaction
  });
  const matched = findOfficeForLocation(location, offices);
  if (matched) return { office: matched, matched: true };
  const fallbackName = process.env.WEBSITE_DEFAULT_OFFICE;
  const fallback = (fallbackName && findOfficeForLocation(fallbackName, offices)) || offices[0] || null;
  return { office: fallback, matched: false };
};

module.exports = { getSystemUser, activeAdvocatesOfOffice, pickRoundRobinAdvocate, resolveWebsiteOffice };
