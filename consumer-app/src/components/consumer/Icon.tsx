import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

const symbols = {
  home: { ios: 'house', android: 'home', web: 'home' },
  bills: { ios: 'doc.text', android: 'description', web: 'description' },
  payments: { ios: 'creditcard', android: 'payments', web: 'payments' },
  news: { ios: 'bell', android: 'notifications', web: 'notifications' },
  feedback: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
  profile: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  water: { ios: 'drop', android: 'water_drop', web: 'water_drop' },
  eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  send: { ios: 'paperplane.fill', android: 'send', web: 'send' },
} as const;

export type IconName = keyof typeof symbols;

export function Icon({
  name,
  size = 22,
  color = colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <SymbolView
      name={symbols[name]}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}
