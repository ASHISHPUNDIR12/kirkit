import { useRef, useState } from "react";
import { router } from "expo-router";
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
import { createMatch } from "../services/api";
import type { Match } from "../types/api";

export default function CreateMatchScreen() {
  const [team1Name, setTeam1Name] = useState("");
  const [team2Name, setTeam2Name] = useState("");
  const [overs, setOvers] = useState("5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdMatch, setCreatedMatch] = useState<Match | null>(null);
  const submitting = useRef(false);

  async function saveMatch() {
    if (submitting.current) return;
    const team1 = team1Name.trim();
    const team2 = team2Name.trim();
    const oversLimit = Number(overs.trim());
    if (!team1 || !team2) {
      setError("Enter both team names.");
      return;
    }
    if (team1.toLowerCase() === team2.toLowerCase()) {
      setError("Choose a different name for each team.");
      return;
    }
    if (
      !/^\d+$/.test(overs.trim()) ||
      !Number.isInteger(oversLimit) ||
      oversLimit < 1 ||
      oversLimit > 2147483647
    ) {
      setError("Enter a whole number of overs between 1 and 2147483647.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      setCreatedMatch(
        await createMatch({ team1Name: team1, team2Name: team2, oversLimit }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save the match.";
      setError(
        `${message} If the connection was interrupted, check Home before creating it again.`,
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
            {createdMatch ? "Match created." : "Let’s play."}
          </Text>
          <Text style={styles.subtitle}>
            {createdMatch
              ? "Your match has been saved."
              : "Two teams. One game. Make it yours."}
          </Text>
          {createdMatch ? (
            <View style={styles.card}>
              <Text style={styles.team}>{createdMatch.team1Name}</Text>
              <Text style={styles.vs}>vs</Text>
              <Text style={styles.team}>{createdMatch.team2Name}</Text>
              <Text style={styles.savedOvers}>
                {createdMatch.oversLimit}{" "}
                {createdMatch.oversLimit === 1 ? "over" : "overs"} per innings ·
                Not started
              </Text>
              <PrimaryButton
                title="Set Up First Innings"
                onPress={() =>
                  router.push({
                    pathname: "/setup-innings",
                    params: {
                      matchId: createdMatch.id,
                      team1Name: createdMatch.team1Name,
                      team2Name: createdMatch.team2Name,
                    },
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
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Team 1 name</Text>
              <TextInput
                accessibilityLabel="Team 1 name"
                value={team1Name}
                onChangeText={setTeam1Name}
                placeholder="e.g. Tigers"
                placeholderTextColor="#849080"
                maxLength={60}
                editable={!saving}
                autoCapitalize="words"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Team 2 name</Text>
              <TextInput
                accessibilityLabel="Team 2 name"
                value={team2Name}
                onChangeText={setTeam2Name}
                placeholder="e.g. Warriors"
                placeholderTextColor="#849080"
                maxLength={60}
                editable={!saving}
                autoCapitalize="words"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Number of overs</Text>
              <TextInput
                accessibilityLabel="Number of overs"
                value={overs}
                onChangeText={setOvers}
                keyboardType="number-pad"
                placeholder="e.g. 5"
                placeholderTextColor="#849080"
                maxLength={10}
                editable={!saving}
                style={styles.input}
              />
              <Text style={styles.hint}>
                Overs per innings. Enter a positive whole number.
              </Text>
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
                title="Create Match"
                onPress={saveMatch}
                loading={saving}
              />
            </View>
          )}
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
  title: { color: "#ffffff", fontSize: 38, fontWeight: "800" },
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
    marginBottom: 22,
  },
  hint: {
    color: "#536253",
    fontSize: 13,
    lineHeight: 20,
    marginTop: -12,
    marginBottom: 24,
  },
  error: { color: "#a3322a", fontSize: 14, lineHeight: 21, marginBottom: 18 },
  team: { color: "#10281b", fontSize: 25, fontWeight: "700" },
  vs: { color: "#74816f", marginVertical: 8, fontSize: 14 },
  savedOvers: {
    color: "#536253",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 20,
    marginBottom: 26,
  },
  homeLink: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  homeLinkText: { color: "#257039", fontSize: 15, fontWeight: "700" },
});
