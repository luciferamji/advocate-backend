/**
 * Migration: Create phone number table
 * Date: 2026-02-26
 * Description: Creates phoneNumber table for managing office phone numbers
 * 
 * Usage: node migrations/create-phone-number-table.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Create phone number table...');
    
    // Check if table already exists
    const [tableExists] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'phoneNumber';
    `);
    
    if (tableExists.length > 0) {
      console.log('✓ Table "phoneNumber" already exists. Skipping migration.');
      process.exit(0);
    }
    
    // Create the phoneNumber table
    console.log('Creating phoneNumber table...');
    await sequelize.query(`
      CREATE TABLE "phoneNumber" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        office VARCHAR(255) NOT NULL,
        place VARCHAR(255) NOT NULL,
        "phoneNumber" VARCHAR(10) NOT NULL CHECK ("phoneNumber" ~ '^[0-9]{10}$'),
        "alohaaNumber" VARCHAR(10) NOT NULL CHECK ("alohaaNumber" ~ '^[0-9]{10}$'),
        "createdBy" UUID NOT NULL REFERENCES admin(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ phoneNumber table created');
    
    // Create indexes for better performance
    console.log('Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_phone_number_created_by 
      ON "phoneNumber"("createdBy");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_phone_number_phone 
      ON "phoneNumber"("phoneNumber");
    `);
    console.log('✓ Indexes created');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your application');
    console.log('2. Super admin can now add phone numbers from the UI');
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };

