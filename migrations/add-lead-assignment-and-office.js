/**
 * Migration: lead assignment, advocate offices, append-only lead audit log
 * Date: 2026-09-30
 *
 * - admin."handlingOfficeId"            UUID NULL  -> handling_offices(id) ON DELETE SET NULL
 *                                        (left NULL for existing advocates: the owner assigns offices)
 * - handling_offices."lastAssignedAdvocateId" UUID NULL -> admin(id) ON DELETE SET NULL (round-robin cursor)
 * - leads."assignedTo"                  UUID NOT NULL -> admin(id), backfilled = "createdBy";
 *                                        a BEFORE INSERT trigger defaults it to "createdBy" (keeps the
 *                                        old app version working between migration and deploy)
 * - leads."deletedAt"                   soft delete (paranoid)
 * - index leads("handlingOfficeId", "assignedTo")
 * - lead_activity_logs: reason, "actorRole", ip, "userAgent", meta JSONB + index ("leadId", "createdAt")
 * - lead_activity_logs append-only trigger: UPDATE / TRUNCATE always rejected, DELETE only for
 *   rows older than the 3-year retention period
 * - "Bangalore" office renamed to "Bengaluru" (only when Bengaluru does not exist already)
 *
 * Idempotent (information_schema / pg_catalog checks) and runs in ONE transaction.
 * Safe to run while the current app version is live.
 *
 * Usage: node migrations/add-lead-assignment-and-office.js
 */

const { sequelize } = require('../models');

const RETENTION_INTERVAL = '3 years';

async function columnExists(table, column, transaction) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = :table AND column_name = :column`,
    { replacements: { table, column }, transaction }
  );
  return rows.length > 0;
}

async function foreignKeyExists(table, column, transaction) {
  const [rows] = await sequelize.query(
    `SELECT 1
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = current_schema()
       AND tc.table_name = :table AND kcu.column_name = :column`,
    { replacements: { table, column }, transaction }
  );
  return rows.length > 0;
}

async function addColumn(table, column, definition, log, transaction) {
  if (await columnExists(table, column, transaction)) {
    log(`✓ ${table}."${column}" already exists`);
    return false;
  }
  await sequelize.query(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};`, { transaction });
  log(`✓ added ${table}."${column}"`);
  return true;
}

