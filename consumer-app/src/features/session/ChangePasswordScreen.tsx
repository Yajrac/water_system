import { useState } from 'react';
import { Text } from 'react-native';
import { Input } from '@/components/consumer/Input';
import { Button, Card, Screen, text } from '@/components/consumer/ui';
import { useSession } from './SessionProvider';

export default function ChangePasswordScreen() {
  const { changePassword, mustChangePassword, cancelChangePassword, signOut } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const action = {
    icon: visible ? ('eyeOff' as const) : ('eye' as const),
    label: visible ? 'Hide passwords' : 'Show passwords',
    onPress: () => setVisible(!visible),
  };
  return (
    <Screen title="Change password">
      <Card>
        <Text style={text.heading}>
          {mustChangePassword ? 'Set your own password' : 'Change password'}
        </Text>
        <Text style={text.muted}>
          {mustChangePassword
            ? 'Your submitter number is your temporary password. Replace it before continuing.'
            : 'After saving, sign in again with your new password.'}
        </Text>
        <Input
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry={!visible}
          editable={!busy}
          action={action}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry={!visible}
          editable={!busy}
          action={action}
          maxLength={128}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={text.muted}>8–128 characters. Use a password you do not use elsewhere.</Text>
        <Input
          label="Confirm new password"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry={!visible}
          editable={!busy}
          maxLength={128}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ color: '#c62828' }}>
            {error}
          </Text>
        ) : null}
        <Button
          label={busy ? 'Saving...' : 'Save new password'}
          disabled={busy}
          onPress={async () => {
            if (busy) return;
            if (!current || next.length < 8 || next.length > 128) {
              setError('Enter your current password and a new password of 8–128 characters.');
              return;
            }
            if (next !== confirmation) {
              setError('New passwords do not match.');
              return;
            }
            if (next === current) {
              setError('Choose a different password.');
              return;
            }
            setBusy(true);
            setError('');
            try {
              await changePassword(current, next);
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Cannot save your password.');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button
          secondary
          disabled={busy}
          label={mustChangePassword ? 'Sign out' : 'Cancel'}
          onPress={mustChangePassword ? signOut : cancelChangePassword}
        />
      </Card>
    </Screen>
  );
}
