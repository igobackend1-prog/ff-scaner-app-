// @ts-nocheck
/**
 * EOD Wastage Alarm Utilities
 *
 * Push notifications require a DEVELOPMENT BUILD — they do NOT work in Expo Go
 * (removed since SDK 53). This file detects Expo Go and skips notification
 * setup silently. The in-app red banner works in both Expo Go and prod builds.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// ── Detect if running inside Expo Go ─────────────────────────
const isExpoGo = Constants.appOwnership === 'expo';

// ── Lazy-load expo-notifications only in non-Expo-Go builds ──
let Notifications: any = null;

function getNotifications() {
  if (isExpoGo) return null;
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch (e) {
      console.warn('[EOD Alarm] expo-notifications not available:', e);
    }
  }
  return Notifications;
}

/**
 * Call once on app startup (App.tsx useEffect).
 * In Expo Go → silently skips push setup (in-app banner still works).
 * In dev/prod build → schedules daily 19:30 notification.
 */
export async function setupEODAlarm(): Promise<void> {
  if (isExpoGo) {
    console.log('[EOD Alarm] Expo Go detected — push notifications skipped. In-app banner is active.');
    return;
  }

  const N = getNotifications();
  if (!N) return;

  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('eod-wastage', {
        name: 'EOD Wastage Reminder',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
        sound: 'default',
      });
    }

    const { status } = await N.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('[EOD Alarm] Notification permission not granted');
      return;
    }

    // Cancel existing EOD notifications to avoid duplicates
    const scheduled = await N.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.content?.data?.type === 'eod_wastage') {
        await N.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    // Schedule daily 19:30
    await N.scheduleNotificationAsync({
      content: {
        title: '🚨 EOD Wastage Entry Due',
        body: "Don't forget to submit today's wastage report before closing!",
        sound: 'default',
        data: { type: 'eod_wastage' },
        ...(Platform.OS === 'android' ? { channelId: 'eod-wastage' } : {}),
      },
      trigger: { hour: 19, minute: 30, repeats: true },
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
 * Returns true if at least one wastage entry exists today for this hub.
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
 * Works in BOTH Expo Go and production builds.
 */
export async function shouldShowEODBanner(hubId: string): Promise<boolean> {
  if (!isAfterEODTime()) return false;
  const submitted = await isTodayWastageSubmitted(hubId);
  return !submitted;
}