async function addForeignKey(table, column, refTable, onDelete, log, transaction) {
  if (await foreignKeyExists(table, column, transaction)) {
    log(`✓ FK ${table}."${column}" already exists`);
    return;
  }
  await sequelize.query(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fkey"
       FOREIGN KEY ("${column}") REFERENCES "${refTable}"(id) ON UPDATE CASCADE ON DELETE ${onDelete};`,
    { transaction }
  );
  log(`✓ added FK ${table}."${column}" -> ${refTable}(id)`);
}

async function runMigration({ log = console.log } = {}) {
  const summary = {};
  await sequelize.transaction(async (transaction) => {
    const q = (sql, opts = {}) => sequelize.query(sql, { transaction, ...opts });

    // 1. Advocate office
    await addColumn('admin', 'handlingOfficeId', 'UUID NULL', log, transaction);
    await addForeignKey('admin', 'handlingOfficeId', 'handling_offices', 'SET NULL', log, transaction);
    await q(`CREATE INDEX IF NOT EXISTS admin_handling_office_id ON "admin" ("handlingOfficeId");`);

    // 2. Round-robin cursor per office
    await addColumn('handling_offices', 'lastAssignedAdvocateId', 'UUID NULL', log, transaction);
    await addForeignKey('handling_offices', 'lastAssignedAdvocateId', 'admin', 'SET NULL', log, transaction);

    // 3. Lead assignee, backfilled from the creator
    await addColumn('leads', 'assignedTo', 'UUID NULL', log, transaction);
    await addForeignKey('leads', 'assignedTo', 'admin', 'NO ACTION', log, transaction);
    const [, backfill] = await q(`UPDATE leads SET "assignedTo" = "createdBy" WHERE "assignedTo" IS NULL;`);
    summary.backfilledLeads = backfill?.rowCount ?? 0;
    log(`✓ backfilled assignedTo = createdBy on ${summary.backfilledLeads} lead(s)`);

    await q(`
      CREATE OR REPLACE FUNCTION leads_default_assigned_to() RETURNS trigger AS $$
      BEGIN
        IF NEW."assignedTo" IS NULL THEN
          NEW."assignedTo" := NEW."createdBy";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await q(`DROP TRIGGER IF EXISTS leads_default_assigned_to ON leads;`);
    await q(`
      CREATE TRIGGER leads_default_assigned_to BEFORE INSERT ON leads
      FOR EACH ROW EXECUTE PROCEDURE leads_default_assigned_to();
    `);
    await q(`ALTER TABLE leads ALTER COLUMN "assignedTo" SET NOT NULL;`);
    log('✓ leads."assignedTo" NOT NULL (+ insert default trigger)');

    // 3b. Office optional: a website lead without a usable city waits with the super-admin (no office)
    await q(`ALTER TABLE leads ALTER COLUMN "handlingOfficeId" DROP NOT NULL;`);
    log('✓ leads."handlingOfficeId" nullable (unrouted website leads)');

    // 4. Soft delete
    await addColumn('leads', 'deletedAt', 'TIMESTAMP WITH TIME ZONE NULL', log, transaction);

    // 5. Scope index
    await q(`CREATE INDEX IF NOT EXISTS leads_handling_office_id_assigned_to ON leads ("handlingOfficeId", "assignedTo");`);
    log('✓ index leads(handlingOfficeId, assignedTo)');

    // 6. Audit log columns
    await addColumn('lead_activity_logs', 'reason', 'TEXT NULL', log, transaction);
    await addColumn('lead_activity_logs', 'actorRole', 'VARCHAR(255) NULL', log, transaction);
    await addColumn('lead_activity_logs', 'ip', 'VARCHAR(255) NULL', log, transaction);
    await addColumn('lead_activity_logs', 'userAgent', 'TEXT NULL', log, transaction);
    await addColumn('lead_activity_logs', 'meta', 'JSONB NULL', log, transaction);
    await q(`CREATE INDEX IF NOT EXISTS lead_activity_logs_lead_id_created_at ON lead_activity_logs ("leadId", "createdAt");`);
    await q(`CREATE INDEX IF NOT EXISTS lead_activity_logs_created_at ON lead_activity_logs ("createdAt");`);

    // 7. Append-only trigger (DELETE allowed only past the retention period)
    await q(`
      CREATE OR REPLACE FUNCTION lead_activity_logs_append_only() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD."createdAt" < now() - interval '${RETENTION_INTERVAL}' THEN
            RETURN OLD;
          END IF;
        END IF;
        RAISE EXCEPTION 'lead_activity_logs is append-only (% not allowed)', TG_OP
          USING ERRCODE = 'insufficient_privilege';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await q(`DROP TRIGGER IF EXISTS lead_activity_logs_append_only ON lead_activity_logs;`);
    await q(`
      CREATE TRIGGER lead_activity_logs_append_only BEFORE UPDATE OR DELETE ON lead_activity_logs
      FOR EACH ROW EXECUTE PROCEDURE lead_activity_logs_append_only();
    `);
    await q(`DROP TRIGGER IF EXISTS lead_activity_logs_no_truncate ON lead_activity_logs;`);
    await q(`
      CREATE TRIGGER lead_activity_logs_no_truncate BEFORE TRUNCATE ON lead_activity_logs
      FOR EACH STATEMENT EXECUTE PROCEDURE lead_activity_logs_append_only();
    `);
    log('✓ lead_activity_logs append-only triggers');

    // 8. Bangalore == Bengaluru
    const [offices] = await q(
      `SELECT id, name FROM handling_offices WHERE lower(trim(name)) IN ('bangalore', 'bengaluru');`
    );
    const bengaluru = offices.find(o => o.name.trim().toLowerCase() === 'bengaluru');
    const bangalore = offices.filter(o => o.name.trim().toLowerCase() === 'bangalore');
    if (bangalore.length && !bengaluru && bangalore.length === 1) {
      await q(`UPDATE handling_offices SET name = 'Bengaluru', "updatedAt" = now() WHERE id = :id;`,
        { replacements: { id: bangalore[0].id } });
      log('✓ renamed office "Bangalore" -> "Bengaluru"');
    } else if (bangalore.length) {
      summary.warning = 'Both "Bangalore" and "Bengaluru" offices exist — merge them manually (leads/advocates) and deactivate "Bangalore".';
      log(`! ${summary.warning}`);
    } else {
      log('✓ no "Bangalore" duplicate office');
    }

    // 9. Report advocates without an office
    const [unassigned] = await q(
      `SELECT name, email FROM "admin" WHERE role = 'advocate' AND "handlingOfficeId" IS NULL ORDER BY name;`
    );
    summary.advocatesWithoutOffice = unassigned.length;
    if (unassigned.length) {
      log(`! ${unassigned.length} advocate(s) have no office yet — assign one in the app (Advocates → Edit)`);
      log('  or: node scripts/assign-advocate-office.js --email <email> --office <office name>');
      unassigned.forEach(a => log(`  - ${a.name} <${a.email}>`));
    }
  });
  return summary;
}

if (require.main === module) {
  console.log('Starting migration: lead assignment + advocate office + audit log...');
  runMigration()
    .then(() => {
      console.log('\n✅ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Migration failed (rolled back):', error.message);
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runMigration };
