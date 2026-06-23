import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // never return password by default
    },

    credits: {
      type: Number,
      default: 100,
      min: 0,
    },

    // Stored as a SHA-256 HASH of the recovery code, never the code itself —
    // a leaked DB row can't be used to reset a password. select:false keeps it
    // out of every normal query/response.
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordExpire: {
      type: Date,
      default: null,
      select: false,
    },

    // Failed recovery-code attempts for the current code. Lets us lock a code
    // after too many wrong guesses (per-account brute-force defence on top of
    // the per-IP limiter).
    resetPasswordAttempts: {
      type: Number,
      default: 0,
      select: false,
    },

    // Bumped on logout / password change / reset to invalidate every JWT issued
    // earlier. `protect` compares the token's version against this; a mismatch
    // is rejected, giving us real session revocation despite stateless JWTs.
    tokenVersion: {
      type: Number,
      default: 0,
    },

    // Email ownership confirmation. New accounts start unverified and must
    // confirm a code before logging in. NOTE: accounts created before this
    // field existed have no value (undefined) and are treated as verified
    // (grandfathered) — login only blocks an explicit `false`.
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Hashed signup verification code + its expiry and wrong-attempt counter,
    // mirroring the password-reset code fields. select:false keeps them private.
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationExpire: {
      type: Date,
      default: null,
      select: false,
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

/* ---------------- PASSWORD HASHING ---------------- */

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


/* ---------------- PASSWORD CHECK METHOD ---------------- */

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);

export default User;
