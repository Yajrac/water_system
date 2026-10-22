import { useConsumerProfile } from '../profile/useConsumerProfile';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
import { useConsumerFinances } from '../bills/useConsumerFinances';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { Badge, Button, Card, CardTitle, Screen, text } from '@/components/consumer/ui';
import { money } from '@/theme/tokens';
import { styles } from './home.styles';

export default function HomeScreen() {
  const { profile: customer, error: profileError, reload: reloadProfile } = useConsumerProfile();
  const { data, error, busy, reload } = useConsumerFinances();
  const { accessToken } = useSession();
  const [advisory, setAdvisory] = useState<{ title: string; date: string } | null>(null);
  const [advisoryError, setAdvisoryError] = useState('');
  const advisoryVersion = useRef(0);
  const loadAdvisory = useCallback(async () => {
    const version = ++advisoryVersion.current;
    if (!accessToken) return;
    setAdvisoryError('');
    try {
      const notices = await consumerRequest<{ category: string; title: string; date: string }[]>(
        '/notifications/mine',
        undefined,
        accessToken,
        'GET',
      );
      if (version === advisoryVersion.current)
        setAdvisory(notices.find((item) => item.category === 'Advisory') || null);
    } catch {
      if (version === advisoryVersion.current) {
        setAdvisory(null);
        setAdvisoryError('Could not load advisories.');
      }
    }
  }, [accessToken]);
  useFocusEffect(
    useCallback(() => {
      void loadAdvisory();
      return () => {
        advisoryVersion.current++;
      };
    }, [loadAdvisory]),
  );
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
        <Text style={text.muted}>
          {busy ? 'Loading your account...' : error || 'Account records are unavailable.'}
        </Text>
        <Button
          label={busy ? 'Loading...' : 'Retry'}
          disabled={busy}
          onPress={() => void reload()}
        />
      </Screen>
    );
  return (
    <Screen title="Home">
      <Button
        label={busy ? 'Refreshing...' : 'Refresh account'}
        secondary
        disabled={busy}
        onPress={() => {
          void reload();
          void reloadProfile();
          void loadAdvisory();
        }}
      />
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
            <Text style={styles.lightLabel}>OUTSTANDING BALANCE</Text>
            <Text style={styles.balance}>{money(balance)}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Icon name="water" color="#ffffff" size={36} />
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.row}>
          <View>
            <Text style={styles.lightLabel}>{latest?.month || 'No bills yet'}</Text>
            <Text style={styles.due}>
              {latest ? 'Due ' + latest.due : 'Your bill will appear here once generated.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/bills')}
            style={styles.viewBill}
          >
            <Text style={styles.viewBillText}>View bill</Text>
            <Icon name="bills" color="#ffffff" size={18} />
          </Pressable>
        </View>
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
        <CardTitle title="Latest advisory" icon="news" />
        <Text style={styles.advisory}>
          {advisoryError || advisory?.title || 'No advisories yet.'}
        </Text>
        <Text style={text.muted}>{advisory?.date || ''}</Text>
        <Button
          label="Read announcements"
          secondary
          onPress={() => router.push('/announcements')}
        />
      </Card>
    </Screen>
  );
}
