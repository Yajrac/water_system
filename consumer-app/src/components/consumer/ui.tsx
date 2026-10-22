 import {
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useRef, type ReactNode, type PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

export function Screen({
  title,
  children,
  footer,
  headerAction,
}: PropsWithChildren<{ title: string; footer?: ReactNode; headerAction?: ReactNode }>) {
  const scroll = useRef<ScrollView>(null);
  const screenIcons: Record<string, IconName> = {
    'My water account': 'home',
    'My bills': 'bills',
    'Payment history': 'payments',
    Announcements: 'news',
    Notifications: 'news',
    Feedback: 'feedback',
    'My profile': 'profile',
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.brand}>PWSS</Text>
        <Icon name={screenIcons[title] || 'home'} size={20} />
        <Text style={[styles.title, { flex: 1 }]}>{title}</Text>
        {headerAction}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        enabled={!!footer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (footer) scroll.current?.scrollToEnd({ animated: true });
          }}
        >
          <View style={styles.inner}>{children}</View>
        </ScrollView>
        {footer ? <View style={styles.composer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function CardTitle({ title, icon }: { title: string; icon: IconName }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Icon name={icon} size={22} />
      <Text style={[text.heading, { flex: 1 }]}>{title}</Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, paid = false }: { label: string; paid?: boolean }) {
  return (
    <View style={[styles.badge, paid && { backgroundColor: colors.successTint }]}>
      <Text
        style={{ color: paid ? colors.success : colors.warning, fontSize: 11, fontWeight: '600' }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={text.muted}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function Sheet({
  title,
  visible,
  onClose,
  children,
}: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void }>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={text.heading}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={12}
            >
              <Text style={text.link}>Close</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 14 }}
          >
            {children}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export const text = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 19 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  amount: { fontSize: 28, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  composer: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    height: 52,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brand: { fontWeight: '800', color: colors.primary, fontSize: 15 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  content: { padding: 18, paddingBottom: 32 },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 6,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondary: { backgroundColor: colors.tint },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  badge: {
    backgroundColor: colors.warningTint,
    alignSelf: 'flex-start',
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 13, color: colors.ink, lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: '#082a40aa', justifyContent: 'center', padding: 18 },
  modal: {
    maxHeight: '85%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
