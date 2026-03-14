module.exports = (sequelize, DataTypes) => {
  const LeadActivityLog = sequelize.define('leadActivityLog', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    field: {
      type: DataTypes.STRING,
      allowNull: true
    },
    oldValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    changedBy: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    updatedAt: false,
    tableName: 'lead_activity_logs'
  });

  return LeadActivityLog;
};
