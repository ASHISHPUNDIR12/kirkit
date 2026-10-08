import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ExtraEventType } from "../types/api";

const runOptions = [0, 1, 2, 3, 4, 6];

type Props = {
  savingRuns: number | null;
  savingWicket: boolean;
  savingExtra: boolean;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onExtra: (eventType: ExtraEventType) => void;
};

export default function InningsScoringControls({
  savingRuns,
  savingWicket,
  savingExtra,
  onRuns,
  onWicket,
  onExtra,
}: Props) {
  const disabled = savingRuns !== null || savingWicket || savingExtra;
  return (
    <>
      <Text style={styles.sectionTitle}>Add runs</Text>
      <View style={styles.runGrid}>
        {runOptions.map((runs) => (
          <Pressable
            key={runs}
            accessibilityRole="button"
            accessibilityLabel={`${runs} runs`}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onRuns(runs)}
            style={({ pressed }) => [
              styles.runButton,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.runText}>
              {savingRuns === runs ? "…" : runs}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onWicket}
        style={({ pressed }) => [
          styles.wicketButton,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text style={styles.wicketText}>
          {savingWicket ? "Saving wicket…" : "Wicket"}
        </Text>
      </Pressable>
      <View style={styles.extraGrid}>
        {(["WIDE", "NO_BALL"] as const).map((eventType) => (
          <Pressable
            key={eventType}
            accessibilityRole="button"
            accessibilityLabel={
              eventType === "WIDE" ? "Wide, add 1" : "No Ball, add 1"
            }
            disabled={disabled}
            onPress={() => onExtra(eventType)}
            style={({ pressed }) => [
              styles.extraButton,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.extraText}>
              {eventType === "WIDE" ? "Wide +1" : "No Ball +1"}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  runGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  runButton: {
    width: "31%",
    flexGrow: 1,
    height: 70,
    borderRadius: 14,
    backgroundColor: "#f6f8ef",
    justifyContent: "center",
    alignItems: "center",
  },
  wicketButton: {
    minHeight: 62,
    backgroundColor: "#e68c69",
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  extraGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  extraButton: {
    flex: 1,
    minHeight: 54,
    backgroundColor: "#e7c878",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.65 },
  runText: { color: "#10281b", fontSize: 26, fontWeight: "800" },
  wicketText: { color: "#321510", fontSize: 19, fontWeight: "800" },
  extraText: { color: "#342a0b", fontSize: 15, fontWeight: "700" },
});
