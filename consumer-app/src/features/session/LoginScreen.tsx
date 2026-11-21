import { useEffect, useState } from 'react';
import { ConsumerApiError } from './api';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Input } from '@/components/consumer/Input';
import { Button } from '@/components/consumer/ui';
import { useSession } from './SessionProvider';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { colors } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn, notice } = useSession();
  const [forgotMode, setForgotMode] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View pointerEvents="none" accessible={false} style={styles.backdrop}>
        <View style={[styles.bubble, styles.bubbleLarge]} />
        <View style={[styles.bubble, styles.bubbleMedium]} />
        <View style={[styles.bubble, styles.bubbleSmall]} />
        <View style={styles.waveBack} />
        <View style={styles.waveFront} />
      </View>
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.brand}>
              <View style={styles.logoFrame}>
                <Image source={require('../../../assets/images/pwss-logo.jpg')} style={styles.logo} accessibilityLabel="Pio Duran Water Supply seal" />
              </View>
              <Text style={styles.brandName}>PWSS</Text>
              <Text style={styles.brandSubtitle}>Pio Duran Water Supply System</Text>
              <View style={styles.portalBadge}>
                <View style={styles.badgeDot} />
                <Text style={styles.eyebrow}>CONSUMER APP</Text>
              </View>
            </View>
            <View style={styles.card}>
            {forgotMode ? (
              <ForgotPasswordForm
                onCancel={() => setForgotMode(false)}
                onDone={(message) => {
                  setForgotMode(false);
                  setPassword('');
                  setError('');
                  setFieldErrors({});
                  setResetNotice(message);
                }}
              />
            ) : (
            <View style={styles.form}>
              <View style={styles.formHeading}>
                <Text style={styles.title}>Welcome back</Text>
                <Text style={styles.subtitle}>Sign in to manage your water account.</Text>
              </View>
            <Input
              variant="login"
              leadingIcon="profile"
              label="Username or account number"
              value={username}
              error={fieldErrors.username}
              onChangeText={(value) => { setUsername(value); setFieldErrors({}); }}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Username or account number"
              placeholder="Username / account number"
              editable={!busy}
            />
            <Input
              variant="login"
              leadingIcon="lock"
              label="Password"
              value={password}
              editable={!busy}
              error={fieldErrors.password}
              onChangeText={(value) => { setPassword(value); setFieldErrors(previous => ({ ...previous, password: undefined })); }}
              secureTextEntry={!visible}
              accessibilityLabel="Password"
              placeholder="Enter your password"
              action={{
                icon: visible ? 'eyeOff' : 'eye',
                label: visible ? 'Hide password' : 'Show password',
                onPress: () => setVisible(!visible),
                active: visible,
              }}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() => { setResetNotice(''); setForgotMode(true); }}
              disabled={busy}
              hitSlop={8}
              style={styles.forgotLink}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
            {notice || resetNotice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {resetNotice || notice}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {remaining > 0 ? <Text accessibilityRole="alert" style={styles.error}>Too many attempts. Try again in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}.</Text> : null}
            <Button
              label={busy ? 'Signing in...' : 'Sign in'}
              loading={busy}
              disabled={busy || remaining > 0 || !username.trim() || !password}
              onPress={async () => {
                if (busy || remaining > 0) return;
                setBusy(true);
                setError('');
                setFieldErrors({});
                try {
                  await signIn(username, password);
                } catch (failure) {
                  if (failure instanceof ConsumerApiError && failure.status === 429 && failure.retryAfterSeconds > 0) {
                    const receivedAt = Date.now();
                    setNow(receivedAt);
                    setLockedUntil(receivedAt + failure.retryAfterSeconds * 1000);
                  } else if (failure instanceof ConsumerApiError && failure.field) {
                    setFieldErrors({ [failure.field]: failure.message });
                  } else {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : 'Cannot sign in. Please try again.',
                  );
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
            </View>
            )}
            </View>
            <Text style={styles.help}>Need help signing in? Contact the PWSS office.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b3d56' },
  // Deep water at the top, lighter shallows at the bottom, like the admin glass login.
  backdrop: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    experimental_backgroundImage: 'linear-gradient(165deg, #082f45 0%, #0b5b79 45%, #1291b3 80%, #3cc3dc 100%)',
  },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bubbleLarge: { width: 280, height: 280, top: -90, right: -110 },
  bubbleMedium: { width: 150, height: 150, top: 170, left: -70 },
  bubbleSmall: { width: 54, height: 54, top: 110, right: 60 },
  waveBack: { position: 'absolute', left: -160, right: -60, bottom: -260, height: 420, borderRadius: 420, backgroundColor: 'rgba(255,255,255,0.10)' },
  waveFront: { position: 'absolute', left: -40, right: -200, bottom: -300, height: 420, borderRadius: 420, backgroundColor: 'rgba(255,255,255,0.12)' },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 22 },
  brand: { alignItems: 'center', gap: 6 },
  logoFrame: {
    padding: 5,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
    boxShadow: '0 10px 30px rgba(2, 24, 38, 0.45)',
  },
  logo: { width: 88, height: 88, borderRadius: 44 },
  brandName: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: 4, color: '#ffffff' },
  brandSubtitle: { fontSize: 13, lineHeight: 20, color: 'rgba(225,244,250,0.85)', textAlign: 'center' },
  portalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    marginTop: 6,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7ee8fa' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.6, color: '#e2f8ff' },
  card: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    boxShadow: '0 24px 48px rgba(3, 30, 46, 0.40)',
  },
  form: { gap: 18 },
  formHeading: { gap: 5, marginBottom: 2 },
  title: { fontSize: 25, lineHeight: 32, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 21, color: colors.muted },
  notice: { fontSize: 13, lineHeight: 20, color: '#187246', backgroundColor: colors.successTint, padding: 12, borderRadius: 12 },
  error: { fontSize: 13, lineHeight: 20, color: '#b63a49', backgroundColor: '#fff0f2', padding: 12, borderRadius: 12 },
  help: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: 'rgba(230,246,251,0.85)' },
  forgotLink: { alignSelf: 'flex-end', marginTop: -6, paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
