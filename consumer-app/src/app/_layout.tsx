import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import LoginScreen from '@/features/session/LoginScreen';
import { colors } from '@/theme/tokens';

function ConsumerNavigation() {
  const { signedIn } = useSession();
  if (!signedIn) return <LoginScreen />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      {[
        { name: 'index', label: 'Home', icon: 'home' },
        { name: 'bills', label: 'Bills', icon: 'bills' },
        { name: 'payments', label: 'Payments', icon: 'payments' },
        { name: 'announcements', label: 'News', icon: 'news' },
        { name: 'feedback', label: 'Feedback', icon: 'feedback' },
        { name: 'profile', label: 'Profile', icon: 'profile' },
      ].map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) => <Icon name={tab.icon as IconName} color={color} size={23} />,
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
      <ConsumerNavigation />
    </SessionProvider>
  );
}
