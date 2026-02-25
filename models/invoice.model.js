module.exports = (sequelize, DataTypes) => {
    const Invoice = sequelize.define('invoice', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
        },
        serialNumber: {
            type: DataTypes.BIGINT,
            allowNull: false,
            unique: true
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
        dueDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        comments: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        cancellationReason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'),
            allowNull: false,
            defaultValue: 'UNPAID'
        },
        paymentMode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        transactionId: {
            type: DataTypes.STRING,
            allowNull: true
        },
        filePath: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        paidAmount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        lastReminderSentAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reminderCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }

    }, {
        timestamps: true,
        tableName: 'invoice'
    });

    return Invoice;
};