import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: parseInt(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendVerificationCode(email, code) {
  const t = getTransporter();
  await t.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'AI画图站 - 验证码',
    html: `
      <div style="max-width:480px;margin:0 auto;padding:32px;background:#1a1a2e;color:#eee;border-radius:12px;font-family:Arial,sans-serif">
        <h2 style="color:#7c3aed;margin:0 0 8px">AI 画图站</h2>
        <p style="color:#aaa;margin:0 0 24px">您的登录验证码</p>
        <div style="background:#16213e;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#fff">${code}</span>
        </div>
        <p style="color:#888;font-size:13px;margin:0">验证码5分钟内有效。如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });
}
