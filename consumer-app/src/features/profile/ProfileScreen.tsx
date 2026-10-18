import { Text, View, StyleSheet } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Button, Card, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { customer } from '@/data/sample';
import { useSession } from '@/features/session/SessionProvider';
import { useState } from 'react';
import { colors } from '@/theme/tokens';

export default function ProfileScreen() {
  const { signOut } = useSession();
  const [confirm, setConfirm] = useState(false);
  return (
    <Screen title="My profile">
      <Card>
        <View style={styles.identity}>
          <Avatar size={76} active={customer.status === 'Active'} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={text.heading}>{customer.name}</Text>
            <Text style={text.muted}>Residential consumer</Text>
          </View>
        </View>
        <Detail label="Account number" value={customer.account} />
        <Detail label="Submitter number" value={customer.submitter} />
        <Detail label="Service address" value={customer.address} />
        <Detail label="Mobile number" value={customer.contact} />
        <Detail label="Meter number" value={customer.meter} />
      </Card>
      <Text style={text.muted}>Contact the PWSS office to update your registered details.</Text>
      <Button label="Log out" secondary onPress={() => setConfirm(true)} />
      <Sheet title="Log out?" visible={confirm} onClose={() => setConfirm(false)}>
        <Text style={text.body}>Are you sure you want to log out of your account?</Text>
        <Button label="Log out" onPress={signOut} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: colors.border },
});
