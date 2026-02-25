/**
 * Migration: Add partial payment support
 * Date: 2026-02-25
 * Description: Adds PARTIALLY_PAID status, paidAmount field, and invoice_payment table
 * 
 * Usage: node migrations/add-partial-payment-support.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  try {
    console.log('Starting migration: Add partial payment support...');
    
    // Step 1: Add PARTIALLY_PAID to status enum
    console.log('Step 1: Updating invoice status enum...');
    await sequelize.query(`
      ALTER TYPE "enum_invoice_status" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
    `);
    console.log('✓ Status enum updated');
    
    // Step 2: Add paidAmount column to invoice table
    console.log('Step 2: Adding paidAmount column...');
    const [paidAmountExists] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoice' 
      AND column_name = 'paidAmount';
    `);
    
    if (paidAmountExists.length === 0) {
      await sequelize.query(`
        ALTER TABLE invoice 
        ADD COLUMN "paidAmount" DECIMAL(10, 2) DEFAULT 0 NOT NULL;
      `);
      console.log('✓ paidAmount column added');
    } else {
      console.log('✓ paidAmount column already exists');
    }

    // Step 2b: Add cancellationReason column to invoice table
    console.log('Step 2b: Adding cancellationReason column...');
    const [cancellationReasonExists] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'invoice' 
      AND column_name = 'cancellationReason';
    `);
    
    if (cancellationReasonExists.length === 0) {
      await sequelize.query(`
        ALTER TABLE invoice 
        ADD COLUMN "cancellationReason" TEXT;
      `);
      console.log('✓ cancellationReason column added');
    } else {
      console.log('✓ cancellationReason column already exists');
    }
    
    // Step 3: Create invoice_payment table
    console.log('Step 3: Creating invoice_payment table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS invoice_payment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoiceId" UUID NOT NULL REFERENCES invoice(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0.01),
        "paymentMode" VARCHAR(50) NOT NULL CHECK ("paymentMode" IN ('cash', 'upi', 'bank', 'cheque', 'others')),
        "transactionId" VARCHAR(255),
        "paymentDate" TIMESTAMP NOT NULL DEFAULT NOW(),
        comments TEXT,
        "createdBy" UUID NOT NULL REFERENCES admin(id),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('✓ invoice_payment table created');
    
    // Step 4: Create indexes for better performance
    console.log('Step 4: Creating indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_payment_invoice_id 
      ON invoice_payment("invoiceId");
    `);
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_payment_created_by 
      ON invoice_payment("createdBy");
    `);
    console.log('✓ Indexes created');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your application');
    console.log('2. Test adding partial payments to invoices');
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
