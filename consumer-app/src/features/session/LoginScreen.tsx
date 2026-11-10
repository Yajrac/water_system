import { useEffect, useState } from 'react';
import { ConsumerApiError } from './api';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/components/consumer/Input';
import { Button } from '@/components/consumer/ui';
import { useSession } from './SessionProvider';
import { colors } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn, notice } = useSession();
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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.brand}>
              <View pointerEvents="none" accessible={false} style={styles.waterRing} />
              <View pointerEvents="none" accessible={false} style={styles.waterRingSmall} />
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
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
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
              <Text style={styles.help}>Need help signing in? Contact the PWSS office.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#edf5f8' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 20 },
  content: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 0 },
  brand: { alignItems: 'center', gap: 8, backgroundColor: '#12394e', paddingTop: 28, paddingBottom: 48, paddingHorizontal: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  waterRing: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 38, borderColor: '#19485f', right: -135, top: -55 },
  waterRingSmall: { position: 'absolute', width: 170, height: 170, borderRadius: 85, borderWidth: 26, borderColor: '#1b4c63', left: -100, bottom: -50 },
  logoFrame: { padding: 6, borderRadius: 58, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#d4e6ed', marginBottom: 4 },
  logo: { width: 92, height: 92, borderRadius: 46 },
  brandName: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: 3, color: '#ffffff' },
  brandSubtitle: { fontSize: 13, lineHeight: 20, color: '#c3dce7', textAlign: 'center' },
  portalBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#235167', marginTop: 4 },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#64d9ef' },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, color: '#c2f2ff' },
  form: { gap: 18, padding: 24, borderRadius: 24, marginTop: -24, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#dce8ed' },
  formHeading: { gap: 5, marginBottom: 4 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 21, color: colors.muted },
  notice: { fontSize: 13, lineHeight: 20, color: '#187246', backgroundColor: colors.successTint, padding: 12, borderRadius: 6 },
  error: { fontSize: 13, lineHeight: 20, color: '#b63a49', backgroundColor: '#fff0f2', padding: 12, borderRadius: 6 },
  help: { fontSize: 11, lineHeight: 18, textAlign: 'center', color: colors.muted },
});
