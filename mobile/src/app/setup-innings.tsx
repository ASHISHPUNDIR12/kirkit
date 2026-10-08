import { useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { startMatch } from "../services/api";

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
            <Text style={styles.backText}>‹ Back to Home</Text>
          </Pressable>
          <Text style={styles.label}>GULLY CRICKET</Text>
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
                    accessibilityState={{ checked: battingTeam === team }}
                    onPress={() => setBattingTeam(team)}
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
                <TextInput
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
                <TextInput
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
                <TextInput
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
  screen: { flex: 1, backgroundColor: "#10281b" },
  content: { padding: 24, width: "100%", maxWidth: 520, alignSelf: "center" },
  back: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  backText: { color: "#b8e46a", fontSize: 15 },
  label: {
    color: "#b8e46a",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 16,
  },
  title: { color: "#ffffff", fontSize: 34, fontWeight: "800" },
  subtitle: {
    color: "#c4d2c8",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 28,
  },
  card: { backgroundColor: "#f6f8ef", borderRadius: 20, padding: 22 },
  fieldLabel: {
    color: "#10281b",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 9,
    marginTop: 8,
  },
  teamOption: {
    minHeight: 54,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1dacb",
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamSelected: { borderColor: "#257039", backgroundColor: "#edf5e8" },
  teamOptionText: { color: "#536253", fontSize: 16, fontWeight: "600" },
  teamSelectedText: { color: "#10281b" },
  radio: { color: "#849080", fontSize: 18 },
  radioSelected: { color: "#257039" },
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
  error: { color: "#a3322a", fontSize: 14, lineHeight: 21, marginBottom: 18 },
  savedTeam: {
    color: "#10281b",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  savedText: { color: "#536253", fontSize: 16, lineHeight: 26 },
  hint: {
    color: "#536253",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 18,
    marginBottom: 22,
  },
  homeLink: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  homeLinkText: { color: "#257039", fontSize: 15, fontWeight: "700" },
});
