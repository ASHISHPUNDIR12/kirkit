import { useCallback, useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMatch } from '../../services/api';
import type { MatchDetails } from '../../types/api';

const eventLabels: Record<string, string> = {
  DOT: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', SIX: '6', WICKET: 'W', WIDE: 'Wd +1', NO_BALL: 'Nb +1',
};

export default function MatchDetailsScreen() {
  const { matchId: rawMatchId } = useLocalSearchParams<{ matchId?: string | string[] }>();
  const matchId = Array.isArray(rawMatchId) ? rawMatchId[0] ?? '' : rawMatchId ?? '';
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMatch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMatch(await getMatch(matchId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this match.');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    let active = true;
    getMatch(matchId).then(result => { if (active) setMatch(result); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this match.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <Text style={styles.label}>MATCH DETAILS</Text>
        {loading && !match ? <ActivityIndicator color="#b8e46a" accessibilityLabel="Loading match" style={styles.loader} /> : null}
        {error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={loadMatch} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {match ? (
          <>
            <Text style={styles.title}>{match.team1Name}</Text>
            <Text style={styles.versus}>versus {match.team2Name} · {match.oversLimit} overs</Text>
            {match.result ? <View style={styles.resultCard}><Text style={styles.result}>{match.result}</Text></View> : null}
            {match.innings.length === 0 ? <View style={styles.card}><Text style={styles.empty}>The innings has not started yet.</Text></View> : null}
            {match.innings.map(innings => (
              <View key={innings.id} style={styles.card}>
                <Text style={styles.inningsLabel}>INNINGS {innings.inningsNumber}</Text>
                <Text style={styles.battingTeam}>{innings.battingTeamName}</Text>
                <Text style={styles.score}>{innings.runs}/{innings.wickets}</Text>
                <Text style={styles.overs}>{innings.completedOvers}.{innings.ballsInCurrentOver} overs · {innings.status === 'COMPLETED' ? 'Complete' : 'In progress'}</Text>
                <View style={styles.divider} />
                <Text style={styles.section}>Batting</Text>
                {innings.players.filter(player => player.playerType === 'BATSMAN').map(player => (
                  <View key={player.id} style={styles.statRow}><Text style={styles.player}>{player.playerName}{player.isOut ? ' · out' : ''}</Text><Text style={styles.stat}>{player.runs} ({player.ballsFaced})</Text></View>
                ))}
                <Text style={styles.section}>Bowling</Text>
                {innings.players.filter(player => player.playerType === 'BOWLER').map(player => (
                  <View key={player.id} style={styles.statRow}><Text style={styles.player}>{player.playerName}</Text><Text style={styles.stat}>{player.wicketsTaken}/{player.runsConceded} · {player.ballsBowled} balls</Text></View>
                ))}
                {innings.ballEvents.length ? <Text style={styles.section}>Ball history</Text> : null}
                {innings.ballEvents.map(event => (
                  <View key={event.id} style={styles.eventRow}><Text style={styles.eventPosition}>{event.overNumber}.{event.ballNumber}</Text><Text style={styles.eventBatter}>{event.batsmanName}</Text><Text style={styles.eventResult}>{eventLabels[event.eventType] ?? event.eventType}</Text></View>
                ))}
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#10281b' },
  content: { padding: 24, paddingTop: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 18 },
  backText: { color: '#b8e46a', fontSize: 15 },
  label: { color: '#b8e46a', fontSize: 12, fontWeight: '700', letterSpacing: 3, marginBottom: 14 },
  loader: { padding: 32 },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '800' },
  versus: { color: '#c4d2c8', fontSize: 15, marginTop: 5, marginBottom: 18 },
  card: { backgroundColor: '#f6f8ef', borderRadius: 18, padding: 20, marginBottom: 14 },
  resultCard: { backgroundColor: '#b8e46a', borderRadius: 14, padding: 16, marginBottom: 16 },
  result: { color: '#10281b', fontWeight: '800', fontSize: 18 },
  empty: { color: '#536253', fontSize: 15 },
  inningsLabel: { color: '#257039', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  battingTeam: { color: '#10281b', fontSize: 22, fontWeight: '700', marginTop: 5 },
  score: { color: '#10281b', fontSize: 36, fontWeight: '800', marginTop: 4 },
  overs: { color: '#536253', fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#dbe2d5', marginVertical: 14 },
  section: { color: '#257039', fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 6 },
  player: { color: '#10281b', fontSize: 14, flex: 1 },
  stat: { color: '#536253', fontSize: 13 },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e3e8de' },
  eventPosition: { color: '#74816f', width: 46, fontSize: 12 },
  eventBatter: { color: '#10281b', flex: 1, fontSize: 13 },
  eventResult: { color: '#257039', fontWeight: '800', minWidth: 45, textAlign: 'right' },
  error: { color: '#a3322a', fontSize: 15, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { color: '#257039', fontWeight: '700' },
});
