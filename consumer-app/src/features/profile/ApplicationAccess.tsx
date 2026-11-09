import { useCallback, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { Button, Card, Detail, Screen, text } from '@/components/consumer/ui';
import { useConsumerProfile } from './useConsumerProfile';

export function ApplicationAccess({ children }: { children: ReactNode }) {
  const { profile, error, reload } = useConsumerProfile();
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  if (profile?.fullAccess) return children;
  const estimate = profile ? Number(profile.installationFee || 0) + Number(profile.setbackLength || 0) *
    Number(profile.setbackRate || 0) + Number(profile.reinstallationFee || 0) + Number(profile.violationFee || 0) : 0;
  return <Screen title="Application progress">
    <Card>
      <Text style={text.heading}>{profile ? profile.name : 'Loading your application…'}</Text>
      {!!error && <Text>{error}</Text>}
      {!!profile && <>
        <Detail label="Application" value={profile.applicationStatus || 'Pending'} />
        <Text>Applied: {profile.dateApplied || 'Not recorded'}</Text>
        <Text>Approved: {profile.dateApproved || 'Awaiting review'}</Text>
        <Text>{profile.applicationStatus === 'Approved' ? 'Your application is approved. Please wait for installation.' : 'Your application is awaiting review.'}</Text>
        <Text>Barangay certification: {profile.certificateReceived ? 'Received' : 'Pending'}</Text>
        <Text>Service contract: {profile.contractReceived ? 'Received' : 'Pending'}</Text>
        <Text>Accessories acknowledgement: {profile.acknowledgementReceived ? 'Received' : 'Pending'}</Text>
        {profile.applicationStatus === 'Approved' && <Text>Installation estimate: ₱{estimate.toFixed(2)}</Text>}
        <Text>Bills, payments, usage and feedback are available after installation. Notifications and Profile remain available.</Text>
      </>}
      <Button label="Refresh application" onPress={() => void reload()} />
    </Card>
  </Screen>;
}
