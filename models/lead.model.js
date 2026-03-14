module.exports = (sequelize, DataTypes) => {
  const Lead = sequelize.define('lead', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    leadId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmailOrEmpty(value) {
          if (value && value.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error('Invalid email format');
          }
        }
      }
    },
    reasonForCalling: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    disposition: {
      type: DataTypes.ENUM('New', 'Call Back', 'Not Interested', 'Onboarded', 'Others'),
      allowNull: false,
      defaultValue: 'New'
    },
    followUpDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    handlingOfficeId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    leadSourceId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false
    }
  }, {
    timestamps: true,
    tableName: 'leads'
  });

  return Lead;
};
