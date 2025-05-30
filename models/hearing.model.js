module.exports = (sequelize, DataTypes) => {
  const Hearing = sequelize.define('hearing', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    hearingDate: {
      type: DataTypes.DATE,
      allowNull: false
    },
    caseId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'case',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'postponed', 'cancelled'),
      defaultValue: 'scheduled'
    }
  }, {
    timestamps: true,
    tableName: 'hearing'
  });
  
  return Hearing;
};