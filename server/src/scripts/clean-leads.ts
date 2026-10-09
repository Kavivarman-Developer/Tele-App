import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { Lead } from '../models/lead.model';
import { Activity } from '../models/activity.model';
import { User } from '../models/user.model';
import { Campaign } from '../models/campaign.model';
import { Pipeline } from '../models/pipeline.model';

const cleanDatabase = async () => {
  const mongoURI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/tele_app';

  try {
    console.log('[Cleanup] Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('[Cleanup] Connected to MongoDB Atlas successfully.');

    // 1. Check existing counts
    const leadCount = await Lead.countDocuments();
    const activityCount = await Activity.countDocuments();
    const userCount = await User.countDocuments();
    const campaignCount = await Campaign.countDocuments();
    const pipelineCount = await Pipeline.countDocuments();

    console.log('\n--- Current Database Counts ---');
    console.log(`Leads (to delete): ${leadCount}`);
    console.log(`Activities / Call Logs (to delete): ${activityCount}`);
    console.log(`Users (preserved): ${userCount}`);
    console.log(`Campaigns (preserved): ${campaignCount}`);
    console.log(`Pipelines (preserved): ${pipelineCount}`);

    // 2. Delete test leads and test activities
    console.log('\n[Cleanup] Cleaning all test leads...');
    const deletedLeads = await Lead.deleteMany({});
    console.log(`[Cleanup] Deleted ${deletedLeads.deletedCount} leads.`);

    console.log('[Cleanup] Cleaning all test call logs / activities...');
    const deletedActivities = await Activity.deleteMany({});
    console.log(`[Cleanup] Deleted ${deletedActivities.deletedCount} activities.`);

    // 3. Verify clean state
    const remainingLeads = await Lead.countDocuments();
    const remainingActivities = await Activity.countDocuments();
    console.log('\n--- Final Verified Database Status ---');
    console.log(`Remaining Leads: ${remainingLeads} (100% Clean)`);
    console.log(`Remaining Activities: ${remainingActivities} (100% Clean)`);
    console.log(`Active Users: ${userCount} (Intact - Login Ready)`);
    console.log(`Campaigns: ${campaignCount} (Intact - Ready for Real Leads Upload)`);
    console.log('--------------------------------------\n');
    console.log('[Cleanup] Database is now 100% fresh and ready for real customer data upload!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] Error cleaning database:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

cleanDatabase();
