import { StyleSheet, Text, View } from "react-native";
import type { ScoreboardInnings } from "../types/api";

type Player = ScoreboardInnings["players"][number] | undefined;

function PlayerStats({
  role,
  player,
  fallback,
}: {
  role: string;
  player: Player;
  fallback?: string;
}) {
  const stats =
    player?.playerType === "BOWLER"
      ? `${player.runsConceded} runs conceded · ${player.ballsBowled} balls`
      : `${player?.runs ?? 0} runs · ${player?.ballsFaced ?? 0} balls`;
  return (
    <>
      <Text style={styles.role}>{role}</Text>
      <Text style={styles.name}>{player?.playerName ?? fallback ?? "—"}</Text>
      <Text style={styles.stats}>{stats}</Text>
    </>
  );
}

export default function InningsPlayersCard({
  striker,
  nonStriker,
  bowler,
  previousBowler,
  bowlerChangeRequired,
}: {
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  previousBowler: Player;
  bowlerChangeRequired: boolean;
}) {
  const shownBowler = bowler ?? previousBowler;
  return (
    <View style={styles.card}>
      <PlayerStats role="STRIKER" player={striker} />
      <View style={styles.divider} />
      <PlayerStats role="NON-STRIKER" player={nonStriker} />
      <View style={styles.divider} />
      <PlayerStats
        role="BOWLER"
        player={shownBowler}
        fallback={bowlerChangeRequired ? "Next bowler needed" : undefined}
      />
      {shownBowler ? (
        <Text style={styles.bowlingStats}>
          {shownBowler.wicketsTaken} wickets
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f6f8ef",
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
  },
  role: {
    color: "#257039",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  name: { color: "#10281b", fontSize: 19, fontWeight: "700", marginTop: 3 },
  stats: { color: "#536253", fontSize: 14, marginTop: 3 },
  divider: { height: 1, backgroundColor: "#dbe2d5", marginVertical: 14 },
  bowlingStats: { color: "#536253", fontSize: 12, marginTop: 4 },
});
