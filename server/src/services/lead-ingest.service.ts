import { Types } from 'mongoose';
import { Campaign } from '../models/campaign.model';
import { Pipeline } from '../models/pipeline.model';
import { Lead, ILeadDoc } from '../models/lead.model';
import { User } from '../models/user.model';
import { LeadAssignmentService } from './lead-assignment.service';
import { normalizePhone } from '../utils/phone.util';
import { AppError } from '../utils/AppError';

export interface RawLeadRow {
  name?: string;
  phone?: string;
  email?: string;
  assignedTo?: string;
  agent?: string;
  [key: string]: unknown;
}

export interface IngestFailedRow {
  row: RawLeadRow;
  reason: string;
}

export interface IngestResult {
  created: number;
  merged: number;
  skipped: number;
  failed: IngestFailedRow[];
}

export class LeadIngestService {
  public static async ingest(
    campaignId: string | Types.ObjectId,
    rows: RawLeadRow[],
    source = 'UPLOAD',
    targetAgentId?: string | Types.ObjectId,
  ): Promise<IngestResult> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!campaign.isActive) {
      throw new AppError('Cannot ingest leads into an inactive campaign', 400);
    }

    // Retrieve the campaign's pipeline to get the initial stage
    const pipeline = await Pipeline.findById(campaign.pipelineId);
    if (!pipeline || pipeline.stages.length === 0) {
      throw new AppError('Campaign pipeline is missing or contains no stages', 400);
    }

    // First stage sorted by order
    const sortedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
    const initialStage = sortedStages[0];

    const result: IngestResult = {
      created: 0,
      merged: 0,
      skipped: 0,
      failed: [],
    };

    for (const row of rows) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!name) {
        result.failed.push({ row, reason: 'Missing or empty lead name' });
        continue;
      }

      // Normalize phone number
      const normalizedPhone = normalizePhone(row.phone);
      if (!normalizedPhone) {
        result.failed.push({
          row,
          reason: 'Invalid phone number (must be a valid 10-digit number)',
        });
        continue;
      }

      const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';

      // Collect custom properties from any extra keys
      const customProperties = new Map<string, string>();
      for (const [key, val] of Object.entries(row)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'name' && lowerKey !== 'phone' && lowerKey !== 'email' && val !== undefined && val !== null) {
          customProperties.set(key, String(val).trim());
        }
      }

      // Check for existing lead with identical campaignId and phone
      const existingLead = await Lead.findOne({
        campaignId: campaign._id,
        phone: normalizedPhone,
      });

      if (existingLead) {
        if (campaign.duplicateMode === 'SKIP') {
          result.skipped += 1;
          continue;
        }

        if (campaign.duplicateMode === 'MERGE') {
          // Merge custom properties
          for (const [k, v] of customProperties.entries()) {
            if (v) {
              existingLead.customProperties.set(k, v);
            }
          }

          if (email && !existingLead.email) {
            existingLead.email = email;
          }

          // Reopen if closed
          if (existingLead.status === 'CLOSED') {
            existingLead.status = 'OPEN';
            existingLead.stage = initialStage.name;
            existingLead.tag = null;
          }

          await existingLead.save();
          result.merged += 1;
          continue;
        }

        // If duplicateMode === 'CREATE_NEW', fall through to creation
      }

      // Assign lead
      let assignedTo: Types.ObjectId | null = null;

      if (targetAgentId && Types.ObjectId.isValid(targetAgentId)) {
        // Direct target agent specified (e.g. from UI selector)
        assignedTo = new Types.ObjectId(targetAgentId);
      } else if (row.assignedTo || row.agent) {
        // Row-level agent specified in CSV (e.g. email or name or ID)
        const agentIdentifier = String(row.assignedTo || row.agent).trim();
        const isOid = Types.ObjectId.isValid(agentIdentifier);
        const matchedAgent = await User.findOne({
          $or: [
            { email: agentIdentifier.toLowerCase() },
            { name: new RegExp(`^${agentIdentifier}$`, 'i') },
            ...(isOid ? [{ _id: new Types.ObjectId(agentIdentifier) }] : []),
          ],
          role: 'AGENT',
          isActive: true,
        });
        if (matchedAgent) {
          assignedTo = matchedAgent._id;
        } else {
          assignedTo = await LeadAssignmentService.assignLead(campaign, customProperties);
        }
      } else {
        assignedTo = await LeadAssignmentService.assignLead(campaign, customProperties);
      }

      const newLead: Partial<ILeadDoc> = {
        campaignId: campaign._id,
        name,
        phone: normalizedPhone,
        email,
        source,
        customProperties,
        assignedTo,
        stage: initialStage.name,
        tag: null,
        status: initialStage.isClosed ? 'CLOSED' : 'OPEN',
        attemptCount: 0,
      };

      await Lead.create(newLead);
      result.created += 1;
    }

    return result;
  }
}
