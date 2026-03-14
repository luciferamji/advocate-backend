/**
 * Migration: Add 'overdue' to hearing status enum
 * Date: 2026-03-14
 * Description: Adds 'overdue' value to the hearing status enum for auto-marking past-date hearings
 * 
 * Usage: node migrations/add-overdue-hearing-status.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Add overdue hearing status...');

    // Check if 'overdue' already exists in the enum
    const [enumValues] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'enum_hearing_status'
      );
    `);

    const existing = enumValues.map(r => r.enumlabel);

    if (existing.includes('overdue')) {
      console.log('✓ "overdue" already exists in enum_hearing_status. Skipping migration.');
      process.exit(0);
    }

    // Add 'overdue' to the enum
    console.log('Adding "overdue" to enum_hearing_status...');
    await sequelize.query(`
      ALTER TYPE enum_hearing_status ADD VALUE 'overdue';
    `);
    console.log('✓ "overdue" added to enum_hearing_status');

    // Mark existing past-date scheduled hearings as overdue
    const today = new Date().toISOString().split('T')[0];
    const [, meta] = await sequelize.query(`
      UPDATE hearing SET status = 'overdue'
      WHERE status = 'scheduled' AND date < '${today}';
    `);
    console.log(`✓ Marked ${meta.rowCount || 0} past hearings as overdue`);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
