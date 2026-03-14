const { sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');

const seedOffices = ['Delhi', 'Kolkata', 'Surat', 'Bengaluru'];
const seedSources = ['Phone Call', 'Walk-in', 'Referral', 'Website', 'Social Media', 'Advertisement'];

async function up() {
  const queryInterface = sequelize.getQueryInterface();

  // Create handling_offices table
  await queryInterface.createTable('handling_offices', {
    id: { type: sequelize.Sequelize.UUID, primaryKey: true, defaultValue: sequelize.Sequelize.UUIDV4 },
    name: { type: sequelize.Sequelize.STRING, allowNull: false, unique: true },
    status: { type: sequelize.Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
    createdAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW },
    updatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW }
  });

  // Create lead_sources table
  await queryInterface.createTable('lead_sources', {
    id: { type: sequelize.Sequelize.UUID, primaryKey: true, defaultValue: sequelize.Sequelize.UUIDV4 },
    name: { type: sequelize.Sequelize.STRING, allowNull: false, unique: true },
    status: { type: sequelize.Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
    createdAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW },
    updatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW }
  });

  // Create leads table
  await queryInterface.createTable('leads', {
    id: { type: sequelize.Sequelize.UUID, primaryKey: true, defaultValue: sequelize.Sequelize.UUIDV4 },
    leadId: { type: sequelize.Sequelize.STRING, allowNull: false, unique: true },
    fullName: { type: sequelize.Sequelize.STRING, allowNull: false },
    phone: { type: sequelize.Sequelize.STRING, allowNull: false },
    email: { type: sequelize.Sequelize.STRING, allowNull: true },
    reasonForCalling: { type: sequelize.Sequelize.TEXT, allowNull: false },
    notes: { type: sequelize.Sequelize.TEXT, allowNull: true },
    disposition: {
      type: sequelize.Sequelize.ENUM('New', 'Call Back', 'Not Interested', 'Onboarded', 'Others'),
      allowNull: false, defaultValue: 'New'
    },
    followUpDate: { type: sequelize.Sequelize.DATEONLY, allowNull: true },
    handlingOfficeId: {
      type: sequelize.Sequelize.UUID, allowNull: false,
      references: { model: 'handling_offices', key: 'id' }
    },
    leadSourceId: {
      type: sequelize.Sequelize.UUID, allowNull: false,
      references: { model: 'lead_sources', key: 'id' }
    },
    createdBy: {
      type: sequelize.Sequelize.UUID, allowNull: false,
      references: { model: 'admin', key: 'id' }
    },
    createdAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW },
    updatedAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW }
  });

  // Create lead_activity_logs table
  await queryInterface.createTable('lead_activity_logs', {
    id: { type: sequelize.Sequelize.UUID, primaryKey: true, defaultValue: sequelize.Sequelize.UUIDV4 },
    leadId: {
      type: sequelize.Sequelize.UUID, allowNull: false,
      references: { model: 'leads', key: 'id' }
    },
    action: { type: sequelize.Sequelize.STRING, allowNull: false },
    field: { type: sequelize.Sequelize.STRING, allowNull: true },
    oldValue: { type: sequelize.Sequelize.TEXT, allowNull: true },
    newValue: { type: sequelize.Sequelize.TEXT, allowNull: true },
    changedBy: {
      type: sequelize.Sequelize.UUID, allowNull: false,
      references: { model: 'admin', key: 'id' }
    },
    createdAt: { type: sequelize.Sequelize.DATE, allowNull: false, defaultValue: sequelize.Sequelize.NOW }
  });

  // Seed handling offices
  const now = new Date();
  await queryInterface.bulkInsert('handling_offices',
    seedOffices.map(name => ({ id: uuidv4(), name, status: 'active', createdAt: now, updatedAt: now }))
  );

  // Seed lead sources
  await queryInterface.bulkInsert('lead_sources',
    seedSources.map(name => ({ id: uuidv4(), name, status: 'active', createdAt: now, updatedAt: now }))
  );

  console.log('Lead management tables created and seeded successfully');
}

async function down() {
  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropTable('lead_activity_logs');
  await queryInterface.dropTable('leads');
  await queryInterface.dropTable('lead_sources');
  await queryInterface.dropTable('handling_offices');
  console.log('Lead management tables dropped');
}

// Run migration
if (require.main === module) {
  const action = process.argv[2] || 'up';
  (action === 'down' ? down() : up())
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = { up, down };
