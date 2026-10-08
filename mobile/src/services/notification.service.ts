import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Lead } from '../types';

// Configure notification presentation for foreground alerts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Map of leadId -> scheduled notificationId
const scheduledNotificationMap = new Map<string, string>();

export class NotificationService {
  /**
   * Requests notification permissions from the user on app launch.
   */
  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return true;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.warn('[NotificationService] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Schedules a reminder notification 10 minutes before the scheduled followUpAt time.
   * If a notification was previously scheduled for this lead, it will be cancelled and rescheduled.
   */
  public async scheduleFollowUpReminder(
    lead: Lead,
    followUpAt: string | Date,
  ): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }

    try {
      // 1. Cancel previous notification for this lead if it exists
      await this.cancelFollowUpReminder(lead._id);

      const targetDate = new Date(followUpAt);
      if (isNaN(targetDate.getTime())) {
        return null;
      }

      const now = Date.now();
      // Reminder is 10 minutes (600,000 ms) before follow-up
      const reminderTime = targetDate.getTime() - 10 * 60 * 1000;

      // If the follow-up is already in the past, don't schedule
      if (targetDate.getTime() <= now) {
        return null;
      }

      // If 10 minutes before is in the past (e.g. follow-up is in 5 minutes), trigger in 5 seconds
      const triggerDate = reminderTime > now ? new Date(reminderTime) : new Date(now + 5000);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Follow-up Reminder',
          body: `Call with ${lead.name} (${lead.phone}) is scheduled in 10 minutes.`,
          data: { leadId: lead._id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      scheduledNotificationMap.set(lead._id, notificationId);
      return notificationId;
    } catch (error) {
      console.warn('[NotificationService] Failed to schedule reminder:', error);
      return null;
    }
  }

  /**
   * Cancels any scheduled reminder notification for the given lead (e.g. when lead is closed).
   */
  public async cancelFollowUpReminder(leadId: string): Promise<void> {
    if (Platform.OS === 'web') {
      scheduledNotificationMap.delete(leadId);
      return;
    }

    try {
      const existingNotificationId = scheduledNotificationMap.get(leadId);
      if (existingNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(existingNotificationId);
        scheduledNotificationMap.delete(leadId);
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to cancel notification:', error);
    }
  }
}

export const notificationService = new NotificationService();
