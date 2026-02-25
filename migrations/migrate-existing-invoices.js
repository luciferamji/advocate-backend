/**
 * Data Migration: Populate amount field for existing invoices
 * Date: 2026-02-25
 * Description: Sets amount = 0 for existing invoices that don't have it
 * 
 * Usage: node migrations/migrate-existing-invoices.js
 */

const { sequelize } = require('../models');

async function runDataMigration() {
  try {
    console.log('Starting data migration: Populate amount for existing invoices...');
    
    // Step 1: Check how many invoices have NULL amount
    const [countResult] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM invoice 
      WHERE amount IS NULL;
    `);
    
    const nullCount = parseInt(countResult[0].count);
    console.log(`Found ${nullCount} invoices with NULL amount`);
    
    if (nullCount === 0) {
      console.log('✓ All invoices already have amount set. No migration needed.');
      process.exit(0);
    }
    
    // Step 2: Set amount to 0 for existing invoices
    // Note: We can't calculate the actual amount from old data
    // These invoices will need manual review if they're still active
    console.log('Step 2: Setting amount = 0 for existing invoices...');
    await sequelize.query(`
      UPDATE invoice 
      SET amount = 0 
      WHERE amount IS NULL;
    `);
    console.log('✓ Updated existing invoices');
    
    // Step 3: Show summary
    const [statusSummary] = await sequelize.query(`
      SELECT status, COUNT(*) as count 
      FROM invoice 
      WHERE amount = 0
      GROUP BY status;
    `);
    
    console.log('\n📊 Summary of migrated invoices:');
    statusSummary.forEach(row => {
      console.log(`   ${row.status}: ${row.count} invoices`);
    });
    
    // Step 4: Show recommendations
    console.log('\n⚠️  IMPORTANT NOTES:');
    console.log('1. Existing invoices have been set to amount = 0');
    console.log('2. These invoices were created before the partial payment system');
    console.log('3. For PAID/CANCELLED invoices: No action needed (historical records)');
    console.log('4. For UNPAID invoices: Consider one of these options:');
    console.log('   a) Leave as-is if they are old/inactive');
    console.log('   b) Manually update amount in database if still active');
    console.log('   c) Cancel them and create new invoices');
    
    // Step 5: Generate SQL for manual review (optional)
    const [unpaidInvoices] = await sequelize.query(`
      SELECT "invoiceId", "clientId", status, "createdAt"
      FROM invoice 
      WHERE amount = 0 AND status = 'UNPAID'
      ORDER BY "createdAt" DESC
      LIMIT 10;
    `);
    
    if (unpaidInvoices.length > 0) {
      console.log('\n📋 Sample UNPAID invoices that may need review:');
      unpaidInvoices.forEach(inv => {
        console.log(`   ${inv.invoiceId} - Created: ${new Date(inv.createdAt).toLocaleDateString()}`);
      });
      
      console.log('\n💡 To manually set amount for an invoice:');
      console.log('   UPDATE invoice SET amount = <actual_amount> WHERE "invoiceId" = \'LAWFY...\';');
    }
    
    console.log('\n✅ Data migration completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n✗ Data migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration if executed directly
if (require.main === module) {
  runDataMigration();
}

module.exports = { runDataMigration };
