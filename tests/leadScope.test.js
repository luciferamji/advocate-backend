jest.mock('../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue() }));

const app = require('../app');
const { db, resetDb, createOffice, createSource, createUser, createLead, as } = require('./helpers');

const { LeadActivityLog, sequelize } = db;

let delhi, kolkata, source, superAdmin, a1, a2, b1, noOffice;
let leadA1, leadA2, leadB1, leadNoOffice;

beforeAll(async () => {
  await resetDb();
  delhi = await createOffice('Delhi');
  kolkata = await createOffice('Kolkata');
  source = await createSource();
  superAdmin = await createUser({ role: 'super-admin' });
  a1 = await createUser({ office: delhi, name: 'A One' });
  a2 = await createUser({ office: delhi, name: 'A Two' });
  b1 = await createUser({ office: kolkata, name: 'B One' });
  noOffice = await createUser({ name: 'No Office' });

  leadA1 = await createLead({ office: delhi, source, assignee: a1 });
  leadA2 = await createLead({ office: delhi, source, assignee: a2 });
  leadB1 = await createLead({ office: kolkata, source, assignee: b1 });
  leadNoOffice = await createLead({ office: kolkata, source, assignee: noOffice });
});

afterAll(() => sequelize.close());

const ids = (res) => res.body.leads.map(l => l.id).sort();

describe('lead visibility scope', () => {
  test('super-admin sees all leads and can filter by office and assignee', async () => {
    const all = await as(app, superAdmin).get('/api/leads?limit=50');
    expect(all.status).toBe(200);
    expect(all.body.pagination.total).toBe(4);

    const byOffice = await as(app, superAdmin).get(`/api/leads?handlingOfficeId=${kolkata.id}`);
    expect(ids(byOffice)).toEqual([leadB1.id, leadNoOffice.id].sort());

    const byAssignee = await as(app, superAdmin).get(`/api/leads?assignedTo=${a2.id}`);
    expect(ids(byAssignee)).toEqual([leadA2.id]);

    const legacyOwner = await as(app, superAdmin).get(`/api/leads?ownerId=${a2.id}`);
    expect(ids(legacyOwner)).toEqual([leadA2.id]);
  });

  test('advocate sees own leads plus all leads of their office, nothing else', async () => {
    const res = await as(app, a1).get('/api/leads?limit=50');
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([leadA1.id, leadA2.id].sort());
    const other = res.body.leads.find(l => l.id === leadA2.id);
    expect(other.owner.name).toBe('A Two');
  });

  test('advocate cannot widen scope with filters', async () => {
    const res = await as(app, a1).get(`/api/leads?handlingOfficeId=${kolkata.id}&assignedTo=${b1.id}`);
    expect(res.body.pagination.total).toBe(0);
  });

  test('advocate without an office sees only leads assigned to them', async () => {
    const res = await as(app, noOffice).get('/api/leads?limit=50');
    expect(ids(res)).toEqual([leadNoOffice.id]);
  });

  test('GET /:id — own 200, office colleague 200 (read-only), other office 404', async () => {
    expect((await as(app, a1).get(`/api/leads/${leadA1.id}`)).status).toBe(200);
    expect((await as(app, a1).get(`/api/leads/${leadA2.id}`)).status).toBe(200);
    expect((await as(app, a1).get(`/api/leads/${leadB1.id}`)).status).toBe(404);
    expect((await as(app, a1).get('/api/leads/not-a-uuid')).status).toBe(404);
  });

  test('PUT /:id — own lead editable, office colleague lead 403, other office 404', async () => {
    const own = await as(app, a1).put(`/api/leads/${leadA1.id}`).send({ disposition: 'In Progress' });
    expect(own.status).toBe(200);
    expect(own.body.data.disposition).toBe('In Progress');

    const colleague = await as(app, a1).put(`/api/leads/${leadA2.id}`).send({ disposition: 'Onboarded' });
    expect(colleague.status).toBe(403);

    const outside = await as(app, a1).put(`/api/leads/${leadB1.id}`).send({ disposition: 'Onboarded' });
    expect(outside.status).toBe(404);

    await leadA2.reload();
    await leadB1.reload();
    expect(leadA2.disposition).toBe('New');
    expect(leadB1.disposition).toBe('New');

    const log = await LeadActivityLog.findOne({ where: { leadId: leadA1.id, action: 'UPDATED' } });
    expect(log).toMatchObject({ field: 'disposition', oldValue: 'New', newValue: 'In Progress', actorRole: 'advocate' });
  });

  test('advocate cannot change restricted fields (office/name) of their own lead', async () => {
    await as(app, a1).put(`/api/leads/${leadA1.id}`).send({ handlingOfficeId: kolkata.id, fullName: 'Hacked' });
    await leadA1.reload();
    expect(leadA1.handlingOfficeId).toBe(delhi.id);
    expect(leadA1.fullName).not.toBe('Hacked');
  });

  test('stats are scoped: advocate sees their scope, super-admin everything', async () => {
    const adv = await as(app, a1).get('/api/leads/stats');
    expect(adv.status).toBe(200);
    expect(adv.body.totalAll).toBe(2);
    const owners = adv.body.ownerBreakdown.map(o => o['owner.name']).sort();
    expect(owners).toEqual(['A One', 'A Two']);

    const sa = await as(app, superAdmin).get('/api/leads/stats');
    expect(sa.body.totalAll).toBe(4);
  });

  test('export and delete stay super-admin only', async () => {
    expect((await as(app, a1).get('/api/leads/export?startDate=2020-01-01&endDate=2100-01-01')).status).toBe(403);
    expect((await as(app, a1).delete(`/api/leads/${leadA1.id}`)).status).toBe(403);
    const exp = await as(app, superAdmin).get('/api/leads/export?startDate=2020-01-01&endDate=2100-01-01');
    expect(exp.status).toBe(200);
  });

  test('advocate-created lead is assigned to them in their own office', async () => {
    const res = await as(app, a1).post('/api/leads').send({
      fullName: 'New Client', phone: '9876543210', reasonForCalling: 'x',
      handlingOfficeId: kolkata.id, leadSourceId: source.id
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ assignedTo: a1.id, createdBy: a1.id, handlingOfficeId: delhi.id });
    const log = await LeadActivityLog.findOne({ where: { leadId: res.body.data.id } });
    expect(log.action).toBe('CREATED');
    expect(log.userAgent).toBe('jest-test');
    expect(log.ip).toBeTruthy();
  });

  test('unauthenticated requests are rejected', async () => {
    const request = require('supertest');
    expect((await request(app).get('/api/leads')).status).toBe(401);
  });
});
