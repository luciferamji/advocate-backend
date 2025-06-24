exports.generateHearingEmail = ({ name, email, tomorrow, hearings }) => {
  return {
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

        <p style="margin-top: 20px;">Best regards,<br /><strong>LAWFY & CO</strong></p>
      </div>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: './assets/logo.png', 
        cid: 'logo' 
      }
    ]
  };
}
