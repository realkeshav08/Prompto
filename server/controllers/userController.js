import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PendingUser from '../models/PendingUser.js';
import Chat from '../models/Chat.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendRecoveryEmail, sendVerificationEmail, sendAccountExistsEmail } from '../utils/email.js';

/* ---------------- JWT ---------------- */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined');
}

// The token embeds the user's current tokenVersion so it can be revoked later
// (see protect). A brand-new account is version 0.
const generateToken = (user) =>
  jwt.sign({ id: user._id, tokenVersion: user.tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: '30d' });

/* ---------------- AUTH COOKIE ----------------
   The JWT is delivered as an httpOnly cookie so browser JavaScript can never
   read it — this closes the XSS token-theft risk of localStorage.
   Frontend (prompto.keshavkashyap.me) and API (prompto-api.keshavkashyap.me)
   share the registrable domain keshavkashyap.me, so SameSite=Lax is treated as
   a first-party cookie and is sent on cross-subdomain requests — working on
   desktop, mobile browsers, and iOS Safari/PWA (which block only third-party
   cookies). Secure is enabled only in production (dev runs on http://localhost). */
const isProd = process.env.NODE_ENV === 'production';

const AUTH_COOKIE = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days — matches the JWT expiry
  path: '/',
};

const sendAuthCookie = (res, token) => res.cookie(AUTH_COOKIE, token, COOKIE_OPTIONS);
// clearCookie must match the original attributes (minus maxAge) to delete it.
const clearAuthCookie = (res) =>
  res.clearCookie(AUTH_COOKIE, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' });

// Recovery codes are stored only as a hash. Hash the candidate the same way to
// compare on verify/reset, so the plaintext code lives only in the user's inbox.
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// How many wrong code entries before the current recovery code is burned.
const MAX_OTP_ATTEMPTS = 5;

// Shown whenever a one-time code could not be delivered. Every flow that depends
// on a code returns this same message so a mail outage looks identical for a
// registered and an unregistered address.
const MAIL_UNAVAILABLE =
  "We couldn't send that email right now. Please try again in a few minutes.";

// Signup verification codes live longer than reset codes — onboarding isn't
// always immediate.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Password policy shared by register / change / reset: at least 8 characters
// with an uppercase letter, a lowercase letter, a number, and a special char.
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.';
const isStrongPassword = (pw) => typeof pw === 'string' && STRONG_PASSWORD.test(pw);

/* ---------------- REGISTER ---------------- */

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Require plain strings — rejects object/array payloads that could
    // otherwise smuggle MongoDB query operators into the lookup.
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name || !email || !password
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_REQUIREMENTS,
      });
    }

    const emailNorm = email.trim().toLowerCase();

    // Enumeration-safe: the browser gets the SAME generic reply whether or not
    // the email already exists. What differs is only which email we send.
    const genericResponse = {
      success: true,
      needsVerification: true,
      email: emailNorm,
      message: 'If that email can be registered, a verification code has been sent to it.',
    };

    // A real (verified / grandfathered) account already exists → tell the owner
    // by email, not in the HTTP response.
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser && existingUser.isVerified !== false) {
      // Report a delivery failure here too, even though this mail is only a
      // courtesy. If this branch still answered 200 while the new-signup branch
      // below reported 503, the difference would itself reveal whether the
      // address is registered — the exact leak genericResponse exists to close.
      const notified = await sendAccountExistsEmail(existingUser.email);
      if (!notified) {
        return res.status(503).json({ success: false, message: MAIL_UNAVAILABLE });
      }
      return res.status(200).json(genericResponse);
    }
    // A stale UNVERIFIED user left over from the old create-then-verify flow —
    // drop it so the fresh pending signup below is the single source of truth.
    if (existingUser) {
      await User.deleteOne({ _id: existingUser._id });
    }

    // Nothing lands in `users` yet — stage the signup in `pendingusers` and email
    // a code. The real account is only created once the code is verified. Password
    // is hashed here so plaintext is never stored, even in the staging collection.
    const passwordHash = await bcrypt.hash(password, 10);
    const code = crypto.randomInt(100000, 1000000).toString();

    // Upsert so re-registering the same email just refreshes the pending entry.
    await PendingUser.findOneAndUpdate(
      { email: emailNorm },
      {
        name,
        email: emailNorm,
        passwordHash,
        codeHash: hashOtp(code),
        attempts: 0,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // The code only exists in the email, so a failed send leaves a pending row
    // the user can never verify. Drop it and say so, rather than showing "check
    // your inbox" for a message that was never delivered.
    const sent = await sendVerificationEmail(emailNorm, code);
    if (!sent) {
      await PendingUser.deleteOne({ email: emailNorm });
      return res.status(503).json({ success: false, message: MAIL_UNAVAILABLE });
    }
    return res.status(200).json(genericResponse);

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
};

/* ---------------- LOGIN ---------------- */

// Precomputed bcrypt hash used to equalise response timing when the email
// doesn't exist — so login timing can't be used to enumerate registered
// accounts (a real compare runs in both the found and not-found paths).
const DUMMY_HASH = bcrypt.hashSync('prompto-timing-safe-dummy', 10);

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Require plain strings — blocks MongoDB operator injection via objects.
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({ email }).select('+password');

    // Return the SAME 401 whether the email is unknown or the password is wrong,
    // so the endpoint can't be used to discover which emails are registered.
    // Run a bcrypt compare in both cases so response timing doesn't leak it either.
    const isMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, DUMMY_HASH);

    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Block only accounts explicitly marked unverified. Legacy accounts created
    // before email verification existed have isVerified === undefined and are
    // grandfathered through.
    if (user.isVerified === false) {
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email: user.email,
        message: 'Please verify your email to continue.',
      });
    }

    const token = generateToken(user);
    sendAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      token, // kept for backward compatibility during the cookie migration
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
};

