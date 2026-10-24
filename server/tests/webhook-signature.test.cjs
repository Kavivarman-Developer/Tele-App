const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { WebhookIngestService } = require('../dist/services/webhook-ingest.service');

describe('Signed Webhook HMAC SHA-256 Unit Tests', () => {
  const secret = 'test_webhook_secret_key_12345';
  const payload = JSON.stringify({
    name: 'Ramesh Kumar',
    phone: '9876543210',
    source: 'WEBSITE_CONTACT',
  });

  it('validates a genuine HMAC SHA-256 signature', () => {
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const isValid = WebhookIngestService.verifySignature(payload, validSignature, secret);
    assert.equal(isValid, true);
  });

  it('validates a genuine signature prefixed with sha256=', () => {
    const validSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const isValid = WebhookIngestService.verifySignature(payload, validSignature, secret);
    assert.equal(isValid, true);
  });

  it('rejects a forged or tampered signature', () => {
    const forgedSignature = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
    const isValid = WebhookIngestService.verifySignature(payload, forgedSignature, secret);
    assert.equal(isValid, false);
  });

  it('rejects when signature header is missing or empty', () => {
    const isValid = WebhookIngestService.verifySignature(payload, '', secret);
    assert.equal(isValid, false);
  });
});
