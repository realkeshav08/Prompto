import express from "express";
import { changePassword, forgotPassword, getMyPublishedAssets, getPublishedImages, getUser, loginUser, logout, registerUser, resendVerification, resetPassword, unpublishAsset, updateProfile, verifyEmail, verifyOTP } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/data', protect, getUser)

// Signup email verification.
userRouter.post('/verify-email', verifyEmail)
userRouter.post('/resend-verification', resendVerification)

// Public community gallery (everyone's featured creations).
userRouter.get('/published-images', getPublishedImages)

// A user's own community uploads + the ability to pull one back to private.
userRouter.get('/my-published', protect, getMyPublishedAssets)
userRouter.post('/unpublish', protect, unpublishAsset)

userRouter.post('/forgot-password', forgotPassword)
userRouter.post('/verify-otp', verifyOTP)
userRouter.post('/reset-password', resetPassword)

userRouter.post('/update-profile', protect, updateProfile)
userRouter.post('/change-password', protect, changePassword)
userRouter.post('/logout', protect, logout)

export default userRouter;