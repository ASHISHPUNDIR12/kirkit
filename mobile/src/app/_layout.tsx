import { useEffect, useState, useSyncExternalStore } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import * as Network from 'expo-network';
import { clearSession, getAuthState, restoreSession, subscribeSession } from '../services/session';
import { checkSession } from '../services/authApi';
import { openAccountDatabase } from '../database/open';
import PrimaryButton from '../components/PrimaryButton';
import { colors, ui } from '../theme/theme';

export default function RootLayout() {
  const auth = useSyncExternalStore(subscribeSession, getAuthState, getAuthState);
  const userId = auth.session?.user.id;
  const [database, setDatabase] = useState<{ userId: string; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [recoveryError, setRecoveryError] = useState('');
  useEffect(() => { void restoreSession(); }, []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    const timeout = setTimeout(() => {
      if (active) setDatabase({ userId, error: 'Your local scorebook is taking too long to open. Retry once. If it happens again, send the Expo terminal lines starting with [scorebook]. Your saved matches have not been reset.' });
    }, 15000);
    openAccountDatabase(userId).then(() => {
      clearTimeout(timeout);
      if (active) setDatabase({ userId });
    }).catch(() => {
      clearTimeout(timeout);
      if (active) setDatabase({ userId, error: 'Could not open your saved matches. Retry after checking device storage. Your database has not been reset.' });
    });
    return () => { active = false; clearTimeout(timeout); };
  }, [userId, attempt]);
  useEffect(() => {
    if (!auth.ready || !auth.session) return;
    const check = () => { void checkSession().catch(() => undefined); };
    check();
    const app = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    const network = Network.addNetworkStateListener(state => { if (state.isConnected && state.isInternetReachable !== false) check(); });
    return () => { app.remove(); network.remove(); };
  }, [auth.ready, auth.session]);

  const databaseError = database?.userId === userId ? database?.error : undefined;
  if (!auth.ready || (userId && (database?.userId !== userId || databaseError))) {
    const error = auth.error || databaseError || recoveryError;
    return <View style={[ui.screen, { justifyContent: 'center', padding: 24 }]}><StatusBar style="dark" />
      <Text style={[ui.title, { marginBottom: 20 }]}>Opening your scorebook.</Text>
      {error ? <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><PrimaryButton title="Try again" onPress={() => { setRecoveryError(''); if (!auth.ready) void restoreSession(); else { setDatabase(null); setAttempt(value => value + 1); } }} /><PrimaryButton title="Sign in again — keep matches" variant="secondary" onPress={() => { void clearSession().catch(() => setRecoveryError('Could not remove your saved sign-in. Try again.')); }} /></> : <ActivityIndicator color={colors.ink} />}
    </View>;
  }
  return <>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!auth.session}><Stack.Screen name="auth" /></Stack.Protected>
      <Stack.Protected guard={!!auth.session}>
        <Stack.Screen name="index" /><Stack.Screen name="teams" /><Stack.Screen name="create-match" />
        <Stack.Screen name="setup-innings" /><Stack.Screen name="innings/[inningsId]" /><Stack.Screen name="matches/[matchId]" />
      </Stack.Protected>
    </Stack>
    <StatusBar style="dark" />
  </>;
}
