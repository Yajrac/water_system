import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, text } from './ui';
import { Icon, type IconName } from './Icon';
import { colors } from '@/theme/tokens';

export function RecordCard({
  title,
  amount,
  details,
  status,
  paid,
  icon,
  action,
  onPress,
}: {
  title: string;
  amount: string;
  details: string;
  status: string;
  paid: boolean;
  icon: IconName;
  action: string;
  onPress: () => void;
}) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.title}>
          <Icon name={icon} size={20} />
          <Text style={styles.heading}>{title}</Text>
        </View>
        <Badge label={status} paid={paid} />
      </View>
      <View style={styles.row}>
        <Text style={styles.amount}>{amount}</Text>
        <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
          <Text style={text.link}>{action}</Text>
        </Pressable>
      </View>
      <Text style={text.muted}>{details}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  heading: { fontSize: 14, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  amount: { fontSize: 22, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.tint,
  },
});
