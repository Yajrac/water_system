import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { Card } from './ui';

export function RefreshControl({ busy, onRefresh }: { busy: boolean; onRefresh: () => void }) {
  return (
    <View style={styles.refreshRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh"
        accessibilityState={{ disabled: busy, busy }} disabled={busy}
        onPress={onRefresh} style={({ pressed }) => [styles.refresh, pressed && { opacity: 0.7 }]}>
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
            <View style={styles.skeletonHead}>
              <View style={styles.box} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.line, styles.short]} />
                <View style={[styles.line, styles.shorter]} />
              </View>
            </View>
            <View style={[styles.line, styles.amount]} />
          </Card>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  refreshRow: { alignItems: 'flex-end', marginBottom: -6 },
  refresh: {
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: colors.tint,
  },
  label: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  list: { gap: 16 },
  skeletonHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.border },
  line: { height: 14, borderRadius: 7, backgroundColor: colors.border, width: '100%' },
  short: { width: '60%' },
  shorter: { width: '40%', height: 10 },
  amount: { height: 26, width: '50%', borderRadius: 9 },
});
