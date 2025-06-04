module.exports = (sequelize, DataTypes) => {
  const CaseComment = sequelize.define('case_comment', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    caseId: {
      type: DataTypes.UUID,
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
    creatorType: {
      type: DataTypes.ENUM('super-admin', 'advocate', 'client'),
      allowNull: false
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'admin',
        key: 'id'
      }
    },
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