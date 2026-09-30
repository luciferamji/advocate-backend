const crypto = require('crypto');
const request = require('supertest');
const db = require('../models');
const { runMigration } = require('../migrations/add-lead-assignment-and-office');

const { sequelize, Admin, HandlingOffice, LeadSource, Lead } = db;

// Fresh schema from the models, then the real migration on top (triggers, indexes)
const resetDb = async () => {
  await sequelize.sync({ force: true });
  await runMigration({ log: () => {} });
};

const createOffice = (name, status = 'active') => HandlingOffice.create({ name, status });
const createSource = (name = 'Phone Call') => LeadSource.create({ name, status: 'active' });

let userSeq = 0;
const createUser = async ({ role = 'advocate', office = null, status = 'active', name, email, createdAt } = {}) => {
  userSeq += 1;
  const user = await Admin.create({
    name: name || `${role} ${userSeq}`,
    email: email || `user${userSeq}-${crypto.randomBytes(3).toString('hex')}@test.local`,
    password: 'x',
    role,
    status,
    handlingOfficeId: office ? office.id : null,
    sessionId: crypto.randomBytes(16).toString('hex'),
    ...(createdAt ? { createdAt } : {})
  });
  return user;
};

let leadSeq = 0;
const createLead = async ({ office, source, assignee, creator, ...rest }) => {
  leadSeq += 1;
  return Lead.create({
    leadId: `LD-T${String(leadSeq).padStart(4, '0')}`,
    fullName: `Lead ${leadSeq}`,
    phone: String(9000000000 + leadSeq),
    reasonForCalling: 'test',
    handlingOfficeId: office.id,
    leadSourceId: source.id,
    createdBy: (creator || assignee).id,
    assignedTo: assignee.id,
    ...rest
  });
};

const cookieFor = (user) => `session=${user.sessionId}`;

// supertest agent bound to a user session
const as = (app, user) => {
  const wrap = (method) => (url) => request(app)[method](url).set('Cookie', cookieFor(user)).set('User-Agent', 'jest-test');
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), delete: wrap('delete') };
};

module.exports = { db, resetDb, createOffice, createSource, createUser, createLead, as };
