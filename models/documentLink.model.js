const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const DocumentLink = sequelize.define('document_link', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    caseId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'case',
        key: 'id'
      }
    },
    hearingId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'hearing',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'used'),
      defaultValue: 'active'
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    tableName: 'document_link',
    hooks: {
      beforeValidate: async (link) => {
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        link.otp = await bcrypt.hash(otp, salt);
        // Store plain OTP temporarily for email
        link.plainOtp = otp;
      }
    }
  });

  return DocumentLink;
};