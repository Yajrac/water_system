import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConsumerProfileProvider, useConsumerProfile } from '@/features/profile/useConsumerProfile';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { colors } from '@/theme/tokens';
import { useNotifications } from '@/features/notifications/NotificationProvider';

export default function ConsumerTabs() {
  return <ConsumerProfileProvider><ConsumerTabContent /></ConsumerProfileProvider>;
}
function ConsumerTabContent() {
  const { unread } = useNotifications();
  const { profile, reload } = useConsumerProfile();
  const insets = useSafeAreaInsets();
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#8a9ba7',
        tabBarStyle: [styles.bar, { height: 70 + insets.bottom, paddingBottom: insets.bottom + 6 }],
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      {[
        { name: 'index', label: 'Home', icon: 'home' },
        { name: 'bills', label: 'Bills', icon: 'bills' },
        { name: 'payments', label: 'Payments', icon: 'payments' },
        { name: 'announcements', label: 'Alerts', icon: 'news' },
        { name: 'feedback', label: 'Feedback', icon: 'feedback' },
        { name: 'profile', label: 'Profile', icon: 'profile' },
      ].map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.name === 'announcements' ? 'Notifications' : tab.label,
            href: ['bills','payments','feedback'].includes(tab.name) && !profile?.fullAccess ? null : undefined,
            tabBarBadge:
              tab.name === 'announcements' && unread ? (unread > 99 ? '99+' : unread) : undefined,
            tabBarBadgeStyle: styles.badge,
            // The active tab's icon sits in a soft colored pill.
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                <Icon name={tab.icon as IconName} color={color} size={23} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    boxShadow: '0 -6px 24px rgba(16, 58, 82, 0.10)',
    elevation: 0,
  },
  item: { paddingTop: 2 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  iconPill: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconPillActive: { backgroundColor: colors.tint },
  badge: { backgroundColor: '#dc2626', color: '#ffffff', fontSize: 10, fontWeight: '700' },
});
