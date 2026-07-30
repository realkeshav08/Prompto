import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

/* ---------------- MESSAGE SUBSCHEMA ---------------- */

const MessageSchema = new Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },

    content: {
      type: String,
      // A "stopped" assistant placeholder is intentionally saved with empty
      // content (the UI shows "⏹ Stopped"). Mongoose treats '' as missing for a
      // required String, so require content only for non-stopped messages —
      // otherwise a failed/empty AI reply crashes the save with a 500.
      required: function () { return !this.stopped; },
      trim: true,
      default: '',
    },

    isImage: {
      type: Boolean,
      default: false,
    },

    isVideo: {
      type: Boolean,
      default: false,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    // True on an assistant placeholder saved when generation failed/timed out.
    // The UI renders these as "⏹ Stopped" with a Regenerate button instead of
    // the missing reply, so the user message before it is never orphaned.
    stopped: {
      type: Boolean,
      default: false,
    },

    // Records which generation pipeline produced (or attempted) this assistant
    // message. Lets the Regenerate endpoint pick the right pipeline on retry.
    // Undefined on legacy/user messages.
    mode: {
      type: String,
      enum: ['text', 'study', 'image'],
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/* ---------------- CHAT SCHEMA ---------------- */

const ChatSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      default: 'New Chat',
    },

    messages: {
      type: [MessageSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

/* ---------------- COMPOUND INDEX ---------------- */
ChatSchema.index({ userId: 1, updatedAt: -1 });

const Chat = mongoose.model('Chat', ChatSchema);

export default Chat;
