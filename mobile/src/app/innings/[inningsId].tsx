import { useCallback, useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

  useEffect(() => {
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
  }, [fetchInnings]);

  async function addRuns(runs: number) {
    if (!inningsId || saving.current) return;
    saving.current = true;
    setSavingRuns(runs);
    setError("");
    try {
      // Use the API response as the scoreboard state so the database remains authoritative.
      setInnings(await recordScore(inningsId, runs));
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
      setInnings(await saveNextBowler(inningsId, nextBowlerName.trim()));
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
      setInnings(await saveWicket(inningsId));
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
      setInnings(await saveNewBatsman(inningsId, newBatsmanName.trim()));
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
      setInnings(await saveExtra(inningsId, eventType));
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
        await finishSavedMatch(innings.match.id);
        setInnings(await getInnings(inningsId));
      } else {
        setInnings(await endSavedInnings(inningsId));
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
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.replace("/")}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Back to Home</Text>
        </Pressable>
        <Text style={styles.label}>GULLY CRICKET</Text>
        {loading && !innings ? (
          <ActivityIndicator
            color="#b8e46a"
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
            </View>
            <InningsPlayersCard
              striker={striker}
              nonStriker={nonStriker}
              bowler={bowler}
              previousBowler={shownBowler}
              bowlerChangeRequired={bowlerChangeRequired}
            />
            <View style={styles.overStatus}>
              <Text style={styles.overText}>
                {innings.completedOvers}.{innings.ballsInCurrentOver} overs
              </Text>
              <Text style={styles.overLimit}>
                of {innings.match.oversLimit} overs
              </Text>
            </View>
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
                <TextInput
                  accessibilityLabel="Second innings striker"
                  value={secondStriker}
                  onChangeText={setSecondStriker}
                  placeholder="Opening striker"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!startingSecond}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <TextInput
                  accessibilityLabel="Second innings non-striker"
                  value={secondNonStriker}
                  onChangeText={setSecondNonStriker}
                  placeholder="Non-striker"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!startingSecond}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <TextInput
                  accessibilityLabel="Second innings bowler"
                  value={secondBowler}
                  onChangeText={setSecondBowler}
                  placeholder="Opening bowler"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!startingSecond}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={startingSecond}
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
                <TextInput
                  accessibilityLabel="New batsman name"
                  value={newBatsmanName}
                  onChangeText={setNewBatsmanName}
                  placeholder="e.g. Sameer"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!savingBatsman}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={savingBatsman || !newBatsmanName.trim()}
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
                <TextInput
                  accessibilityLabel="Next bowler name"
                  value={nextBowlerName}
                  onChangeText={setNextBowlerName}
                  placeholder="e.g. Aman"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!changingBowler}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={changingBowler || !nextBowlerName.trim()}
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
            {innings.status === "IN_PROGRESS" ? (
              <Pressable
                accessibilityRole="button"
                disabled={endingInnings}
                onPress={() => {
                  void endInnings();
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
            {error ? (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={styles.inlineError}
              >
                {error}
              </Text>
            ) : null}
            <Text style={styles.hint}>
              Each score is saved as a delivery. Strike rotates after 1 or 3
              runs and at the end of each over.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#10281b" },
  content: {
    padding: 24,
    paddingTop: 20,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  back: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  backText: { color: "#b8e46a", fontSize: 15 },
  label: {
    color: "#b8e46a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 14,
  },
  loader: { padding: 32 },
  team: { color: "#ffffff", fontSize: 28, fontWeight: "800", marginBottom: 14 },
  scoreCard: {
    backgroundColor: "#b8e46a",
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
  },
  score: { color: "#10281b", fontSize: 48, fontWeight: "800", lineHeight: 54 },
  wickets: { fontSize: 32, fontWeight: "700" },
  scoreCaption: {
    color: "#31552c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: 4,
  },
  overStatus: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  overText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  overLimit: { color: "#c4d2c8", fontSize: 14 },
  chaseCard: {
    backgroundColor: "#173a28",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  chaseTarget: { color: "#b8e46a", fontSize: 18, fontWeight: "800" },
  chaseRequired: {
    color: "#c4d2c8",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 4,
  },
  notice: {
    backgroundColor: "#f6f8ef",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
  },
  sectionTitleDark: {
    color: "#10281b",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  nextBowlerCard: {
    backgroundColor: "#f6f8ef",
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
  },
  nextBowlerHint: {
    color: "#536253",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d1dacb",
    borderRadius: 10,
    color: "#10281b",
    fontSize: 17,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  changeButton: {
    backgroundColor: "#b8e46a",
    minHeight: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  changeButtonText: { color: "#10281b", fontSize: 16, fontWeight: "700" },
  targetText: {
    color: "#10281b",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  finishButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#d99380",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  finishText: { color: "#ffd1c9", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.65 },
  inlineError: { color: "#ffd1c9", fontSize: 14, lineHeight: 21, marginTop: 4 },
  hint: { color: "#c4d2c8", fontSize: 13, lineHeight: 20, marginTop: 12 },
  error: { color: "#a3322a", fontSize: 15, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  retryText: { color: "#257039", fontWeight: "700" },
});
