import { ActivityIndicator, Text } from 'react-native';
import { Button, Screen, text } from '@/components/consumer/ui';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import LoginScreen from '@/features/session/LoginScreen';
import ChangePasswordScreen from '@/features/session/ChangePasswordScreen';
import { colors } from '@/theme/tokens';
import {
  NotificationProvider,
  useNotifications,
} from '@/features/notifications/NotificationProvider';

function ConsumerNavigation() {
  const { unread } = useNotifications();
  const { signedIn, mustChangePassword, changingPassword, restoring, restoreError, retryRestore, signOut } = useSession();
  if (restoring || restoreError) return <Screen title="My water account">
    {restoring ? <ActivityIndicator color={colors.primary} /> : <>
      <Text style={text.muted}>{restoreError}</Text>
      <Button label="Retry connection" onPress={retryRestore} />
      <Button label="Use another account" secondary onPress={signOut} />
    </>}
  </Screen>;
  if (!signedIn) return <LoginScreen />;
  if (mustChangePassword || changingPassword) return <ChangePasswordScreen />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 64 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 5, paddingBottom: 4 },
      }}
    >
      {[
        { name: 'index', label: 'Home', icon: 'home' },
        { name: 'bills', label: 'Bills', icon: 'bills' },
        { name: 'payments', label: 'Payments', icon: 'payments' },
        { name: 'announcements', label: 'Notifications', icon: 'news' },
        { name: 'feedback', label: 'Feedback', icon: 'feedback' },
        { name: 'profile', label: 'Profile', icon: 'profile' },
      ].map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarBadge:
              tab.name === 'announcements' && unread ? (unread > 99 ? '99+' : unread) : undefined,
            tabBarBadgeStyle: { backgroundColor: '#dc2626', color: '#ffffff' },
            tabBarIcon: ({ color }) => <Icon name={tab.icon as IconName} color={color} size={27} />,
          }}
        />
      ))}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
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
