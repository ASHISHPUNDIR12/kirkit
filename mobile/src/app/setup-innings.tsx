import TextField from "../components/TextField";
import { colors, ui } from "../theme/theme";
import NameChoices from "../components/NameChoices";
import { useTeams } from "../hooks/useTeams";
import type { MatchDetails } from "../types/api";
import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { getMatch, startMatch } from "../services/api";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function SetupInningsScreen() {
  const {
    matchId: rawMatchId,
    team1Name: rawTeam1,
    team2Name: rawTeam2,
  } = useLocalSearchParams<{
    matchId?: string | string[];
    team1Name?: string | string[];
    team2Name?: string | string[];
  }>();
  const matchId = firstParam(rawMatchId);
  const team1Name = firstParam(rawTeam1);
  const team2Name = firstParam(rawTeam2);
  const [battingTeam, setBattingTeam] = useState(team1Name);
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [startedInningsId, setStartedInningsId] = useState("");
  const submitting = useRef(false);
  const { teams } = useTeams();
  const [rosterMatch, setRosterMatch] = useState<MatchDetails | null>(null);
  useEffect(() => {
    let active = true;
    getMatch(matchId).then(match => { if (active) setRosterMatch(match); }).catch(() => {});
    return () => { active = false; };
  }, [matchId]);
  const battingId = battingTeam === team1Name ? rosterMatch?.team1Id : rosterMatch?.team2Id;
  const bowlingId = battingTeam === team1Name ? rosterMatch?.team2Id : rosterMatch?.team1Id;
  const batters = teams.find(team => team.id === battingId)?.players.map(player => player.name) ?? [];
  const bowlers = teams.find(team => team.id === bowlingId)?.players.map(player => player.name) ?? [];

  async function saveSetup() {
    if (submitting.current) return;
    if (!matchId || !team1Name || !team2Name) {
      setError(
        "Match details are missing. Return Home and create the match again.",
      );
      return;
    }
    const values = {
      battingFirstTeam: battingTeam,
      strikerName: striker.trim(),
      nonStrikerName: nonStriker.trim(),
      bowlerName: bowler.trim(),
    };
    if (!values.strikerName || !values.nonStrikerName || !values.bowlerName) {
      setError("Enter the striker, non-striker, and opening bowler.");
      return;
    }
    if (
      values.strikerName.toLowerCase() === values.nonStrikerName.toLowerCase()
    ) {
      setError("Enter a different name for each opening batsman.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const startedMatch = await startMatch(matchId, values);
      setStartedInningsId(startedMatch.innings[0]?.id ?? "");
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the innings setup.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/")}
            disabled={saving}
            style={styles.back}
          >
            <Text style={styles.backText}>← Home</Text>
          </Pressable>
          <Text style={styles.label}>MATCH DAY / 02</Text>
          <Text style={styles.title}>
            {saved ? "First innings is ready." : "Set up the innings."}
          </Text>
          <Text style={styles.subtitle}>
            {saved
              ? "Your team and opening players have been saved."
              : "Choose who bats first, then enter the opening players."}
          </Text>
          <View style={styles.card}>
            {saved ? (
              <>
                <Text style={styles.savedTeam}>
                  {battingTeam} batting first
                </Text>
                <Text style={styles.savedText}>Striker: {striker.trim()}</Text>
                <Text style={styles.savedText}>
                  Non-striker: {nonStriker.trim()}
                </Text>
                <Text style={styles.savedText}>
                  Opening bowler: {bowler.trim()}
                </Text>
                <Text style={styles.hint}>
                  Your first innings is ready for scoring.
                </Text>
                <PrimaryButton
                  title="Go to Scoreboard"
                  onPress={() =>
                    router.replace({
                      pathname: "/innings/[inningsId]",
                      params: { inningsId: startedInningsId },
                    })
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.replace("/")}
                  style={styles.homeLink}
                >
                  <Text style={styles.homeLinkText}>Back to Home</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Who is batting first?</Text>
                {[team1Name, team2Name].filter(Boolean).map((team) => (
                  <Pressable
                    key={team}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: battingTeam === team, disabled: saving }}
                    disabled={saving}
                    onPress={() => { if (team !== battingTeam) { setBattingTeam(team); setStriker(""); setNonStriker(""); setBowler(""); } }}
                    style={[
                      styles.teamOption,
                      battingTeam === team && styles.teamSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.teamOptionText,
                        battingTeam === team && styles.teamSelectedText,
                      ]}
                    >
                      {team}
                    </Text>
                    <Text
                      style={[
                        styles.radio,
                        battingTeam === team && styles.radioSelected,
                      ]}
                    >
                      {battingTeam === team ? "●" : "○"}
                    </Text>
                  </Pressable>
                ))}
                <Text style={styles.fieldLabel}>Striker batsman</Text>
                <NameChoices names={batters.filter(name => name !== nonStriker)} onSelect={setStriker} disabled={saving} />
                <TextField
                  accessibilityLabel="Striker batsman"
                  value={striker}
                  onChangeText={setStriker}
                  placeholder="e.g. Ashish"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!saving}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Non-striker batsman</Text>
                <NameChoices names={batters.filter(name => name !== striker)} onSelect={setNonStriker} disabled={saving} />
                <TextField
                  accessibilityLabel="Non-striker batsman"
                  value={nonStriker}
                  onChangeText={setNonStriker}
                  placeholder="e.g. Rahul"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!saving}
                  autoCapitalize="words"
                  style={styles.input}
                />
                <Text style={styles.fieldLabel}>Opening bowler</Text>
                <NameChoices names={bowlers} onSelect={setBowler} disabled={saving} />
                <TextField
                  accessibilityLabel="Opening bowler"
                  value={bowler}
                  onChangeText={setBowler}
                  placeholder="e.g. Aman"
                  placeholderTextColor="#849080"
                  maxLength={60}
                  editable={!saving}
                  autoCapitalize="words"
                  style={styles.input}
                />
                {error ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    style={styles.error}
                  >
                    {error}
                  </Text>
                ) : null}
                <PrimaryButton
                  title="Start First Innings"
                  onPress={saveSetup}
                  loading={saving}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 screen: ui.screen, content: ui.content, back: ui.back, backText: ui.backText,
 label: ui.eyebrow, title: ui.title, subtitle: ui.subtitle, card: ui.card,
 fieldLabel: { ...ui.fieldLabel, marginTop: 8 }, input: ui.input, error: ui.error,
 team: { color: colors.ink, fontSize: 27, fontWeight: '800' },
 vs: { color: colors.muted, marginVertical: 10, fontSize: 13 },
 savedOvers: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 20, marginBottom: 26 },
 hint: { color: colors.muted, fontSize: 12, lineHeight: 19, marginBottom: 24 },
 homeLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
 homeLinkText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
 teamOption: { minHeight: 56, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
 teamSelected: { backgroundColor: colors.lime }, teamOptionText: { color: colors.ink, fontSize: 16, fontWeight: '700', flex: 1 }, teamSelectedText: { color: colors.ink }, radio: { color: colors.ink, fontSize: 20 }, radioSelected: { color: colors.ink },
 savedTeam: { color: colors.ink, fontSize: 22, fontWeight: '800', marginBottom: 16 }, savedText: { color: colors.muted, fontSize: 16, lineHeight: 28 },
 presets: { flexDirection: 'row', gap: 10, marginBottom: 14 }, preset: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4 }, presetText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
});
