import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, Pressable } from 'react-native';
import { Badge, Button, Card, Screen, Sheet, text } from '@/components/consumer/ui';
import { useNotifications, type ConsumerNotice } from '../notifications/NotificationProvider';
export default function AnnouncementsScreen() {
  const { items, busy, error, refresh, markRead } = useNotifications();
  const [selected, setSelected] = useState<ConsumerNotice | null>(null);
  const [readError, setReadError] = useState('');
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
      <Button
        label={busy ? 'Refreshing...' : 'Refresh notifications'}
        disabled={busy}
        onPress={() => void refresh()}
      />
      {!!error && <Text style={text.muted}>{error}</Text>}
      {!busy && !error && !items.length && <Text style={text.muted}>No notifications yet.</Text>}
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={(item.read ? '' : 'Unread: ') + item.title}
          onPress={() => void view(item)}
        >
          <Card>
            {!item.read && <Text style={{ color: '#dc2626', fontWeight: '700' }}>New</Text>}
            <Badge label={item.category} />
            <Text style={text.heading}>{item.title}</Text>
            <Text style={text.muted}>{item.date}</Text>
            <Text style={text.body} numberOfLines={2}>
              {item.body}
            </Text>
          </Card>
        </Pressable>
      ))}
      <Sheet
        title={selected?.title || 'Notification'}
        visible={!!selected}
        onClose={() => setSelected(null)}
      >
        <Text style={text.muted}>{selected?.date}</Text>
        <Text style={text.body}>{selected?.body}</Text>
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
