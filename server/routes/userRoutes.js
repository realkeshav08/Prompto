import express from "express";
import { changePassword, forgotPassword, getMyPublishedAssets, getPublishedImages, getUser, loginUser, logout, registerUser, resendVerification, resetPassword, unpublishAsset, updateProfile, verifyEmail, verifyOTP } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { userSchemas } from "../validators/schemas.js";

const userRouter = express.Router();

userRouter.post('/register', validate(userSchemas.register), registerUser)
userRouter.post('/login', validate(userSchemas.login), loginUser)
userRouter.get('/data', protect, getUser)

// Signup email verification.
userRouter.post('/verify-email', validate(userSchemas.verifyEmail), verifyEmail)
userRouter.post('/resend-verification', validate(userSchemas.resendVerification), resendVerification)

// Public community gallery (everyone's featured creations).
userRouter.get('/published-images', getPublishedImages)

// A user's own community uploads + the ability to pull one back to private.
userRouter.get('/my-published', protect, getMyPublishedAssets)
userRouter.post('/unpublish', protect, validate(userSchemas.unpublish), unpublishAsset)

userRouter.post('/forgot-password', validate(userSchemas.forgotPassword), forgotPassword)
userRouter.post('/verify-otp', validate(userSchemas.verifyOtp), verifyOTP)
userRouter.post('/reset-password', validate(userSchemas.resetPassword), resetPassword)

userRouter.post('/update-profile', protect, validate(userSchemas.updateProfile), updateProfile)
userRouter.post('/change-password', protect, validate(userSchemas.changePassword), changePassword)
userRouter.post('/logout', protect, logout)

export default userRouter;
