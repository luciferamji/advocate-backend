/**
 * Migration: Add 'location' column to leads table
 * Date: 2026-03-14
 * Description: Adds a nullable location (VARCHAR) column to the leads table
 * 
 * Usage: node migrations/add-location-to-leads.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Add location to leads...');

    // Check if column already exists
    const [columns] = await sequelize.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'location';
    `);

    if (columns.length > 0) {
      console.log('✓ "location" column already exists in leads table. Skipping migration.');
      process.exit(0);
    }

    // Add location column
    console.log('Adding "location" column to leads table...');
    await sequelize.query(`
      ALTER TABLE leads ADD COLUMN location VARCHAR(255) DEFAULT NULL;
    `);
    console.log('✓ "location" column added to leads table');

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
