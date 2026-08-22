/**
 * Migration: Add 'In Progress' to lead disposition enum
 * Date: 2026-08-22
 * Description: Adds 'In Progress' value to the lead disposition enum
 * 
 * Usage: node migrations/add-in-progress-disposition.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Add "In Progress" disposition...');

    // Check if 'In Progress' already exists in the enum
    const [enumValues] = await sequelize.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (
        SELECT oid FROM pg_type WHERE typname = 'enum_leads_disposition'
      );
    `);

    const existing = enumValues.map(r => r.enumlabel);
    console.log('Current enum values:', existing);

    if (existing.includes('In Progress')) {
      console.log('✓ "In Progress" already exists. Skipping migration.');
      process.exit(0);
    }

    // Add 'In Progress' to the enum after 'New'
    await sequelize.query(`
      ALTER TYPE "enum_leads_disposition" ADD VALUE 'In Progress' AFTER 'New';
    `);
    console.log('✓ "In Progress" added to enum_leads_disposition');

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
