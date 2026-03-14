const cron = require('node-cron');
const { Hearing } = require('../models');
const { Op } = require('sequelize');

const markOverdueHearings = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [, meta] = await Hearing.sequelize.query(`
      UPDATE hearing SET status = 'overdue', "updatedAt" = NOW()
      WHERE status = 'scheduled' AND date < '${today}';
    `);

    const count = meta.rowCount || 0;
    if (count > 0) {
      console.log(`[Overdue Cron] Marked ${count} hearing(s) as overdue`);
    }
  } catch (err) {
    console.error('[Overdue Cron] Error marking overdue hearings:', err);
  }
};

// Run daily at midnight IST
cron.schedule('0 0 * * *', markOverdueHearings, {
  timezone: 'Asia/Kolkata'
});

// Also run once on server startup to catch any missed hearings
markOverdueHearings();
