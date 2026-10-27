const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { reportExportQuerySchema } = require('../dist/validations/report.validation');

describe('Report Export Schema & Validation Unit Tests', () => {
  it('accepts valid report export types (dashboard, user-calls, call-logs, dispositions, follow-ups)', () => {
    const validTypes = [
      'dashboard',
      'user-calls',
      'call-logs',
      'dispositions',
      'follow-ups',
      'campaign-stages',
      'campaign-leads',
    ];

    for (const type of validTypes) {
      const parsed = reportExportQuerySchema.safeParse({
        query: {
          type,
          format: 'csv',
        },
      });
      assert.equal(parsed.success, true, `Expected ${type} to be valid`);
      if (parsed.success) {
        assert.equal(parsed.data.query.type, type);
        assert.equal(parsed.data.query.format, 'csv');
      }
    }
  });

  it('accepts optional date range and branch scope parameters', () => {
    const parsed = reportExportQuerySchema.safeParse({
      query: {
        type: 'user-calls',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-27T23:59:59.999Z',
        branch: 'Trichy',
      },
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.query.branch, 'Trichy');
      assert.equal(parsed.data.query.type, 'user-calls');
    }
  });

  it('rejects unsupported report export types with a validation error', () => {
    const parsed = reportExportQuerySchema.safeParse({
      query: {
        type: 'unsupported-report-type',
      },
    });

    assert.equal(parsed.success, false);
  });
});
