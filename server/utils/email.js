import nodemailer from 'nodemailer';

// Sender Gmail account — configurable via env, with a fallback for existing setups.
const EMAIL_USER = process.env.EMAIL_USER || 'asuskeshavkashyap@gmail.com';

// One shared transporter for all outgoing mail.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password from .env
  },
});

export const sendRecoveryEmail = async (to, otp) => {
  try {
    const mailOptions = {
      from: `"Prompto Security" <${EMAIL_USER}>`,
      to,
      subject: '🔒 Your Account Recovery Code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1; text-align: center;">Prompto v2.0</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Use the code below to proceed with your recovery. This code is valid for <strong>10 minutes</strong>.</p>
          
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #1e293b;">${otp}</span>
          </div>
          
          <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 10px; color: #94a3b8; text-align: center;">&copy; 2026 Prompto Intelligence Systems. All rights reserved.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Recovery email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Recovery email failed:', err.message);
    return false;
  }
};

/* Sent when someone tries to REGISTER with an email that already has a verified
   account. The registration endpoint returns a generic response either way (so
   it can't be used to enumerate accounts) — this email is how the real owner is
   told what actually happened. */
export const sendAccountExistsEmail = async (to) => {
  try {
    const mailOptions = {
      from: `"Prompto" <${EMAIL_USER}>`,
      to,
      subject: '🔐 You already have a Prompto account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1; text-align: center;">Prompto</h2>
          <p>Someone just tried to create a Prompto account with this email address — but you already have one.</p>
          <p>If this was you, simply <strong>log in</strong> instead. Forgot your password? Use the <strong>"Forgot?"</strong> link on the login screen to reset it.</p>
          <p style="color: #64748b; font-size: 12px;">If this wasn't you, you can safely ignore this email — no account was created or changed.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 10px; color: #94a3b8; text-align: center;">&copy; 2026 Prompto. All rights reserved.</p>
        </div>
      `,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Account-exists email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Account-exists email failed:', err.message);
    return false;
  }
};

/* Sends the signup verification code that confirms a new user owns their email
   address before their account is activated. */
export const sendVerificationEmail = async (to, code) => {
  try {
    const mailOptions = {
      from: `"Prompto" <${EMAIL_USER}>`,
      to,
      subject: '✨ Confirm your Prompto account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6366f1; text-align: center;">Welcome to Prompto v2.0</h2>
          <p>Thanks for signing up! Enter the code below to verify your email and activate your account. This code is valid for <strong>24 hours</strong>.</p>

          <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #1e293b;">${code}</span>
          </div>

          <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't create a Prompto account, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 10px; color: #94a3b8; text-align: center;">&copy; 2026 Prompto Intelligence Systems. All rights reserved.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Verification email failed:', err.message);
    return false;
  }
};
