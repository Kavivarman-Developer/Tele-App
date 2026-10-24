const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

// Mock dependencies
const mockLeadId = new mongoose.Types.ObjectId();
const mockAdminId = new mongoose.Types.ObjectId();
const mockAgentId = new mongoose.Types.ObjectId();
const mockCampaignId = new mongoose.Types.ObjectId();

test('Tagged Leads API & RBAC Unit Tests', async (t) => {
  const { LeadService } = require('../dist/services/lead.service');
  const { TaggedLead } = require('../dist/models/tagged-lead.model');
  const { Lead } = require('../dist/models/lead.model');

  await t.test('rejects tagLeadToManager with invalid leadId format (400)', async () => {
    const requester = {
      _id: mockAgentId,
      name: 'Agent User',
      role: 'AGENT',
      branch: 'Main Branch',
    };

    await assert.rejects(
      async () => {
        await LeadService.tagLeadToManager(requester, {
          leadId: 'invalid-id-123',
          reason: 'VIP / High Value Deal',
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Invalid leadId format/);
        return true;
      }
    );
  });

  await t.test('rejects dismissTaggedLead with invalid tagId format (400)', async () => {
    const requester = {
      _id: mockAdminId,
      name: 'System Admin',
      role: 'ADMIN',
    };

    await assert.rejects(
      async () => {
        await LeadService.dismissTaggedLead(requester, 'bad-tag-id');
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /Invalid tagId format/);
        return true;
      }
    );
  });
});
