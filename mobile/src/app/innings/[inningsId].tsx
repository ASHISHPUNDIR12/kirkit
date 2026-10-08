import TextField from "../../components/TextField";
import PrimaryButton from "../../components/PrimaryButton";
import { colors, ui, hardShadow } from "../../theme/theme";
import NameChoices from "../../components/NameChoices";
import { useTeams } from "../../hooks/useTeams";
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  KeyboardAvoidingView,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import InningsScoringControls from "../../components/InningsScoringControls";
import InningsPlayersCard from "../../components/InningsPlayersCard";
import {
  addNewBatsman as saveNewBatsman,
  changeBowler as saveNextBowler,
  endInnings as endSavedInnings,
  finishMatch as finishSavedMatch,
  getInnings,
  undoLastAction,
  recordExtra as saveExtra,
  recordScore,
  recordWicket as saveWicket,
  startSecondInnings as createSecondInnings,
} from "../../services/api";
import type { ExtraEventType, ScoreboardInnings } from "../../types/api";

export default function ScoreScreen() {
  const { inningsId: rawInningsId } = useLocalSearchParams<{
    inningsId?: string | string[];
  }>();
  const inningsId = Array.isArray(rawInningsId)
    ? (rawInningsId[0] ?? "")
    : (rawInningsId ?? "");
  const [innings, setInnings] = useState<ScoreboardInnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRuns, setSavingRuns] = useState<number | null>(null);
  const [nextBowlerName, setNextBowlerName] = useState("");
  const [changingBowler, setChangingBowler] = useState(false);
  const [newBatsmanName, setNewBatsmanName] = useState("");
  const [savingBatsman, setSavingBatsman] = useState(false);
  const [savingWicket, setSavingWicket] = useState(false);
  const [savingExtra, setSavingExtra] = useState(false);
  const [endingInnings, setEndingInnings] = useState(false);
  const [secondStriker, setSecondStriker] = useState("");
  const [secondNonStriker, setSecondNonStriker] = useState("");
  const [secondBowler, setSecondBowler] = useState("");
  const [startingSecond, setStartingSecond] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const [undoing, setUndoing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const { teams } = useTeams();
  const busy = savingRuns !== null || changingBowler || savingBatsman || savingWicket || savingExtra || endingInnings || startingSecond || undoing;
  const battingId = innings?.battingTeamName === innings?.match.team1Name ? innings?.match.team1Id : innings?.match.team2Id;
  const bowlingId = innings?.battingTeamName === innings?.match.team1Name ? innings?.match.team2Id : innings?.match.team1Id;
  const battingNames = teams.find(team => team.id === battingId)?.players.map(player => player.name) ?? [];
  const bowlingNames = teams.find(team => team.id === bowlingId)?.players.map(player => player.name) ?? [];

  async function undo() {
    if (!innings || saving.current) return;
    saving.current = true; setUndoing(true); setError("");
    try { setInnings(await undoLastAction(inningsId, innings.match.revision)); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to undo."); }
    finally { saving.current = false; setUndoing(false); }
  }

  const fetchInnings = useCallback(() => {
    if (!inningsId)
      return Promise.reject(
        new Error(
          "Innings details are missing. Return Home and open the match setup again.",
        ),
      );
    return getInnings(inningsId);
  }, [inningsId]);

  const loadInnings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInnings(await fetchInnings());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load the scoreboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchInnings]);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchInnings()
      .then((result) => {
        if (active) {
          setInnings(result);
          setError("");
        }
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the scoreboard.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchInnings]));

  async function addRuns(runs: number) {
    if (!inningsId || saving.current) return;
    saving.current = true;
    setSavingRuns(runs);
    setError("");
    try {
      // Use the API response as the scoreboard state so the database remains authoritative.
      setInnings(await recordScore(inningsId, runs, innings?.match.revision));
    } catch (scoreError) {
      setError(
        scoreError instanceof Error
          ? scoreError.message
          : "Unable to save this delivery.",
      );
    } finally {
      saving.current = false;
      setSavingRuns(null);
    }
  }

  async function changeBowler() {
    if (!inningsId || !nextBowlerName.trim() || saving.current) return;
    saving.current = true;
    setChangingBowler(true);
    setError("");
    try {
      setInnings(await saveNextBowler(inningsId, nextBowlerName.trim(), innings?.match.revision));
      setNextBowlerName("");
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : "Unable to change the bowler.",
      );
    } finally {
      saving.current = false;
      setChangingBowler(false);
    }
  }

  async function recordWicket() {
    if (!inningsId || saving.current) return;
    saving.current = true;
    setSavingWicket(true);
    setError("");
    try {
      setInnings(await saveWicket(inningsId, innings?.match.revision));
    } catch (wicketError) {
      setError(
        wicketError instanceof Error
          ? wicketError.message
          : "Unable to record the wicket.",
      );
    } finally {
      saving.current = false;
      setSavingWicket(false);
    }
  }

  async function addNewBatsman() {
    if (!inningsId || !newBatsmanName.trim() || saving.current) return;
    saving.current = true;
    setSavingBatsman(true);
    setError("");
    try {
      setInnings(await saveNewBatsman(inningsId, newBatsmanName.trim(), innings?.match.revision));
      setNewBatsmanName("");
    } catch (batsmanError) {
      setError(
        batsmanError instanceof Error
          ? batsmanError.message
          : "Unable to add the new batsman.",
      );
    } finally {
      saving.current = false;
      setSavingBatsman(false);
    }
  }

  async function addExtra(eventType: ExtraEventType) {
    if (!inningsId || saving.current) return;
    saving.current = true;
    setSavingExtra(true);
    setError("");
    try {
      setInnings(await saveExtra(inningsId, eventType, innings?.match.revision));
    } catch (extraError) {
      setError(
        extraError instanceof Error
          ? extraError.message
          : "Unable to record the extra.",
      );
    } finally {
      saving.current = false;
      setSavingExtra(false);
    }
  }

  async function endInnings() {
    if (!inningsId || saving.current) return;
    saving.current = true;
    setEndingInnings(true);
    setError("");
    try {
      if (innings?.inningsNumber === 2) {
        await finishSavedMatch(innings.match.id, innings.match.revision);
        setInnings(await getInnings(inningsId));
      } else {
        setInnings(await endSavedInnings(inningsId, innings?.match.revision));
      }
    } catch (endError) {
      setError(
        endError instanceof Error
          ? endError.message
          : "Unable to finish this innings.",
      );
    } finally {
      saving.current = false;
      setEndingInnings(false);
    }
  }

  async function startSecondInnings() {
    if (!innings || saving.current) return;
    const strikerName = secondStriker.trim();
    const nonStrikerName = secondNonStriker.trim();
    const bowlerName = secondBowler.trim();
    if (!strikerName || !nonStrikerName || !bowlerName) {
      setError("Enter the second-innings striker, non-striker, and bowler.");
      return;
    }
    if (strikerName.toLowerCase() === nonStrikerName.toLowerCase()) {
      setError("Enter a different name for each opening batsman.");
      return;
    }
    saving.current = true;
    setStartingSecond(true);
    setError("");
    try {
      const second = await createSecondInnings(innings.match.id, {
        strikerName,
        nonStrikerName,
        bowlerName,
      });
      router.replace({
        pathname: "/innings/[inningsId]",
        params: { inningsId: second.id },
      });
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Unable to start the second innings.",
      );
    } finally {
      saving.current = false;
      setStartingSecond(false);
    }
  }

  const striker = innings?.players.find(
    (player) => player.activeRole === "STRIKER",
  );
  const nonStriker = innings?.players.find(
    (player) => player.activeRole === "NON_STRIKER",
  );
  const bowler = innings?.players.find(
    (player) => player.activeRole === "BOWLER",
  );
  const shownBowler =
    bowler ??
    innings?.players.find(
      (player) =>
        player.playerType === "BOWLER" &&
        player.playerName === innings.ballEvents[0]?.bowlerName,
    );
  const bowlerChangeRequired = Boolean(
    innings &&
    !bowler &&
    innings.completedOvers > 0 &&
    innings.ballsInCurrentOver === 0,
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.replace("/")}
          style={styles.back}
        >
          <Text style={styles.backText}>← Match centre</Text>
        </Pressable>
        <Text style={styles.label}>{innings?.status === "COMPLETED" ? "INNINGS COMPLETE" : "THE LIVE SCOREBOOK"}</Text>
        {loading && !innings ? (
          <ActivityIndicator
            color={colors.ink}
            accessibilityLabel="Loading scoreboard"
            style={styles.loader}
          />
        ) : null}
        {error && !innings ? (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setLoading(true);
                void loadInnings();
              }}
              style={styles.retry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {innings ? (
          <>
            <Text style={styles.team}>{innings.battingTeamName}</Text>
            <View style={styles.scoreCard}>
              <Text style={styles.score}>
                {innings.runs}
                <Text style={styles.wickets}> / {innings.wickets}</Text>
              </Text>
              <Text style={styles.scoreCaption}>RUNS / WICKETS</Text>
              <View style={styles.scoreMeta}><Text style={styles.overText}>{innings.completedOvers}.{innings.ballsInCurrentOver} <Text style={styles.overLimit}>/ {innings.match.oversLimit} overs</Text></Text><Text style={styles.overLimit}>INNINGS 0{innings.inningsNumber}</Text></View>
            </View>
            <View style={styles.recentRow}><Text style={styles.recentLabel}>LAST BALLS</Text><View style={styles.balls}>{[...innings.ballEvents].sort((a, b) => a.sequence - b.sequence).slice(-6).map(event => <View key={event.id} style={[styles.ball, event.eventType === 'WICKET' && { backgroundColor: colors.coral }, event.runs >= 4 && { backgroundColor: colors.lime }]}><Text style={styles.ballText}>{event.eventType === 'WICKET' ? 'W' : event.eventType === 'WIDE' ? 'Wd' : event.eventType === 'NO_BALL' ? 'Nb' : event.runs}</Text></View>)}{!innings.ballEvents.length ? <Text style={styles.overLimit}>First ball awaits.</Text> : null}</View></View>
            <InningsPlayersCard
              striker={striker}
              nonStriker={nonStriker}
              bowler={bowler}
              previousBowler={shownBowler}
              bowlerChangeRequired={bowlerChangeRequired}
            />
            {innings.inningsNumber === 2 && innings.match.target !== null ? (
              <View style={styles.chaseCard}>
                <Text style={styles.chaseTarget}>
                  Target: {innings.match.target}
                </Text>
                <Text style={styles.chaseRequired}>
                  Required: {Math.max(0, innings.match.target - innings.runs)}{" "}
                  runs · Balls remaining:{" "}
                  {Math.max(
                    0,
                    innings.match.oversLimit * 6 -
                      innings.completedOvers * 6 -
                      innings.ballsInCurrentOver,
                  )}
                </Text>
              </View>
            ) : null}
            {innings.status === "COMPLETED" &&
            innings.inningsNumber === 1 &&
            innings.match.currentInnings === 1 ? (
              <View style={styles.nextBowlerCard}>
                <Text style={styles.sectionTitleDark}>
                  First innings complete
                </Text>
                <Text style={styles.targetText}>
                  Target: {innings.match.target}
                </Text>
                <Text style={styles.nextBowlerHint}>
                  {innings.bowlingTeamName} will chase {innings.match.target}.
                </Text>
                <NameChoices names={bowlingNames.filter(name => name !== secondNonStriker)} onSelect={setSecondStriker} disabled={busy} />
                <TextField
                  accessibilityLabel="Second innings striker"
                  value={secondStriker}
                  onChangeText={setSecondStriker}
                  placeholder="Opening striker"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!busy}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <NameChoices names={bowlingNames.filter(name => name !== secondStriker)} onSelect={setSecondNonStriker} disabled={busy} />
                <TextField
                  accessibilityLabel="Second innings non-striker"
                  value={secondNonStriker}
                  onChangeText={setSecondNonStriker}
                  placeholder="Non-striker"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!busy}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <NameChoices names={battingNames} onSelect={setSecondBowler} disabled={busy} />
                <TextField
                  accessibilityLabel="Second innings bowler"
                  value={secondBowler}
                  onChangeText={setSecondBowler}
                  placeholder="Opening bowler"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!busy}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    void startSecondInnings();
                  }}
                  style={({ pressed }) => [
                    styles.changeButton,
                    pressed && styles.pressed,
                    startingSecond && styles.disabled,
                  ]}
                >
                  <Text style={styles.changeButtonText}>
                    {startingSecond ? "Starting…" : "Start Second Innings"}
                  </Text>
                </Pressable>
              </View>
            ) : innings.status === "COMPLETED" ? (
              <View style={styles.nextBowlerCard}>
                <Text style={styles.sectionTitleDark}>Innings complete</Text>
                {innings.match.result ? (
                  <Text style={styles.targetText}>{innings.match.result}</Text>
                ) : null}
                {innings.match.target && innings.inningsNumber === 2 ? (
                  <Text style={styles.nextBowlerHint}>
                    Target: {innings.match.target}
                  </Text>
                ) : null}
              </View>
            ) : innings.pendingBatsmanRole ? (
              <View style={styles.nextBowlerCard}>
                <Text style={styles.sectionTitleDark}>Wicket! New batsman</Text>
                <Text style={styles.nextBowlerHint}>
                  Enter the next batsman to continue.
                </Text>
                <NameChoices names={battingNames.filter(name => !innings.players.some(player => player.playerType === "BATSMAN" && player.playerName.toLowerCase() === name.toLowerCase()))} onSelect={setNewBatsmanName} disabled={busy} />
                <TextField
                  accessibilityLabel="New batsman name"
                  value={newBatsmanName}
                  onChangeText={setNewBatsmanName}
                  placeholder="e.g. Sameer"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!busy}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !newBatsmanName.trim()}
                  onPress={() => {
                    void addNewBatsman();
                  }}
                  style={({ pressed }) => [
                    styles.changeButton,
                    pressed && styles.pressed,
                    (savingBatsman || !newBatsmanName.trim()) &&
                      styles.disabled,
                  ]}
                >
                  <Text style={styles.changeButtonText}>
                    {savingBatsman ? "Saving…" : "Add Batsman"}
                  </Text>
                </Pressable>
              </View>
            ) : bowlerChangeRequired ? (
              <View style={styles.nextBowlerCard}>
                <Text style={styles.sectionTitleDark}>Over complete</Text>
                <Text style={styles.nextBowlerHint}>
                  Enter the bowler for the next over.
                </Text>
                <NameChoices names={bowlingNames} onSelect={setNextBowlerName} disabled={busy} />
                <TextField
                  accessibilityLabel="Next bowler name"
                  value={nextBowlerName}
                  onChangeText={setNextBowlerName}
                  placeholder="e.g. Aman"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!busy}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !nextBowlerName.trim()}
                  onPress={() => {
                    void changeBowler();
                  }}
                  style={({ pressed }) => [
                    styles.changeButton,
                    pressed && styles.pressed,
                    (changingBowler || !nextBowlerName.trim()) &&
                      styles.disabled,
                  ]}
                >
                  <Text style={styles.changeButtonText}>
                    {changingBowler ? "Saving…" : "Start Next Over"}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <InningsScoringControls
                  busy={busy || loading}
                  savingRuns={savingRuns}
                  savingWicket={savingWicket}
                  savingExtra={savingExtra}
                  onRuns={(runs) => {
                    void addRuns(runs);
                  }}
                  onWicket={() => {
                    void recordWicket();
                  }}
                  onExtra={(eventType) => {
                    void addExtra(eventType);
                  }}
                />
              </>
            )}
            <Pressable accessibilityRole="button" disabled={busy || !innings.canUndo} onPress={() => void undo()} style={[styles.undoButton, (busy || !innings.canUndo) && styles.disabled]}>
              <Text style={styles.undoText}>{undoing ? "Undoing…" : `Undo ${innings.undoLabel ?? "last action"}`}</Text>
            </Pressable>
            {innings.status === "IN_PROGRESS" ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => {
                  setConfirmEnd(true);
                }}
                style={({ pressed }) => [
                  styles.finishButton,
                  pressed && styles.pressed,
                  endingInnings && styles.disabled,
                ]}
              >
                <Text style={styles.finishText}>
                  {endingInnings ? "Finishing…" : "Finish Innings"}
                </Text>
              </Pressable>
            ) : null}
            {confirmEnd && innings.status === "IN_PROGRESS" ? <View style={styles.confirmCard}><Text style={styles.sectionTitleDark}>Finish this innings?</Text><Text style={styles.nextBowlerHint}>This closes the current innings at {innings.runs}/{innings.wickets}.</Text><PrimaryButton title="Yes, finish innings" loading={busy} onPress={() => { setConfirmEnd(false); void endInnings(); }} /><Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmEnd(false)} style={styles.retry}><Text style={styles.backText}>Keep playing</Text></Pressable></View> : null}
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.inlineError}
              >
                {error}
              </Text>
            ) : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void loadInnings()} style={styles.retry}>
              <Text style={styles.backText}>Refresh scoreboard</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push({ pathname: "/matches/[matchId]", params: { matchId: innings.match.id } })} style={styles.retry}>
              <Text style={styles.backText}>Full scorecard</Text>
            </Pressable>

          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 screen: ui.screen, content: { ...ui.content, paddingTop: 8 }, back: { ...ui.back, marginBottom: 6 }, backText: ui.backText,
 label: { ...ui.eyebrow, marginBottom: 8 }, loader: { padding: 32 }, team: { color: colors.ink, fontSize: 26, fontWeight: '900', letterSpacing: -0.7, marginBottom: 12 },
 scoreCard: { ...ui.card, ...hardShadow, backgroundColor: colors.lime, padding: 16, marginBottom: 18 }, score: { color: colors.ink, fontSize: 58, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] }, wickets: { fontSize: 34, fontWeight: '600', letterSpacing: -1 }, scoreCaption: { color: colors.ink, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }, scoreMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#99AF42', marginTop: 14, paddingTop: 10 }, overText: { color: colors.ink, fontSize: 19, fontWeight: '800' }, overLimit: { color: colors.muted, fontSize: 11, fontWeight: '600' },
 recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }, recentLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 }, balls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 }, ball: { borderWidth: 1, borderColor: colors.ink, borderRadius: 3, minWidth: 28, minHeight: 28, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }, ballText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
 chaseCard: { ...ui.card, backgroundColor: colors.lavender, padding: 14 }, chaseTarget: { color: colors.ink, fontSize: 18, fontWeight: '800' }, chaseRequired: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 }, notice: ui.card, nextBowlerCard: ui.card, sectionTitleDark: { color: colors.ink, fontSize: 20, fontWeight: '800', marginBottom: 12 }, nextBowlerHint: { color: colors.muted, fontSize: 14, lineHeight: 22, marginBottom: 14 }, input: ui.input,
 changeButton: { ...hardShadow, minHeight: 54, backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, justifyContent: 'center', alignItems: 'center', padding: 14 }, changeButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' }, targetText: { color: colors.ink, fontSize: 26, fontWeight: '800', marginBottom: 8 }, finishButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, finishText: { color: colors.error, fontSize: 13, fontWeight: '700' }, undoButton: { minHeight: 48, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginTop: 16, padding: 10 }, undoText: { color: colors.ink, fontSize: 14, fontWeight: '700' }, confirmCard: { ...ui.card, backgroundColor: colors.coral, marginTop: 12 },
 pressed: { opacity: 0.65 }, disabled: { opacity: 0.4 }, inlineError: { ...ui.error, marginTop: 12 }, hint: ui.subtitle, error: ui.error, retry: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' }, retryText: ui.backText,
});
