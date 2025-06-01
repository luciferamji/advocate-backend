module.exports = (sequelize, DataTypes) => {
  const CaseComment = sequelize.define('case_comment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    caseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'case',
        key: 'id'
      }
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true, // Changed to allow null for client comments
      references: {
        model: 'admin',
        key: 'id'
      }
    },
    // New fields for client comments
    clientName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    clientEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    clientPhone: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'case_comment'
  });
  
  return CaseComment;
};