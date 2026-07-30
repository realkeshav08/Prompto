import mongoose from 'mongoose';

const { Schema } = mongoose;

// Holds an in-progress signup BEFORE its email is verified. Nothing lands in the
// real `users` collection until the code is confirmed — so abandoned/unverified
// signups never pollute it and can't squat a real email. A TTL index makes Mongo
// auto-delete a pending entry once it expires, so no cleanup job is needed.
const PendingUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    // Password is stored ALREADY bcrypt-hashed — never plaintext, even here.
    passwordHash: { type: String, required: true },

    // SHA-256 hash of the 6-digit code (the plaintext lives only in the inbox).
    codeHash: { type: String, required: true },

    // Wrong-code attempts for the current code (per-account brute-force defence).
    attempts: { type: Number, default: 0 },

    // Mongo deletes the document once this time passes (see the TTL index below).
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — purge expired pending signups automatically (expireAfterSeconds: 0
// means "delete as soon as expiresAt is in the past").
PendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PendingUser = mongoose.model('PendingUser', PendingUserSchema);

export default PendingUser;
