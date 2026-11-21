import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRef, type ReactNode, type PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';

// Soft shadow shared by cards and raised controls.
export const softShadow = '0 8px 24px rgba(16, 58, 82, 0.08)';

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
    'Application progress': 'profile',
  };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name={screenIcons[title] || 'home'} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>PWSS</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
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
      <View style={styles.iconBox}>
        <Icon name={icon} size={20} />
      </View>
      <Text style={[text.heading, { flex: 1 }]}>{title}</Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  const ink = danger ? '#b63a49' : secondary ? colors.primary : '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && styles.danger,
        pressed && styles.pressed,
        (disabled || loading) && { opacity: 0.55 },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={ink} /> : null}
      <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

// Status pill: green when paid, red when overdue or disconnected, amber otherwise.
export function Badge({ label, paid = false }: { label: string; paid?: boolean }) {
  const alarm = /overdue|disconnected|failed/i.test(label);
  const tone = paid
    ? { bg: colors.successTint, fg: colors.success }
    : alarm
      ? { bg: '#fdecee', fg: '#b63a49' }
      : { bg: colors.warningTint, fg: colors.warning };
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.fg }]} />
      <Text style={{ color: tone.fg, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, strong && styles.detailStrong]}>{value}</Text>
    </View>
  );
}

// Bottom sheet: slides up from the bottom with a grab handle and a round close button.
export function Sheet({
  title,
  visible,
  onClose,
  children,
}: PropsWithChildren<{ title: string; visible: boolean; onClose: () => void }>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.modal}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={[text.heading, { flex: 1 }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={12}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>{'✕'}</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 24, gap: 14 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export const text = StyleSheet.create({
  heading: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  muted: { fontSize: 12, color: colors.muted, lineHeight: 19 },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  amount: { fontSize: 28, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  composer: {
    padding: 16,
    gap: 10,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    boxShadow: '0 -6px 20px rgba(16, 58, 82, 0.08)',
  },
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: softShadow,
  },
  brand: { fontWeight: '800', color: colors.primary, fontSize: 11, letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 21, lineHeight: 27, fontWeight: '800' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 16 },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e3edf2',
    padding: 18,
    gap: 12,
    boxShadow: softShadow,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    boxShadow: '0 6px 16px rgba(8, 127, 163, 0.25)',
  },
  secondary: { backgroundColor: colors.tint, boxShadow: 'none' },
  danger: { backgroundColor: '#fdecee', boxShadow: 'none' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  buttonText: { fontWeight: '700', fontSize: 15 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f5',
  },
  detailLabel: { fontSize: 13, color: colors.muted },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 20 },
  detailStrong: { fontSize: 16, fontWeight: '800', color: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(6, 30, 46, 0.55)' },
  modal: {
    maxHeight: '88%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#d5e0e7', marginTop: 10 },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  closeText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
