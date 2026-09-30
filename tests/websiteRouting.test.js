jest.mock('../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue() }));

const request = require('supertest');
const app = require('../app');
const { sendEmail } = require('../utils/email');
const { db, resetDb, createOffice, createUser, as } = require('./helpers');
const { findOfficeForLocation, canonicalOfficeName } = require('../utils/offices');

const { Lead, LeadActivityLog, HandlingOffice, sequelize } = db;

let bengaluru, delhi, system, c1, c2;
let phoneSeq = 0;

beforeAll(async () => {
  await resetDb();
  bengaluru = await createOffice('Bengaluru');
  delhi = await createOffice('Delhi');
  system = await createUser({ role: 'super-admin', name: 'System Admin' });
  const t = Date.now();
  c1 = await createUser({ office: bengaluru, name: 'C One', createdAt: new Date(t - 3000) });
  c2 = await createUser({ office: bengaluru, name: 'C Two', createdAt: new Date(t - 2000) });
  await createUser({ office: bengaluru, name: 'C Inactive', status: 'inactive', createdAt: new Date(t - 1000) });
  await createUser({ office: delhi, name: 'D Inactive', status: 'inactive' });
});

afterAll(() => sequelize.close());

const consult = (location) => {
  phoneSeq += 1;
  return request(app).post('/api/leads/consultation').send({
    fullName: `Web ${phoneSeq}`, phone: String(8000000000 + phoneSeq), email: 'web@example.com',
    areaOfLaw: 'Family', preferredDate: '2030-01-01', preferredTime: '10:00', legalMatter: 'Divorce',
    location
  });
};

const leadFor = (res) => Lead.findOne({ where: { leadId: res.body.leadId } });

describe('office matching', () => {
  test('Bangalore and Bengaluru are the same office, case-insensitive', () => {
    const offices = [{ name: 'Delhi' }, { name: 'Bengaluru' }, { name: 'Kolkata' }];
    expect(findOfficeForLocation('Koramangala, BANGALORE', offices).name).toBe('Bengaluru');
    expect(findOfficeForLocation('bengaluru', offices).name).toBe('Bengaluru');
    expect(findOfficeForLocation('New Delhi 110001', offices).name).toBe('Delhi');
    expect(findOfficeForLocation('Mumbai', offices)).toBeNull();
    expect(findOfficeForLocation('', offices)).toBeNull();
    expect(canonicalOfficeName(' bangalore ')).toBe('Bengaluru');
  });
});

describe('website consultation routing', () => {
  test('round-robin among active advocates of the matched office', async () => {
    const assignees = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await consult('HSR Layout, Bangalore');
      expect(res.status).toBe(201);
      const lead = await leadFor(res);
      expect(lead.handlingOfficeId).toBe(bengaluru.id);
      expect(lead.createdBy).toBe(system.id);
      assignees.push(lead.assignedTo);
    }
    expect(assignees).toEqual([c1.id, c2.id, c1.id]);

    const office = await HandlingOffice.findByPk(bengaluru.id);
    expect(office.lastAssignedAdvocateId).toBe(c1.id);

    // assigned advocate is emailed (in addition to the existing consultation email)
    expect(sendEmail.mock.calls.some(([m]) => m.email === c1.email)).toBe(true);
  });

  test('CREATED is logged by the system user with routing meta', async () => {
    const res = await consult('bengaluru');
    const lead = await leadFor(res);
    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id } });
    expect(log).toMatchObject({ action: 'CREATED', changedBy: system.id, actorRole: 'system' });
    expect(log.meta).toMatchObject({ source: 'website', routing: 'round_robin', fallbackToSystem: false, handlingOfficeName: 'Bengaluru' });
  });

  test('office without active advocates falls back to the system super-admin', async () => {
    const res = await consult('New Delhi');
    const lead = await leadFor(res);
    expect(lead).toMatchObject({ handlingOfficeId: delhi.id, assignedTo: system.id });
    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id } });
    expect(log.meta).toMatchObject({ routing: 'fallback_no_active_advocate', fallbackToSystem: true });
  });

  test('unknown location: no office, super-admin only until transferred', async () => {
    const res = await consult('Mumbai');
    const lead = await leadFor(res);
    expect(lead).toMatchObject({ assignedTo: system.id, handlingOfficeId: null });
    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id } });
    expect(log.meta).toMatchObject({ routing: 'fallback_no_office_match', fallbackToSystem: true, officeMatched: false, handlingOfficeId: null });

    // no advocate sees it (not theirs, no office)
    const asC1 = await as(app, c1).get(`/api/leads/${lead.id}`);
    expect(asC1.status).toBe(404);
    const list = await as(app, c1).get('/api/leads?limit=100');
    expect(JSON.stringify(list.body)).not.toContain(lead.leadId);
    // the super-admin sees it
    const asSystem = await as(app, system).get(`/api/leads/${lead.id}`);
    expect(asSystem.status).toBe(200);

    // transferring it to an advocate moves it into that advocate's office
    const tr = await as(app, system).post(`/api/leads/${lead.id}/transfer`).send({ toAdvocateId: c2.id, reason: 'Routed by admin' });
    expect(tr.status).toBe(200);
    await lead.reload();
    expect(lead).toMatchObject({ assignedTo: c2.id, handlingOfficeId: bengaluru.id });
  });

  test('no city at all is treated like an unknown location', async () => {
    const res = await consult(undefined);
    expect(res.status).toBe(201);
    const lead = await leadFor(res);
    expect(lead).toMatchObject({ assignedTo: system.id, handlingOfficeId: null });
  });

  test('duplicate phone with a New lead is not re-created', async () => {
    const first = await consult('Bangalore');
    const again = await request(app).post('/api/leads/consultation').send({
      fullName: 'Again', phone: String(8000000000 + phoneSeq), areaOfLaw: 'Family',
      preferredDate: '2030-01-01', preferredTime: '10:00', legalMatter: 'Divorce', location: 'Bangalore'
    });
    expect(again.body).toMatchObject({ duplicate: true, leadId: first.body.leadId });
  });
});
