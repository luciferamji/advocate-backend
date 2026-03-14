module.exports = (sequelize, DataTypes) => {
  const HandlingOffice = sequelize.define('handlingOffice', {
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
    tableName: 'handling_offices'
  });

  return HandlingOffice;
};
