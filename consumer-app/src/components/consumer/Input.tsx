import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon, type IconName } from './Icon';

import { colors } from '@/theme/tokens';

export function Input({
  label,
  action,
  leadingIcon,
  variant = 'default',
  error,
  ...props
}: TextInputProps & {
  label: string;
  leadingIcon?: IconName;
  variant?: 'default' | 'login';
  error?: string;
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
            variant === 'login' && styles.loginInput,
            focused && { borderColor: colors.primary },
            variant === 'login' && focused && styles.loginFocused,
            leadingIcon && { paddingLeft: 48 },
            props.multiline && { height: contentHeight, textAlignVertical: 'top' },
            action && { paddingRight: 48 },
            Boolean(error) && { borderColor: '#b63a49', backgroundColor: '#fff7f8' },
          ]}
        />
        {leadingIcon ? (
          <View pointerEvents="none" style={styles.leadingIcon}>
            <Icon name={leadingIcon} size={21} color={focused ? colors.primary : colors.muted} />
          </View>
        ) : null}
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
      {error ? <Text accessibilityRole="alert" style={{ color: '#b63a49', fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  leadingIcon: { position: 'absolute', left: 15, top: 0, bottom: 0, justifyContent: 'center' },
  loginInput: { minHeight: 56, borderRadius: 12, backgroundColor: '#f1f6f9', borderColor: '#e1eaf0', paddingVertical: 15, fontSize: 14 },
  loginFocused: { backgroundColor: '#f5fcff', borderColor: '#087fa3' },
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
