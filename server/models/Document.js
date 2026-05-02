import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const DocumentSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null, // null = global document
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'txt', 'docx', 'url'],
      required: true,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Document = mongoose.model('Document', DocumentSchema);

export default Document;
