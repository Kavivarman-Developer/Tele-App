import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, IUserDoc } from '../models/user.model';
import { Pipeline } from '../models/pipeline.model';
import { Campaign } from '../models/campaign.model';
import { Lead } from '../models/lead.model';
import { Activity } from '../models/activity.model';

const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Isha', 'Myra', 'Kavya', 'Riya', 'Anika',
  'Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Deepa', 'Suresh', 'Karthik', 'Pooja', 'Rohan',
];

const lastNames = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Sundar', 'Rao', 'Iyer', 'Menon', 'Kumar', 'Singh',
  'Gupta', 'Chopra', 'Nair', 'Joshi', 'Bhat', 'Deshmukh', 'Mehta', 'Kulkarni', 'Pillai', 'Das',
];

const cities = ['Chennai', 'Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi', 'Coimbatore', 'Kochi', 'Pune'];
const budgets = ['30L - 50L', '50L - 80L', '80L - 1.2Cr', '1.2Cr - 2Cr', '> 2Cr'];
const sources = ['UPLOAD', 'FACEBOOK_ADS', 'GOOGLE_ADS', 'WEBSITE', 'WALK_IN'];
const notConnectedReasons = [
  'DID_NOT_PICK',
  'BUSY',
  'USER_DISCONNECTED',
  'SWITCHED_OFF',
  'OUT_OF_COVERAGE',
] as const;

