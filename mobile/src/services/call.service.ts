import { Linking, Platform } from 'react-native';
import { Lead, DetectedCallResult } from '../types';

export interface ICallService {
  startCall(lead: Lead): Promise<boolean>;
  openWhatsApp(phone: string, text?: string): Promise<boolean>;
  checkPermissions?(): Promise<boolean>;
  requestPermissions?(): Promise<boolean>;
  getCallResult(phone: string, callStartTime: number): Promise<DetectedCallResult>;
}

export class DeviceCallService implements ICallService {
  /**
   * Initiates a phone call to the lead's phone number using the native dialer.
   * Cleans non-digit characters for dialing compatibility.
   */
  public async startCall(lead: Lead): Promise<boolean> {
    if (!lead || !lead.phone) {
      console.warn('[CallService] Cannot start call: Missing phone number');
      return false;
    }

    const cleanNumber = lead.phone.trim();
    const telUrl = `tel:${cleanNumber}`;

    try {
      if (Platform.OS === 'web') {
        window.open(telUrl, '_self');
        return true;
      }

      await Linking.openURL(telUrl);
      return true;
    } catch (error) {
      console.warn('[CallService] Failed to open phone dialer:', error);
      return false;
    }
  }

  /**
   * Opens WhatsApp chat with the specified phone number.
   * Strips all non-digit characters and prefixes country code (default 91 for India if 10 digits).
   */
  public async openWhatsApp(phone: string, text?: string): Promise<boolean> {
    if (!phone) {
      return false;
    }

    let digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      // Default to +91 (India) if 10 digits provided
      digitsOnly = `91${digitsOnly}`;
    }

    const encodedText = text ? encodeURIComponent(text) : '';
    const waUrl = `https://wa.me/${digitsOnly}${encodedText ? `?text=${encodedText}` : ''}`;

    try {
      if (Platform.OS === 'web') {
        window.open(waUrl, '_blank');
        return true;
      }

      const canOpen = await Linking.canOpenURL(waUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(waUrl);
        return true;
      }

      await Linking.openURL(waUrl);
      return true;
    } catch (error) {
      console.warn('[CallService] Failed to open WhatsApp URL:', error);
      return false;
    }
  }

  /**
   * Default permissions check for standard/fallback platforms.
   */
  public async checkPermissions(): Promise<boolean> {
    return false;
  }

  /**
   * Default permissions request for standard/fallback platforms.
   */
  public async requestPermissions(): Promise<boolean> {
    return false;
  }

  /**
   * Calculates call result using elapsed wall-clock time when native call log is not available.
   */
  public async getCallResult(_phone: string, callStartTime: number): Promise<DetectedCallResult> {
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - callStartTime) / 1000));
    return {
      durationSeconds: elapsedSeconds,
      connected: elapsedSeconds > 0,
      matchedLog: false,
    };
  }
}

let activeCallService: ICallService | null = null;

const getActiveCallService = (): ICallService => {
  if (!activeCallService) {
    if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { androidCallService } = require('./android-call.service');
      activeCallService = androidCallService;
    } else {
      activeCallService = new DeviceCallService();
    }
  }
  return activeCallService!;
};

export const callService: ICallService = {
  startCall: (lead) => getActiveCallService().startCall(lead),
  openWhatsApp: (phone, text) => getActiveCallService().openWhatsApp(phone, text),
  checkPermissions: () => getActiveCallService().checkPermissions?.() ?? Promise.resolve(false),
  requestPermissions: () => getActiveCallService().requestPermissions?.() ?? Promise.resolve(false),
  getCallResult: (phone, start) => getActiveCallService().getCallResult(phone, start),
};
