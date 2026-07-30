import nodemailer from 'nodemailer';

/* ─────────────────────────────────────────────────────────────────────────────
   OUTBOUND EMAIL

   Delivery goes over Resend's HTTPS API rather than SMTP. Most cloud hosts
   (DigitalOcean included) block outbound ports 25/465/587 on new accounts, so
   an SMTP transport cannot connect at all from the production droplet — it
   fails as a slow timeout or an immediate ENETUNREACH once DNS returns an IPv6
   address the host has no route for. Port 443 is always open, so an HTTP API is
   the only delivery path that reliably works there.

   SMTP is kept as a fallback for local development, where it works fine and
   avoids needing a real API key to test a signup flow.
   ───────────────────────────────────────────────────────────────────────── */

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Must be an address on a domain verified in Resend, or delivery is rejected.
const EMAIL_FROM = process.env.EMAIL_FROM || 'Prompto <onboarding@resend.dev>';

// Legacy SMTP sender, only used by the nodemailer fallback below.
const EMAIL_USER = process.env.EMAIL_USER || 'asuskeshavkashyap@gmail.com';

/* Callers await delivery before answering the user, so a hung provider would
   hold the request open until the browser gives up. Cap it well below any
   sensible client timeout and treat a slow provider as a failed send. */
const SEND_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10000;

/* The same timeout budget as the API path. Without these, a host that silently
   drops SMTP traffic leaves the socket opening until the OS gives up (~60s),
   which is long enough for the caller's request to be aborted by the gateway. */
const smtpTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: SEND_TIMEOUT_MS,
  greetingTimeout: SEND_TIMEOUT_MS,
  socketTimeout: SEND_TIMEOUT_MS,
});

/* Shared chrome for every message. Templates supply only their own body, so the
   header, footer and card styling stay identical across mails by construction
   rather than by three copies being kept in sync by hand. */
const layout = (bodyHtml) => `
  <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #6366f1; text-align: center;">Prompto</h2>
    ${bodyHtml}
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 10px; color: #94a3b8; text-align: center;">&copy; 2026 Prompto Intelligence Systems. All rights reserved.</p>
  </div>
`;

/* The one-time code, rendered the same way in signup and recovery mails. */
const codeBlock = (code) => `
  <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
    <span style="font-size: 32px; font-weight: 900; letter-spacing: 5px; color: #1e293b;">${code}</span>
  </div>
`;

/* Single delivery point for every template. Returns a boolean instead of
   throwing: a failed notification must never take down the request that
   triggered it, and each caller already decides what a failure means for it. */
async function deliver({ to, subject, html, label }) {
  try {
    if (RESEND_API_KEY) {
      // AbortSignal.timeout rejects the fetch outright, so a stalled provider
      // surfaces as a failed send rather than an open socket.
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });

      if (!res.ok) {
        // Resend reports template/domain/key problems in the body; surface it
        // (it never contains the API key) so misconfiguration is diagnosable.
        const detail = await res.text().catch(() => '');
        console.error(`❌ ${label} failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
        return false;
      }

      const { id } = await res.json().catch(() => ({}));
      console.log(`✅ ${label} sent: ${id || 'ok'}`);
      return true;
    }

    // Local-development path. Unreachable in production, where SMTP is blocked.
    const info = await smtpTransporter.sendMail({ from: EMAIL_FROM, to, subject, html });
    console.log(`✅ ${label} sent via SMTP: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ ${label} failed: ${err.message}`);
    return false;
  }
}

/* Password-recovery code. Expiry stated in the copy must match
   RESET_TOKEN_TTL in the controller. */
export const sendRecoveryEmail = (to, otp) =>
  deliver({
    to,
    subject: '🔒 Your Account Recovery Code',
    label: 'Recovery email',
    html: layout(`
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the code below to proceed with your recovery. This code is valid for <strong>10 minutes</strong>.</p>
      ${codeBlock(otp)}
      <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
    `),
  });

/* Sent when someone tries to REGISTER with an email that already has a verified
   account. The registration endpoint returns a generic response either way (so
   it can't be used to enumerate accounts) — this email is how the real owner is
   told what actually happened. */
export const sendAccountExistsEmail = (to) =>
  deliver({
    to,
    subject: '🔐 You already have a Prompto account',
    label: 'Account-exists email',
    html: layout(`
      <p>Someone just tried to create a Prompto account with this email address — but you already have one.</p>
      <p>If this was you, simply <strong>log in</strong> instead. Forgot your password? Use the <strong>"Forgot?"</strong> link on the login screen to reset it.</p>
      <p style="color: #64748b; font-size: 12px;">If this wasn't you, you can safely ignore this email — no account was created or changed.</p>
    `),
  });

/* Signup verification code. Until this is entered the account exists only as a
   PendingUser, so a failed send here blocks registration entirely. */
export const sendVerificationEmail = (to, code) =>
  deliver({
    to,
    subject: '✨ Confirm your Prompto account',
    label: 'Verification email',
    html: layout(`
      <p>Thanks for signing up! Enter the code below to verify your email and activate your account. This code is valid for <strong>24 hours</strong>.</p>
      ${codeBlock(code)}
      <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't create a Prompto account, you can safely ignore this email.</p>
    `),
  });
