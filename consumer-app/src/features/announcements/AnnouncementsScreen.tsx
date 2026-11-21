import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Screen, Sheet, softShadow, text } from '@/components/consumer/ui';
import { Icon } from '@/components/consumer/Icon';
import { colors } from '@/theme/tokens';
import { useNotifications, type ConsumerNotice } from '../notifications/NotificationProvider';
export default function AnnouncementsScreen() {
  const { items, busy, error, refresh, markRead } = useNotifications();
  const [selected, setSelected] = useState<ConsumerNotice | null>(null);
  const [readError, setReadError] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  async function view(item: ConsumerNotice) {
    setSelected(item);
    setReadError('');
    if (!item.read)
      try {
        await markRead([item.id]);
      } catch {
        setReadError('Could not save read status. Please try again.');
      }
  }
  return (
    <Screen title="Notifications">
      <RefreshControl busy={busy} onRefresh={() => void refresh()} />
      {busy && !items.length && <LoadingCards />}
      {!!error && <Text style={text.muted}>{error}</Text>}
      {!busy && !error && !items.length && <Text style={text.muted}>No notifications yet.</Text>}
      {items.slice(0, visibleCount).map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={(item.read ? '' : 'Unread: ') + item.title}
          onPress={() => void view(item)}
          style={({ pressed }) => [styles.card, !item.read && styles.unread, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, !item.read && styles.iconBoxUnread]}>
            <Icon name="news" size={20} color={item.read ? colors.muted : colors.primary} />
            {!item.read && <View style={styles.dot} />}
          </View>
          <View style={styles.body}>
            <View style={styles.topRow}>
              <Badge label={item.category} />
              <Text style={styles.date}>{item.date}</Text>
            </View>
            <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>{item.title}</Text>
            <Text style={text.muted} numberOfLines={2}>{item.body}</Text>
          </View>
        </Pressable>
      ))}
      {items.length > visibleCount && <Button label="See more" secondary onPress={() => setVisibleCount(count => count + 10)} />}
      <Sheet
        title={selected?.title || 'Notification'}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        <View style={styles.sheetMeta}>
          {!!selected?.category && <Badge label={selected.category} />}
          <Text style={styles.date}>{selected?.date}</Text>
        </View>
        <Text style={styles.sheetBody}>{selected?.body}</Text>
        {!!readError && (
          <>
            <Text style={text.muted}>{readError}</Text>
            <Button
              label="Retry read status"
              onPress={() => {
                if (selected) void view(selected);
              }}
            />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e3edf2',
    backgroundColor: colors.surface,
    boxShadow: softShadow,
  },
  unread: { backgroundColor: '#f3fbfe', borderColor: '#cfe9f3' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  iconBox: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  iconBoxUnread: { backgroundColor: colors.tint },
  dot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.surface, backgroundColor: '#dc2626' },
  body: { flex: 1, gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontSize: 11, color: colors.muted },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.ink },
  titleUnread: { fontWeight: '800' },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetBody: { fontSize: 15, lineHeight: 24, color: colors.ink },
});
