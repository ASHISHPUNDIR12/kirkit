import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import type { Match } from "../types/api";

const statusLabels = {
  CREATED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

export default function MatchCard({ match }: { match: Match }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${match.team1Name} versus ${match.team2Name}`}
      onPress={() =>
        router.push({
          pathname: "/matches/[matchId]",
          params: { matchId: match.id },
        })
      }
      style={styles.card}
    >
      <View style={styles.topRow}>
        <Text style={styles.overs}>
          {match.oversLimit} {match.oversLimit === 1 ? "over" : "overs"}
        </Text>
        <Text style={styles.status}>{statusLabels[match.status]}</Text>
      </View>
      <Text style={styles.team}>{match.team1Name}</Text>
      <Text style={styles.versus}>vs</Text>
      <Text style={styles.team}>{match.team2Name}</Text>
      {match.result ? <Text style={styles.result}>{match.result}</Text> : null}
      <Text style={styles.date}>
        {new Date(match.createdAt).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f6f8ef",
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 16,
  },
  overs: { color: "#536253", fontSize: 13 },
  status: {
    color: "#257039",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#e3eddb",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  team: { color: "#10281b", fontSize: 21, fontWeight: "700" },
  versus: { color: "#74816f", fontSize: 13, marginVertical: 5 },
  result: { color: "#257039", fontSize: 14, marginTop: 14 },
  date: { color: "#74816f", fontSize: 12, marginTop: 16 },
});
