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
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
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
    const images = await Chat.aggregate([
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
          imageUrl: '$messages.content',
          userName: '$userName',
          createdAt: '$messages.timestamp',
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 100 },
    ]);

    return res.status(200).json({
      success: true,
      images,
    });

  } catch (err) {
    console.error('Published images error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch images',
    });
  }
};
