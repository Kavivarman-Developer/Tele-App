const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RetryRuleService } = require('../dist/services/retry-rule.service');

describe('Retry Delay Calculation Unit Tests', () => {
  const baseTime = new Date('2026-10-07T10:00:00.000Z');
  const agentDate = new Date('2026-10-09T15:00:00.000Z');

  const defaultBusyRule = {
    reason: 'BUSY',
    enabled: true,
    steps: [{ delayMinutes: 60 }, { delayMinutes: 1440 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('calculates step 1 delay (60 minutes) for 1st consecutive not-connected attempt', () => {
    const result = RetryRuleService.calculateRetryFollowUp(defaultBusyRule, 1, agentDate, baseTime);
    assert.ok(result !== null);

    const expected = new Date(baseTime.getTime() + 60 * 60 * 1000);
    assert.equal(result.toISOString(), expected.toISOString());
  });

  it('calculates step 2 delay (1440 minutes) for 2nd consecutive not-connected attempt', () => {
    const result = RetryRuleService.calculateRetryFollowUp(defaultBusyRule, 2, agentDate, baseTime);
    assert.ok(result !== null);

    const expected = new Date(baseTime.getTime() + 1440 * 60 * 1000);
    assert.equal(result.toISOString(), expected.toISOString());
  });

  it('leaves followUpAt as the agent chose when retry steps are exhausted (3rd attempt)', () => {
    const result = RetryRuleService.calculateRetryFollowUp(defaultBusyRule, 3, agentDate, baseTime);
    assert.ok(result !== null);
    assert.equal(result.toISOString(), agentDate.toISOString());
  });

  it('returns agent-chosen date when rule is disabled', () => {
    const disabledRule = {
      reason: 'INVALID_NUMBER',
      enabled: false,
      steps: [{ delayMinutes: 60 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = RetryRuleService.calculateRetryFollowUp(disabledRule, 1, agentDate, baseTime);
    assert.equal(result?.toISOString(), agentDate.toISOString());
  });

  it('returns null when rule is disabled and agent chose no follow-up', () => {
    const disabledRule = {
      reason: 'INVALID_NUMBER',
      enabled: false,
      steps: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = RetryRuleService.calculateRetryFollowUp(disabledRule, 1, null, baseTime);
    assert.equal(result, null);
  });

  it('handles custom multi-step rules correctly', () => {
    const customRule = {
      reason: 'DID_NOT_PICK',
      enabled: true,
      steps: [{ delayMinutes: 15 }, { delayMinutes: 30 }, { delayMinutes: 120 }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const r1 = RetryRuleService.calculateRetryFollowUp(customRule, 1, null, baseTime);
    assert.equal(r1?.toISOString(), new Date(baseTime.getTime() + 15 * 60 * 1000).toISOString());

    const r2 = RetryRuleService.calculateRetryFollowUp(customRule, 2, null, baseTime);
    assert.equal(r2?.toISOString(), new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString());

    const r3 = RetryRuleService.calculateRetryFollowUp(customRule, 3, null, baseTime);
    assert.equal(r3?.toISOString(), new Date(baseTime.getTime() + 120 * 60 * 1000).toISOString());

    const r4 = RetryRuleService.calculateRetryFollowUp(customRule, 4, agentDate, baseTime);
    assert.equal(r4?.toISOString(), agentDate.toISOString());
  });
});
