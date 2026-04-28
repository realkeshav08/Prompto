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

    if (!name || !email || !password) {
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

    if (!email || !password) {
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
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
    });
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
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

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

    return res.status(200).json({
      success: true,
      message: "Recovery code sent to your email",
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------- VERIFY OTP ---------------- */

export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
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
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------- RESET PASSWORD ---------------- */

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
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
    return res.status(500).json({ success: false, message: err.message });
  }
};
