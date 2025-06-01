module.exports = (sequelize, DataTypes) => {
  const Hearing = sequelize.define('hearing', {
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    time: {
      type: DataTypes.TIME,
      allowNull: false
    },
    courtName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: true
    },
    judge: {
      type: DataTypes.STRING,
      allowNull: true
    },
    room: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
      defaultValue: 'scheduled'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    tableName: 'hearing'
  });
  
  return Hearing;
};