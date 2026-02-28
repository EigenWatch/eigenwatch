const LOGO_URL = 'https://eigenwatch.xyz/assets/png/eigenwatch.png';

// Shared layout wrapper matching EigenWatch dark theme
function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EigenWatch</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #09090B; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width: 560px; width: 100%;">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 0 0 32px 0;">
              <img src="${LOGO_URL}" alt="EigenWatch" width="147" height="43" style="display: block; border: 0;" />
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td style="background-color: #18181B; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 40px 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 0 0 0;">
              <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.5;">
                This email was sent by EigenWatch. If you didn't request this, you can safely ignore it.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #6B7280;">
                <a href="https://eigenwatch.xyz" style="color: #3B82F6; text-decoration: none;">eigenwatch.xyz</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function verificationCodeEmail(
  code: string,
  expiresInMinutes: number = 10,
): EmailTemplate {
  const html = layout(`
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #FFFFFF;">
      Verify your email
    </h1>
    <p style="margin: 0 0 28px 0; font-size: 14px; color: #9F9FA9; line-height: 1.6;">
      Enter this code in the EigenWatch dashboard to verify your email address.
    </p>
    <!-- Code Display -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 20px 0;">
          <div style="display: inline-block; background-color: #09090B; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px 40px; letter-spacing: 8px; font-size: 32px; font-weight: 600; color: #FFFFFF; font-family: 'Courier New', Courier, monospace;">
            ${code}
          </div>
        </td>
      </tr>
    </table>
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #6B7280; line-height: 1.5;">
      This code expires in <strong style="color: #9F9FA9;">${expiresInMinutes} minutes</strong>. Do not share it with anyone.
    </p>
  `);

  const text = `EigenWatch - Verify your email

Your verification code is: ${code}

This code expires in ${expiresInMinutes} minutes. Do not share it with anyone.

If you didn't request this, you can safely ignore this email.`;

  return {
    subject: `${code} is your EigenWatch verification code`,
    html,
    text,
  };
}
