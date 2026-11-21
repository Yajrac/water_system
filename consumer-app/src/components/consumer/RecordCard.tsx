import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, softShadow } from './ui';
import { Icon, type IconName } from './Icon';
import { colors } from '@/theme/tokens';

// One bill or payment: icon, title and status on top, amount and action below.
// The whole card opens the record.
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action + ': ' + title + ', ' + amount + ', ' + status}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <Icon name={icon} size={21} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heading} numberOfLines={1}>{title}</Text>
          <Text style={styles.details} numberOfLines={1}>{details}</Text>
        </View>
        <Badge label={status} paid={paid} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.amount}>{amount}</Text>
        <View style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
          <Text style={styles.arrow}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e3edf2',
    padding: 16,
    gap: 14,
    boxShadow: softShadow,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint },
  heading: { fontSize: 15, fontWeight: '700', color: colors.ink },
  details: { fontSize: 12, color: colors.muted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f5',
  },
  amount: { fontSize: 22, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.tint,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  arrow: { fontSize: 18, lineHeight: 20, color: colors.primary },
});
