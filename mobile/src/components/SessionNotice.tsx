import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { authenticate, checkSession } from '../services/authApi';
import { getSession, subscribeSession } from '../services/session';
import PrimaryButton from './PrimaryButton';
import TextField from './TextField';
import { colors, ui } from '../theme/theme';

export default function SessionNotice() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session) return null;
  const expired = !session.token;
  if (!expired) return <Text style={[ui.eyebrow, { letterSpacing: 0.5 }]}>SAVED ON THIS DEVICE · WORKS OFFLINE</Text>;
  return <View style={[ui.card, { backgroundColor: colors.lavender }]}>
    <Text style={ui.fieldLabel}>Your matches are available offline.</Text>
    <Text style={{ color: colors.muted, lineHeight: 21 }}>Your online sign-in expired. Sign in again only when you need online services.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => { setOpen(!open); setPassword(''); setError(''); }} style={ui.back}><Text style={ui.backText}>{open ? 'Keep playing offline' : 'Sign in again'}</Text></Pressable>
    {open ? <><Text style={ui.fieldLabel}>{session.user.email}</Text><TextField accessibilityLabel="Password to renew sign-in" placeholder="Password" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" />{error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}<PrimaryButton title="Renew sign-in" loading={busy} onPress={async () => {
      if (busy) return;
      setBusy(true); setError('');
      try { await authenticate('login', session.user.email, password); setPassword(''); setOpen(false); void checkSession(); }
      catch (error) { setError(error instanceof Error ? error.message : 'Unable to sign in.'); }
      finally { setBusy(false); }
    }} /></> : null}
  </View>;
}
