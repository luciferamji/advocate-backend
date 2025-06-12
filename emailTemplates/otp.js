exports.generateDocumentUploadEmail = ({ email, caseNumber, title, description, uploadUrl, plainOtp, expiresIn, creatorEmail })=> {
  return {
    email,
    subject: '📤 Document Upload Request',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; background-color: #fafafa;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #333;">Document Upload Request</h2>

        <p style="font-size: 16px;">Dear Client,</p>
        <p style="font-size: 15px;">
          You are requested to upload documents related to the case <strong>${caseNumber}</strong>.
        </p>

        <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin-top: 10px; border: 1px solid #ccc;">
          <p><strong>📌 Title:</strong> ${title}</p>
          ${description ? `<p><strong>📝 Description:</strong> ${description}</p>` : ''}
          <p><strong>🔗 Upload Link:</strong> <a href="${uploadUrl}" style="color: #0066cc;">Click Here</a></p>
          <p><strong>🔐 OTP:</strong> <span style="font-weight: bold; font-size: 16px;">${plainOtp}</span></p>
          <p><strong>⏰ Expiry:</strong> This link will expire in ${expiresIn} hours.</p>
        </div>

        <p style="margin-top: 20px; font-size: 15px;">
          If you have any questions or require assistance, please contact your advocate.
        </p>

        <p style="margin-top: 30px;">Best regards,<br /><strong>Lawfy & Co</strong></p>
      </div>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: './assets/logo.png',
        cid: 'logo'
      }
    ],
    cc: creatorEmail ? [creatorEmail] : []
  };
}