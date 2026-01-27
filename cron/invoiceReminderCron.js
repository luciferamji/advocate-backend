const cron = require('node-cron');
const { Invoice, Client, Admin } = require('../models');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/email');
const fs = require('fs-extra');
const path = require('path');
const { generateInvoiceReminderEmail } = require('../emailTemplates/invoiceReminder');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendOverdueInvoiceReminders = async () => {
    try {
        const today = new Date();
        const sevenDaysAgo = new Date(
            today.getTime() - 7 * 24 * 60 * 60 * 1000
        );

        const limit = 50;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const invoices = await Invoice.findAll({
                where: {
                    status: 'UNPAID',
                    dueDate: { [Op.lt]: today },
                    [Op.or]: [
                        { lastReminderSentAt: null },
                        { lastReminderSentAt: { [Op.lte]: sevenDaysAgo } }
                    ]
                },
                include: [
                    {
                        model: Client,
                        as: 'client',
                        attributes: ['name', 'email']
                    },
                    {
                        model: Admin,
                        as: 'advocate',
                        attributes: ['name', 'email']
                    }
                ],
                limit,
                offset,
                order: [['dueDate', 'ASC']]
            });

            offset += limit;
            hasMore = invoices.length === limit;

            for (const invoice of invoices) {
                const client = invoice.client;
                const advocate = invoice.advocate;
                if (!client?.email || !advocate?.email) continue;

                const daysOverdue = Math.floor(
                    (today - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24)
                );
                const fileName = path.basename(invoice.filePath);
                const sourcePath = path.join(__dirname, '..', process.env.UPLOAD_DIR, fileName);
                const fileExists = await fs.pathExists(sourcePath);
                if (!fileExists) {
                    console.warn(`Invoice file not found: ${invoice.filePath}, skipping ${client.email}`);
                    continue;
                }

                const invoiceEmail = generateInvoiceReminderEmail({
                    clientName: client.name,
                    clientEmail: client.email,
                    advocateEmail: advocate.email,
                    invoiceId: invoice.invoiceId,
                    daysOverdue,
                    dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
                    invoiceAttachmentPath: sourcePath
                });

                try {
                    await sendEmail(invoiceEmail);
                    await invoice.update({
                        lastReminderSentAt: new Date(),
                        reminderCount: invoice.reminderCount + 1
                    });

                    console.log(
                        `Invoice ${invoice.invoiceId}: reminder #${invoice.reminderCount + 1} sent to ${client.email}`
                    );
                } catch (err) {
                    console.error(`Failed to send email to ${client.email}:`, err.message);
                }

                await sleep(1500);
            }
        }

        console.log(`[${new Date().toISOString()}] All overdue invoice emails processed.`);
    } catch (error) {
        console.error('Error during invoice email cron:', error);
    }
};

// Run daily at 12:30 AM IST
cron.schedule('30 0 * * *', sendOverdueInvoiceReminders, {
  timezone: 'Asia/Kolkata'
});