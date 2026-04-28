import nodemailer from 'nodemailer';

export const sendRecoveryEmail = async (to, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'asuskeshavkashyap@gmail.com',
        pass: process.env.EMAIL_PASS, // User must provide App Password in .env
      },
    });

    const mailOptions = {
      from: `"Prompto Security" <asuskeshavkashyap@gmail.com>`,
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
    console.log(`✅ Email sent: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    return false;
  }
};
