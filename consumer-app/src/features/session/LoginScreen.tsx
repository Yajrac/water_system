import { useState } from 'react';
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
import { Button, text } from '@/components/consumer/ui';
import { useSession } from './SessionProvider';
import { colors } from '@/theme/tokens';

export default function LoginScreen() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={styles.form}>
            <Image source={require('../../../assets/images/pwss-logo.jpg')} style={styles.logo} />
            <Text style={styles.eyebrow}>PIO DURAN WATER SUPPLY</Text>
            <Text style={styles.title}>Your water account, all in one place.</Text>
            <Text style={text.muted}>View your bills, track consumption and stay connected.</Text>
            <Input
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Enter your username"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!visible}
              placeholder="Enter your password"
              action={{
                icon: visible ? 'eyeOff' : 'eye',
                label: visible ? 'Hide password' : 'Show password',
                onPress: () => setVisible(!visible),
                active: visible,
              }}
            />
            {error ? (
              <Text accessibilityRole="alert" style={{ color: '#b63a49' }}>
                {error}
              </Text>
            ) : null}
            <Button
              label="Sign in"
              onPress={() => {
                if (!signIn(username, password)) setError('Check your username and password.');
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: 16 },
  logo: { width: 66, height: 66, borderRadius: 33 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.primary },
  title: { fontSize: 27, lineHeight: 36, fontWeight: '700', color: colors.ink },
});
