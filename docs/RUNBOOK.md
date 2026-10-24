# Hi Talk CRM — Production Operations Runbook (RUNBOOK.md)

## 1. System Architecture Overview
Hi Talk CRM consists of:
- **Mobile Client**: Expo 57 / React Native 0.86 Android APK with native call-log reconciliation, offline outbox queue, and dual-SIM support.
- **Backend API**: Node.js 20, Express, TypeScript, MongoDB (Mongoose 8), node-cron with distributed locks.
- **Deployment**: PM2 Cluster Mode behind Nginx / Render reverse proxy with SSL termination.

---

## 2. Environment Verification Checklist
Before starting in staging or production, ensure the following environment variables are set:
| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | HTTP port | `5000` |
| `MONGODB_URI` | MongoDB replica set connection string | `mongodb+srv://user:pass@cluster.mongodb.net/hitalk` |
| `JWT_SECRET` | 256-bit cryptographically secure secret | `<high-entropy-random-string>` |
| `JWT_EXPIRES_IN`| Token lifetime | `7d` |
| `WEBHOOK_SECRET`| Shared secret for HMAC SHA-256 webhooks | `<high-entropy-random-string>` |

---

## 3. Database Operations: Backup & Restore

### 3.1 Automated Nightly Backup
Execute via scheduled cron job on server or MongoDB Atlas automated backup:
```bash
# Dump complete database archive with gzip compression
mongodump --uri="$MONGODB_URI" --archive=/var/backups/hitalk_$(date +%Y%m%d_%H%M%S).gz --gzip
```

### 3.2 Point-in-Time Restore Procedure
> [!CAUTION]
> Restoring a database snapshot will overwrite existing records. Perform during scheduled maintenance window.

```bash
# 1. Stop PM2 application processes to halt active writes
pm2 stop hi-talk-api

# 2. Restore archive
mongorestore --uri="$MONGODB_URI" --archive=/var/backups/hitalk_YYYYMMDD_HHMMSS.gz --gzip --drop

# 3. Restart PM2 processes
pm2 start ecosystem.config.js --env production
```

---

## 4. PM2 Zero-Downtime Deployment
Deploy code updates without dropping telecaller calls or active connections:

```bash
# 1. Pull latest verified release
git pull origin main

# 2. Install dependencies & build TypeScript
cd server
npm ci
npm run build

# 3. Zero-downtime cluster reload
pm2 reload ecosystem.config.js --env production

# 4. Verify cluster health
pm2 status
pm2 logs --lines 50
```

---

## 5. Incident Response Runbooks

### Incident A: Sudden Spike in 504 Gateway Timeouts
1. Inspect MongoDB connection pool and slow queries:
   `pm2 logs hi-talk-api --err`
2. Check if large CSV ingestion is running: chunked streaming in `lead-ingest.service.ts` processes in 250-row batches to protect CPU/memory.
3. Restart cluster if memory threshold exceeded:
   `pm2 restart hi-talk-api`

### Incident B: Telecaller Claims Inbound Calls Inflated Cold-Calling Metrics
1. Confirm metrics isolation: Outbound dials (`callsMade`) and Inbound callbacks (`inboundCalls`) are strictly partitioned in `report.service.ts` and `HomeScreen.tsx`.
2. Inspect `Activity` documents: ensure `direction: 'INCOMING'` activities have not incremented `lead.attemptCount`.

### Incident C: Compromised Agent Token / Unauthorized Access
1. Immediately increment `user.tokenVersion` via Admin Console or API:
   `PATCH /api/users/:id` with `{ "isActive": false }`.
2. The user's JWT is immediately invalidated across all active sessions upon next request.
3. Deactivated agent's open leads are automatically reassigned to active agents.
