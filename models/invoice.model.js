module.exports = (sequelize, DataTypes) => {
const Invoice = sequelize.define('invoice', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    invoiceId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    clientId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'client',
            key: 'id'
        }
    },
    advocateId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'admin',
            key: 'id'
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    comments: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('UNPAID', 'PAID', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'UNPAID'
    },
}, {
    timestamps: true,
    tableName: 'invoice'
});
  
  return Invoice;
};