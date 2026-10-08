import TextField from "../components/TextField";
import { colors, ui } from "../theme/theme";
import NameChoices from "../components/NameChoices";
import { useTeams } from "../hooks/useTeams";
import { useRef, useState } from "react";
import { router } from "expo-router";
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
import { createMatch } from "../services/api";
import type { Match } from "../types/api";

export default function CreateMatchScreen() {
  const { teams, error: rosterError } = useTeams();
  const [team1Id, setTeam1Id] = useState<string>();
  const [team2Id, setTeam2Id] = useState<string>();
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
        await createMatch({ team1Name: team1, team2Name: team2, oversLimit, team1Id, team2Id }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save the match.";
      setError(
        `${message} Check your saved matches before creating it again.`,
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
          <Text style={styles.label}>MATCH DAY / 01</Text>
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
              {rosterError ? <Text style={styles.error}>{rosterError} You can still enter custom teams.</Text> : null}
              <Text style={styles.fieldLabel}>Team 1 name</Text>
              <NameChoices names={teams.filter(t => t.id !== team2Id).map(t => t.name)} disabled={saving} onSelect={name => { setTeam1Name(name); setTeam1Id(teams.find(t => t.name === name)?.id); }} />
              <TextField
                accessibilityLabel="Team 1 name"
                value={team1Name}
                onChangeText={value => { setTeam1Name(value); setTeam1Id(undefined); }}
                placeholder="e.g. Tigers"
                placeholderTextColor="#849080"
                maxLength={60}
                editable={!saving}
                autoCapitalize="words"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Team 2 name</Text>
              <NameChoices names={teams.filter(t => t.id !== team1Id).map(t => t.name)} disabled={saving} onSelect={name => { setTeam2Name(name); setTeam2Id(teams.find(t => t.name === name)?.id); }} />
              <TextField
                accessibilityLabel="Team 2 name"
                value={team2Name}
                onChangeText={value => { setTeam2Name(value); setTeam2Id(undefined); }}
                placeholder="e.g. Warriors"
                placeholderTextColor="#849080"
                maxLength={60}
                editable={!saving}
                autoCapitalize="words"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Overs per innings</Text>
              <View style={styles.presets}>{['5', '10', '15', '20'].map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value} overs`} accessibilityState={{ selected: overs === value, disabled: saving }} disabled={saving} onPress={() => setOvers(value)} style={[styles.preset, overs === value && { backgroundColor: colors.lime }]}><Text style={styles.presetText}>{value}</Text></Pressable>)}</View>
              <TextField
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
                Pick a format above, or enter your own number of overs.
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
