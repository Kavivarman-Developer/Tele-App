import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import { DeviceCallService, ICallService } from './call.service';
import { Lead, DetectedCallResult } from '../types';

interface RawCallLogEntry {
  id: string;
  phoneNumber?: string;
  duration?: number | string;
  timestamp?: string | number;
  dateTime?: string;
  type?: string;
  rawType?: number;
}

export class AndroidCallService extends DeviceCallService implements ICallService {
  /**
   * Safely acquires the native react-native-call-log module if present in the runtime.
   * Gracefully returns null on iOS, Web, or Expo Go where native module is not linked.
   */
  private getCallLogsModule(): { load: (limit: number, filter?: Record<string, unknown>) => Promise<RawCallLogEntry[]> } | null {
    if (Platform.OS !== 'android') {
      return null;
    }

    try {
      const isTurboModule = (globalThis as { __turboModuleProxy?: unknown }).__turboModuleProxy != null;
      if (!isTurboModule && !NativeModules?.CallLogs) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const callLogPkg = require('react-native-call-log');
      return callLogPkg.default || callLogPkg;
    } catch (err) {
      console.warn('[AndroidCallService] react-native-call-log is not linked or unavailable:', err);
      return null;
    }
  }

  /**
   * Checks whether the user has granted READ_CALL_LOG and READ_PHONE_STATE permissions.
   */
  public async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const hasReadCallLog = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      );
      const hasReadPhoneState = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      );

      return hasReadCallLog && hasReadPhoneState;
    } catch (error) {
      console.warn('[AndroidCallService] checkPermissions error:', error);
      return false;
    }
  }

  /**
   * Requests runtime READ_CALL_LOG and READ_PHONE_STATE permissions on Android.
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      ]);

      const callLogGranted =
        results[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] ===
        PermissionsAndroid.RESULTS.GRANTED;
      const phoneStateGranted =
        results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] ===
        PermissionsAndroid.RESULTS.GRANTED;

      return callLogGranted && phoneStateGranted;
    } catch (error) {
      console.warn('[AndroidCallService] requestPermissions error:', error);
      return false;
    }
  }

  /**
   * Normalizes a phone string into its core 10 digits for accurate matching across formats (+91, 0, spaces).
   */
  private extractCoreDigits(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  /**
   * Searches the device call log for the outbound call matching the lead's number after callStartTime.
   * If found: returns duration and connected (duration > 0).
   * If not found or permissions denied: falls back to elapsed wall-clock time.
   */
  public async getCallResult(phone: string, callStartTime: number): Promise<DetectedCallResult> {
    // 1. Non-Android platforms or missing permissions -> fallback to wall-clock calculation
    if (Platform.OS !== 'android') {
      return super.getCallResult(phone, callStartTime);
    }

    const hasPermission = await this.checkPermissions();
    if (!hasPermission) {
      console.log('[AndroidCallService] Permissions not granted. Falling back to elapsed wall-clock time.');
      return super.getCallResult(phone, callStartTime);
    }

    const CallLogsModule = this.getCallLogsModule();
    if (!CallLogsModule) {
      console.log('[AndroidCallService] Native CallLogs module not linked. Falling back to elapsed wall-clock time.');
      return super.getCallResult(phone, callStartTime);
    }

    const targetDigits = this.extractCoreDigits(phone);
    if (!targetDigits) {
      return super.getCallResult(phone, callStartTime);
    }

    // Helper to query and match logs
    const findMatchingLog = async (): Promise<RawCallLogEntry | null> => {
      try {
        // Query the latest 20 call entries
        const logs = await CallLogsModule.load(20);
        if (!Array.isArray(logs) || logs.length === 0) {
          return null;
        }

        // Look for outbound call to this phone number made near or after callStartTime
        // Allow a 30s window before callStartTime to account for minor clock discrepancies
        const minTimestamp = callStartTime - 30000;

        for (const log of logs) {
          const logDigits = this.extractCoreDigits(log.phoneNumber || '');
          const isPhoneMatch =
            logDigits.length >= 7 &&
            (logDigits === targetDigits ||
              targetDigits.endsWith(logDigits) ||
              logDigits.endsWith(targetDigits));

          const rawType = typeof log.rawType === 'number' ? log.rawType : -1;
          const typeStr = (log.type || '').toUpperCase();
          // Outgoing call in Android is type 2 or 'OUTGOING'
          const isOutgoing = rawType === 2 || typeStr.includes('OUT');

          const timestamp = typeof log.timestamp === 'number'
            ? log.timestamp
            : parseInt(String(log.timestamp || '0'), 10);

          const isRecent = !isNaN(timestamp) && timestamp > 0 ? timestamp >= minTimestamp : true;

          if (isPhoneMatch && isOutgoing && isRecent) {
            return log;
          }
        }

        return null;
      } catch (err) {
        console.warn('[AndroidCallService] Query call logs error:', err);
        return null;
      }
    };

    // First attempt to match call log
    let matchedLog = await findMatchingLog();

    // If not found immediately, wait 600ms and retry once (Android OS often delays writing call log)
    if (!matchedLog) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      matchedLog = await findMatchingLog();
    }

    if (matchedLog) {
      const rawDuration = matchedLog.duration;
      const durationSeconds = typeof rawDuration === 'number'
        ? rawDuration
        : parseInt(String(rawDuration || '0'), 10);

      const isConnected = durationSeconds > 0;

      console.log(
        `[AndroidCallService] Matched call log for ${phone}: duration=${durationSeconds}s, connected=${isConnected}`,
      );

      return {
        durationSeconds: Math.max(0, durationSeconds),
        connected: isConnected,
        rawType: matchedLog.type || String(matchedLog.rawType),
        matchedLog: true,
      };
    }

    // Fallback if log was not found or call didn't register in call log provider
    console.log('[AndroidCallService] No matching call log found. Falling back to elapsed wall-clock time.');
    return super.getCallResult(phone, callStartTime);
  }
}

export const androidCallService = new AndroidCallService();
