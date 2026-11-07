import { z } from 'zod';

/* ─────────────────────────────────────────────────────────────────────────────
   REQUEST SCHEMAS

   One definition per endpoint, applied by middlewares/validate.js. Declaring a
   field as a string is what stops a MongoDB operator object ({"$ne": null})
   being smuggled into a query filter, so these double as the injection guard
   rather than each controller repeating a typeof check.

   Messages are written for the user, since validate.js returns the first one
   directly. Auth-related messages stay deliberately generic so a rejection can't
   be used to probe which addresses are registered.
   ───────────────────────────────────────────────────────────────────────── */

// Mongo ObjectId. Rejecting a malformed id here avoids a CastError surfacing as
// a 500 from deeper in the stack.
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const email = z.string().trim().toLowerCase().min(3).max(254).email('Enter a valid email address');

// Length only — the strength rules live in userController's STRONG_PASSWORD so
// the policy and its user-facing description stay in one place.
const password = z.string().min(1).max(200);

const otp = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const userSchemas = {
  register: { body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(80),
    email,
    password,
  }) },

  login: { body: z.object({ email, password }) },

  verifyEmail: { body: z.object({ email, code: otp }) },

  resendVerification: { body: z.object({ email }) },

  forgotPassword: { body: z.object({ email }) },

  verifyOtp: { body: z.object({ email, otp }) },

  resetPassword: { body: z.object({ email, otp, newPassword: password }) },

  changePassword: { body: z.object({
    currentPassword: password,
    newPassword: password,
  }) },

  updateProfile: { body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(80),
  }) },

  unpublish: { body: z.object({
    chatId: objectId,
    url: z.string().trim().min(1).max(2000),
  }) },
};

export const chatSchemas = {
  get: { query: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().datetime({ offset: true }).optional(),
  }) },

  byId: { params: z.object({ id: objectId }) },

  remove: { body: z.object({
    chatId: objectId,
    onlyIfEmpty: z.boolean().optional(),
  }) },

  rename: { body: z.object({
    chatId: objectId,
    name: z.string().trim().min(1, 'Name cannot be empty').max(100),
  }) },
};

export const creditSchemas = {
  purchase: { body: z.object({
    planId: z.enum(['basic', 'pro', 'premium'], { message: 'Invalid plan selected' }),
  }) },
};

export const documentSchemas = {
  // Uploads arrive as multipart, so the file itself is handled by multer and
  // only the accompanying text fields are described here. Both are optional:
  // a request carries either a file or a url, and the handler decides which.
  upload: { body: z.object({
    url: z.string().trim().max(2000).optional(),
    isGlobal: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  }) },

  remove: { params: z.object({ id: objectId }) },
};
