import crypto from 'crypto';
import { Lead, ILeadDoc } from '../models/lead.model';
import { Campaign } from '../models/campaign.model';
import { LeadAssignmentService } from './lead-assignment.service';
import { AuditService } from './audit.service';
import { AppError } from '../utils/AppError';
import { Request } from 'express';

export interface WebhookLeadPayload {
  name: string;
  phone: string;
  email?: string;
  campaignId?: string;
  campaignName?: string;
  source?: string;
  tag?: string;
  customProperties?: Record<string, unknown>;
}

export class WebhookIngestService {
  public static verifySignature(
    payloadString: string,
    signatureHeader?: string,
    secret = process.env.WEBHOOK_SECRET || 'hi_talk_default_webhook_secret_key_2026',
  ): boolean {
    if (!signatureHeader) return false;

    const cleanSig = signatureHeader.replace(/^sha256=/, '').trim();
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    const expected = hmac.digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(cleanSig, 'utf8'),
        Buffer.from(expected, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  public static async ingestLead(
    payload: WebhookLeadPayload,
    req?: Request,
  ): Promise<ILeadDoc> {
    if (!payload.phone || !payload.name) {
      throw new AppError('name and phone are required fields for webhook ingestion', 400);
    }

    // Resolve Campaign
    let campaign = null;
    if (payload.campaignId) {
      campaign = await Campaign.findById(payload.campaignId);
    }
    if (!campaign && payload.campaignName) {
      campaign = await Campaign.findOne({ name: payload.campaignName });
    }
    if (!campaign) {
      // Find default active campaign
      campaign = await Campaign.findOne({ isActive: true }).sort({ createdAt: 1 });
    }

    if (!campaign) {
      throw new AppError('No active campaign found to receive incoming webhook lead', 400);
    }

    // Map custom properties
    const customProps = new Map<string, string>();
    if (payload.customProperties) {
      for (const [k, v] of Object.entries(payload.customProperties)) {
        customProps.set(k, String(v));
      }
    }

    // Auto-assign to available agent in campaign
    const assignedAgentId = await LeadAssignmentService.assignLead(campaign, customProps);

    const lead = await Lead.create({
      name: payload.name.trim(),
      phone: payload.phone.trim(),
      email: payload.email?.toLowerCase().trim(),
      campaignId: campaign._id,
      source: payload.source || 'WEBHOOK',
      stage: 'New',
      tag: payload.tag || 'COLD',
      status: 'OPEN',
      assignedTo: assignedAgentId,
      branch: null,
      customProperties: customProps,
    });

    await AuditService.log({
      req,
      action: 'WEBHOOK_LEAD_INGEST',
      resourceType: 'LEAD',
      resourceId: lead._id.toString(),
      details: {
        campaignId: campaign._id.toString(),
        campaignName: campaign.name,
        assignedTo: assignedAgentId ? assignedAgentId.toString() : null,
      },
    });

    return lead;
  }
}
