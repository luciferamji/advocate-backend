const nodemailer = require('nodemailer');

// Emails to exclude from CC
const EXCLUDED_CC_EMAILS = ['ask@lawfyco.in'];

const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    // service: process.env.SMTP_SERVICE, // e.g., 'gmail', 'yahoo', etc.
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  // Filter out excluded emails from CC
  const ccList = (options.cc || []).filter(
    email => !EXCLUDED_CC_EMAILS.includes(email?.toLowerCase())
  );

  // Message options
  const message = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments || [],
    cc: ccList
  };

  // Send email
  await transporter.sendMail(message);
};

module.exports = {
  sendEmail
};