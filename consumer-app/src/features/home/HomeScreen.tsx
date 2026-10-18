import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Icon, type IconName } from '@/components/consumer/Icon';
import { Badge, Button, Card, CardTitle, Screen, text } from '@/components/consumer/ui';
import { announcements, bills, customer } from '@/data/sample';
import { money } from '@/theme/tokens';
import { styles } from './home.styles';

export default function HomeScreen() {
  const latest = bills[0];
  const balance = bills.reduce((sum, bill) => sum + bill.total - bill.paid, 0);
  const usage = latest.current - latest.previous;
  const quickLinks: {
    label: string;
    icon: IconName;
    route: '/bills' | '/payments';
  }[] = [
    { label: 'My bills', icon: 'bills', route: '/bills' },
    { label: 'Payments', icon: 'payments', route: '/payments' },
  ];
  return (
    <Screen title="Home">
      <View style={styles.welcome}>
        <View style={{ flex: 1 }}>
          <Text style={text.muted}>Welcome back, Ana</Text>
          <Text style={styles.welcomeTitle}>Your water service</Text>
          <Text style={text.muted}>{customer.account}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View my profile"
          onPress={() => router.push('/profile')}
        >
          <Avatar active={customer.status === 'Active'} />
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
            <Text style={styles.lightLabel}>{latest.month}</Text>
            <Text style={styles.due}>Due {latest.due}</Text>
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
          <Badge label={latest.month} />
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usage}>
            {usage}
            <Text style={styles.unit}> m³</Text>
          </Text>
          <Text style={text.muted}>This billing month</Text>
        </View>
        <View style={styles.readings}>
          <View>
            <Text style={text.muted}>Previous reading</Text>
            <Text style={styles.reading}>{latest.previous} m³</Text>
          </View>
          <View style={styles.readingDivider} />
          <View>
            <Text style={text.muted}>Current reading</Text>
            <Text style={styles.reading}>{latest.current} m³</Text>
          </View>
        </View>
        <Text style={text.muted}>Meter no. {customer.meter}</Text>
      </Card>
      <Card>
        <CardTitle title="Latest advisory" icon="news" />
        <Text style={styles.advisory}>{announcements[0].title}</Text>
        <Text style={text.muted}>{announcements[0].date}</Text>
        <Button
          label="Read announcements"
          secondary
          onPress={() => router.push('/announcements')}
        />
      </Card>
    </Screen>
  );
}
