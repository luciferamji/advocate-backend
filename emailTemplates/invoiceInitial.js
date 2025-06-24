exports.generateInitialInvoiceEmail = ({
  clientName,
  clientEmail,
  advocateEmail,
  invoiceId,
  dueDate,
  invoiceAttachmentPath
}) => {
  return {
    email: clientEmail,
    cc: [advocateEmail],
    subject: `🧾 New Invoice - ${invoiceId} (Due by ${dueDate})`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #2e7d32;">Your Invoice from Lawfy & Co</h2>

        <p>Dear ${clientName},</p>

        <p>Please find attached your invoice <strong>${invoiceId}</strong> issued by Lawfy & Co.</p>

        <p>The payment is due by <strong>${dueDate}</strong>. We request you to review the attached document and make the payment at your earliest convenience.</p>

        <p>If you have any questions or need clarification, feel free to reach out to us.</p>

        <p style="margin-top: 20px;">Thank you for your trust in our services.</p>

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
