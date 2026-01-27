exports.generateInvoiceReminderEmail = ({
  clientName,
  clientEmail,
  _advocateEmail,
  invoiceId,
  daysOverdue,
  dueDate,
  invoiceAttachmentPath
}) => {
  return {
    email: clientEmail,
    cc: [],
    subject: `🧾 Invoice Overdue Reminder - ${invoiceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #c62828;">Invoice Overdue Notice</h2>

        <p>Dear ${clientName},</p>

        <p>This is a reminder that your invoice <strong>${invoiceId}</strong> is currently <strong>${daysOverdue} day(s)</strong> overdue.</p>

        <p>It was due on <strong>${dueDate}</strong>. Please make the payment as soon as possible to avoid any service interruptions.</p>

        <p>If you have already made the payment, kindly ignore this message.</p>

        <p style="margin-top: 20px;">Best regards,<br /><strong>Finance Team</strong><br />LAWFY & CO</p>
      </div>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: './assets/logo.png',
        cid: 'logo'
      },
      {
        filename: `${invoiceId}.pdf`,
        path: invoiceAttachmentPath
      }
    ]
  };
};
