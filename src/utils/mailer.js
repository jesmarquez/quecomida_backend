const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(toEmail, code) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject: "Confirm your order",
    text: `Your verification code is: ${code}\n\nEnter this code to confirm your order.`,
    html: `<p>Your verification code is:</p><h2>${code}</h2><p>Enter this code to confirm your order.</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Preview verification email: ${previewUrl}`);
  }

  return info;
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendConfirmationEmail(toEmail, confirmUrl) {
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject: "Confirm your vendor account",
    text: `Click the link below to confirm your account and finish signing up:\n\n${confirmUrl}\n\nThis link expires in ${process.env.CONFIRMATION_TOKEN_EXPIRY_MINUTES || 30} minutes.`,
    html: `<p>Click the link below to confirm your account and finish signing up:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>This link expires in ${process.env.CONFIRMATION_TOKEN_EXPIRY_MINUTES || 30} minutes.</p>`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`Preview confirmation email: ${previewUrl}`);
  }

  return info;
}

module.exports = { sendVerificationEmail, generateVerificationCode, sendConfirmationEmail };