module.exports = (sequelize, DataTypes) => {
  const Case = sequelize.define('case', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    caseId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'client',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    },
    courtDetails: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'closed', 'pending'),
      defaultValue: 'active'
    }
  }, {
    timestamps: true,
    tableName: 'case'
  });
  
  return Case;
};