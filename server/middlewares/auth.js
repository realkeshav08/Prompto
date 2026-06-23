import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined');
}

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    /* ---- Check header ---- */
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token missing',
      });
    }

    const token = authHeader.split(' ')[1];

    /* ---- Verify token ---- */
    const decoded = jwt.verify(token, JWT_SECRET);

    /* ---- Fetch user (exclude password) ---- */
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
    }

    /* ---- Session revocation check ----
       The token carries the tokenVersion it was minted with. Logout / password
       change / reset increment user.tokenVersion, so any token older than the
       current version is rejected. Tokens issued before this field existed have
       no claim → treated as version 0, matching a fresh account's default. */
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({
        success: false,
        message: 'Session expired, please log in again',
      });
    }

    req.user = user;
    next();

  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid',
    });
  }
};
