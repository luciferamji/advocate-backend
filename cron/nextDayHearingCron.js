const cron = require('node-cron');
const { Admin, Case, Hearing, Client } = require('../models');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/email');

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

        console.log(`Found ${hearings.length} hearings for tomorrow (${formattedDate})`);
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
            await sendEmail({
                email,
                subject: `📅 Hearings for Tomorrow (${tomorrow})`,
                html: `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd;">
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
      </div>
      <h2 style="text-align: center; color: #333;">Hearing Schedule for ${tomorrow}</h2>
      <p>Dear ${name},</p>
      <p>Below are your scheduled hearings for tomorrow:</p>

      ${hearings.map(h => `
        <div style="border-top: 1px solid #eee; padding: 10px 0;">
          <strong>📌 Case:</strong> ${h.case.title} (${h.case.caseNumber})<br />
          <strong>👤 Client:</strong> ${h.case.client.name}<br />
          <strong>🕒 Time:</strong> ${h.time}<br />
          <strong>🏛 Court:</strong> ${h.courtName}<br />
          <strong>📄 Purpose:</strong> ${h.purpose || 'N/A'}<br />
          <strong>⚖️ Judge:</strong> ${h.judge || 'N/A'}<br />
        </div>
      `).join('')}

      <p style="margin-top: 20px;">Best regards,<br /><strong>Lawfy & Co</strong></p>
    </div>
  `, attachments: [{
                    filename: 'logo.png',
                    path: './assets/logo.png', 
                    cid: 'logo' 
                }]
            });
        }

        console.log(`Hearing reminder emails sent for ${tomorrow}`);
    } catch (err) {
        console.error('Error sending hearing reminders:', err);
    }
};

// Run every day at 4:00 PM IST (10:30 AM UTC)
cron.schedule('0 10 * * *', sendHearingReminders, {
    timezone: 'Asia/Kolkata'
});
