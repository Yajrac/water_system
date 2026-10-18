import { Text, View, StyleSheet } from 'react-native';
import { MessageComposer } from './MessageComposer';
import { Badge, Screen, text } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { useFeedback } from './useFeedback';

export default function FeedbackScreen() {
  const { messages, send } = useFeedback();
  return (
    <Screen title="Feedback" footer={<MessageComposer onSend={send} />}>
      <Badge label="In progress" />
      <Text style={text.heading}>Water supply concern</Text>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[styles.bubble, message.author === 'consumer' && styles.mine]}
        >
          <Text style={text.link}>{message.author === 'admin' ? 'PWSS Admin' : 'You'}</Text>
          <Text style={text.body}>{message.body}</Text>
          <Text style={text.muted}>{message.time}</Text>
        </View>
      ))}
    </Screen>
  );
}
const styles = StyleSheet.create({
  bubble: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
    marginRight: 24,
  },
  mine: { backgroundColor: colors.tint, marginRight: 0, marginLeft: 24 },
});
