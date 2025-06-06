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
db.DocumentLink = require('./documentLink.model')(sequelize, Sequelize);
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
  foreignKey: 'advocateId',
  as: 'cases'
});
db.Case.belongsTo(db.Admin, {
  foreignKey: 'advocateId',
  as: 'advocate'
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

// Admin - HearingComment relationship (1:Many)
db.Admin.hasMany(db.HearingComment, {
  foreignKey: 'adminId',
  as: 'hearingComments'
});
db.HearingComment.belongsTo(db.Admin, {
  foreignKey: 'adminId',
  as: 'user'
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

// Admin - CaseComment relationship (1:Many)
db.Admin.hasMany(db.CaseComment, {
  foreignKey: 'adminId',
  as: 'caseComments'
});
db.CaseComment.belongsTo(db.Admin, {
  foreignKey: 'adminId',
  as: 'user'
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

// Add these associations
db.Case.hasMany(db.DocumentLink, {
  foreignKey: 'caseId',
  as: 'documentLinks'
});
db.DocumentLink.belongsTo(db.Case, {
  foreignKey: 'caseId',
  as: 'case'
});

db.Hearing.hasMany(db.DocumentLink, {
  foreignKey: 'hearingId',
  as: 'documentLinks'
});
db.DocumentLink.belongsTo(db.Hearing, {
  foreignKey: 'hearingId',
  as: 'hearing'
});

db.Admin.hasMany(db.DocumentLink, {
  foreignKey: 'createdBy',
  as: 'documentLinks'
});
db.DocumentLink.belongsTo(db.Admin, {
  foreignKey: 'createdBy',
  as: 'creator'
});

db.CaseComment.belongsTo(db.Client, {
  foreignKey: 'clientId',
  as: 'client'
});

db.HearingComment.belongsTo(db.Client, {
  foreignKey: 'clientId',
  as: 'client'
});

db.DocumentLink.belongsTo(db.Client, {
  foreignKey: 'clientId',
  as: 'client'
});

db.Client.hasMany(db.DocumentLink, {
  foreignKey: 'clientId',
  as: 'documentLinks'
});

module.exports = db;