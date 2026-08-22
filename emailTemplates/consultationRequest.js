exports.generateConsultationRequestEmail = ({
  fullName,
  phone,
  email,
  areaOfLaw,
  preferredDate,
  preferredTime,
  legalMatter,
  leadId
}) => {
  return {
    email: 'Abhijeet.chakraborty01@gmail.com',
    subject: `🆕 New Consultation Request - ${fullName} | ${areaOfLaw} (${leadId})`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; background-color: #fdfdfd;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #1565c0;">New Consultation Request</h2>

        <p style="font-size: 15px;">A new consultation request has been received from <strong>www.lawfyco.com</strong>:</p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 150px;">Lead ID:</td>
              <td>${leadId}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Name:</td>
              <td>${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
              <td>${phone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Email:</td>
              <td>${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Area of Law:</td>
              <td><strong>${areaOfLaw}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Preferred Date:</td>
              <td>${preferredDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold;">Preferred Time:</td>
              <td>${preferredTime}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e3f2fd; padding: 16px; border-radius: 8px; border-left: 4px solid #1565c0; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #1565c0;">Legal Matter:</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.5;">${legalMatter}</p>
        </div>

        <p style="font-size: 14px; color: #666; margin-top: 20px;">
          Please follow up with the client at your earliest convenience.
        </p>

        <p style="margin-top: 30px; font-size: 15px;">
          Best regards,<br />
          <strong>Lawfy & Co System</strong>
        </p>
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
};
