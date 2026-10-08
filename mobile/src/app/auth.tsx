import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Brand from '../components/Brand';
import ConnectionCheck from '../components/ConnectionCheck';
import PrimaryButton from '../components/PrimaryButton';
import TextField from '../components/TextField';
import { authenticate } from '../services/api';
import { colors, ui } from '../theme/theme';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const changeMode = (next: 'login' | 'signup') => { if (next === mode) return; setMode(next); setPassword(''); setVisible(false); setError(''); };
  const submit = async () => {
    if (lock.current) return;
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    lock.current = true; setError(''); setBusy(true);
    try { await authenticate(mode, email, password); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to sign in.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Brand />
      <View style={styles.hero}><Text style={styles.tag}>LESS PAPERWORK. MORE CRICKET.</Text><Text style={styles.title}>{mode === 'login' ? 'Back to\nthe game.' : 'Your next\nbig innings.'}</Text><Text style={styles.subtitle}>{mode === 'login' ? 'Your teams. Your matches. Your kind of cricket.' : 'Make an account. Give every game a scoreboard.'}</Text><View style={styles.stamp}><Text style={styles.stampText}>PLAY. SCORE. REPEAT.</Text></View></View>
      <View style={styles.tabs}>{(['login', 'signup'] as const).map(item => <Pressable key={item} disabled={busy} accessibilityRole="tab" accessibilityState={{ selected: mode === item, disabled: busy }} onPress={() => changeMode(item)} style={[styles.tab, mode === item && styles.activeTab]}><Text style={[styles.tabText, mode === item && { color: colors.white }]}>{item === 'login' ? 'Sign in' : 'Create account'}</Text></Pressable>)}</View>
      <Text style={ui.fieldLabel}>Email address</Text>
      <TextField accessibilityLabel="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} maxLength={254} />
      <View style={styles.passwordLabel}><Text style={ui.fieldLabel}>Password</Text><Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} hitSlop={8} onPress={() => setVisible(!visible)} style={styles.show}><Text style={styles.showText}>{visible ? 'Hide' : 'Show'}</Text></Pressable></View>
      <TextField key={mode} accessibilityLabel="Password" value={password} onChangeText={setPassword} placeholder={mode === 'login' ? 'Your password' : 'At least 12 characters'} secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
      {error ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
      <PrimaryButton title={mode === 'login' ? 'Let’s play' : 'Create my account'} loading={busy} onPress={submit} />
      <Text style={styles.footnote}>Your neighbourhood game. A proper scoreboard.</Text>
      <ConnectionCheck />
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ content: { ...ui.content, paddingTop: 28 }, hero: { marginTop: 36, marginBottom: 28 }, tag: { ...ui.eyebrow, fontSize: 9, letterSpacing: 1.5 }, title: { ...ui.title, fontSize: 52, lineHeight: 54, letterSpacing: -2.5 }, subtitle: { ...ui.subtitle, marginBottom: 18 }, stamp: { alignSelf: 'flex-start', backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.ink, padding: 8, transform: [{ rotate: '-2deg' }] }, stampText: { color: colors.ink, fontWeight: '800', fontSize: 10, letterSpacing: 1 }, tabs: { flexDirection: 'row', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 5, padding: 4, marginBottom: 26, gap: 4 }, tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 2, paddingHorizontal: 6 }, activeTab: { backgroundColor: colors.ink }, tabText: { color: colors.muted, fontWeight: '700', fontSize: 14 }, passwordLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, show: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, marginTop: -12 }, showText: { fontWeight: '700', fontSize: 12, color: colors.ink }, footnote: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 24 } });
