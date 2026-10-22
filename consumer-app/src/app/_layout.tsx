import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { NotificationProvider } from '@/features/notifications/NotificationProvider';

function ConsumerNavigation() {
  const { signedIn, mustChangePassword, changingPassword, restoring, restoreError } = useSession();
  const waiting = restoring || !!restoreError;
  const passwordRequired = mustChangePassword || changingPassword;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={waiting}>
        <Stack.Screen name="session-loading" />
      </Stack.Protected>
      <Stack.Protected guard={!waiting && !signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={!waiting && signedIn && passwordRequired}>
        <Stack.Screen name="change-password" />
      </Stack.Protected>
      <Stack.Protected guard={!waiting && signedIn && !passwordRequired}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="explore" />
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <NotificationProvider>
        <ConsumerNavigation />
      </NotificationProvider>
    </SessionProvider>
  );
}
