import { Platform } from 'react-native';
import { callService } from './call.service';
import { useLeadHistoryStore, normalizePhone } from '../store/leadHistoryStore';
import { useAuthStore } from '../store/authStore';
import { formatDisplayPhone } from '../utils/phoneUtils';

export class IncomingCallSyncService {
  private isSyncing = false;
  private lastSyncTimestamp = 0;

  /**
   * Scans Android native CallLog for incoming answered and missed calls from leads/customers.
   * Auto-logs them into useLeadHistoryStore with direction='INCOMING', accurate duration & status.
   */
  public async syncIncomingCalls(limit: number = 35): Promise<number> {
    if (Platform.OS !== 'android') {
      return 0;
    }

    // Debounce to at most once every 3 seconds
    const now = Date.now();
    if (this.isSyncing || now - this.lastSyncTimestamp < 3000) {
      return 0;
    }

    const hasPermission = await callService.checkPermissions();
    if (!hasPermission) {
      return 0;
    }

    this.isSyncing = true;
    this.lastSyncTimestamp = now;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const callLogPkg = require('react-native-call-log');
      const CallLogs = callLogPkg.default || callLogPkg;
      if (!CallLogs || typeof CallLogs.load !== 'function') {
        return 0;
      }

      const logs: any[] = await CallLogs.load(limit);
      if (!Array.isArray(logs) || logs.length === 0) {
        return 0;
      }

      const user = useAuthStore.getState().user;
      const existingActivities = useLeadHistoryStore.getState().getAllActivities();
      // Scan logs within the last 48 hours
      const cutoffTime = Date.now() - 48 * 60 * 60 * 1000;
      let addedCount = 0;

      for (const log of logs) {
        const rawPhone = (log.phoneNumber || '').trim();
        const normPhone = normalizePhone(rawPhone);
        if (!normPhone || normPhone.length < 7) continue;

        const timestamp =
          typeof log.timestamp === 'number'
            ? log.timestamp
            : parseInt(String(log.timestamp || '0'), 10);

        if (!timestamp || isNaN(timestamp) || timestamp < cutoffTime) continue;

        const rawType = typeof log.rawType === 'number' ? log.rawType : -1;
        const typeStr = (log.type || '').toUpperCase();

        // Android CallLog types:
        // 1 = INCOMING (answered)
        // 3 = MISSED (unanswered incoming)
        // 5 = REJECTED (declined incoming)
        const isIncomingAnswered =
          rawType === 1 ||
          (typeStr.includes('INC') && !typeStr.includes('MISSED') && !typeStr.includes('REJECT'));
        const isMissed =
          rawType === 3 || rawType === 5 || typeStr.includes('MISSED') || typeStr.includes('REJECT');

        if (!isIncomingAnswered && !isMissed) continue;

        // Deduplication: check if this incoming call event was already recorded
        const alreadyExists = existingActivities.some((act) => {
          if (normalizePhone(act.phone) !== normPhone) return false;
          const actTime = new Date(act.createdAt).getTime();
          // Within 2.5 minutes of the call log timestamp
          return Math.abs(actTime - timestamp) < 150000;
        });

        if (alreadyExists) continue;

        const rawDuration =
          typeof log.duration === 'number'
            ? log.duration
            : parseInt(String(log.duration || '0'), 10);
        const durationSeconds = isIncomingAnswered ? Math.max(0, rawDuration) : 0;
        const isConnected = isIncomingAnswered && durationSeconds > 0;

        const stage = isMissed
          ? 'Missed Call'
          : isConnected
          ? 'Connected'
          : 'Not Connected';

        const tag = isMissed ? 'Warm' : isConnected ? 'Hot' : 'Cold';

        const durationMins = Math.floor(durationSeconds / 60);
        const durationSecs = durationSeconds % 60;
        const durationText =
          durationMins > 0 ? `${durationMins}m ${durationSecs}s` : `${durationSecs}s`;

        const remark = isMissed
          ? rawType === 5
            ? 'Incoming call declined by agent'
            : 'Customer missed call'
          : `Incoming call answered (${durationText})`;

        // Match existing lead name if known
        const leadMatch = existingActivities.find(
          (a) =>
            a.phone &&
            normalizePhone(a.phone) === normPhone &&
            a.customerName &&
            !a.customerName.startsWith('Customer ('),
        );

        const customerName = leadMatch?.customerName || `Customer (${formatDisplayPhone(rawPhone)})`;
        const leadId = leadMatch?.leadId || `lead-${normPhone}`;

        useLeadHistoryStore.getState().addActivity(leadId, {
          phone: rawPhone,
          customerName,
          agentName: user?.name,
          agentId: user?._id,
          branch: user?.branch,
          connected: isConnected,
          type: 'CALL',
          direction: 'INCOMING',
          stage,
          tag,
          durationSeconds,
          remark,
          createdAt: new Date(timestamp).toISOString(),
        });

        addedCount++;
      }

      if (addedCount > 0) {
        console.log(`[IncomingCallSyncService] Synced ${addedCount} new incoming/missed calls`);
      }

      return addedCount;
    } catch (err) {
      console.warn('[IncomingCallSyncService] Error syncing incoming calls:', err);
      return 0;
    } finally {
      this.isSyncing = false;
    }
  }
}

export const incomingCallSyncService = new IncomingCallSyncService();
