const cron = require('node-cron');
const { Admin, Case, Hearing, Client } = require('../models');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/email');
const {generateHearingEmail} = require('../emailTemplates/dailyHearing');

const sendHearingReminders = async () => {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];

        // Fetch hearings with all necessary joins
        const hearings = await Hearing.findAll({
            where: {
                date: formattedDate
            },
            include: [
                {
                    model: Case,
                    as: 'case',
                    include: [
                        { model: Client, as: 'client' },
                        {
                            model: Admin,
                            as: 'advocate',
                            attributes: ['id', 'name', 'email']
                        }
                    ]
                }
            ],
            order: [['time', 'ASC']]
        });
        // Use a Map for grouping by advocateId
        const advocateMap = new Map();

        for (const hearing of hearings) {
            const advocate = hearing.case?.advocate;
            if (!advocate || !advocate.email) continue;

            if (!advocateMap.has(advocate.id)) {
                advocateMap.set(advocate.id, {
                    name: advocate.name,
                    email: advocate.email,
                    hearings: []
                });
            }

            advocateMap.get(advocate.id).hearings.push(hearing);
        }

        // Send grouped emails
        for (const [_, { name, email, hearings }] of advocateMap) {
            
            let emailContent = generateHearingEmail({
                name,
                email,
                tomorrow: formattedDate,
                hearings
            });
            await sendEmail(emailContent);
        }

        console.log(`Hearing reminder emails sent for ${tomorrow}`);
    } catch (err) {
        console.error('Error sending hearing reminders:', err);
    }
};

cron.schedule('0 17 * * *', sendHearingReminders, {
  timezone: 'Asia/Kolkata'
});
