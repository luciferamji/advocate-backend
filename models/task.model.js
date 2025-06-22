module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define('task', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'admin',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    start: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in-progress', 'done'),
      defaultValue: 'pending',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
  }, {
    timestamps: true,
    tableName: 'task',
  });


  return Task;
};
