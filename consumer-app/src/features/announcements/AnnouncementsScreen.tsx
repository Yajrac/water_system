import { Text } from 'react-native';
import { Badge, Card, Screen, text } from '@/components/consumer/ui';
import { announcements } from '@/data/sample';

export default function AnnouncementsScreen() {
  return (
    <Screen title="Announcements">
      {announcements.map((item) => (
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
