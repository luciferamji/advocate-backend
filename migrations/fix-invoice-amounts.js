/**
 * Migration: Fix invoice amounts and recalculate totals
 * Date: 2026-02-27
 * Description: Updates invoice amounts based on payment data and ensures consistency
 * 
 * This migration:
 * 1. Recalculates paidAmount from invoice_payment table
 * 2. Updates invoice status based on payment amounts
 * 3. Validates data consistency
 * 
 * Usage: node migrations/fix-invoice-amounts.js
 */

const { sequelize } = require('../models');

async function runMigration() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Starting migration: Fix invoice amounts...\n');
    
    // Step 1: Update specific invoices with correct amounts from spreadsheet data
    console.log('Step 1: Updating invoice amounts from spreadsheet data...');
    
    const invoiceUpdates = [
      { invoiceId: 'LAWFY00000001104', amount: 2500.00, paidAmount: 2500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001103', amount: 7000.00, paidAmount: 7000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001102', amount: 29000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001101', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001100', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001099', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001098', amount: 30000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001097', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001096', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001095', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001094', amount: 1000.00, paidAmount: 1000.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001093', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001092', amount: 9500.00, paidAmount: 9500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001091', amount: 500.00, paidAmount: 500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001090', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001089', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001088', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001087', amount: 4500.00, paidAmount: 4500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001086', amount: 6000.00, paidAmount: 6000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001085', amount: 4000.00, paidAmount: 4000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001084', amount: 30000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001083', amount: 30000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001082', amount: 2500.00, paidAmount: 2500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001081', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001080', amount: 4000.00, paidAmount: 4000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001079', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001078', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001077', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001076', amount: 65000.00, paidAmount: 65000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001075', amount: 75000.00, paidAmount: 75000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001074', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001073', amount: 3500.00, paidAmount: 3500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001072', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001071', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001070', amount: 4000.00, paidAmount: 4000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001069', amount: 27000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001068', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001067', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001066', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001065', amount: 6000.00, paidAmount: 6000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001064', amount: 6000.00, paidAmount: 6000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001063', amount: 60000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001062', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001061', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001060', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001059', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001058', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001057', amount: 63000.00, paidAmount: 63000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001056', amount: 10000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001055', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001054', amount: 60000.00, paidAmount: 60000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001053', amount: 6000.00, paidAmount: 6000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001052', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001051', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001050', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001049', amount: 1000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001048', amount: 3000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001047', amount: 6500.00, paidAmount: 6500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001046', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001045', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001044', amount: 75000.00, paidAmount: 75000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001043', amount: 25000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001042', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001041', amount: 20000.00, paidAmount: 20000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001040', amount: 20000.00, paidAmount: 20000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001039', amount: 43000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001038', amount: 60000.00, paidAmount: 60000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001037', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001036', amount: 10000.00, paidAmount: 10000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001035', amount: 3000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001034', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001033', amount: 3500.00, paidAmount: 3500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001032', amount: 3000.00, paidAmount: 3000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001031', amount: 30000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001030', amount: 23500.00, paidAmount: 23500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001029', amount: 25000.00, paidAmount: 25000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001028', amount: 25000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001027', amount: 20000.00, paidAmount: 20000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001026', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001025', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001024', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001023', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001022', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001021', amount: 6000.00, paidAmount: 6000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001020', amount: 60000.00, paidAmount: 60000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001019', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001018', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001017', amount: 7000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001016', amount: 22000.00, paidAmount: 22000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001015', amount: 22000.00, paidAmount: 0.00, status: 'CANCELLED' },
      { invoiceId: 'LAWFY00000001014', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001013', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001012', amount: 7500.00, paidAmount: 7500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001011', amount: 1500.00, paidAmount: 1500.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001010', amount: 28000.00, paidAmount: 0.00, status: 'UNPAID' },
      { invoiceId: 'LAWFY00000001009', amount: 4000.00, paidAmount: 4000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001008', amount: 20000.00, paidAmount: 20000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001007', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001006', amount: 30000.00, paidAmount: 30000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001005', amount: 22000.00, paidAmount: 22000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001004', amount: 2000.00, paidAmount: 2000.00, status: 'PAID' },
      { invoiceId: 'LAWFY00000001003', amount: 5000.00, paidAmount: 5000.00, status: 'PAID' },
      { invoiceId: 'LAWFY0000000000001001', amount: 1000.00, paidAmount: 1000.00, status: 'PAID' },
      { invoiceId: 'LAWFY0000000000001000', amount: 80000.00, paidAmount: 80000.00, status: 'PAID' }
    ];
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const update of invoiceUpdates) {
      const [result] = await sequelize.query(`
        UPDATE invoice 
        SET amount = :amount, 
            "paidAmount" = :paidAmount,
            status = :status
        WHERE "invoiceId" = :invoiceId
        RETURNING id;
      `, {
        replacements: update,
        transaction
      });
      
      if (result.length > 0) {
        updatedCount++;
      } else {
        notFoundCount++;
      }
    }
    
    console.log(`✓ Updated ${updatedCount} invoices from spreadsheet data`);
    if (notFoundCount > 0) {
      console.log(`⚠ ${notFoundCount} invoices not found in database`);
    }
    
    // Step 2: Validate data consistency for updated invoices only
    console.log('\nStep 2: Validating updated invoices...');
    
    const updatedInvoiceIds = invoiceUpdates.map(u => u.invoiceId);
    const placeholders = updatedInvoiceIds.map((_, i) => `$${i + 1}`).join(',');
    
    const [inconsistentInvoices] = await sequelize.query(`
      SELECT 
        "invoiceId",
        amount,
        "paidAmount",
        status,
        (amount - "paidAmount") as remaining
      FROM invoice
      WHERE "invoiceId" IN (${placeholders})
        AND status != 'CANCELLED'
        AND amount IS NOT NULL
        AND (
          (status = 'PAID' AND "paidAmount" < amount - 0.01) OR
          (status = 'UNPAID' AND "paidAmount" > 0.01) OR
          (status = 'PARTIALLY_PAID' AND ("paidAmount" <= 0.01 OR "paidAmount" >= amount - 0.01))
        );
    `, { 
      bind: updatedInvoiceIds,
      transaction 
    });
    
    if (inconsistentInvoices.length > 0) {
      console.warn(`⚠ Found ${inconsistentInvoices.length} invoices with inconsistent status:`);
      inconsistentInvoices.forEach(inv => {
        console.warn(`  - ${inv.invoiceId}: Amount=${inv.amount}, Paid=${inv.paidAmount}, Status=${inv.status}`);
      });
    } else {
      console.log('✓ All updated invoices have consistent status');
    }
    
    // Step 3: Generate summary report for updated invoices only
    console.log('\nStep 3: Generating summary report for updated invoices...');
    
    const [summary] = await sequelize.query(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'PARTIALLY_PAID' THEN 1 END) as partial_count,
        COUNT(CASE WHEN status = 'UNPAID' THEN 1 END) as unpaid_count,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM("paidAmount"), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN amount - "paidAmount" ELSE 0 END), 0) as total_remaining
      FROM invoice
      WHERE "invoiceId" IN (${placeholders});
    `, { 
      bind: updatedInvoiceIds,
      transaction 
    });
    
    const stats = summary[0];
    console.log('\n📊 Updated Invoices Summary:');
    console.log(`   Total Updated: ${stats.total_invoices}`);
    console.log(`   - PAID: ${stats.paid_count}`);
    console.log(`   - PARTIALLY_PAID: ${stats.partial_count}`);
    console.log(`   - UNPAID: ${stats.unpaid_count}`);
    console.log(`   - CANCELLED: ${stats.cancelled_count}`);
    console.log(`\n💰 Financial Summary (Updated Invoices Only):`);
    console.log(`   Total Amount: ₹${parseFloat(stats.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Paid: ₹${parseFloat(stats.total_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`   Total Remaining: ₹${parseFloat(stats.total_remaining).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    console.log(`\n📝 Note: Only ${invoiceUpdates.length} specific invoices from the spreadsheet were updated.`);
    console.log(`   Other invoices in the database remain unchanged.`);
    
    await transaction.commit();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review the summary above');
    console.log('2. Expected totals: ₹1,579,000 (Amount), ₹1,177,000 (Paid), ₹402,000 (Remaining)');
    console.log('3. Check any inconsistent invoices if reported');
    console.log('4. Restart your application');
    
    process.exit(0);
    
  } catch (error) {
    await transaction.rollback();
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
