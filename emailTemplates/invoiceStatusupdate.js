exports.generateInvoiceStatusUpdateEmail = ({
  clientName,
  clientEmail,
  advocateEmail,
  invoiceId,
  status
}) => {
  const statusColorMap = {
    PAID: '#2e7d32',       // Green
    CANCELLED: '#c62828',  // Red
    UNPAID: '#6c757d'      // Gray (fallback or not expected here)
  };

  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const statusColor = statusColorMap[status] || '#6c757d';

  return {
    email: clientEmail,
    cc: [advocateEmail],
    subject: `🧾 Invoice Status Update - ${invoiceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; background-color: #fdfdfd;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #3028c6e4;">Invoice Status Update</h2>

        <p style="font-size: 16px;">Dear <strong>${clientName}</strong>,</p>

        <p style="font-size: 15px;">
          This is to inform you that your invoice <strong>${invoiceId}</strong> has been updated with the following status:
        </p>

        <div style="text-align: center; margin: 20px 0;">
          <span style="
            display: inline-block;
            background-color: ${statusColor};
            color: white;
            padding: 10px 18px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
          ">
            ${formattedStatus}
          </span>
        </div>

        <p style="font-size: 15px;">If you have any questions or concerns, feel free to get in touch with us.</p>

        <p style="margin-top: 30px; font-size: 15px;">
          Best regards,<br />
          <strong>Finance Team</strong><br />
          LAWFY & CO
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
