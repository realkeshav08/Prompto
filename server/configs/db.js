import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined');
    }

    mongoose.connection.once('connected', () => {
      console.log('✅ MongoDB connected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    await mongoose.connect(mongoURI, {
      dbName: 'quickgpt',
      autoIndex: true,
    });

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1); // stop the server if DB fails
  }
};

export default connectDB;
