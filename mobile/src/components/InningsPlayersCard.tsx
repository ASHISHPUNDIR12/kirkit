import { StyleSheet, Text, View } from 'react-native';
import type { ScoreboardInnings } from '../types/api';
import { colors, ui } from '../theme/theme';
type Player = ScoreboardInnings['players'][number] | undefined;
export default function InningsPlayersCard({ striker, nonStriker, bowler, previousBowler, bowlerChangeRequired }: { striker: Player; nonStriker: Player; bowler: Player; previousBowler: Player; bowlerChangeRequired: boolean }) {
  const shownBowler = bowler ?? previousBowler;
  return <View style={styles.card}>
    <View style={styles.header}><Text style={styles.label}>AT THE CREASE</Text><Text style={styles.label}>R / B</Text></View>
    {[striker, nonStriker].map((player, index) => <View key={index} style={styles.row}><View style={[styles.dot, index === 0 && { backgroundColor: colors.lime }]} /><Text style={styles.name}>{player?.playerName ?? 'Batter needed'}{index === 0 ? ' *' : ''}</Text><Text style={styles.figures}>{player?.runs ?? 0}<Text style={styles.balls}> / {player?.ballsFaced ?? 0}</Text></Text></View>)}
    <View style={styles.bowler}><Text style={styles.bowlerName}>{bowlerChangeRequired ? 'NEXT BOWLER NEEDED' : `BOWLING · ${shownBowler?.playerName ?? '—'}`}</Text>{shownBowler ? <Text style={styles.bowlerStats}>{shownBowler.wicketsTaken}/{shownBowler.runsConceded} ({Math.floor(shownBowler.ballsBowled / 6)}.{shownBowler.ballsBowled % 6})</Text> : null}</View>
  </View>;
}
const styles = StyleSheet.create({ card: { ...ui.card, padding: 14, marginBottom: 16 }, header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, label: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }, dot: { width: 9, height: 9, borderWidth: 1, borderColor: colors.ink, borderRadius: 2 }, name: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.ink }, figures: { fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'], color: colors.ink }, balls: { fontSize: 13, fontWeight: '400', color: colors.muted }, bowler: { borderTopWidth: 1, borderColor: colors.line, marginTop: 8, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'space-between' }, bowlerName: { color: colors.muted, fontSize: 10, fontWeight: '700', flexShrink: 1 }, bowlerStats: { color: colors.ink, fontSize: 12, fontWeight: '700' } });
