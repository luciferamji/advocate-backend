const nodemailer = require('nodemailer');

const emailTemplates = {
  advocateWelcome: (name, email, password) => ({
    subject: 'Welcome to Advocate Management System',
    html: `
      <h2>Welcome to Advocate Management System</h2>
      <p>Dear ${name},</p>
      <p>Your account has been created in the Advocate Management System. Here are your login credentials:</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Temporary Password:</strong> ${password}</p>
      <p>For security reasons, please change your password after your first login.</p>
      <p>If you have any questions or need assistance, please contact the system administrator.</p>
      <p>Best regards,<br>Admin Team</p>
    `
  })
};

const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Message options
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html
  };

  // Send email
  await transporter.sendMail(message);
};

module.exports = {
  sendEmail,
  emailTemplates
};