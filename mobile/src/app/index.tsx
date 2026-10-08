import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ConnectionCheck from "../components/ConnectionCheck";
import MatchCard from "../components/MatchCard";
import PrimaryButton from "../components/PrimaryButton";
import { getMatches, logout } from "../services/api";
import type { Match } from "../types/api";

export default function HomeScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const requestId = useRef(0);

  const loadMatches = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const savedMatches = await getMatches();
      if (id === requestId.current) setMatches(savedMatches);
    } catch (error) {
      if (id === requestId.current)
        setError(
          error instanceof Error ? error.message : "Unable to load matches.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMatches();
      // Ignore responses arriving after this screen loses focus.
      return () => {
        requestId.current += 1;
      };
    }, [loadMatches]),
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>GULLY CRICKET</Text>
        <Text style={styles.title}>Every ball.{"\n"}Every run.</Text>
        <Text style={styles.subtitle}>
          Your neighbourhood game, ready for the scoreboard.
        </Text>
        <PrimaryButton
          title="Start New Match"
          onPress={() => router.push("/create-match")}
        />
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Previous Matches</Text>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={loadMatches}
            style={styles.refresh}
          >
            <Text style={styles.refreshText}>
              {loading ? "Loading…" : "Refresh"}
            </Text>
          </Pressable>
        </View>
        {loading && matches.length === 0 ? (
          <ActivityIndicator
            color="#b8e46a"
            accessibilityLabel="Loading matches"
            style={styles.loader}
          />
        ) : null}
        {error ? (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={loadMatches}
              style={styles.retry}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && matches.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.emptyTitle}>Your first match starts here.</Text>
            <Text style={styles.emptyText}>
              Create a match and it will appear here, ready for your next game.
            </Text>
          </View>
        ) : null}
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
        <PrimaryButton title="Sign out" loading={signingOut} onPress={async () => {
          setSigningOut(true);
          try { await logout(); } catch (error) {
            setError(error instanceof Error ? error.message : "Unable to sign out.");
          } finally { setSigningOut(false); }
        }} />
        <ConnectionCheck />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#10281b" },
  content: {
    padding: 24,
    paddingTop: 36,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  label: {
    color: "#b8e46a",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    marginBottom: 22,
  },
  title: { color: "#ffffff", fontSize: 42, fontWeight: "800", lineHeight: 48 },
  subtitle: {
    color: "#c4d2c8",
    fontSize: 16,
    lineHeight: 25,
    marginTop: 14,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: { color: "#ffffff", fontSize: 20, fontWeight: "700", flex: 1 },
  refresh: { minHeight: 44, justifyContent: "center", paddingLeft: 14 },
  refreshText: { color: "#b8e46a", fontSize: 13 },
  loader: { padding: 28 },
  notice: {
    padding: 22,
    borderRadius: 18,
    backgroundColor: "#f6f8ef",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#10281b",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  emptyText: { color: "#536253", fontSize: 15, lineHeight: 23 },
  error: { color: "#a3322a", fontSize: 15, lineHeight: 23 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  retryText: { color: "#257039", fontWeight: "700" },
});