/* ---------------- GET USER ---------------- */

export const getUser = async (req, res) => {
  try {
    const isAdmin = !!process.env.ADMIN_EMAIL && req.user.email === process.env.ADMIN_EMAIL;
    return res.status(200).json({
      success: true,
      user: { ...req.user.toObject(), isAdmin },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
  }
};

/* ---------------- UPDATE PROFILE ---------------- */

export const updateProfile = async (req, res) => {
  try {
    const name = req.body.name?.trim();

    if (!name || name.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name },
      { new: true }
    );

    const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
    return res.status(200).json({ success: true, user: { ...user.toObject(), isAdmin } });
  } catch (err) {
    console.error('Update profile error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/* ---------------- CHANGE PASSWORD ---------------- */

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current and new password are both required',
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_REQUIREMENTS,
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // The User pre-save hook re-hashes the password. Bump tokenVersion so every
    // previously issued JWT is invalidated — a changed password logs out all
    // other sessions, which is the expected security behaviour.
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    // Hand back a fresh token (as a new cookie) minted at the new version so the
    // current session isn't logged out by its own change.
    const token = generateToken(user);
    sendAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token,
    });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

/* ---------------- LOGOUT (revoke all sessions) ----------------
   Stateless JWTs can't be deleted server-side, so logout increments
   tokenVersion: every token minted before now fails the version check in
   protect. Clients should also drop their local copy. */

export const logout = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    clearAuthCookie(res);
    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to log out' });
  }
};

/* ---------------- VERIFY EMAIL ----------------
   Confirms the signup code and CREATES the real account (verified) from the
   staged pending signup — nothing exists in `users` until this succeeds. Mirrors
   the OTP hardening: hashed compare, expiry, generic failures, attempt lockout. */

