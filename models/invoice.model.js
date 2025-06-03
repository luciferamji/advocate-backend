const { all } = require("../routes/client.routes");

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
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'client',
            key: 'clientId'
        }
    },
    advocateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'admin',
            key: 'id'
        }
    },
    amountInWords: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: ''
    },
    details: {
        type: DataTypes.JSON,
        allowNull: false
        // Example: [{ description: "Service A", amount: 100 }, { description: "Service B", amount: 200 }]
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    dueDate: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'invoice'
});
  
  return Invoice;
};