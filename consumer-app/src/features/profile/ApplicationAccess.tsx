import { useCallback, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Detail, Screen, text } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { useConsumerProfile } from './useConsumerProfile';

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.step} accessible accessibilityLabel={label + (done ? ', received' : ', pending')}>
      <View style={[styles.stepIcon, done && styles.stepDone]}>
        <Text style={[styles.stepMark, done && { color: '#ffffff' }]}>{done ? '✓' : '•'}</Text>
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
      <Text style={[styles.stepState, done && { color: colors.success }]}>{done ? 'Received' : 'Pending'}</Text>
    </View>
  );
}

export function ApplicationAccess({ children }: { children: ReactNode }) {
  const { profile, error, reload } = useConsumerProfile();
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  if (profile?.fullAccess) return children;
  const estimate = profile ? Number(profile.installationFee || 0) + Number(profile.setbackLength || 0) *
    Number(profile.setbackRate || 0) + Number(profile.reinstallationFee || 0) + Number(profile.violationFee || 0) : 0;
  const approved = profile?.applicationStatus === 'Approved';
  return <Screen title="Application progress">
    <Card>
      <View style={styles.head}>
        <Text style={[text.heading, { flex: 1 }]}>{profile ? profile.name : 'Loading your application…'}</Text>
        {!!profile && <Badge label={profile.applicationStatus || 'Pending'} paid={approved} />}
      </View>
      {!!error && <Text style={text.muted}>{error}</Text>}
      {!!profile && <>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {approved ? 'Your application is approved. Please wait for installation.' : 'Your application is awaiting review.'}
          </Text>
        </View>
        <Detail label="Applied" value={profile.dateApplied || 'Not recorded'} />
        <Detail label="Approved" value={profile.dateApproved || 'Awaiting review'} />
        {approved && <Detail label="Installation estimate" value={'₱' + estimate.toFixed(2)} strong />}
        <Text style={styles.section}>Requirements</Text>
        <Step label="Barangay certification" done={!!profile.certificateReceived} />
        <Step label="Service contract" done={!!profile.contractReceived} />
        <Step label="Accessories acknowledgement" done={!!profile.acknowledgementReceived} />
        <Text style={text.muted}>Bills, payments, usage and feedback are available after installation. Notifications and Profile remain available.</Text>
      </>}
      <Button label="Refresh application" onPress={() => void reload()} />
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notice: { padding: 14, borderRadius: 14, backgroundColor: colors.tint },
  noticeText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: colors.primary },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.primary, textTransform: 'uppercase', marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.background },
  stepIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  stepDone: { backgroundColor: colors.success },
  stepMark: { fontSize: 14, fontWeight: '800', color: colors.muted },
  stepLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  stepState: { fontSize: 12, fontWeight: '700', color: colors.warning },
});
