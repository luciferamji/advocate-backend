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
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    tableName: 'case_comment'
  });
  
  return CaseComment;
};