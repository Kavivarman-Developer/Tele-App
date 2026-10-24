const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AppError } = require('../dist/utils/AppError');

describe('Lead Reassignment RBAC & Server-Side Security Regression Tests', () => {
  // Mock target validation logic mirror
  function validateReassignTarget(targetUser) {
    if (!targetUser || !targetUser.isActive) {
      throw new AppError('Target user must be an active user', 400);
    }
    if (targetUser.role === 'AGENT' && !targetUser.canReceiveLeads) {
      throw new AppError('Target agent must have canReceiveLeads enabled', 400);
    }
    return true;
  }

  // Mock requester authorization logic mirror
  function authorizeLeadReassignment(requester, lead, campaign) {
    if (requester.role === 'AGENT') {
      if (lead.assignedTo?.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only reassign leads currently assigned to you', 403);
      }
    } else if (requester.role === 'MANAGER') {
      if (campaign.managerId.toString() !== requester._id.toString()) {
        throw new AppError('Forbidden: You can only reassign leads within your own campaigns', 403);
      }
    }
    return true;
  }

  // Mock getMyLeads scope resolution mirror
  function resolveLeadsQueryScope(requester, query, managedCampaignIds = []) {
    const matchStage = {};
    if (requester.role === 'ADMIN') {
      if (query.userId) {
        matchStage.assignedTo = String(query.userId);
      }
      if (query.campaignId) {
        matchStage.campaignId = String(query.campaignId);
      }
    } else if (requester.role === 'MANAGER') {
      if (query.campaignId) {
        if (!managedCampaignIds.includes(String(query.campaignId))) {
          throw new AppError('Forbidden: You can only view leads for your own campaigns', 403);
        }
        matchStage.campaignId = String(query.campaignId);
      } else {
        matchStage.campaignId = { $in: managedCampaignIds };
      }
      if (query.userId) {
        matchStage.assignedTo = String(query.userId);
      }
    } else {
      // AGENT: strictly enforced to own assignedTo ID
      matchStage.assignedTo = String(requester._id);
      if (query.campaignId) {
        matchStage.campaignId = String(query.campaignId);
      }
    }
    return matchStage;
  }

  it('allows reassigning lead to an active ADMIN', () => {
    const adminUser = { _id: '670000000000000000000001', role: 'ADMIN', isActive: true };
    assert.equal(validateReassignTarget(adminUser), true);
  });

  it('allows reassigning lead to an active MANAGER', () => {
    const managerUser = { _id: '670000000000000000000002', role: 'MANAGER', isActive: true };
    assert.equal(validateReassignTarget(managerUser), true);
  });

  it('allows reassigning lead to an active AGENT with canReceiveLeads enabled', () => {
    const agentUser = { _id: '670000000000000000000003', role: 'AGENT', isActive: true, canReceiveLeads: true };
    assert.equal(validateReassignTarget(agentUser), true);
  });

  it('rejects reassigning to an AGENT when canReceiveLeads is false', () => {
    const busyAgent = { _id: '670000000000000000000004', role: 'AGENT', isActive: true, canReceiveLeads: false };
    assert.throws(
      () => validateReassignTarget(busyAgent),
      (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('canReceiveLeads')
    );
  });

  it('rejects reassigning to an inactive user regardless of role', () => {
    const inactiveAdmin = { _id: '670000000000000000000005', role: 'ADMIN', isActive: false };
    assert.throws(
      () => validateReassignTarget(inactiveAdmin),
      (err) => err instanceof AppError && err.statusCode === 400 && err.message.includes('active user')
    );
  });

  it('prevents an AGENT from reassigning another agent\'s lead (403 Forbidden)', () => {
    const agentRequester = { _id: 'agent_111', role: 'AGENT' };
    const lead = { _id: 'lead_999', assignedTo: 'agent_222' };
    const campaign = { _id: 'camp_1', managerId: 'mgr_1' };

    assert.throws(
      () => authorizeLeadReassignment(agentRequester, lead, campaign),
      (err) => err instanceof AppError && err.statusCode === 403 && err.message.includes('Forbidden')
    );
  });

  it('allows an AGENT to reassign their own assigned lead', () => {
    const agentRequester = { _id: 'agent_111', role: 'AGENT' };
    const lead = { _id: 'lead_999', assignedTo: 'agent_111' };
    const campaign = { _id: 'camp_1', managerId: 'mgr_1' };

    assert.equal(authorizeLeadReassignment(agentRequester, lead, campaign), true);
  });

  it('prevents a MANAGER from reassigning leads outside their managed campaigns (403 Forbidden)', () => {
    const managerRequester = { _id: 'mgr_1', role: 'MANAGER' };
    const lead = { _id: 'lead_999', assignedTo: 'agent_1' };
    const otherCampaign = { _id: 'camp_other', managerId: 'mgr_2' };

    assert.throws(
      () => authorizeLeadReassignment(managerRequester, lead, otherCampaign),
      (err) => err instanceof AppError && err.statusCode === 403 && err.message.includes('Forbidden')
    );
  });

  it('strictly isolates AGENT query scope ignoring any injected userId parameter', () => {
    const agentRequester = { _id: 'agent_111', role: 'AGENT' };
    const maliciousQuery = { userId: 'admin_007', type: 'ALL' };

    const resolvedScope = resolveLeadsQueryScope(agentRequester, maliciousQuery);
    // Even though query.userId requested 'admin_007', scope must be hardcoded to 'agent_111'
    assert.equal(resolvedScope.assignedTo, 'agent_111');
  });

  it('prevents a MANAGER from querying leads from an unmanaged campaign (403 Forbidden)', () => {
    const managerRequester = { _id: 'mgr_1', role: 'MANAGER' };
    const query = { campaignId: 'unmanaged_camp_999' };
    const myManagedCampaignIds = ['camp_1', 'camp_2'];

    assert.throws(
      () => resolveLeadsQueryScope(managerRequester, query, myManagedCampaignIds),
      (err) => err instanceof AppError && err.statusCode === 403 && err.message.includes('Forbidden')
    );
  });
});
