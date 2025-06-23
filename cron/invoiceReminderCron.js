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
        const limit = 50;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const invoices = await Invoice.findAll({
                where: {
                    status: 'UNPAID',
                    dueDate: {
                        [Op.lt]: today
                    }
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
                offset
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
                    advocateName: advocate.name,
                    advocateEmail: advocate.email,
                    invoiceId: invoice.invoiceId,
                    daysOverdue,
                    dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
                    invoiceAttachmentPath: sourcePath
                });

                try {
                    await sendEmail(invoiceEmail);
                    console.log(`Sent invoice email to ${client.email}`);
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
// Run daily at 11:15 PM IST = 17:45 UTC
cron.schedule('30 0 * * *', sendOverdueInvoiceReminders, {
  timezone: 'Asia/Kolkata'
});