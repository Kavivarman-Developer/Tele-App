import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('[Database] Warning: MONGO_URI is not defined in environment variables.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(
      '[Database] MongoDB Connection Error: Could not connect to MongoDB.',
      error instanceof Error ? error.message : error,
    );
    console.warn('[Database] Continuing server execution. Set a valid MONGO_URI in .env to use database features.');
  }
};
