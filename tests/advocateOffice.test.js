jest.mock('../utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue() }));

const app = require('../app');
const { db, resetDb, createOffice, createUser, as } = require('./helpers');

const { Admin, sequelize } = db;

let delhi, kolkata, superAdmin;

beforeAll(async () => {
  await resetDb();
  delhi = await createOffice('Delhi');
  kolkata = await createOffice('Kolkata');
  superAdmin = await createUser({ role: 'super-admin' });
});

afterAll(() => sequelize.close());

test('office is required when creating an advocate and returned afterwards', async () => {
  const body = { name: 'New Adv', email: 'new.adv@test.local', phone: '9999999999', barNumber: 'D/1/2020' };
  expect((await as(app, superAdmin).post('/api/advocates').send(body)).status).toBe(400);

  const res = await as(app, superAdmin).post('/api/advocates').send({ ...body, handlingOfficeId: delhi.id });
  expect(res.status).toBe(201);
  expect(res.body).toMatchObject({ handlingOfficeId: delhi.id, handlingOfficeName: 'Delhi' });

  const got = await as(app, superAdmin).get(`/api/advocates/${res.body.id}`);
  expect(got.body.handlingOfficeName).toBe('Delhi');
});

test('editing an advocate keeps / changes the office; an office is required', async () => {
  const res = await as(app, superAdmin).post('/api/advocates').send({
    name: 'Edit Adv', email: 'edit.adv@test.local', phone: '9999999998', barNumber: 'D/2/2020', handlingOfficeId: delhi.id
  });
  const id = res.body.id;

  const keep = await as(app, superAdmin).put(`/api/advocates/${id}`).send({ phone: '9999999997' });
  expect(keep.status).toBe(200);
  expect(keep.body.handlingOfficeId).toBe(delhi.id);

  const move = await as(app, superAdmin).put(`/api/advocates/${id}`).send({ handlingOfficeId: kolkata.id });
  expect(move.body.handlingOfficeName).toBe('Kolkata');

  expect((await as(app, superAdmin).put(`/api/advocates/${id}`).send({ handlingOfficeId: 'nope' })).status).toBe(400);

  // a legacy advocate without office must get one on their next edit
  const legacy = await createUser({ name: 'Legacy' });
  await sequelize.models.advocate.create({ adminId: legacy.id, barNumber: 'L/1' });
  expect((await as(app, superAdmin).put(`/api/advocates/${legacy.id}`).send({ phone: '9999999996' })).status).toBe(400);
  expect((await as(app, superAdmin).put(`/api/advocates/${legacy.id}`).send({ handlingOfficeId: kolkata.id })).status).toBe(200);
  expect((await Admin.findByPk(legacy.id)).handlingOfficeId).toBe(kolkata.id);
});

test('/auth/me exposes the user\'s office', async () => {
  const adv = await createUser({ office: delhi });
  const me = await as(app, adv).get('/api/auth/me');
  expect(me.body.handlingOfficeId).toBe(delhi.id);
});

test('office names: Bangalore is stored as Bengaluru and duplicates are rejected', async () => {
  const created = await as(app, superAdmin).post('/api/handling-offices').send({ name: 'bangalore' });
  expect(created.status).toBe(201);
  expect(created.body.data.name).toBe('Bengaluru');
  const dup = await as(app, superAdmin).post('/api/handling-offices').send({ name: 'Bengaluru' });
  expect(dup.body.error.code).toBe('DUPLICATE_OFFICE');
});
