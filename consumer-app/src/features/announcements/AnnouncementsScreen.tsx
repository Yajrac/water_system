import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Badge, Button, Card, Screen, text } from '@/components/consumer/ui';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';

type Notice = { id: string; category: string; title: string; date: string; body: string };
export default function AnnouncementsScreen() {
  const { accessToken } = useSession();
  const [items, setItems] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true); setError('');
    try {
      setItems(await consumerRequest<Notice[]>('/notifications/mine', undefined, accessToken, 'GET'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not load notifications.');
    } finally { setBusy(false); }
  }, [accessToken]);
  useEffect(() => { void load(); }, [load]);
  return (
    <Screen title="Announcements">
      <Button label={busy ? 'Loading...' : 'Refresh notifications'} disabled={busy} onPress={() => void load()} />
      {!!error && <Text style={text.muted}>{error}</Text>}
      {!busy && !error && !items.length && <Text style={text.muted}>No notifications yet.</Text>}
      {items.map((item) => (
        <Card key={item.id}>
          <Badge label={item.category} />
          <Text style={text.heading}>{item.title}</Text>
          <Text style={text.muted}>{item.date}</Text>
          <Text style={text.body}>{item.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}
