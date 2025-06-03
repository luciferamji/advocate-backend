// Add to existing associations
db.DocumentLink = require('./documentLink.model')(sequelize, Sequelize);

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