const app = require('./app');
const { sequelize } = require('./models');
const createSuperAdmin = require('./utils/createSuperAdmin');

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    // Sync database
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database connected successfully');
    
    // Create super admin if doesn't exist
    await createSuperAdmin();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

startServer();


//cron declaration
require('./cron/nextDayHearingCron');
require('./cron/linkCleanupCron');
require('./cron/invoiceReminderCron');
require('./cron/overdueHearingCron');
