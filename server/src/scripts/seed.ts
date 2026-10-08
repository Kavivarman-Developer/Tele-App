import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/user.model';
import { Pipeline } from '../models/pipeline.model';

const seedDatabase = async (): Promise<void> => {
  const mongoURI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/tele_app';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('[Seed] Connected to MongoDB.');

    // 1. Seed Admin
    const adminEmail = 'admin@example.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log(`[Seed] Admin user already exists (${adminEmail}). Skipping creation.`);
    } else {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      const admin = await User.create({
        name: 'System Admin',
        email: adminEmail,
        phone: '1234567890',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        canReceiveLeads: false,
      });

      console.log(`[Seed] Default ADMIN user created successfully!`);
      console.log(`[Seed] ID: ${admin._id.toString()}`);
      console.log(`[Seed] Email: ${admin.email}`);
      console.log(`[Seed] Role: ${admin.role}`);
    }

    // 2. Seed Default Pipeline
    const defaultPipelineName = 'Sales Pipeline';
    const existingPipeline = await Pipeline.findOne({ name: defaultPipelineName });

    if (existingPipeline) {
      console.log(`[Seed] Pipeline '${defaultPipelineName}' already exists. Skipping creation.`);
    } else {
      const pipeline = await Pipeline.create({
        name: defaultPipelineName,
        stages: [
          { name: 'New', isClosed: false, tags: [], order: 0 },
          { name: 'Interested', isClosed: false, tags: ['hot', 'warm', 'cold'], order: 1 },
          { name: 'Follow Up', isClosed: false, tags: [], order: 2 },
          { name: 'Not Interested', isClosed: false, tags: [], order: 3 },
          { name: 'Converted', isClosed: true, tags: [], order: 4 },
          { name: 'Lost', isClosed: true, tags: [], order: 5 },
        ],
      });

      console.log(
        `[Seed] Default '${defaultPipelineName}' created successfully with ${pipeline.stages.length} stages!`,
      );
      console.log(`[Seed] Pipeline ID: ${pipeline._id.toString()}`);
    }

    await mongoose.disconnect();
    console.log('[Seed] Database disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDatabase();
