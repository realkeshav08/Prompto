import User from '../models/User.js';
import Chat from '../models/Chat.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/* ---------------- JWT ---------------- */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined');
}

const generateToken = (id) =>
  jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });

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

    const user = await User.create({ name, email, password });

    return res.status(201).json({
      success: true,
      token: generateToken(user._id),
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

    return res.status(200).json({
      success: true,
      token: generateToken(user._id),
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

    // The User pre-save hook re-hashes the password.
    user.password = newPassword;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

/* ---------------- PUBLISHED IMAGES ---------------- */

export const getPublishedImages = async (_req, res) => {
  try {
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

import { sendRecoveryEmail } from '../utils/email.js';

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

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes
    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
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

    const user = await User.findOne({ 
      email, 
      resetPasswordToken: otp,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired recovery code" });
    }

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password.",
    });

  } catch (err) {
    console.error('User controller error:', err.message);
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

    const user = await User.findOne({ 
      email, 
      resetPasswordToken: otp,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Session expired. Try again." });
    }

    // Set new password (hashing is handled by pre-save middleware)
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now login.",
    });

  } catch (err) {
    console.error('User controller error:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};
