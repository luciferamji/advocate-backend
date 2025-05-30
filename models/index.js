const { Sequelize } = require('sequelize');
const dbConfig = require('../config/db.config');

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.DB,
  dbConfig.USER,
  dbConfig.PASSWORD,
  {
    host: dbConfig.HOST,
    port: dbConfig.PORT,
    dialect: dbConfig.dialect,
    pool: dbConfig.pool,
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

// Initialize db object
const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Admin = require('./admin.model')(sequelize, Sequelize);
db.Advocate = require('./advocate.model')(sequelize, Sequelize);
db.Client = require('./client.model')(sequelize, Sequelize);
db.Case = require('./case.model')(sequelize, Sequelize);
db.Hearing = require('./hearing.model')(sequelize, Sequelize);
db.HearingComment = require('./hearingComment.model')(sequelize, Sequelize);
db.HearingCommentDoc = require('./hearingCommentDoc.model')(sequelize, Sequelize);
db.CaseComment = require('./caseComment.model')(sequelize, Sequelize);
db.CaseCommentDoc = require('./caseCommentDoc.model')(sequelize, Sequelize);
db.UploadLink = require('./uploadLink.model')(sequelize, Sequelize);

// Define associations

// Admin - Advocate relationship (1:1)
db.Admin.hasOne(db.Advocate);
db.Advocate.belongsTo(db.Admin);

// Admin - Client relationship (1:Many)
db.Admin.hasMany(db.Client, {
  foreignKey: 'createdBy',
  as: 'clients'
});
db.Client.belongsTo(db.Admin, {
  foreignKey: 'createdBy',
  as: 'admin'
});

// Client - Case relationship (1:Many)
db.Client.hasMany(db.Case, {
  foreignKey: 'clientId',
  as: 'cases'
});
db.Case.belongsTo(db.Client, {
  foreignKey: 'clientId',
  as: 'client'
});

// Admin - Case relationship (1:Many)
db.Admin.hasMany(db.Case, {
  foreignKey: 'createdBy',
  as: 'cases'
});
db.Case.belongsTo(db.Admin, {
  foreignKey: 'createdBy',
  as: 'admin'
});

// Case - Hearing relationship (1:Many)
db.Case.hasMany(db.Hearing, {
  foreignKey: 'caseId',
  as: 'hearings'
});
db.Hearing.belongsTo(db.Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// Hearing - HearingComment relationship (1:Many)
db.Hearing.hasMany(db.HearingComment, {
  foreignKey: 'hearingId',
  as: 'comments'
});
db.HearingComment.belongsTo(db.Hearing, {
  foreignKey: 'hearingId',
  as: 'hearing'
});

// HearingComment - HearingCommentDoc relationship (1:Many)
db.HearingComment.hasMany(db.HearingCommentDoc, {
  foreignKey: 'hearingCommentId',
  as: 'documents'
});
db.HearingCommentDoc.belongsTo(db.HearingComment, {
  foreignKey: 'hearingCommentId',
  as: 'comment'
});

// Case - CaseComment relationship (1:Many)
db.Case.hasMany(db.CaseComment, {
  foreignKey: 'caseId',
  as: 'comments'
});
db.CaseComment.belongsTo(db.Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// CaseComment - CaseCommentDoc relationship (1:Many)
db.CaseComment.hasMany(db.CaseCommentDoc, {
  foreignKey: 'caseCommentId',
  as: 'documents'
});
db.CaseCommentDoc.belongsTo(db.CaseComment, {
  foreignKey: 'caseCommentId',
  as: 'comment'
});

// Case - UploadLink relationship (1:Many)
db.Case.hasMany(db.UploadLink, {
  foreignKey: 'caseId',
  as: 'uploadLinks'
});
db.UploadLink.belongsTo(db.Case, {
  foreignKey: 'caseId',
  as: 'case'
});

// Admin - UploadLink relationship (1:Many)
db.Admin.hasMany(db.UploadLink, {
  foreignKey: 'createdBy',
  as: 'uploadLinks'
});
db.UploadLink.belongsTo(db.Admin, {
  foreignKey: 'createdBy',
  as: 'admin'
});

module.exports = db;