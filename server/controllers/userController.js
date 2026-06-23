import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendRecoveryEmail, sendVerificationEmail } from '../utils/email.js';

/* ---------------- JWT ---------------- */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined');
}

// The token embeds the user's current tokenVersion so it can be revoked later
// (see protect). A brand-new account is version 0.
const generateToken = (user) =>
  jwt.sign({ id: user._id, tokenVersion: user.tokenVersion ?? 0 }, JWT_SECRET, { expiresIn: '30d' });

// Recovery codes are stored only as a hash. Hash the candidate the same way to
// compare on verify/reset, so the plaintext code lives only in the user's inbox.
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// How many wrong code entries before the current recovery code is burned.
const MAX_OTP_ATTEMPTS = 5;

// Signup verification codes live longer than reset codes — onboarding isn't
// always immediate.
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Issues (or re-issues) a signup verification code on a user doc and emails it.
// Returns whether the email was dispatched. Caller is responsible for saving.
const issueVerificationCode = async (user) => {
  const code = crypto.randomInt(100000, 1000000).toString();
  user.verificationToken = hashOtp(code);
  user.verificationExpire = Date.now() + VERIFICATION_TTL_MS;
  user.verificationAttempts = 0;
  await user.save();
  return sendVerificationEmail(user.email, code);
};

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

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists',
      });
    }

    const user = await User.create({ name, email, password, isVerified: false });

    // Email a verification code instead of logging the user straight in — the
    // account stays inactive until they confirm ownership of the address.
    await issueVerificationCode(user);

    return res.status(201).json({
      success: true,
      needsVerification: true,
      email: user.email,
      message: 'Account created. Check your email for a verification code.',
    });

  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
};

/* ---------------- LOGIN ---------------- */

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
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found. Please register first.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
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

    return res.status(200).json({
      success: true,
      token: generateToken(user),
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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
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

    // Hand back a fresh token minted at the new version so the current session
    // (which just authenticated) isn't logged out by its own change.
    return res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token: generateToken(user),
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
    return res.status(200).json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to log out' });
  }
};

/* ---------------- VERIFY EMAIL ----------------
   Confirms the signup code, activates the account, and logs the user in by
   returning a token. Mirrors the OTP verification hardening: hashed compare,
   expiry, generic failures, and a wrong-attempt lockout. */

export const verifyEmail = async (req, res) => {
  try {
    const email = req.body.email?.trim();
    const code = req.body.code?.trim();
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const user = await User.findOne({ email })
      .select('+verificationToken +verificationExpire +verificationAttempts');

    const invalid = () =>
      res.status(400).json({ success: false, message: 'Invalid or expired verification code' });

    if (!user) return invalid();

    // Already verified ⇒ idempotent success (just log them in).
    if (user.isVerified === true || user.isVerified === undefined) {
      return res.status(200).json({ success: true, token: generateToken(user) });
    }
    if (!user.verificationToken || !user.verificationExpire) return invalid();
    if (user.verificationExpire.getTime() < Date.now()) return invalid();

    if ((user.verificationAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      user.verificationToken = null;
      user.verificationExpire = null;
      await user.save();
      return invalid();
    }

    if (hashOtp(code) !== user.verificationToken) {
      user.verificationAttempts = (user.verificationAttempts ?? 0) + 1;
      await user.save();
      return invalid();
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationExpire = null;
    user.verificationAttempts = 0;
    await user.save();

    return res.status(200).json({
      success: true,
      token: generateToken(user),
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
    const email = req.body.email?.trim();
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const generic = {
      success: true,
      message: 'If that account needs verification, a new code has been sent.',
    };

    const user = await User.findOne({ email });
    // Only re-issue for accounts explicitly awaiting verification.
    if (!user || user.isVerified !== false) return res.status(200).json(generic);

    await issueVerificationCode(user);
    return res.status(200).json(generic);
  } catch (err) {
    console.error('Resend verification error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- COMMUNITY GALLERY (PUBLIC) ----------------
   Every image/video a user opted to "feature in the community collection"
   across all accounts, newest first. Powers the public Visual Showcase.

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
          $or: [
            { 'messages.isImage': true },
            { 'messages.isVideo': true }
          ],
          'messages.isPublished': true,
        },
      },
      {
        $project: {
          _id: 0,
          url: '$messages.content',
          isVideo: '$messages.isVideo',
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
          $or: [
            { 'messages.isImage': true },
            { 'messages.isVideo': true },
          ],
          'messages.isPublished': true,
        },
      },
      {
        $project: {
          _id: 0,
          chatId: '$_id',
          url: '$messages.content',
          isVideo: '$messages.isVideo',
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

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
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

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now login.",
    });

  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};
