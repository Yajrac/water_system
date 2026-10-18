import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/tokens';

export function Avatar({ size = 48, active }: { size?: number; active: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={active ? 'Account active' : 'Account inactive'}
      style={{ width: size, height: size }}
    >
      <Image
        source={require('../../../assets/images/avatar-female.svg')}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
      <View style={[styles.dot, !active && { backgroundColor: colors.muted }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: '#28b463',
  },
});
