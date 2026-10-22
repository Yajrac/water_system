import { Tabs } from 'expo-router';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { colors } from '@/theme/tokens';
import { useNotifications } from '@/features/notifications/NotificationProvider';

export default function ConsumerTabs() {
  const { unread } = useNotifications();
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
    </Tabs>
  );
}