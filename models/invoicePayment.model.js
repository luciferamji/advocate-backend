module.exports = (sequelize, DataTypes) => {
    const InvoicePayment = sequelize.define('invoice_payment', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        invoiceId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'invoice',
                key: 'id'
            },
            onDelete: 'CASCADE'
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        paymentMode: {
            type: DataTypes.ENUM('cash', 'upi', 'bank', 'cheque', 'others'),
            allowNull: false
        },
        transactionId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        paymentDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        comments: {
            type: DataTypes.TEXT,
            allowNull: true
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
        tableName: 'invoice_payment'
    });

    return InvoicePayment;
};
