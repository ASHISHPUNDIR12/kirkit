import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Match } from '../types/api';
import { colors, ui } from '../theme/theme';
const statusLabels = { CREATED: 'READY TO PLAY', IN_PROGRESS: 'IN PROGRESS', COMPLETED: 'FULL TIME' };
export default function MatchCard({ match }: { match: Match }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${match.team1Name} versus ${match.team2Name}`}
    onPress={() => router.push({ pathname: '/matches/[matchId]', params: { matchId: match.id } })}
    style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.subtle }]}>
    <View style={styles.top}><Text style={[styles.badge, match.status === 'IN_PROGRESS' && { backgroundColor: colors.lime }]}>{statusLabels[match.status]}</Text><Text style={styles.meta}>{match.oversLimit} OVERS</Text></View>
    {[match.team1Name, match.team2Name].map((team, index) => <View key={index} style={styles.teamRow}><View style={[styles.avatar, index === 1 && { backgroundColor: colors.lavender }]}><Text style={styles.initial}>{team.slice(0, 2).toUpperCase()}</Text></View><Text style={styles.team}>{team}</Text><Text style={styles.teamNumber}>0{index + 1}</Text></View>)}
    <View style={styles.footer}><Text style={styles.date}>{match.result || new Date(match.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text><Text style={styles.arrow}>↗</Text></View>
  </Pressable>;
}
const styles = StyleSheet.create({ card: { ...ui.card, padding: 16, marginBottom: 14 }, top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 14 }, badge: { color: colors.ink, fontSize: 10, letterSpacing: 0.8, fontWeight: '800', backgroundColor: colors.subtle, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 3 }, meta: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 1 }, teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }, avatar: { width: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderWidth: 1, borderColor: colors.ink, borderRadius: 3 }, initial: { fontWeight: '800', fontSize: 12, color: colors.ink }, team: { fontSize: 19, fontWeight: '800', color: colors.ink, flex: 1, letterSpacing: -0.4 }, teamNumber: { fontSize: 12, color: colors.muted }, footer: { borderTopWidth: 1, borderColor: colors.line, marginTop: 5, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }, date: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 }, arrow: { color: colors.ink, fontSize: 23 } });
