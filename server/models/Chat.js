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
      required: true,
      trim: true,
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
