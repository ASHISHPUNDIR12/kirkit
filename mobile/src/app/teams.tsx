import TextField from "../components/TextField";
import { colors, ui } from "../theme/theme";
import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addTeamPlayer, createTeam } from '../services/api';
import { useTeams } from '../hooks/useTeams';
import PrimaryButton from '../components/PrimaryButton';
export default function TeamsScreen() {
  const { teams, error: loadError, refresh } = useTeams();
  const [name, setName] = useState('');
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  async function save(teamId?: string) {
    if (lock.current) return;
    if (!(teamId ? playerNames[teamId] : name)?.trim()) { setError(teamId ? 'Enter a player name.' : 'Enter a team name.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      if (teamId) { await addTeamPlayer(teamId, playerNames[teamId] ?? ''); setPlayerNames(value => ({ ...value, [teamId]: '' })); }
      else { await createTeam(name); setName(''); }
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityRole="button" style={ui.back}><Text style={ui.backText}>← Match centre</Text></Pressable>
    <Text style={ui.eyebrow}>THE CLUBHOUSE</Text><Text style={ui.title}>Good teams.{"\n"}Great stories.</Text>
    <Text style={ui.subtitle}>Build your squad once. Bring them to every game.</Text>
    <View style={styles.summary}><Text style={styles.summaryNumber}>{teams.length.toString().padStart(2, '0')}</Text><Text style={styles.summaryLabel}>SAVED TEAMS</Text><View style={styles.summaryDivider} /><Text style={styles.summaryNumber}>{teams.reduce((count, team) => count + team.players.length, 0).toString().padStart(2, '0')}</Text><Text style={styles.summaryLabel}>PLAYERS</Text></View>
    {error || loadError ? <Text accessibilityRole="alert" style={ui.error}>{error || loadError}</Text> : null}
    <View style={styles.section}><Text style={styles.heading}>Your squads</Text><Pressable onPress={() => void refresh()} accessibilityRole="button" accessibilityLabel="Refresh teams and statistics" style={styles.refresh}><Text style={styles.refreshText}>↻</Text></Pressable></View>
    {teams.map((team, index) => <View key={team.id} style={ui.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === team.id }} onPress={() => setExpanded(expanded === team.id ? null : team.id)} style={styles.teamHeader}><View style={styles.numberBox}><Text style={styles.number}>{(index + 1).toString().padStart(2, '0')}</Text></View><View style={{ flex: 1 }}><Text style={styles.teamName}>{team.name}</Text><Text style={styles.meta}>{team.players.length} players · View squad & stats</Text></View><Text style={styles.expand}>{expanded === team.id ? '−' : '+'}</Text></Pressable>
      {expanded === team.id ? <>
      {team.players.map(player => <View key={player.id} style={styles.player}><Text style={styles.name}>{player.name}</Text><View style={styles.statsRow}>{[[player.stats.matches, 'MATCHES'], [player.stats.runs, 'RUNS'], [player.stats.wickets, 'WICKETS']].map(([value, label]) => <View key={label} style={styles.stat}><Text style={styles.statNumber}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}</View><Text style={styles.meta}>Strike rate {player.stats.strikeRate?.toFixed(1) ?? '—'} · Average {player.stats.average?.toFixed(1) ?? '—'} · Economy {player.stats.economy?.toFixed(1) ?? '—'}</Text></View>)}
      {!team.players.length ? <Text style={styles.empty}>A team needs its people. Add your first player below.</Text> : null}
      <Text style={[ui.fieldLabel, { marginTop: 18 }]}>Add a player</Text><TextField accessibilityLabel={`New player for ${team.name}`} placeholder="Player’s name" value={playerNames[team.id] ?? ''} onChangeText={value => setPlayerNames(names => ({ ...names, [team.id]: value }))} maxLength={60} editable={!busy} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void save(team.id)} />
      <PrimaryButton title="Add to squad" variant="secondary" loading={busy} onPress={() => void save(team.id)} />
      </> : null}
    </View>)}
    <View style={[ui.card, { backgroundColor: colors.lavender }]}><Text style={styles.heading}>Start a new squad.</Text><Text style={styles.empty}>Give your team a name. Add players next.</Text><Text style={ui.fieldLabel}>Team name</Text><TextField accessibilityLabel="New team name" placeholder="e.g. The Boundary Boys" value={name} onChangeText={setName} maxLength={60} editable={!busy} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void save()} /><PrimaryButton title="Create team" loading={busy} onPress={() => void save()} /></View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ summary: { ...ui.card, backgroundColor: colors.lime, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 16 }, summaryNumber: { fontSize: 28, fontWeight: '900', color: colors.ink }, summaryLabel: { fontSize: 9, letterSpacing: 1, color: colors.ink, fontWeight: '700' }, summaryDivider: { width: 1, height: 24, backgroundColor: colors.ink, marginHorizontal: 4 }, section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, heading: { color: colors.ink, fontSize: 23, fontWeight: '800', letterSpacing: -0.6 }, refresh: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, refreshText: { fontSize: 26, color: colors.ink }, teamHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 }, numberBox: { borderWidth: 1.5, borderColor: colors.ink, backgroundColor: colors.lavender, borderRadius: 3, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, number: { fontSize: 16, fontWeight: '800', color: colors.ink }, teamName: { fontSize: 20, fontWeight: '800', color: colors.ink }, meta: { fontSize: 11, lineHeight: 18, color: colors.muted, marginTop: 4 }, expand: { color: colors.ink, fontSize: 26 }, player: { paddingVertical: 18, borderBottomWidth: 1, borderColor: colors.line }, name: { fontSize: 17, fontWeight: '800', color: colors.ink }, statsRow: { flexDirection: 'row', marginTop: 12, marginBottom: 8 }, stat: { flex: 1 }, statNumber: { color: colors.ink, fontWeight: '800', fontSize: 23, fontVariant: ['tabular-nums'] }, statLabel: { fontSize: 8, letterSpacing: 1, color: colors.muted, marginTop: 3 }, empty: { color: colors.muted, fontSize: 14, lineHeight: 22, marginVertical: 16 } });
