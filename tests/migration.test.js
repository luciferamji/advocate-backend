const { db } = require('./helpers');
const { runMigration } = require('../migrations/add-lead-assignment-and-office');

const { sequelize } = db;
const q = (sql, replacements) => sequelize.query(sql, { replacements }).then(([rows]) => rows);

// Recreate the pre-migration (live) schema: current tables minus the new columns/triggers
const buildLegacySchema = async () => {
  await sequelize.sync({ force: true });
  await q('DROP TRIGGER IF EXISTS leads_default_assigned_to ON leads');
  await q('DROP TRIGGER IF EXISTS lead_activity_logs_append_only ON lead_activity_logs');
  await q('DROP TRIGGER IF EXISTS lead_activity_logs_no_truncate ON lead_activity_logs');
  await q('ALTER TABLE leads DROP COLUMN "assignedTo", DROP COLUMN "deletedAt"');
  await q('ALTER TABLE "admin" DROP COLUMN "handlingOfficeId"');
  await q('ALTER TABLE handling_offices DROP COLUMN "lastAssignedAdvocateId"');
  await q('ALTER TABLE lead_activity_logs DROP COLUMN reason, DROP COLUMN "actorRole", DROP COLUMN ip, DROP COLUMN "userAgent", DROP COLUMN meta');
};

afterAll(() => sequelize.close());

test('migration upgrades the live schema, backfills and is idempotent', async () => {
  await buildLegacySchema();

  const [admin] = await q(`INSERT INTO "admin" (id, name, email, password, role, status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Adv', 'adv@test.local', 'x', 'advocate', 'active', now(), now()) RETURNING id`);
  const [office] = await q(`INSERT INTO handling_offices (id, name, status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Bangalore', 'active', now(), now()) RETURNING id`);
  const [source] = await q(`INSERT INTO lead_sources (id, name, status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), 'Website', 'active', now(), now()) RETURNING id`);
  const insertLegacyLead = (leadId) => q(`INSERT INTO leads (id, "leadId", "fullName", phone, "reasonForCalling", disposition,
      "handlingOfficeId", "leadSourceId", "createdBy", "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), :leadId, 'Old', '9999999999', 'x', 'New', :office, :source, :admin, now(), now()) RETURNING id`,
  { leadId, office: office.id, source: source.id, admin: admin.id });
  const [lead] = await insertLegacyLead('LD-0001');
  await q(`INSERT INTO lead_activity_logs (id, "leadId", action, "changedBy", "createdAt")
    VALUES (gen_random_uuid(), :lead, 'Lead created', :admin, now())`, { lead: lead.id, admin: admin.id });

  const summary = await runMigration({ log: () => {} });
  expect(summary).toMatchObject({ backfilledLeads: 1, advocatesWithoutOffice: 1 });

  const [upgraded] = await q('SELECT "assignedTo", "deletedAt" FROM leads WHERE id = :id', { id: lead.id });
  expect(upgraded).toEqual({ assignedTo: admin.id, deletedAt: null });

  const [renamed] = await q('SELECT name FROM handling_offices WHERE id = :id', { id: office.id });
  expect(renamed.name).toBe('Bengaluru');

  // the old app version (no assignedTo) can still insert leads
  const [legacyInsert] = await insertLegacyLead('LD-0002');
  const [row] = await q('SELECT "assignedTo" FROM leads WHERE id = :id', { id: legacyInsert.id });
  expect(row.assignedTo).toBe(admin.id);

  // legacy audit rows are kept and are now protected
  await expect(q('DELETE FROM lead_activity_logs')).rejects.toThrow(/append-only/);

  // idempotent
  const second = await runMigration({ log: () => {} });
  expect(second.backfilledLeads).toBe(0);

  const indexes = await q(`SELECT indexname FROM pg_indexes WHERE tablename = 'leads'`);
  expect(indexes.map(i => i.indexname)).toContain('leads_handling_office_id_assigned_to');
});

test('migration refuses to guess when both Bangalore and Bengaluru exist', async () => {
  await buildLegacySchema();
  await q(`INSERT INTO handling_offices (id, name, status, "createdAt", "updatedAt") VALUES
    (gen_random_uuid(), 'Bangalore', 'active', now(), now()), (gen_random_uuid(), 'Bengaluru', 'active', now(), now())`);
  const summary = await runMigration({ log: () => {} });
  expect(summary.warning).toMatch(/Both/);
  const names = (await q('SELECT name FROM handling_offices ORDER BY name')).map(r => r.name);
  expect(names).toEqual(['Bangalore', 'Bengaluru']);
});