const seedDemoData = async (): Promise<void> => {
  const mongoURI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://localhost:27017/tele_app';

  try {
    console.log('[Seed Demo] Connecting to database...');
    await mongoose.connect(mongoURI);
    console.log('[Seed Demo] Connected to MongoDB.');

    // 1. Ensure Admin exists
    let admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      admin = await User.create({
        name: 'System Admin',
        email: 'admin@example.com',
        phone: '1234567890',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        canReceiveLeads: false,
      });
    }

    // 2. Ensure Pipeline exists
    let pipeline = await Pipeline.findOne({ name: 'Sales Pipeline' });
    if (!pipeline) {
      pipeline = await Pipeline.create({
        name: 'Sales Pipeline',
        stages: [
          { name: 'New', isClosed: false, tags: [], order: 0 },
          { name: 'Interested', isClosed: false, tags: ['hot', 'warm', 'cold'], order: 1 },
          { name: 'Follow Up', isClosed: false, tags: [], order: 2 },
          { name: 'Not Interested', isClosed: true, tags: [], order: 3 },
          { name: 'Converted', isClosed: true, tags: [], order: 4 },
          { name: 'Lost', isClosed: true, tags: [], order: 5 },
        ],
      });
    }

    // 3. Ensure at least 3 active Agents exist
    const agentConfigs = [
      { name: 'John Agent', email: 'john@example.com', phone: '9876543210' },
      { name: 'Agent Two', email: 'agent2@example.com', phone: '9876543299' },
      { name: 'Agent Three', email: 'agent3@example.com', phone: '9876543288' },
    ];

    const agents: IUserDoc[] = [];
    const passwordHash = await bcrypt.hash('Agent@123', 10);

    for (const cfg of agentConfigs) {
      let ag = await User.findOne({ email: cfg.email });
      if (!ag) {
        ag = await User.create({
          ...cfg,
          passwordHash,
          role: 'AGENT',
          isActive: true,
          canReceiveLeads: true,
        });
      }
      agents.push(ag);
    }

    // 4. Ensure a Campaign exists
    let campaign = await Campaign.findOne({ name: 'Demo Sales Campaign' });
    if (!campaign) {
      campaign = await Campaign.create({
        name: 'Demo Sales Campaign',
        pipelineId: pipeline._id,
        managerId: admin._id,
        agentIds: agents.map((a) => a._id),
        distributionMode: 'EQUAL',
        priority: 'HIGH',
        duplicateMode: 'MERGE',
        engagementForm: [
          { id: 'q1', type: 'MULTIPLE_CHOICE', label: 'Budget', options: budgets, required: true },
          { id: 'q2', type: 'SHORT_ANSWER', label: 'Preferred City', options: [], required: false },
        ],
        isActive: true,
      });
    }

    console.log('[Seed Demo] Generating 200 realistic leads and activities...');

    const now = Date.now();
    const leadsToInsert = [];
    const activitiesToInsert = [];

    const stagesList = ['New', 'Interested', 'Follow Up', 'Not Interested', 'Converted', 'Lost'];

    for (let i = 1; i <= 200; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${fName} ${lName}`;
      const phone = `98${String(10000000 + i).padStart(8, '0')}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@demoexample.com`;
      const source = sources[Math.floor(Math.random() * sources.length)];
      const assignedAgent = agents[i % agents.length];

      // Spread creation dates over past 14 days
      const daysAgo = Math.floor(Math.random() * 14);
      const createdAt = new Date(now - daysAgo * 86400000 - Math.random() * 36000000);

      const stage = stagesList[Math.floor(Math.random() * stagesList.length)];
      const isClosed = stage === 'Converted' || stage === 'Lost';
      const status = isClosed ? 'CLOSED' : 'OPEN';

      let tag: string | null = null;
      if (stage === 'Interested') {
        const tags = ['hot', 'warm', 'cold'];
        tag = tags[Math.floor(Math.random() * tags.length)];
      }

      // Follow-up dates: some due today, some missed, some future
      let nextFollowUpAt: Date | null = null;
      let followUpDue = false;

      if (!isClosed) {
        const followUpType = i % 4;
        if (followUpType === 0) {
          // Due today
          nextFollowUpAt = new Date();
          followUpDue = true;
        } else if (followUpType === 1) {
          // Missed (past date)
          nextFollowUpAt = new Date(now - (Math.random() * 3 + 1) * 86400000);
          followUpDue = true;
        } else if (followUpType === 2) {
          // Future date
          nextFollowUpAt = new Date(now + (Math.random() * 5 + 1) * 86400000);
        }
      }

      const customProperties = new Map<string, string>();
      customProperties.set('city', cities[Math.floor(Math.random() * cities.length)]);
      customProperties.set('budget', budgets[Math.floor(Math.random() * budgets.length)]);

      const attemptCount = Math.floor(Math.random() * 4);

      const leadId = new mongoose.Types.ObjectId();

      leadsToInsert.push({
        _id: leadId,
        campaignId: campaign._id,
        name,
        phone,
        email,
        source,
        customProperties,
        assignedTo: assignedAgent._id,
        stage,
        tag,
        status,
        nextFollowUpAt,
        followUpDue,
        lastContactedAt: attemptCount > 0 ? createdAt : null,
        attemptCount,
        createdAt,
        updatedAt: createdAt,
      });

      // Generate activity for leads that had attempts
      if (attemptCount > 0) {
        const connected = Math.random() > 0.4;
        const notConnectedReason = connected
          ? null
          : notConnectedReasons[Math.floor(Math.random() * notConnectedReasons.length)];
        const durationSeconds = connected
          ? Math.floor(Math.random() * 300) + 30
          : Math.floor(Math.random() * 20) + 5;

        activitiesToInsert.push({
          leadId,
          campaignId: campaign._id,
          userId: assignedAgent._id,
          type: 'CALL',
          connected,
          notConnectedReason,
          stage,
          tag,
          remark: connected ? 'Discussed requirements in detail' : 'Call did not connect',
          followUpAt: nextFollowUpAt,
          durationSeconds,
          answers: connected
            ? [
                { questionId: 'q1', value: customProperties.get('budget') },
                { questionId: 'q2', value: customProperties.get('city') },
              ]
            : [],
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    await Lead.insertMany(leadsToInsert);
    await Activity.insertMany(activitiesToInsert);

    console.log(`[Seed Demo] Successfully seeded ${leadsToInsert.length} leads and ${activitiesToInsert.length} activities!`);
    await mongoose.disconnect();
    console.log('[Seed Demo] Done.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Demo] Error:', error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
};

seedDemoData();
