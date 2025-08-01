module.exports = (sequelize, DataTypes) => {
  const Case = sequelize.define('case', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    caseNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    filingNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'client',
        key: 'id'
      }
    },
    advocateId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    },
    courtName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('OPEN', 'CANCEL/WITHDRAWN', 'CLOSED'),
      defaultValue: 'OPEN'
    }
  }, {
    timestamps: true,
    tableName: 'case'
  });

  return Case;
};