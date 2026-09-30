jest.mock('../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue() }));

const app = require('../app');
const { db, resetDb, createOffice, createSource, createUser, createLead, as } = require('./helpers');
const { purgeOldLeadActivityLogs } = require('../utils/leadAudit');

const { LeadActivityLog, Lead, sequelize } = db;

let delhi, source, superAdmin, a1;

beforeAll(async () => {
  await resetDb();
  delhi = await createOffice('Delhi');
  source = await createSource();
  superAdmin = await createUser({ role: 'super-admin', name: 'Super' });
  a1 = await createUser({ office: delhi, name: 'A One' });
});

afterAll(() => sequelize.close());

const newLead = async (user = superAdmin) => {
  const res = await as(app, user).post('/api/leads').send({
    fullName: 'Audit Client', phone: '9876500000', reasonForCalling: 'x',
    handlingOfficeId: delhi.id, leadSourceId: source.id
  });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('audit trail and soft delete', () => {
  test('soft delete keeps the lead row and its logs; restore brings it back', async () => {
    const lead = await newLead();
    await as(app, superAdmin).put(`/api/leads/${lead.id}`).send({ disposition: 'Call Back', followUpDate: '2030-01-01' });

    const del = await as(app, superAdmin).delete(`/api/leads/${lead.id}`).send({ reason: 'duplicate entry' });
    expect(del.status).toBe(200);

    expect((await as(app, superAdmin).get(`/api/leads/${lead.id}`)).status).toBe(404);
    const list = await as(app, superAdmin).get('/api/leads');
    expect(list.body.leads.find(l => l.id === lead.id)).toBeUndefined();

    const row = await Lead.findByPk(lead.id, { paranoid: false });
    expect(row.deletedAt).not.toBeNull();

    const actions = (await LeadActivityLog.findAll({ where: { leadId: lead.id }, order: [['createdAt', 'ASC']] }))
      .map(l => l.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATED', 'UPDATED', 'DELETED']));
    const deletedLog = await LeadActivityLog.findOne({ where: { leadId: lead.id, action: 'DELETED' } });
    expect(deletedLog.reason).toBe('duplicate entry');

    const restore = await as(app, superAdmin).post(`/api/leads/${lead.id}/restore`);
    expect(restore.status).toBe(200);
    expect((await as(app, superAdmin).get(`/api/leads/${lead.id}`)).status).toBe(200);
    expect(await LeadActivityLog.count({ where: { leadId: lead.id, action: 'RESTORED' } })).toBe(1);
  });

  test('lead IDs are not reused after a soft delete', async () => {
    const first = await newLead();
    await as(app, superAdmin).delete(`/api/leads/${first.id}`);
    const second = await newLead();
    expect(second.leadId).not.toBe(first.leadId);
  });

  test('GET /:id returns the audit trail newest first with actor names', async () => {
    const lead = await newLead();
    await as(app, superAdmin).put(`/api/leads/${lead.id}`).send({ notes: 'first' });
    const res = await as(app, superAdmin).get(`/api/leads/${lead.id}`);
    const logs = res.body.activityLogs;
    expect(logs[0].action).toBe('UPDATED');
    expect(logs[logs.length - 1].action).toBe('CREATED');
    expect(logs[0].changedByUser.name).toBe('Super');
  });

  test('office change by super-admin is logged as OFFICE_CHANGED', async () => {
    const kolkata = await createOffice('Kolkata');
    const lead = await newLead();
    await as(app, superAdmin).put(`/api/leads/${lead.id}`).send({ handlingOfficeId: kolkata.id });
    const log = await LeadActivityLog.findOne({ where: { leadId: lead.id, action: 'OFFICE_CHANGED' } });
    expect(log.meta).toMatchObject({ fromOfficeName: 'Delhi', toOfficeName: 'Kolkata' });
  });

  test('database rejects UPDATE / DELETE / TRUNCATE of audit rows', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const log = await LeadActivityLog.create({ leadId: lead.id, action: 'CREATED', changedBy: a1.id });

    await expect(sequelize.query(`UPDATE lead_activity_logs SET reason = 'x' WHERE id = '${log.id}'`))
      .rejects.toThrow(/append-only/);
    await expect(LeadActivityLog.destroy({ where: { id: log.id } })).rejects.toThrow(/append-only/);
    await expect(sequelize.query('TRUNCATE lead_activity_logs')).rejects.toThrow(/append-only/);
    expect(await LeadActivityLog.count({ where: { id: log.id } })).toBe(1);
  });

  test('retention purge deletes only rows older than 3 years', async () => {
    const lead = await createLead({ office: delhi, source, assignee: a1 });
    const old = new Date();
    old.setFullYear(old.getFullYear() - 3);
    old.setDate(old.getDate() - 10);
    await sequelize.query(
      `INSERT INTO lead_activity_logs (id, "leadId", action, "changedBy", "createdAt")
       VALUES (gen_random_uuid(), :leadId, 'CREATED', :by, :old)`,
      { replacements: { leadId: lead.id, by: a1.id, old } }
    );
    await LeadActivityLog.create({ leadId: lead.id, action: 'UPDATED', changedBy: a1.id });

    const purged = await purgeOldLeadActivityLogs();
    expect(purged).toBe(1);
    const remaining = await LeadActivityLog.findAll({ where: { leadId: lead.id } });
    expect(remaining.map(r => r.action)).toEqual(['UPDATED']);
  });
});