export const verifyEmail = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const code = req.body.code?.trim();
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const pending = await PendingUser.findOne({ email });

    const invalid = () =>
      res.status(400).json({ success: false, message: 'Invalid or expired verification code' });

    // No staged signup for this email ⇒ nothing to confirm.
    if (!pending) return invalid();

    if (pending.expiresAt.getTime() < Date.now()) {
      await PendingUser.deleteOne({ _id: pending._id });
      return invalid();
    }

    if ((pending.attempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      await PendingUser.deleteOne({ _id: pending._id });
      return invalid();
    }

    if (hashOtp(code) !== pending.codeHash) {
      pending.attempts = (pending.attempts ?? 0) + 1;
      await pending.save();
      return invalid();
    }

    // Code valid → NOW create the real, verified account from the staged data.
    // Guard against a real account having appeared in the meantime.
    const existing = await User.findOne({ email });
    if (existing) {
      await PendingUser.deleteOne({ _id: pending._id });
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please log in.',
      });
    }

    // Password was already hashed at register time → skip the pre-save re-hash.
    const user = new User({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      isVerified: true,
    });
    user.$locals.skipHash = true;
    await user.save();

    await PendingUser.deleteOne({ _id: pending._id });

    const token = generateToken(user);
    sendAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      token,
      message: 'Email verified',
    });
  } catch (err) {
    console.error('Verify email error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- RESEND VERIFICATION CODE ----------------
   Issues a fresh signup code. Responds identically whether or not the account
   exists / still needs verifying, so it can't be used to probe registrations. */

export const resendVerification = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const generic = {
      success: true,
      message: 'If that account needs verification, a new code has been sent.',
    };

    const pending = await PendingUser.findOne({ email });
    // No staged signup ⇒ respond generically (reveal nothing).
    if (!pending) return res.status(200).json(generic);

    const code = crypto.randomInt(100000, 1000000).toString();
    pending.codeHash = hashOtp(code);
    pending.attempts = 0;
    pending.expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await pending.save();

    // Same reasoning as register: a code the user never receives is worse than
    // an explicit failure, since the stored hash has already been rotated.
    const sent = await sendVerificationEmail(email, code);
    if (!sent) {
      return res.status(503).json({ success: false, message: MAIL_UNAVAILABLE });
    }
    return res.status(200).json(generic);
  } catch (err) {
    console.error('Resend verification error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- COMMUNITY GALLERY (PUBLIC) ----------------
   Every image a user opted to "feature in the community collection" across all
   accounts, newest first. Powers the public Visual Showcase.

   This aggregation unwinds every message of every chat, so it must not run on
   each request of a public, unauthenticated endpoint. Results are cached in
   memory for a short TTL; the gallery tolerates being a few seconds stale, and
   unpublishing (below) clears the cache for immediate feedback. */

const GALLERY_TTL_MS = 60 * 1000;
let galleryCache = { at: 0, data: null };
const invalidateGalleryCache = () => { galleryCache = { at: 0, data: null }; };

export const getPublishedImages = async (_req, res) => {
  try {
    if (galleryCache.data && Date.now() - galleryCache.at < GALLERY_TTL_MS) {
      return res.status(200).json({ success: true, images: galleryCache.data });
    }

    const assets = await Chat.aggregate([
      { $unwind: '$messages' },
      {
        $match: {
          'messages.isImage': true,
          'messages.isPublished': true,
        },
      },
      {
        $project: {
          _id: 0,
          url: '$messages.content',
          isImage: '$messages.isImage',
          userName: '$userName',
          createdAt: '$messages.timestamp',
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ]);

    galleryCache = { at: Date.now(), data: assets };

    return res.status(200).json({
      success: true,
      images: assets, // Keep key name 'images' for frontend compatibility
    });

  } catch (err) {
    console.error('Published assets error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery assets',
    });
  }
};

/* ---------------- MY COMMUNITY UPLOADS ----------------
   The signed-in user's OWN published assets, so they can review everything
   they've shared to the community and pull anything back. Each item carries
   its parent chatId + asset url, which together uniquely address the message
   that the unpublish endpoint below flips back to private. */

export const getMyPublishedAssets = async (req, res) => {
  try {
    const userId = req.user._id;

    const assets = await Chat.aggregate([
      { $match: { userId } },
      { $unwind: '$messages' },
      {
        $match: {
          'messages.isImage': true,
          'messages.isPublished': true,
        },
      },
      {
        $project: {
          _id: 0,
          chatId: '$_id',
          url: '$messages.content',
          isImage: '$messages.isImage',
          createdAt: '$messages.timestamp',
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return res.status(200).json({ success: true, images: assets });
  } catch (err) {
    console.error('My published assets error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch your community uploads',
    });
  }
};

/* ---------------- REMOVE AN UPLOAD FROM THE COMMUNITY ----------------
   Flips a single asset's `isPublished` back to false so it leaves the public
   gallery. The image itself stays in the user's chat history — this only
   revokes the "featured in community" choice (e.g. an accidental tick).
   The chat is matched by `userId` as well as `_id`, so a user can never
   unpublish — or even probe the existence of — another account's content. */

export const unpublishAsset = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, url } = req.body;

    if (typeof chatId !== 'string' || typeof url !== 'string' || !chatId || !url) {
      return res.status(400).json({
        success: false,
        message: 'A chat id and asset url are required',
      });
    }

    // Reject malformed ids up front so a cast failure can't surface as a 500.
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ success: false, message: 'Invalid chat id' });
    }

    // Atomic, ownership-scoped update. `arrayFilters` targets exactly the
    // published message whose stored url matches, leaving every other message
    // untouched. Idempotent: a second call simply matches nothing to modify.
    const result = await Chat.updateOne(
      { _id: chatId, userId },
      { $set: { 'messages.$[asset].isPublished': false } },
      { arrayFilters: [{ 'asset.content': url, 'asset.isPublished': true }] }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Upload not found' });
    }

    // Drop the cached gallery so the removed item disappears immediately.
    invalidateGalleryCache();

    return res.status(200).json({
      success: true,
      message: 'Removed from the community',
    });
  } catch (err) {
    console.error('Unpublish asset error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove upload',
    });
  }
};

