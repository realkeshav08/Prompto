import express from "express";
import { changePassword, forgotPassword, getPublishedImages, getUser, loginUser, registerUser, resetPassword, updateProfile, verifyOTP } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/data', protect, getUser)
userRouter.get('/published-images', getPublishedImages)

userRouter.post('/forgot-password', forgotPassword)
userRouter.post('/verify-otp', verifyOTP)
userRouter.post('/reset-password', resetPassword)

userRouter.post('/update-profile', protect, updateProfile)
userRouter.post('/change-password', protect, changePassword)

export default userRouter;