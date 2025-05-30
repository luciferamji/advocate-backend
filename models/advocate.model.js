module.exports = (sequelize, DataTypes) => {
  const Advocate = sequelize.define('advocate', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    barNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    specialization: {
      type: DataTypes.STRING,
      allowNull: true
    },
    yearsOfExperience: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    tableName: 'advocate'
  });
  
  return Advocate;
};