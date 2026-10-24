# Hi Talk CRM — Automated Test & Coverage Report (TEST_REPORT.md)

## 1. Test Suite Execution Summary
- **Execution Date**: 2026-10-24
- **Runtime**: Node.js 20 Built-in Test Runner (`node --test`)
- **Total Test Suites**: 4
- **Total Unit & Integration Tests**: 15
- **Passing**: 15 / 15 (100%)
- **Failing**: 0
- **Duration**: ~552 ms

---

## 2. Granular Test Results

### 2.1 Calling Hours & Regulatory Compliance (`tests/calling-hours.test.cjs`)
| Test Case | Description | Result |
| :--- | :--- | :--- |
| `in-window-timestamp` | Preserves valid business hours (09:00 - 20:00 IST) without shifting | **PASS** |
| `late-evening-rollover`| Rolls over post-20:00 attempts to 09:30 AM next morning | **PASS** |
| `early-morning-rollover`| Shifts pre-09:00 attempts to 09:30 AM same morning | **PASS** |

### 2.2 Retry Engine & Step Progression (`tests/retry-calculator.test.cjs`)
| Test Case | Description | Result |
| :--- | :--- | :--- |
| `step-1-60m` | Correct 60m delay for 1st consecutive not-connected attempt | **PASS** |
| `step-2-1440m` | Correct 1440m (24h) delay for 2nd consecutive attempt | **PASS** |
| `steps-exhausted` | Reverts to agent manual choice when defined rule steps exhausted | **PASS** |
| `disabled-rule` | Preserves agent date when rule is disabled | **PASS** |
| `disabled-null` | Returns null when rule is disabled and no manual follow-up set | **PASS** |
| `multi-step-custom` | Evaluates arbitrary custom delays (15m, 30m, 120m) accurately | **PASS** |

### 2.3 NoSQL Injection Sanitization (`tests/sanitizer.test.cjs`)
| Test Case | Description | Result |
| :--- | :--- | :--- |
| `strip-dollar-keys` | Strips MongoDB query operator keys (`$gt`, `$ne`, `$where`) | **PASS** |
| `strip-dot-keys` | Strips dot-notation object paths preventing unauthorized document traversal | **PASS** |

### 2.4 Cryptographic Webhook Signatures (`tests/webhook-signature.test.cjs`)
| Test Case | Description | Result |
| :--- | :--- | :--- |
| `valid-hmac-sha256` | Verifies genuine raw HMAC SHA-256 hex signatures | **PASS** |
| `prefixed-sha256` | Verifies signatures with `sha256=` header prefix | **PASS** |
| `reject-forged` | Blocks forged or tampered signatures with 401 | **PASS** |
| `reject-missing` | Rejects payloads missing signature header in production mode | **PASS** |

---

## 3. Client & Server Static Quality Diagnostics
- **Server Typecheck (`npx tsc --noEmit`)**: 0 errors.
- **Server Linter (`npm run lint`)**: 0 warnings, 0 errors.
- **Mobile Typecheck (`npx -p typescript tsc --noEmit`)**: 0 errors.
- **Expo Diagnostics (`npx expo-doctor`)**: All critical checks passed.
