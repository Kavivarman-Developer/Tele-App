import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Lead } from '../types';

// Configure notification presentation for foreground alerts (Native only)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

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

      if (finalStatus === 'granted' && Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Telecalling Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
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
      // If the follow-up is already in the past, don't schedule
      if (targetDate.getTime() <= now) {
        return null;
      }

      // Ensure Android high-priority reminder channel is active
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Telecalling Reminders',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }

      // 1. Primary Alert: Exactly at the scheduled follow-up time!
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Callback Reminder: ${lead.name || 'Lead'}`,
          body: `Call with ${lead.name || 'Customer'} (${lead.phone || ''}) is scheduled now!`,
          data: { leadId: lead._id, phone: lead.phone, name: lead.name },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: 'reminders',
        },
      });

      scheduledNotificationMap.set(lead._id, notificationId);

      // 2. Advance Alert: 10 minutes prior (if scheduled more than 12 minutes in advance)
      const advanceTime = targetDate.getTime() - 10 * 60 * 1000;
      if (advanceTime > now + 60 * 1000) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `⏳ Upcoming Callback in 10 mins: ${lead.name || 'Lead'}`,
            body: `Reminder: Follow-up call with ${lead.name || 'Customer'} starts at ${targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            data: { leadId: lead._id, phone: lead.phone, name: lead.name },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(advanceTime),
            channelId: 'reminders',
          },
        });
      }

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

  /**
   * Fires an immediate high-priority alert notification (e.g. when an agent tags Admin or Branch Manager).
   */
  public async sendImmediateNotification(
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    try {
      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
      return notifId;
    } catch (error) {
      console.warn('[NotificationService] Failed to send immediate alert notification:', error);
      return null;
    }
  }
}

export const notificationService = new NotificationService();
