import { useConsumerProfile } from '../profile/useConsumerProfile';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useNotifications, type ConsumerNotice } from '../notifications/NotificationProvider';
import { useConsumerFinances } from '../bills/useConsumerFinances';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { Button, Card, Screen, Sheet, text } from '@/components/consumer/ui';
import { money } from '@/theme/tokens';
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
    hint: string;
  }[] = [
    { label: 'My bills', icon: 'bills', route: '/bills', hint: 'Statements and dues' },
    { label: 'Payments', icon: 'payments', route: '/payments', hint: 'Receipts and history' },
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
  const firstName = customer?.firstName || '';
  const status = customer?.status || '';
  return (
    <Screen title="Home">
      {!!error && <Text accessibilityRole="alert" style={text.muted}>{error}</Text>}
      {!!profileError && <Text style={text.muted}>{profileError}</Text>}
      <View style={styles.hero}>
        <View pointerEvents="none" accessible={false} style={[styles.heroBubble, styles.heroBubbleLarge]} />
        <View pointerEvents="none" accessible={false} style={[styles.heroBubble, styles.heroBubbleSmall]} />
        <View pointerEvents="none" accessible={false} style={styles.heroWave} />
        <View style={styles.heroTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View my profile"
            onPress={() => router.push('/profile')}
            style={styles.heroAvatar}
          >
            <Avatar active={status === 'Active'} gender={customer?.gender} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroGreeting}>Welcome back{firstName ? ',' : ''}</Text>
            <Text style={styles.heroName} numberOfLines={1}>{firstName || 'Consumer'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh account"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            hitSlop={6}
            style={styles.refreshPill}
            onPress={() => {
              void reload();
              void reloadProfile();
              void refreshNotices();
            }}
          >
            {busy ? <ActivityIndicator size="small" color="#ffffff" /> : null}
            <Text style={styles.refreshPillText}>{busy ? 'Refreshing' : 'Refresh'}</Text>
          </Pressable>
        </View>
        <View style={styles.heroBalance}>
          <Text style={styles.lightLabel}>REMAINING BALANCE</Text>
          <Text style={styles.balance} adjustsFontSizeToFit numberOfLines={1}>{money(balance)}</Text>
          <Text style={styles.due}>
            {balance > 0 ? 'Total unpaid balance across all bills.' : 'You are all paid up. Thank you!'}
          </Text>
        </View>
        <View style={styles.heroFooter}>
          <View style={styles.heroChip}>
            <Icon name="bills" size={14} color="#dff6fc" />
            <Text style={styles.heroChipText}>{customer?.account || 'No account number'}</Text>
          </View>
          {!!status && (
            <View style={[styles.heroChip, status === 'Active' ? styles.chipActive : styles.chipOff]}>
              <View style={[styles.statusDot, { backgroundColor: status === 'Active' ? '#5ef0a6' : '#ffb4bd' }]} />
              <Text style={styles.heroChipText}>{status}</Text>
            </View>
          )}
        </View>
      </View>
      {status === 'Disconnected' && (
        <View accessibilityRole="alert" style={styles.disconnectedBanner}>
          <Text style={styles.disconnectedTitle}>
            Service disconnected{customer?.disconnectedOn ? ' since ' + customer.disconnectedOn : ''}
          </Text>
          <Text style={styles.disconnectedText}>
            {balance > 0 ? 'Outstanding balance: ' + money(balance) + '. ' : ''}
            You can still view your bills and payments. Contact the PWSS office for details and reconnection.
          </Text>
        </View>
      )}
      <View style={styles.quickLinks}>
        {quickLinks.map((link) => (
          <Pressable
            accessibilityRole="button"
            key={link.label}
            style={({ pressed }) => [styles.quickLink, pressed && styles.pressed]}
            onPress={() => router.push(link.route)}
          >
            <View style={styles.quickIcon}>
              <Icon name={link.icon} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickLabel}>{link.label}</Text>
              <Text style={styles.quickHint}>{link.hint}</Text>
            </View>
            <Text style={styles.quickArrow}>›</Text>
          </Pressable>
        ))}
      </View>
      <Card style={styles.modernCard}>
        <View style={styles.row}>
          <View style={styles.cardHeading}>
            <View style={styles.cardIcon}><Icon name="water" size={20} /></View>
            <Text style={styles.cardTitle}>Water consumption</Text>
          </View>
          <View style={styles.monthPill}>
            <Text style={styles.monthPillText}>{latest?.month || 'No bills yet'}</Text>
          </View>
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usage}>
            {usage}
            <Text style={styles.unit}> m³</Text>
          </Text>
          <Text style={styles.usageHint}>Latest billed consumption</Text>
        </View>
        <View style={styles.readings}>
          <View style={styles.readingTile}>
            <Text style={styles.readingLabel}>Previous reading</Text>
            <Text style={styles.reading}>{latest?.previous || '—'} m³</Text>
          </View>
          <View style={styles.readingTile}>
            <Text style={styles.readingLabel}>Current reading</Text>
            <Text style={styles.reading}>{latest?.current || '—'} m³</Text>
          </View>
        </View>
        <Text style={styles.meterText}>Meter no. {customer?.meter || 'Not recorded'}</Text>
      </Card>
      <Card style={styles.modernCard}>
        <View style={styles.cardHeading}>
          <View style={styles.cardIcon}><Icon name="news" size={20} /></View>
          <Text style={styles.cardTitle}>Latest notifications</Text>
        </View>
        {!!noticeError && <Text style={text.muted}>{noticeError}</Text>}
        {!latestNotices.length && <Text style={text.muted}>
          {noticesBusy ? 'Loading notifications...' : noticeError ? 'Notifications are unavailable right now.' : 'No notifications yet.'}
        </Text>}
        {latestNotices.map(item => (
          <Pressable key={item.id} accessibilityRole="button"
            accessibilityLabel={(item.read ? '' : 'Unread: ') + item.title}
            onPress={() => void viewNotice(item)}
            style={({ pressed }) => [styles.notificationPreview, !item.read && styles.notificationUnread, pressed && styles.pressed]}>
            <View style={styles.row}>
              <View style={styles.noticeTitleRow}>
                {!item.read && <View style={styles.unreadDot} />}
                <Text style={styles.advisory} numberOfLines={1}>{item.title}</Text>
              </View>
              {!item.read && <Text style={styles.newNotice}>NEW</Text>}
            </View>
            <Text style={styles.noticeDate}>{item.date}</Text>
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
