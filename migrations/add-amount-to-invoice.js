/**
 * Migration: Add amount column to invoice table
 * Date: 2026-02-25
 * Description: Adds amount field to store total invoice amount
 * 
 * Usage: node migrations/add-amount-to-invoice.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Add amount column to invoice table...');
    
    // Check if column already exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoice' 
      AND column_name = 'amount';
    `);
    
    if (results.length > 0) {
      console.log('✓ Column "amount" already exists. Skipping migration.');
      process.exit(0);
    }
    
    // Add the amount column
    await sequelize.query(`
      ALTER TABLE invoice 
      ADD COLUMN amount DECIMAL(10, 2) DEFAULT NULL;
    `);
    
    console.log('✓ Successfully added "amount" column to invoice table');
    console.log('Migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
