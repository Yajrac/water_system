import { useConsumerProfile } from '../profile/useConsumerProfile';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useNotifications, type ConsumerNotice } from '../notifications/NotificationProvider';
import { useConsumerFinances } from '../bills/useConsumerFinances';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { Badge, Button, Card, CardTitle, Screen, Sheet, text } from '@/components/consumer/ui';
import { colors, money } from '@/theme/tokens';
import { styles } from './home.styles';

export default function HomeScreen() {
  const { profile: customer, error: profileError, reload: reloadProfile } = useConsumerProfile();
  const { data, error, busy, reload } = useConsumerFinances();
  const { items: notices, error: noticeError, busy: noticesBusy, refresh: refreshNotices, markRead } = useNotifications();
  const [selectedNotice, setSelectedNotice] = useState<ConsumerNotice | null>(null);
  const [readError, setReadError] = useState('');
  const latestNotices = notices.slice(0, 2);
  async function viewNotice(item: ConsumerNotice) {
    setSelectedNotice(item);
    setReadError('');
    if (!item.read) {
      try { await markRead([item.id]); }
      catch { setReadError('Could not save read status. Please try again.'); }
    }
  }
  useFocusEffect(useCallback(() => { void refreshNotices(); }, [refreshNotices]));
  const latest = data?.latestBill;
  const balance = Number(data?.summary.balance || 0);
  const usage = latest?.consumption || '0';
  const quickLinks: {
    label: string;
    icon: IconName;
    route: '/bills' | '/payments';
  }[] = [
    { label: 'My bills', icon: 'bills', route: '/bills' },
    { label: 'Payments', icon: 'payments', route: '/payments' },
  ];
  if (!data)
    return (
      <Screen title="Home">
        {busy ? (
          <View accessible accessibilityLabel="Loading your account" accessibilityState={{ busy: true }} style={styles.skeletonLayout}>
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.skeletonLayout}>
              <View style={styles.welcome}>
                <View style={styles.skeletonWelcome}>
                  <View style={[styles.skeletonLine, styles.skeletonShort]} />
                  <View style={styles.skeletonLine} />
                  <View style={[styles.skeletonLine, styles.skeletonShort]} />
                </View>
                <View style={styles.skeletonAvatar} />
              </View>
              <View style={styles.skeletonBalance}>
                <View style={[styles.skeletonLine, styles.skeletonShort]} />
                <View style={styles.skeletonAmount} />
                <View style={styles.skeletonLine} />
              </View>
              <View style={styles.quickLinks}>
                <View style={styles.skeletonQuickLink} />
                <View style={styles.skeletonQuickLink} />
              </View>
              {[0, 1].map(item => (
                <Card key={item}>
                  <View style={[styles.skeletonLine, styles.skeletonShort]} />
                  <View style={styles.skeletonAmount} />
                  <View style={styles.skeletonLine} />
                  <View style={styles.skeletonLine} />
                </Card>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Text accessibilityRole="alert" style={text.muted}>
              {error || 'Account records are unavailable.'}
            </Text>
            <Button label="Retry" onPress={() => void reload()} />
          </>
        )}
      </Screen>
    );
  return (
    <Screen title="Home">
      <View style={styles.refreshRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh account"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          style={styles.refreshButton}
          onPress={() => {
            void reload();
            void reloadProfile();
            void refreshNotices();
          }}
        >
          {busy && <ActivityIndicator size="small" color={colors.primary} />}
          <Text style={styles.refreshText}>{busy ? 'Refreshing...' : 'Refresh'}</Text>
        </Pressable>
      </View>
      {!!error && <Text accessibilityRole="alert" style={text.muted}>{error}</Text>}
      {!!profileError && <Text style={text.muted}>{profileError}</Text>}
      <View style={styles.welcome}>
        <View style={{ flex: 1 }}>
          <Text style={text.muted}>
            Welcome back{customer?.firstName ? ', ' + customer.firstName : ''}
          </Text>
          <Text style={styles.welcomeTitle}>Your water service</Text>
          <Text style={text.muted}>{customer?.account || ''}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View my profile"
          onPress={() => router.push('/profile')}
        >
          <Avatar active={customer?.status === 'Active'} />
        </Pressable>
      </View>
      <View style={styles.balanceCard}>
        <View style={styles.row}>
          <View>
            <Text style={styles.lightLabel}>REMAINING BALANCE</Text>
            <Text style={styles.balance}>{money(balance)}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="water" color="#ffffff" size={36} />
          </View>
        </View>
        <Text style={styles.due}>Total unpaid balance across all bills.</Text>
      </View>
      <View style={styles.quickLinks}>
        {quickLinks.map((link) => (
          <Pressable
            accessibilityRole="button"
            key={link.label}
            style={styles.quickLink}
            onPress={() => router.push(link.route)}
          >
            <View style={styles.quickIcon}>
              <Icon name={link.icon} />
            </View>
            <Text style={styles.quickLabel}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <View style={styles.row}>
          <CardTitle title="Water consumption" icon="water" />
          <Badge label={latest?.month || 'No bills yet'} />
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usage}>
            {usage}
            <Text style={styles.unit}> m³</Text>
          </Text>
          <Text style={text.muted}>Latest billed consumption</Text>
        </View>
        <View style={styles.readings}>
          <View>
            <Text style={text.muted}>Previous reading</Text>
            <Text style={styles.reading}>{latest?.previous || '?'} m³</Text>
          </View>
          <View style={styles.readingDivider} />
          <View>
            <Text style={text.muted}>Current reading</Text>
            <Text style={styles.reading}>{latest?.current || '?'} m³</Text>
          </View>
        </View>
        <Text style={text.muted}>Meter no. {customer?.meter || 'Not recorded'}</Text>
      </Card>
      <Card>
        <CardTitle title="Latest notifications" icon="news" />
        {!!noticeError && <Text style={text.muted}>{noticeError}</Text>}
        {!latestNotices.length && <Text style={text.muted}>
          {noticesBusy ? 'Loading notifications...' : noticeError ? 'Notifications are unavailable right now.' : 'No notifications yet.'}
        </Text>}
        {latestNotices.map(item => (
          <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={(item.read ? '' : 'Unread: ') + item.title}
            onPress={() => void viewNotice(item)} style={styles.notificationPreview}>
            <View style={styles.row}>
              <Text style={styles.advisory}>{item.title}</Text>
              {!item.read && <Text style={styles.newNotice}>New</Text>}
            </View>
            <Text style={text.muted}>{item.date}</Text>
            <Text style={text.body} numberOfLines={2}>{item.body}</Text>
          </Pressable>
        ))}
        <Button label="View all notifications" secondary onPress={() => router.push('/announcements')} />
      </Card>
      <Sheet title={selectedNotice?.title || 'Notification'} visible={!!selectedNotice} onClose={() => setSelectedNotice(null)}>
        <Text style={text.muted}>{selectedNotice?.date}</Text>
        <Text style={text.body}>{selectedNotice?.body}</Text>
        {!!readError && <>
          <Text accessibilityRole="alert" style={text.muted}>{readError}</Text>
          <Button label="Retry read status" onPress={() => { if (selectedNotice) void viewNotice(selectedNotice); }} />
        </>}
      </Sheet>
    </Screen>
  );
}
