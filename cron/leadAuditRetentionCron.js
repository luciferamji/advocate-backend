const cron = require('node-cron');
const { purgeOldLeadActivityLogs } = require('../utils/leadAudit');

// Lead audit log retention: 3 years. Runs daily at 02:30 IST.
cron.schedule('30 2 * * *', async () => {
  try {
    const deleted = await purgeOldLeadActivityLogs();
    console.log(`[${new Date().toISOString()}] Lead audit retention: purged ${deleted} log(s) older than 3 years.`);
  } catch (error) {
    console.error('Lead audit retention purge failed:', error);
  }
}, {
  timezone: 'Asia/Kolkata'
});
