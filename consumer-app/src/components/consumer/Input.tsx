import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon, type IconName } from './Icon';

import { colors } from '@/theme/tokens';

export function Input({
  label,
  action,
  ...props
}: TextInputProps & {
  label: string;
  action?: { icon: IconName; label: string; onPress: () => void; active?: boolean };
}) {
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(90);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          {...props}
          onContentSizeChange={(event) => {
            if (props.multiline)
              setContentHeight(Math.min(140, Math.max(90, event.nativeEvent.contentSize.height)));
            props.onContentSizeChange?.(event);
          }}
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            focused && { borderColor: colors.primary },
            props.multiline && { height: contentHeight, textAlignVertical: 'top' },
            action && { paddingRight: 48 },
          ]}
        />
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ checked: action.active }}
            onPress={action.onPress}
            style={styles.action}
          >
            <Icon name={action.icon} size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  action: {
    position: 'absolute',
    right: 1,
    top: 1,
    bottom: 1,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    minHeight: 46,
    outlineWidth: 0,
  },
});
