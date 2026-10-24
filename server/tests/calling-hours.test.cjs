const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { RetryRuleService } = require('../dist/services/retry-rule.service');

describe('Calling Hours & Regulatory Compliance Unit Tests', () => {
  it('preserves timestamps that fall within legal 09:00 - 20:00 IST calling hours', () => {
    // 14:00 IST is 08:30 UTC
    const inWindow = new Date('2026-10-15T08:30:00.000Z');
    const adjusted = RetryRuleService.adjustForCallingHours(inWindow);
    assert.equal(adjusted.toISOString(), inWindow.toISOString());
  });

  it('rolls over late evening follow-ups (after 20:00 IST) to 09:30 AM next morning', () => {
    // 21:00 IST is 15:30 UTC on Oct 15
    const lateNight = new Date('2026-10-15T15:30:00.000Z');
    const adjusted = RetryRuleService.adjustForCallingHours(lateNight);

    // Expected: Oct 16, 09:30 AM IST = Oct 16, 04:00 AM UTC
    const expected = new Date('2026-10-16T04:00:00.000Z');
    assert.equal(adjusted.toISOString(), expected.toISOString());
  });

  it('rolls over early morning follow-ups (before 09:00 IST) to 09:30 AM same morning', () => {
    // 06:00 IST is 00:30 UTC on Oct 15
    const earlyMorning = new Date('2026-10-15T00:30:00.000Z');
    const adjusted = RetryRuleService.adjustForCallingHours(earlyMorning);

    // Expected: Oct 15, 09:30 AM IST = Oct 15, 04:00 AM UTC
    const expected = new Date('2026-10-15T04:00:00.000Z');
    assert.equal(adjusted.toISOString(), expected.toISOString());
  });
});
