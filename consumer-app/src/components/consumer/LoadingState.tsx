import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { Card } from './ui';

export function RefreshControl({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return (
    <View style={styles.refreshRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh"
        accessibilityState={{ disabled: busy, busy }} disabled={busy}
        onPress={onRefresh} style={styles.refresh}>
        {busy && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={styles.label}>{busy ? 'Refreshing...' : 'Refresh'}</Text>
      </Pressable>
    </View>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <View accessible accessibilityLabel="Loading records" accessibilityState={{ busy: true }} style={styles.list}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.list}>
        {Array.from({ length: count }, (_, index) => (
          <Card key={index}>
            <View style={[styles.line, styles.short]} />
            <View style={[styles.line, styles.amount]} />
            <View style={styles.line} />
            <View style={[styles.line, styles.short]} />
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  refreshRow: { alignItems: 'flex-end' },
  refresh: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  list: { gap: 18 },
  line: { height: 14, borderRadius: 5, backgroundColor: colors.border, width: '100%' },
  short: { width: '55%' },
  amount: { height: 30, width: '65%' },
});
