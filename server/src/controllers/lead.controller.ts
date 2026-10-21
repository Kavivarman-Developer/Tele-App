import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { parse } from 'csv-parse/sync';
import { LeadIngestService, RawLeadRow } from '../services/lead-ingest.service';
import { LeadService } from '../services/lead.service';
import { Campaign } from '../models/campaign.model';
import { ListCampaignLeadsQuery, MyLeadsQuery } from '../validations/lead.validation';
import { AppError } from '../utils/AppError';

export class LeadController {
  public static async uploadCsv(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.file) {
        throw new AppError('CSV file is required in multipart form-data (key: "file")', 400);
      }

      let parsedRecords: Array<Record<string, unknown>>;
      try {
        parsedRecords = parse(req.file.buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } catch {
        throw new AppError('Invalid CSV format. Please upload a well-formed CSV file.', 400);
      }

      if (parsedRecords.length === 0) {
        throw new AppError('The uploaded CSV file is empty', 400);
      }

      // Map rows extracting name, phone, email, agent and putting extra columns into custom properties
      const rows: RawLeadRow[] = parsedRecords.map((record) => {
        const row: RawLeadRow = {};
        for (const [key, value] of Object.entries(record)) {
          const lowerKey = key.trim().toLowerCase();
          if (lowerKey === 'name') {
            row.name = String(value);
          } else if (lowerKey === 'phone' || lowerKey === 'mobile' || lowerKey === 'contact') {
            row.phone = String(value);
          } else if (lowerKey === 'email') {
            row.email = String(value);
          } else if (
            lowerKey === 'agent' ||
            lowerKey === 'assignedto' ||
            lowerKey === 'assigned_to' ||
            lowerKey === 'agentemail' ||
            lowerKey === 'agent_email'
          ) {
            row.agent = String(value);
          } else {
            row[key.trim()] = value;
          }
        }
        return row;
      });

      const targetAgentId = req.body?.targetAgentId || undefined;
      const result = await LeadIngestService.ingest(req.params.id, rows, 'UPLOAD', targetAgentId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async createWalkInLead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      let campaignId = req.params.id;
      if (
        !campaignId ||
        campaignId === 'default' ||
        campaignId === 'default-campaign' ||
        !Types.ObjectId.isValid(campaignId)
      ) {
        const activeCamp = await Campaign.findOne({ isActive: true });
        if (activeCamp) {
          campaignId = activeCamp._id.toString();
        } else {
          const anyCamp = await Campaign.findOne();
          if (anyCamp) {
            campaignId = anyCamp._id.toString();
          } else {
            throw new AppError('No campaign found to register walk-in lead.', 400);
          }
        }
      }

      const row: RawLeadRow = {
        name: req.body.name,
        phone: req.body.phone,
        email: req.body.email,
        ...(req.body.customProperties || {}),
      };

      // If user is an AGENT, always assign the walk-in lead directly to them!
      const targetAgentId =
        req.user.role === 'AGENT'
          ? req.user._id.toString()
          : (req.body.assignedTo || undefined);

      const result = await LeadIngestService.ingest(campaignId, [row], 'WALK_IN', targetAgentId);

      if (result.failed.length > 0) {
        throw new AppError(`Lead creation failed: ${result.failed[0].reason}`, 400);
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async listCampaignLeads(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // req.query is validated and typed by listCampaignLeadsQuerySchema
      const query = req.query as unknown as ListCampaignLeadsQuery;
      const result = await LeadService.listCampaignLeads(req.user, req.params.id, query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async getMyLeads(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // req.query is validated and typed by myLeadsQuerySchema
      const query = req.query as unknown as MyLeadsQuery;
      const result = await LeadService.getMyLeads(req.user, query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async reassignLead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const lead = await LeadService.reassignLead(req.user, req.params.id, req.body.userId);
      res.status(200).json({ lead });
    } catch (error) {
      next(error);
    }
  }

  public static async bulkReassign(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      const result = await LeadService.bulkReassign(
        req.user,
        req.body.fromUserId,
        req.body.toUserId,
        req.body.campaignId,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  public static async exportCampaignLeadsCsv(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const csv = await LeadService.exportCampaignLeadsToCsv(req.user, req.params.id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="campaign-leads-${req.params.id}-${Date.now()}.csv"`,
      );
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  public static async exportMyLeadsCsv(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const query = req.query as unknown as MyLeadsQuery;
      const csv = await LeadService.exportMyLeadsToCsv(req.user, query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="my-leads-${Date.now()}.csv"`,
      );
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  public static async updateLead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }
      const { id } = req.params;
      const { name, phone, email } = req.body;
      const lead = await LeadService.updateLead(id, { name, phone, email });
      res.status(200).json({ status: 'ok', lead });
    } catch (error) {
      next(error);
    }
  }
}
