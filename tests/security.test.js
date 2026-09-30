const bcrypt = require('bcryptjs');
const request = require('supertest');
const { getAllowedOrigins } = require('../utils/corsOptions');
const { db, resetDb } = require('./helpers');
const createSuperAdmin = require('../utils/createSuperAdmin');

const { Admin, sequelize } = db;

afterAll(() => sequelize.close());

describe('CORS allowlist', () => {
  test('defaults to the app origins in production, env overrides', () => {
    expect(getAllowedOrigins({ NODE_ENV: 'production' })).toEqual([
      'https://pro.lawfyco.com', 'https://www.lawfyco.com', 'https://lawfyco.com'
    ]);
    expect(getAllowedOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://a.com/, https://B.com' }))
      .toEqual(['https://a.com', 'https://b.com']);
  });

  test('allowed origin gets credentials headers; unknown origin gets none', async () => {
    const app = require('../app');
    const ok = await request(app).options('/api/leads').set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');

    const bad = await request(app).options('/api/leads').set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('super-admin seeding', () => {
  beforeEach(resetDb);
  afterEach(() => { delete process.env.SUPER_ADMIN_PASSWORD; });

  test('no fixed password: uses SUPER_ADMIN_PASSWORD when set', async () => {
    process.env.SUPER_ADMIN_PASSWORD = 'a-long-test-password';
    await createSuperAdmin();
    const admins = await Admin.findAll({ where: { role: 'super-admin' } });
    expect(admins.length).toBeGreaterThan(0);
    for (const a of admins) {
      expect(await bcrypt.compare('admin123', a.password)).toBe(false);
      expect(await bcrypt.compare('a-long-test-password', a.password)).toBe(true);
    }
  });

  test('generates a random password when unset', async () => {
    await createSuperAdmin();
    const admin = await Admin.findOne({ where: { role: 'super-admin' } });
    expect(await bcrypt.compare('admin123', admin.password)).toBe(false);
  });

  test('never touches an existing super-admin', async () => {
    const hash = await bcrypt.hash('existing-password', 4);
    await Admin.create({ name: 'Existing', email: 'abhijeet.chakraborty01@gmail.com', password: hash, role: 'super-admin' });
    process.env.SUPER_ADMIN_PASSWORD = 'a-long-test-password';
    await createSuperAdmin();
    const all = await Admin.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].password).toBe(hash);
  });
});
