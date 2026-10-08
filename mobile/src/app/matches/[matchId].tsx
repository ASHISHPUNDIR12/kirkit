import PrimaryButton from "../../components/PrimaryButton";
import { colors, ui } from "../../theme/theme";
import ScorecardDetails from "../../components/ScorecardDetails";
import { useCallback, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMatch } from '../../services/api';
import type { MatchDetails } from '../../types/api';
import { exportScorecardPdf } from '../../export/pdf';

const eventLabels: Record<string, string> = {
  DOT: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4', SIX: '6', WICKET: 'W', WIDE: 'Wd +1', NO_BALL: 'Nb +1',
};

export default function MatchDetailsScreen() {
  const { matchId: rawMatchId } = useLocalSearchParams<{ matchId?: string | string[] }>();
  const matchId = Array.isArray(rawMatchId) ? rawMatchId[0] ?? '' : rawMatchId ?? '';
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInnings, setSelectedInnings] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const downloadScorecard = async () => {
    if (!match) return;
    setExporting(true);
    setExportError('');
    try {
      await exportScorecardPdf(match);
    } catch (exportFailure) {
      setExportError(exportFailure instanceof Error ? `Could not create or share the PDF. ${exportFailure.message}` : 'Could not create or share the PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

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

  useFocusEffect(useCallback(() => {
    let active = true;
    getMatch(matchId).then(result => { if (active) setMatch(result); })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load this match.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId]));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.label}>THE MATCH REPORT</Text>
        {loading && !match ? <ActivityIndicator color={colors.ink} accessibilityLabel="Loading match" style={styles.loader} /> : null}
        {error ? <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={loadMatch} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {match ? (
          <>
            <Text style={styles.title}>{match.team1Name}</Text>
            <Text style={styles.versus}>versus {match.team2Name} · {match.oversLimit} overs</Text>
            {match.result ? <View style={styles.resultCard}><Text style={styles.result}>{match.result}</Text></View> : null}
            <View style={styles.exportCard}><PrimaryButton title={exporting ? 'Preparing scorecard…' : 'Download scorecard PDF'} loading={exporting} onPress={downloadScorecard} />{exportError ? <Text accessibilityRole="alert" style={styles.error}>{exportError}</Text> : null}</View>
            {match.innings.length === 0 ? <View style={styles.card}><Text style={styles.empty}>The teams are ready. Pick your opening players to get started.</Text><PrimaryButton title="Set up first innings" onPress={() => router.push({ pathname: '/setup-innings', params: { matchId: match.id, team1Name: match.team1Name, team2Name: match.team2Name } })} /></View> : null}
            {match.innings.length > 1 ? <View style={styles.tabs}>{match.innings.map(innings => <Pressable key={innings.id} accessibilityRole="tab" accessibilityState={{ selected: (selectedInnings ?? match.currentInnings) === innings.inningsNumber }} onPress={() => { setSelectedInnings(innings.inningsNumber); setShowHistory(false); }} style={[styles.tab, (selectedInnings ?? match.currentInnings) === innings.inningsNumber && { backgroundColor: colors.lime }]}><Text style={styles.tabText}>Innings {innings.inningsNumber}</Text><Text style={styles.tabTeam}>{innings.battingTeamName}</Text></Pressable>)}</View> : null}
            {match.innings.filter(innings => innings.inningsNumber === (selectedInnings ?? match.currentInnings)).map(innings => (
              <View key={innings.id} style={styles.card}>
                <Text style={styles.inningsLabel}>INNINGS {innings.inningsNumber}</Text>
                <Text style={styles.battingTeam}>{innings.battingTeamName}</Text>
                <Text style={styles.score}>{innings.runs}/{innings.wickets}</Text>
                <Text style={styles.overs}>{innings.completedOvers}.{innings.ballsInCurrentOver} overs · {innings.status === 'COMPLETED' ? 'Complete' : 'In progress'}</Text>
                {innings.inningsNumber === match.currentInnings ? <View style={{ marginTop: 18 }}><PrimaryButton title={innings.status === 'IN_PROGRESS' ? 'Continue scoring' : 'Open scoreboard / undo'} onPress={() => router.push({ pathname: '/innings/[inningsId]', params: { inningsId: innings.id } })} /></View> : null}
                <View style={styles.divider} />
                {innings.scorecard ? <ScorecardDetails card={innings.scorecard} /> : null}

                {innings.ballEvents.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHistory }} onPress={() => setShowHistory(!showHistory)} style={styles.historyToggle}><Text style={styles.section}>Delivery history ({innings.ballEvents.length})</Text><Text style={styles.tabText}>{showHistory ? '−' : '+'}</Text></Pressable> : null}
                {showHistory && innings.ballEvents.map(event => (
                  <View key={event.id} style={styles.eventRow}><Text style={styles.eventPosition}>{event.overNumber - 1}.{event.ballNumber}</Text><Text style={styles.eventBatter}>{event.batsmanName}</Text><Text style={styles.eventResult}>{eventLabels[event.eventType] ?? event.eventType}</Text></View>
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
 screen: ui.screen, content: ui.content, back: ui.back, backText: ui.backText, label: ui.eyebrow, loader: { padding: 32 }, title: ui.title, exportCard: { marginTop: 16, marginBottom: 8 },
 versus: { ...ui.subtitle, marginTop: 8 }, card: ui.card, resultCard: { ...ui.card, backgroundColor: colors.lime }, result: { color: colors.ink, fontWeight: '800', fontSize: 21, lineHeight: 28 }, empty: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 20 }, inningsLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, battingTeam: { color: colors.ink, fontSize: 24, fontWeight: '800', marginTop: 8 }, score: { color: colors.ink, fontSize: 48, letterSpacing: -1.5, fontWeight: '900', marginTop: 6, fontVariant: ['tabular-nums'] }, overs: { color: colors.muted, fontSize: 12, marginTop: 4 }, divider: ui.divider,
 section: { color: colors.ink, fontSize: 14, fontWeight: '800', flex: 1 }, eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line, gap: 10 }, eventPosition: { color: colors.muted, width: 36, fontSize: 12 }, eventBatter: { color: colors.ink, flex: 1, fontSize: 13 }, eventResult: { color: colors.ink, fontWeight: '800', minWidth: 45, textAlign: 'right' }, error: ui.error, retry: ui.back, retryText: ui.backText,
 tabs: { flexDirection: 'row', gap: 10, marginBottom: 18 }, tab: { flex: 1, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, padding: 12, minHeight: 64 }, tabText: { color: colors.ink, fontSize: 14, fontWeight: '800' }, tabTeam: { color: colors.muted, fontSize: 11, marginTop: 4 }, historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderTopWidth: 1, borderColor: colors.ink, marginTop: 22 },
});
