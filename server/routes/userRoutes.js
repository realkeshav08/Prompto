import express from "express";
import { forgotPassword, getPublishedImages, getUser, loginUser, registerUser, resetPassword, verifyOTP } from "../controllers/userController.js";
import { protect } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post('/register', registerUser)
userRouter.post('/login', loginUser)
userRouter.get('/data', protect, getUser)
userRouter.get('/published-images', getPublishedImages)

userRouter.post('/forgot-password', forgotPassword)
userRouter.post('/verify-otp', verifyOTP)
userRouter.post('/reset-password', resetPassword)

export default userRouter;