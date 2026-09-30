// Append-only: rows are never updated or deleted by the app (a DB trigger also
// blocks it, except purging rows older than the 3-year retention period).
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
    },
    // Why (required for transfers)
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // super-admin | advocate | system
    actorRole: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    timestamps: true,
    updatedAt: false,
    tableName: 'lead_activity_logs'
  });

  return LeadActivityLog;
};
