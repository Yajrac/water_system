import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/consumer/Input';
import { Button } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { consumerRequest } from './api';

// Office policy: the account number alone lets a consumer set a new password.
// The server limits resets, signs out other devices and posts a security notice.
export function ForgotPasswordForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const [accountNumber, setAccountNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = {
    icon: visible ? ('eyeOff' as const) : ('eye' as const),
    label: visible ? 'Hide passwords' : 'Show passwords',
    onPress: () => setVisible(!visible),
    active: visible,
  };

  async function submit() {
    if (busy) return;
    if (!accountNumber.trim()) return setError('Enter your account number.');
    if (password.length < 8 || password.length > 128) return setError('Enter a new password of 8–128 characters.');
    if (password !== confirmation) return setError('New passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await consumerRequest('/auth/forgot-password', { accountNumber: accountNumber.trim(), newPassword: password });
      onDone('Password updated. Sign in with your account number and new password.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Cannot reset your password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.heading}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>Enter the account number on your water bill, then choose a new password.</Text>
      </View>
      <Input
        variant="login"
        leadingIcon="bills"
        label="Account number"
        value={accountNumber}
        onChangeText={(value) => { setAccountNumber(value); setError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={40}
        placeholder="Account number"
        accessibilityLabel="Account number"
        editable={!busy}
      />
      <Input
        variant="login"
        leadingIcon="lock"
        label="New password"
        value={password}
        onChangeText={(value) => { setPassword(value); setError(''); }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
        placeholder="8–128 characters"
        accessibilityLabel="New password"
        editable={!busy}
        action={action}
      />
      <Input
        variant="login"
        leadingIcon="lock"
        label="Confirm new password"
        value={confirmation}
        onChangeText={(value) => { setConfirmation(value); setError(''); }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={128}
        placeholder="Type the new password again"
        accessibilityLabel="Confirm new password"
        editable={!busy}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button
        label={busy ? 'Saving...' : 'Set new password'}
        loading={busy}
        disabled={busy || !accountNumber.trim() || !password || !confirmation}
        onPress={submit}
      />
      <Button secondary label="Back to sign in" disabled={busy} onPress={onCancel} />
      <Text style={styles.help}>Other devices signed in to this account will be signed out.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18, padding: 24, borderRadius: 24, marginTop: -24, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#dce8ed' },
  heading: { gap: 5, marginBottom: 4 },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 13, lineHeight: 21, color: colors.muted },
  error: { fontSize: 13, lineHeight: 20, color: '#b63a49', backgroundColor: '#fff0f2', padding: 12, borderRadius: 6 },
  help: { fontSize: 11, lineHeight: 18, textAlign: 'center', color: colors.muted },
});
