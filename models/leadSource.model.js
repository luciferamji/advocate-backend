module.exports = (sequelize, DataTypes) => {
  const LeadSource = sequelize.define('leadSource', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    }
  }, {
    timestamps: true,
    tableName: 'lead_sources'
  });

  return LeadSource;
};
