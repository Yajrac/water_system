import { ActivityIndicator, Text } from 'react-native';
import { Button, Screen, text } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { useSession } from '@/features/session/SessionProvider';

export default function SessionLoadingScreen() {
  const { restoring, restoreError, retryRestore, signOut } = useSession();
  return (
    <Screen title="My water account">
      {restoring ? <ActivityIndicator color={colors.primary} accessibilityLabel="Restoring your session" /> : <>
        <Text style={text.muted}>{restoreError}</Text>
        <Button label="Retry connection" onPress={retryRestore} />
        <Button label="Use another account" secondary onPress={signOut} />
      </>}
    </Screen>
  );
}
