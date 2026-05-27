// @ts-nocheck
/**
 * EOD Wastage Alarm Utilities
 * Schedules a daily 19:30 push notification and checks in-app banner state.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Set how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Call once on app startup (in App.tsx useEffect).
 * Requests permission and schedules daily 19:30 alarm.
 */
export async function setupEODAlarm(): Promise<void> {
  try {
    // Android: set up notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('eod-wastage', {
        name: 'EOD Wastage Reminder',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
        sound: 'default',
      });
    }

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('[EOD Alarm] Notification permission not granted');
      return;
    }

    // Cancel any previously scheduled EOD notifications to avoid duplicates
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content.data?.type === 'eod_wastage') {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    // Schedule daily at 19:30
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 EOD Wastage Entry Due',
        body: "Don't forget to submit today's wastage report before closing!",
        sound: 'default',
        data: { type: 'eod_wastage' },
        ...(Platform.OS === 'android' ? { channelId: 'eod-wastage' } : {}),
      },
      trigger: {
        hour: 19,
        minute: 30,
        repeats: true,
      },
    });

    console.log('[EOD Alarm] Daily 19:30 alarm scheduled ✅');
  } catch (e) {
    console.warn('[EOD Alarm] Setup failed:', e);
  }
}

/**
 * Returns true if current time is past 19:30.
 */
export function isAfterEODTime(): boolean {
  const now = new Date();
  return now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30);
}

/**
 * Returns true if at least one wastage entry was submitted today for this hub.
 */
export async function isTodayWastageSubmitted(hubId: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await supabase
      .from('wastage_entries')
      .select('*', { count: 'exact', head: true })
      .eq('hub_id', hubId)
      .eq('entry_date', today);
    return (count ?? 0) > 0;
  } catch {
    return true; // Don't nag on error
  }
}

/**
 * Returns true if the in-app EOD banner should be shown.
 * Condition: after 19:30 AND no wastage entry submitted today.
 */
export async function shouldShowEODBanner(hubId: string): Promise<boolean> {
  if (!isAfterEODTime()) return false;
  const submitted = await isTodayWastageSubmitted(hubId);
  return !submitted;
}
