import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
import { useNotifications } from './NotificationProvider';

// Must match the server (push.service.js) and the sound listed in app.json.
const CHANNEL = 'pwss-alerts';

// Show, ring and badge notifications even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getPushToken() {
  // Remote push needs a real phone and the installed app (APK); Expo Go cannot receive it.
  if (Platform.OS !== 'android' || !Device.isDevice) return null;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  // Android plays the channel's sound; channels cannot be changed once created.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'PWSS alerts',
    description: 'Bills, payments and announcements from PWSS',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'ting.wav',
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#087fa3',
  });
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

function openAlerts() {
  router.push('/announcements');
}

export function PushRegistration() {
  const { signedIn, accessToken, mustChangePassword } = useSession();
  const { refresh } = useNotifications();
  const token = useRef(accessToken);
  useEffect(() => {
    token.current = accessToken;
  }, [accessToken]);
  const ready = signedIn && !mustChangePassword;

  // Register this phone once per sign-in.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const pushToken = await getPushToken();
        if (pushToken && !cancelled && token.current)
          await consumerRequest('/notifications/devices', { token: pushToken }, token.current);
      } catch {
        // Push is optional; the Alerts tab still refreshes on its own.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  // A push arriving while the app is open refreshes the Alerts list and badge.
  useEffect(() => {
    if (!ready) return;
    const received = Notifications.addNotificationReceivedListener(() => void refresh());
    // Tapping a notification opens the Alerts tab.
    const tapped = Notifications.addNotificationResponseReceivedListener(() => {
      void refresh();
      openAlerts();
    });
    // The app was opened by tapping a notification while it was closed.
    if (Notifications.getLastNotificationResponse()) {
      Notifications.clearLastNotificationResponse();
      openAlerts();
    }
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [ready, refresh]);

  return null;
}
