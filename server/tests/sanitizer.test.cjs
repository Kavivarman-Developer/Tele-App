const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeNoSql } = require('../dist/middleware/sanitize.middleware');

describe('NoSQL Injection Protection Unit Tests', () => {
  it('strips dangerous MongoDB $ operators from request body and query', () => {
    const req = {
      body: {
        email: 'user@example.com',
        $gt: '',
        nested: {
          $where: 'this.password.length > 0',
          validField: 'hello',
        },
      },
      query: {
        username: 'admin',
        $ne: null,
      },
      params: {
        id: '123',
      },
    };

    let nextCalled = false;
    sanitizeNoSql(req, {}, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.body.$gt, undefined);
    assert.equal(req.body.nested.$where, undefined);
    assert.equal(req.body.nested.validField, 'hello');
    assert.equal(req.body.email, 'user@example.com');
    assert.equal(req.query.$ne, undefined);
    assert.equal(req.query.username, 'admin');
  });

  it('strips keys containing dot notation from request objects', () => {
    const req = {
      body: {
        'user.role': 'ADMIN',
        normalKey: 'safe',
      },
    };

    sanitizeNoSql(req, {}, () => {});
    assert.equal(req.body['user.role'], undefined);
    assert.equal(req.body.normalKey, 'safe');
  });
});
