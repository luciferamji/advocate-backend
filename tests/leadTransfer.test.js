jest.mock('../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue() }));

const app = require('../app');
const { sendEmail } = require('../utils/email');
const { db, resetDb, createOffice, createSource, createUser, createLead, as } = require('./helpers');

const { LeadActivityLog, Lead, sequelize } = db;

let delhi, kolkata, source, superAdmin, a1, a2, a3Inactive, b1, noOffice;

beforeAll(async () => {
  await resetDb();
  delhi = await createOffice('Delhi');
  kolkata = await createOffice('Kolkata');
  source = await createSource();
  superAdmin = await createUser({ role: 'super-admin', name: 'Super' });
  a1 = await createUser({ office: delhi, name: 'A One' });
  a2 = await createUser({ office: delhi, name: 'A Two' });
  a3Inactive = await createUser({ office: delhi, name: 'A Three', status: 'inactive' });
  b1 = await createUser({ office: kolkata, name: 'B One' });
  noOffice = await createUser({ name: 'No Office' });
});

beforeEach(() => sendEmail.mockClear());

afterAll(() => sequelize.close());

const transfer = (user, lead, body) => as(app, user).post(`/api/leads/${lead.id}/transfer`).send(body);

describe('lead transfer rules', () => {
  test('reason is required and must be 3-500 characters', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    expect((await transfer(a1, lead, { toAdvocateId: a2.id })).status).toBe(400);
    expect((await transfer(a1, lead, { toAdvocateId: a2.id, reason: '  ab  ' })).status).toBe(400);
    expect((await transfer(a1, lead, { toAdvocateId: a2.id, reason: 'x'.repeat(501) })).status).toBe(400);
    await lead.reload();
    expect(lead.assignedTo).toBe(a1.id);
  });

  test('advocate can transfer own lead to an active advocate of the same office', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(a1, lead, { toAdvocateId: a2.id, reason: 'Going on leave' });
    expect(res.status).toBe(200);
    expect(res.body.data.assignedTo).toBe(a2.id);
    expect(res.body.data.owner.name).toBe('A Two');
    expect(res.body.data.createdBy).toBe(a1.id); // creator unchanged

    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id, action: 'TRANSFERRED' } });
    expect(log).toMatchObject({
      reason: 'Going on leave', changedBy: a1.id, actorRole: 'advocate',
      oldValue: a1.id, newValue: a2.id, userAgent: 'jest-test'
    });
    expect(log.meta).toMatchObject({ fromAdvocateName: 'A One', toAdvocateName: 'A Two', officeName: 'Delhi' });

    // receiver is notified by email
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].email).toBe(a2.email);

    // previous owner still sees it (same office) but can no longer edit/transfer it
    expect((await as(app, a1).get(`/api/leads/${lead.id}`)).status).toBe(200);
    expect((await as(app, a1).put(`/api/leads/${lead.id}`).send({ notes: 'x' })).status).toBe(403);
    expect((await transfer(a1, lead, { toAdvocateId: a1.id, reason: 'take it back' })).status).toBe(403);
  });

  test('advocate cannot transfer to another office', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(a1, lead, { toAdvocateId: b1.id, reason: 'wrong office' });
    expect(res.status).toBe(403);
    await lead.reload();
    expect(lead.assignedTo).toBe(a1.id);
  });

  test('advocate cannot move a lead to another office', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(a1, lead, { toAdvocateId: a2.id, toOfficeId: kolkata.id, reason: 'move it' });
    expect(res.status).toBe(403);
  });

  test('inactive target advocate is rejected', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(a1, lead, { toAdvocateId: a3Inactive.id, reason: 'inactive target' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/inactive/i);
  });

  test('super-admin cannot transfer to a super-admin / unknown user', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    expect((await transfer(superAdmin, lead, { toAdvocateId: superAdmin.id, reason: 'to me' })).status).toBe(400);
  });

  test('advocate cannot transfer a colleague\'s lead (403) or another office\'s lead (404)', async () => {
    const colleague = await createLead({ office: delhi, source, assignee: a2 });
    const other = await createLead({ office: kolkata, source, assignee: b1 });
    expect((await transfer(a1, colleague, { toAdvocateId: a1.id, reason: 'mine now' })).status).toBe(403);
    expect((await transfer(a1, other, { toAdvocateId: a1.id, reason: 'mine now' })).status).toBe(404);
  });

  test('advocate without an office cannot transfer', async () => {
    const lead = await createLead({ office: delhi, source, assignee: noOffice });
    expect((await transfer(noOffice, lead, { toAdvocateId: a2.id, reason: 'no office' })).status).toBe(403);
  });

  test('super-admin can transfer across offices and change the office in one transaction', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(superAdmin, lead, { toAdvocateId: b1.id, toOfficeId: kolkata.id, reason: 'client moved to Kolkata' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ assignedTo: b1.id, handlingOfficeId: kolkata.id });

    const logs = await LeadActivityLog.findAll({ where: { leadId: lead.id }, order: [['action', 'ASC']] });
    expect(logs.map(l => l.action)).toEqual(['OFFICE_CHANGED', 'TRANSFERRED']);
    logs.forEach(l => expect(l).toMatchObject({ reason: 'client moved to Kolkata', actorRole: 'super-admin' }));
    expect(logs[0].meta).toMatchObject({ fromOfficeName: 'Delhi', toOfficeName: 'Kolkata' });

    // it left A One's scope entirely
    expect((await as(app, a1).get(`/api/leads/${lead.id}`)).status).toBe(404);
  });

  test('super-admin can transfer cross-office without changing the office', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(superAdmin, lead, { toAdvocateId: b1.id, reason: 'specialist' });
    expect(res.status).toBe(200);
    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id, action: 'TRANSFERRED' } });
    expect(log.meta.crossOffice).toBe(true);
  });

  test('failed transfer leaves no partial state', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const res = await transfer(superAdmin, lead, { toAdvocateId: a3Inactive.id, toOfficeId: kolkata.id, reason: 'should fail' });
    expect(res.status).toBe(400);
    const fresh = await Lead.findByPk(lead.id);
    expect(fresh).toMatchObject({ assignedTo: a1.id, handlingOfficeId: delhi.id });
    expect(await LeadActivityLog.count({ where: { leadId: lead.id } })).toBe(0);
  });
});

describe('assignable advocates', () => {
  test('advocate gets active colleagues of their office only (not self, not inactive)', async () => {
    const res = await as(app, a1).get('/api/leads/assignable-advocates');
    expect(res.status).toBe(200);
    expect(res.body.advocates.map(a => a.id)).toEqual([a2.id]);
  });

  test('advocate cannot list another office', async () => {
    expect((await as(app, a1).get(`/api/leads/assignable-advocates?officeId=${kolkata.id}`)).status).toBe(403);
  });

  test('advocate without office gets an empty list', async () => {
    const res = await as(app, noOffice).get('/api/leads/assignable-advocates');
    expect(res.body.advocates).toEqual([]);
  });

  test('super-admin can list any office or all active advocates', async () => {
    const k = await as(app, superAdmin).get(`/api/leads/assignable-advocates?officeId=${kolkata.id}`);
    expect(k.body.advocates.map(a => a.id)).toEqual([b1.id]);
    const all = await as(app, superAdmin).get('/api/leads/assignable-advocates');
    expect(all.body.advocates.map(a => a.id).sort()).toEqual([a1.id, a2.id, b1.id, noOffice.id].sort());
  });
});
