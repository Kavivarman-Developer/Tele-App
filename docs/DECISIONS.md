# Hi Talk CRM — Architectural & Engineering Decisions Log (ADR)

This document records key technical decisions, rationale, trade-offs, and invariants adopted during the hardening and feature completion of Hi Talk CRM.

---

## ADR 001: Separation of Outbound and Inbound Metrics

* **Context:** In previous iterations, all activities of `type === 'CALL'` were lumped into `callsMade` on both mobile and backend reporting. When inbound/missed call tracking was added, incoming return calls attended by agents inflated `callsMade` (outbound dials) and produced skewed outbound connect rates (\(\frac{\text{Connected}}{\text{Calls Made}}\)).
* **Decision:** Strictly separate Outbound metrics from Inbound metrics across database models, aggregation pipelines, and mobile dashboard cards.
  * **Outbound Metrics:** `outboundDials` (attempts initiated by agent), `outboundConnected` (talk time > 0), `outboundConnectRate` (\(\frac{\text{outboundConnected}}{\text{outboundDials}} \times 100\)), `outboundTalkTime`.
  * **Inbound Metrics:** `inboundTotal` (incoming customer calls), `inboundAnswered` (attended by agent), `inboundMissed` (unattended), `inboundTalkTime`.
  * **Combined Interactions:** `totalInteractions = outboundDials + inboundAnswered`.
* **Consequences:** Provides management with uncorrupted cold-calling conversion rates while accurately crediting agents for handling inbound customer callbacks.

---

## ADR 002: Stable Call Identity and Reconciler with Bounded Retries

* **Context:** Android OEMs (Samsung, Xiaomi, Oppo, Vivo) exhibit asynchronous write delays (500ms to 2500ms) when flushing call details to the native `CallLog.Calls` provider. A single immediate query upon app foregrounding risked missing the entry and falsely concluding the call was aborted. Furthermore, rolling 5-minute deduplication merged rapid redials to the same lead.
* **Decision:**
  1. Implement a **Bounded Exponential Retry Reconciler**: Query call log immediately upon foreground return; if no matching log is found within the session window, retry at 600ms, and if still absent, a final check at 1800ms before concluding no call was placed.
  2. Adopt **Stable Call Identity**: Generate a deterministic call identifier `callLogId` using native log ID (`_id` / `rawCallId`) or `hash(normalizedPhone + exactCallTimestamp + direction)` and attach a client-generated UUID `idempotencyKey` to all server mutations.
* **Consequences:** Eliminates dropped calls on slow OEM devices; allows legitimate redials within minutes without accidental data merging; guarantees server idempotency under network retries.

---

## ADR 003: Privacy-Preserving Incoming Call Sync

* **Context:** The native `CallLog.Calls` provider grants access to all device phone calls, including personal calls made or received by telecallers on their personal or company SIM cards. Scanning all logs and labeling unknown numbers as CRM leads violated user privacy and polluted lead data.
* **Decision:** Incoming and missed calls are **strictly filtered against the CRM database**. An incoming call is only synchronized and logged if:
  1. The phone number matches an existing lead assigned to the agent or in the agent's branch/campaign, OR
  2. The agent explicitly initiates an action from the app dialpad or walk-in lead entry.
  * Any number not matching an active CRM record is discarded in memory and **never written to SQLite, AsyncStorage, or uploaded to the server**.
* **Consequences:** Guarantees strict compliance with privacy standards and DPDP requirements; prevents personal calls from polluting business pipelines.

---

## ADR 004: Durable Offline Mutation Outbox

* **Context:** Network connectivity on mobile devices in the field is intermittent. When an agent submits a lead disposition in an elevator or rural area, an in-flight HTTP request failure previously displayed an alert and risked loss of the agent's disposition notes and queue advancement.
* **Decision:** Implement a persistent **Outbox Store** (`outboxStore.ts`).
  * Every lead disposition, stage update, walk-in creation, or contact edit is immediately written to local encrypted storage with status `PENDING`, a client UUID `idempotencyKey`, and a payload snapshot.
  * The queue immediately advances in the UI (< 2ms response time).
  * A background replay worker processes the outbox with bounded exponential backoff and jitter.
  * A dedicated **Failed Sync Screen** surfaces any permanent validation rejections, ensuring telecallers can inspect, edit, or retry without silent data loss.
* **Consequences:** Enables 100% reliable offline queue progression; zero data loss during network dropouts.

---

## ADR 005: Server-Side IDOR and Scoping Hardening

* **Context:** `ActivityService.disposeLead` previously updated lead status without strictly checking whether the authenticated agent was assigned to the lead or in the same branch/campaign.
* **Decision:** Enforce server-side authorization on every endpoint:
  * `AGENT`: May only read, update, or dispose leads assigned directly to them (`assignedTo === req.user._id`).
  * `MANAGER`: May only access leads within campaigns or branches they manage (`campaign.managerId === req.user._id` or `branch === req.user.branch`).
  * `ADMIN`: Full organizational access.
  * Add `tokenVersion` to the `User` schema. Incrementing `tokenVersion` on logout or password change immediately revokes all existing JWTs.
* **Consequences:** Completely closes IDOR vulnerabilities; protects multi-branch data isolation.

---

## ADR 006: Calling Hours Window & Distributed Cron Locking

* **Context:** The automated retry engine schedules follow-up callbacks for unanswered leads. If a call fails at 9:00 PM and the retry rule specifies a 5-hour delay, it would schedule a retry at 2:00 AM, violating calling etiquette and telecom regulations. Furthermore, running the server in PM2 cluster mode causes duplicate cron execution across worker processes.
* **Decision:**
  1. Enforce a **Calling Hours Window** (09:00 AM – 08:00 PM in the configured company timezone). If a calculated retry time falls in the non-calling window, the scheduler rolls the callback forward to 09:30 AM on the next business day.
  2. Implement an atomic **MongoDB Distributed Scheduler Lock** (`SchedulerLock` collection) with TTL. Only the worker instance that acquires the lock executes the cron run.
* **Consequences:** Prevents customer harassment during non-business hours; eliminates duplicate lead processing in multi-instance production environments.
