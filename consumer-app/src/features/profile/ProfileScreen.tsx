import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { Text, View, StyleSheet } from 'react-native';
import { Avatar } from '@/components/consumer/Avatar';
import { Icon } from '@/components/consumer/Icon';
import { Button, Card, Detail, Screen, Sheet, text } from '@/components/consumer/ui';
import { useConsumerProfile } from './useConsumerProfile';
import { useSession } from '@/features/session/SessionProvider';
import { useState } from 'react';
import { colors } from '@/theme/tokens';

export default function ProfileScreen() {
  const { signOut, openChangePassword } = useSession();
  const { profile:customer, error, busy, reload } = useConsumerProfile();
  const [confirm, setConfirm] = useState(false);
  const active = customer?.status === 'Active';
  return (
    <Screen title="My profile">
      {!!error && <Text style={text.muted}>{error}</Text>}
      <RefreshControl busy={busy} onRefresh={() => void reload()} />
      {busy && !customer && <LoadingCards count={1} />}
      {customer && <>
        <View style={styles.hero}>
          <View pointerEvents="none" accessible={false} style={styles.bubble} />
          <View style={styles.avatarRing}>
            <Avatar size={80} active={active} gender={customer.gender} />
          </View>
          <Text style={styles.name}>{customer.name}</Text>
          <Text style={styles.type}>{customer.customerType} consumer</Text>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Icon name="bills" size={14} color="#dff6fc" />
              <Text style={styles.chipText}>{customer.account}</Text>
            </View>
            {!!customer.status && (
              <View style={[styles.chip, active ? styles.chipActive : styles.chipOff]}>
                <View style={[styles.statusDot, { backgroundColor: active ? '#5ef0a6' : '#ffb4bd' }]} />
                <Text style={styles.chipText}>{customer.status}</Text>
              </View>
            )}
          </View>
        </View>
        <Card>
          <Text style={styles.section}>Account details</Text>
          <Detail label="Application status" value={customer.applicationStatus || 'Pending'} />
          <Detail label="Submitter number" value={customer.submitter} />
          <Detail label="Meter number" value={customer.meter} />
          <Text style={styles.section}>Contact</Text>
          <Detail label="Service address" value={customer.address} />
          <Detail label="Mobile number" value={customer.contact} />
        </Card>
      </>}
      <View style={styles.hint}>
        <Icon name="profile" size={18} color={colors.muted} />
        <Text style={[text.muted, { flex: 1 }]}>Contact the PWSS office to update your registered details.</Text>
      </View>
      <Button label="Change password" onPress={openChangePassword} />
      <Button label="Log out" danger onPress={() => setConfirm(true)} />
      <Sheet title="Log out?" visible={confirm} onClose={() => setConfirm(false)}>
        <Text style={text.body}>Are you sure you want to log out of your account?</Text>
        <Button label="Log out" danger onPress={signOut} />
        <Button label="Stay signed in" secondary onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0a6789',
    experimental_backgroundImage: 'linear-gradient(150deg, #0a3f5a 0%, #0b6f93 55%, #18a3c4 100%)',
    boxShadow: '0 14px 30px rgba(8, 63, 90, 0.30)',
  },
  bubble: { position: 'absolute', width: 200, height: 200, borderRadius: 100, top: -80, right: -60, backgroundColor: 'rgba(255,255,255,0.08)' },
  avatarRing: { padding: 4, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 8 },
  name: { fontSize: 21, lineHeight: 28, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  type: { fontSize: 13, color: 'rgba(225,244,250,0.85)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  chipActive: { backgroundColor: 'rgba(46, 204, 128, 0.20)' },
  chipOff: { backgroundColor: 'rgba(255, 120, 136, 0.22)' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.primary, textTransform: 'uppercase', marginTop: 4, marginBottom: -4 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#e3edf2' },
});
