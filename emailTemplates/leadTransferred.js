const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Sent to the advocate who receives a lead via transfer (or website routing)
exports.leadTransferred = ({ to, lead, fromName, actorName, reason, appUrl }) => ({
  email: to.email,
  subject: `Lead ${lead.leadId} assigned to you`,
  html: `
<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #ddd; background-color: #f9f9f9;">
  <p style="font-size: 15px; color: #333;">Dear <strong>${escapeHtml(to.name)}</strong>,</p>
  <p style="font-size: 15px; color: #444;">Lead <strong>${escapeHtml(lead.leadId)}</strong> (${escapeHtml(lead.fullName)}) has been assigned to you${fromName ? ` (previously with ${escapeHtml(fromName)})` : ''}.</p>
  <div style="background: #fff; padding: 15px; border: 1px solid #ccc; margin: 15px 0;">
    ${actorName ? `<p style="margin: 5px 0;"><strong>Transferred by:</strong> ${escapeHtml(actorName)}</p>` : ''}
    ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
  </div>
  ${appUrl ? `<p style="font-size: 14px;"><a href="${escapeHtml(appUrl)}/leads">Open leads</a></p>` : ''}
  <p style="font-size: 13px; color: #888;">Lawfy &amp; Co</p>
</div>`
});
