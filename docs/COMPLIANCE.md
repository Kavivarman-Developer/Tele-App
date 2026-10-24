# Hi Talk CRM — Compliance, Calling Hours & Privacy Architecture (COMPLIANCE.md)

## 1. Regulatory Framework & Standards
Hi Talk CRM is architected to comply with national and international telecalling regulations, including:
- **TRAI (Telecom Regulatory Authority of India)** UCC (Unsolicited Commercial Communication) regulations.
- **National Do Not Call (NDNC / DND) Registry**.
- **Data Protection & PII Privacy**: Strict separation of personal device call logs from enterprise CRM activities.

---

## 2. Calling Hours Enforcement (P9)
1. **Mandatory Calling Window**:
   - Outbound telecalling and automated retry schedules are strictly restricted to **09:00 AM to 08:00 PM (20:00)** local time (default: Indian Standard Time UTC+5:30).
2. **Rollover Algorithm (`RetryRuleService.adjustForCallingHours`)**:
   - If an agent follow-up or retry algorithm schedules a contact attempt after 20:00 or before 09:00, the timestamp is automatically shifted to **09:30 AM the next morning**.
   - Ensures no customer receives automated callback notifications or calls during night/rest hours.

---

## 3. Suppression & DND Management
1. **Immediate Lead Closure**:
   - When a call disposition or activity is logged with reasons:
     - `INVALID_NUMBER`
     - `NUMBER_NOT_IN_USE`
     - `INCOMING_NOT_AVAILABLE`
     - Or stages `NOT INTERESTED`, `LOST`, `DND`, `DO NOT CALL`
   - The system immediately transitions the lead to `status: 'CLOSED'` and sets `nextFollowUpAt: null`.
2. **Exclusion from Dialer Queues**:
   - Suppressed and closed leads are filtered out of all telecaller queue selectors (`homeMyLeadsQueue`, `listCampaignLeads`), preventing accidental redialing.

---

## 4. Personal Call Privacy & Whitelist Filtering (P3.3 & ADR 003)
1. **The Telecaller Privacy Guarantee**:
   - Telecallers use personal or company-issued Android phones that often receive personal calls from family, friends, and private contacts.
2. **Zero-PII-Leak Whitelist Filter**:
   - Native incoming call-log synchronizer (`incomingCallSync.service.ts`) strictly cross-references caller phone numbers against the active CRM lead database.
   - Any phone number not matching an existing customer lead is **immediately discarded in memory**.
   - Personal phone numbers, talk durations, timestamps, and contact names are **NEVER saved to device storage, NEVER logged, and NEVER uploaded to the server**.
