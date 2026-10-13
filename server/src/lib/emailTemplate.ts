const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type EmailContent = {
  name: string
  heading: string
  intro: string
  buttonLabel?: string
  link?: string
  note: string
}

// Table layout with inline styles for broad email-client support.
export function renderEmail({ name, heading, intro, buttonLabel, link, note }: EmailContent) {
  const safeLink = link ? escapeHtml(link) : ''
  const action = link && buttonLabel ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#1B449C;border-radius:6px;">
            <a href="${safeLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(buttonLabel)}</a>
          </td></tr></table>` : ''
  const fallback = link ? `<p style="margin:16px 0 0;font-size:11px;line-height:17px;color:#8C94A2;word-break:break-all;">Button not working? Copy this link into your browser:<br><a href="${safeLink}" style="color:#1B449C;">${safeLink}</a></p>` : ''
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F5F7FC;font-family:Segoe UI,Arial,sans-serif;color:#202638;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FC;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #E3E7EF;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1B449C;padding:22px 32px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">AFRICAN OIL <span style="font-weight:400;opacity:0.8;">Ethiopia</span></td></tr>
        <tr><td style="background:#E38505;height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#202638;">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 8px;font-size:14px;line-height:22px;">Hello ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#354055;">${escapeHtml(intro)}</p>
          ${action}
          <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#7C8493;">${escapeHtml(note)}</p>
          ${fallback}
        </td></tr>
        <tr><td style="background:#F9FAFD;border-top:1px solid #E9EDF4;padding:16px 32px;font-size:11px;color:#8C94A2;">
          If you did not expect this email, you can safely ignore it. <span style="color:#B82A1D;">Never share this link.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
