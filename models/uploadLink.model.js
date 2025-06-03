const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize, DataTypes) => {
  const UploadLink = sequelize.define('upload_link', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    caseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'case',
        key: 'id'
      }
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    pin: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    timestamps: true,
    tableName: 'upload_link',
    hooks: {
      beforeCreate: async (link) => {
        // Generate a 6-digit PIN
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        // Hash the PIN
        const salt = await bcrypt.genSalt(10);
        link.pin = await bcrypt.hash(pin, salt);
        // Store the plain PIN temporarily for email sending
        link.plainPin = pin;
      }
    }
  });

  return UploadLink;
};