module.exports = (sequelize, DataTypes) => {
  const PhoneNumber = sequelize.define('phoneNumber', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    office: {
      type: DataTypes.STRING,
      allowNull: false
    },
    place: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^[0-9]{10}$/
      }
    },
    alohaaNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^[0-9]{10}$/
      }
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
    tableName: 'phoneNumber'
  });
  
  return PhoneNumber;
};
