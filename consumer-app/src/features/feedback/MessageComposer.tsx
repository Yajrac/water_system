import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/consumer/Icon';
import { colors } from '@/theme/tokens';

export function MessageComposer({ onSend }: { onSend: (message: string) => boolean }) {
  const [message, setMessage] = useState('');
  const [height, setHeight] = useState(44);
  const [focused, setFocused] = useState(false);
  const canSend = Boolean(message.trim());

  function sendMessage() {
    if (!canSend || !onSend(message)) return;
    setMessage('');
    setHeight(44);
  }

  return (
    <View style={styles.row}>
      <TextInput
        accessibilityLabel="Message to PWSS"
        placeholder="Message..."
        placeholderTextColor={colors.muted}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onContentSizeChange={(event) => {
          setHeight(Math.min(110, Math.max(44, event.nativeEvent.contentSize.height)));
        }}
        style={[styles.input, { height }, focused && { borderColor: colors.primary }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        disabled={!canSend}
        onPress={sendMessage}
        style={({ pressed }) => [styles.send, (!canSend || pressed) && { opacity: 0.45 }]}
      >
        <Icon name="send" size={22} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 22,
    backgroundColor: colors.background,
    color: colors.ink,
    textAlignVertical: 'top',
    outlineWidth: 0,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
});
