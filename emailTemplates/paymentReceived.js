exports.generatePaymentReceivedEmail = ({
  clientName,
  clientEmail,
  advocateEmail,
  invoiceId,
  paymentAmount,
  totalAmount,
  paidAmount,
  remainingAmount,
  paymentMode,
  transactionId,
  status
}) => {
  const statusColorMap = {
    PAID: '#2e7d32',           // Green
    PARTIALLY_PAID: '#1976d2', // Blue
    UNPAID: '#ed6c02'          // Orange
  };

  const statusLabelMap = {
    PAID: 'Fully Paid',
    PARTIALLY_PAID: 'Partially Paid',
    UNPAID: 'Unpaid'
  };

  const statusColor = statusColorMap[status] || '#6c757d';
  const statusLabel = statusLabelMap[status] || status;

  return {
    email: clientEmail,
    cc: [advocateEmail],
    subject: `Payment Received - Invoice ${invoiceId}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; background-color: #fdfdfd;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="cid:logo" alt="Lawfy & Co" style="max-width: 150px;" />
        </div>

        <h2 style="text-align: center; color: #2e7d32;">✓ Payment Received</h2>

        <p style="font-size: 16px;">Dear <strong>${clientName}</strong>,</p>

        <p style="font-size: 15px;">
          We have successfully received your payment for invoice <strong>${invoiceId}</strong>.
        </p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0;"><strong>Payment Amount:</strong></td>
              <td style="text-align: right; color: #2e7d32; font-weight: bold;">₹${parseFloat(paymentAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Payment Mode:</strong></td>
              <td style="text-align: right; text-transform: uppercase;">${paymentMode}</td>
            </tr>
            ${transactionId ? `
            <tr>
              <td style="padding: 8px 0;"><strong>Transaction ID:</strong></td>
              <td style="text-align: right;">${transactionId}</td>
            </tr>
            ` : ''}
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 12px 0 8px 0;"><strong>Invoice Total:</strong></td>
              <td style="text-align: right;">₹${parseFloat(totalAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Total Paid:</strong></td>
              <td style="text-align: right; color: #2e7d32; font-weight: bold;">₹${parseFloat(paidAmount).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0;"><strong>Remaining:</strong></td>
              <td style="text-align: right; color: ${remainingAmount > 0 ? '#d32f2f' : '#2e7d32'}; font-weight: bold;">₹${parseFloat(remainingAmount).toFixed(2)}</td>
            </tr>
          </table>
        </div>

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
            ${statusLabel}
          </span>
        </div>

        ${status === 'PAID' ? `
        <div style="background-color: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid #2e7d32; margin: 20px 0;">
          <p style="margin: 0; color: #2e7d32; font-weight: bold;">🎉 Invoice Fully Paid!</p>
          <p style="margin: 8px 0 0 0; font-size: 14px;">Thank you for completing the payment.</p>
        </div>
        ` : ''}

        <p style="font-size: 15px; margin-top: 20px;">
          Thank you for your payment. If you have any questions, please don't hesitate to contact us.
        </p>

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