/* ---------------- FORGOT PASSWORD ---------------- */

export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });

    // Always respond identically whether or not the account exists,
    // so this endpoint can't be used to discover registered emails.
    const genericResponse = {
      success: true,
      message: "If an account exists for that email, a recovery code has been sent",
    };

    if (!user) return res.status(200).json(genericResponse);

    // Cryptographically secure 6-digit code (not Math.random, which is
    // predictable). Only its hash is persisted; the plaintext is emailed.
    const otp = crypto.randomInt(100000, 1000000).toString();

    user.resetPasswordToken = hashOtp(otp);
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.resetPasswordAttempts = 0;
    await user.save();

    // Send Live Email
    const sent = await sendRecoveryEmail(email, otp);

    if (!sent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send email. Check server configuration.",
      });
    }

    return res.status(200).json(genericResponse);

  } catch (err) {
    console.error('User controller error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- VERIFY OTP ---------------- */

export const verifyOTP = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const otp = req.body.otp?.trim();
    if (!email || !otp) return res.status(400).json({ success: false, message: "All fields required" });

    const user = await User.findOne({ email })
      .select('+resetPasswordToken +resetPasswordExpire +resetPasswordAttempts');

    // One generic failure response for every reason (no account / wrong code /
    // expired / locked) so the endpoint can't be used to probe accounts.
    const invalid = () =>
      res.status(400).json({ success: false, message: "Invalid or expired recovery code" });

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpire) return invalid();
    if (user.resetPasswordExpire.getTime() < Date.now()) return invalid();

    // Too many wrong guesses ⇒ burn the code (per-account brute-force defence).
    if ((user.resetPasswordAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      return invalid();
    }

    if (hashOtp(otp) !== user.resetPasswordToken) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts ?? 0) + 1;
      await user.save();
      return invalid();
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password.",
    });

  } catch (err) {
    console.error('Verify OTP error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- RESET PASSWORD ---------------- */

export const resetPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const otp = req.body.otp?.trim();
    const { newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: "All fields required" });

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ success: false, message: PASSWORD_REQUIREMENTS });
    }

    const user = await User.findOne({ email })
      .select('+resetPasswordToken +resetPasswordExpire +resetPasswordAttempts');

    const invalid = () =>
      res.status(400).json({ success: false, message: "Invalid or expired recovery code" });

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpire) return invalid();
    if (user.resetPasswordExpire.getTime() < Date.now()) return invalid();

    if ((user.resetPasswordAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      return invalid();
    }

    if (hashOtp(otp) !== user.resetPasswordToken) {
      user.resetPasswordAttempts = (user.resetPasswordAttempts ?? 0) + 1;
      await user.save();
      return invalid();
    }

    // Valid code → set the new password (pre-save hook hashes it), clear the
    // recovery code, and bump tokenVersion to revoke any sessions an attacker
    // might have opened before the reset.
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    user.resetPasswordAttempts = 0;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    // Log the user straight in after a successful reset (set the auth cookie).
    const token = generateToken(user);
    sendAuthCookie(res, token);
    return res.status(200).json({
      success: true,
      token,
      message: "Password updated successfully",
    });

  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};
