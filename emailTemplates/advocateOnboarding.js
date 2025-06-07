
exports.advocateWelcome = (name, email, password) => {
    return ({
        email,
        subject: 'Welcome to Lawfy',
        html: `
<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; background-color: #f9f9f9;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
  </div>

  <h2 style="color: #333; text-align: center;">Welcome to <span style="color: #000;">Lawfy & Co</span></h2>

  <p style="font-size: 16px; color: #444;">Dear <strong>${name}</strong>,</p>

  <p style="font-size: 15px; color: #444;">Your account has been successfully created in <strong>Lawfy</strong>. Below are your login credentials:</p>

  <div style="background: #fff; padding: 15px; border: 1px solid #ccc; margin: 15px 0;">
    <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
  </div>

  <p style="font-size: 15px; color: #444;">🔒 For security reasons, please change your password after your first login.</p>

  <p style="font-size: 15px; color: #444;">If you have any questions or need assistance, feel free to contact the system administrator.</p>

  <p style="margin-top: 30px; font-size: 15px; color: #444;">Best regards,<br><strong>Admin Team</strong><br>Lawfy & Co</p>
</div>
    `,
        attachments: [
            {
                filename: 'logo.png',
                path: './assets/logo.png', // Adjust path as per your setup
                cid: 'logo' // same as in the <img src="cid:logo" />
            }
        ]
    });
}