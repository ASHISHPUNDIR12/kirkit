import SessionNotice from "../components/SessionNotice";
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Brand from "../components/Brand";
import { colors, ui, hardShadow } from "../theme/theme";
import ConnectionCheck from "../components/ConnectionCheck";
import MatchCard from "../components/MatchCard";
import PrimaryButton from "../components/PrimaryButton";
import { getMatches, importLegacyMatches, logout } from "../services/api";
import type { Match } from "../types/api";

export default function HomeScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [importing, setImporting] = useState(false);
  const requestId = useRef(0);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

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
      return () => { requestId.current += 1; };
    }, [loadMatches]),
  );

  const visible = matches.filter(match => filter === "all" || (filter === "active" ? match.status !== "COMPLETED" : match.status === "COMPLETED"));
  const activeCount = matches.filter(match => match.status !== "COMPLETED").length;
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading && matches.length > 0} onRefresh={loadMatches} tintColor={colors.ink} />}>
        <View style={styles.header}><Brand /><Pressable accessibilityRole="button" disabled={signingOut} style={styles.signOut} onPress={async () => {
          setSigningOut(true);
          try { await logout(); } catch (error) { setError(error instanceof Error ? error.message : "Unable to sign out."); }
          finally { setSigningOut(false); }
        }}><Text style={styles.signOutText}>{signingOut ? "Leaving…" : "Sign out"}</Text></Pressable></View>
        <SessionNotice />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR GROUND. YOUR GAME.</Text>
          <Text style={styles.title}>Small ground.{"\n"}Big moments.</Text>
          <Text style={styles.subtitle}>Pick your teams. Call the first ball.{"\n"}We’ll keep the score.</Text>
          <PrimaryButton title="Start a match" onPress={() => router.push("/create-match")} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/teams")} style={({ pressed }) => [styles.teams, pressed && { opacity: 0.7 }]}>
          <View style={styles.teamIcon}><Text style={styles.teamIconText}>XI</Text></View><View style={{ flex: 1 }}><Text style={styles.teamTitle}>Your club, all together.</Text><Text style={styles.teamHint}>Teams, players & career stats</Text></View><Text style={styles.arrow}>↗</Text>
        </Pressable>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Match centre <Text style={styles.count}>/ {matches.length.toString().padStart(2, '0')}</Text></Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh matches" disabled={loading} onPress={loadMatches} style={styles.refresh}><Text style={styles.refreshText}>{loading ? "…" : "↻"}</Text></Pressable></View>
        <View style={styles.filters}>{([['all', 'All matches'], ['active', `Active (${activeCount})`], ['completed', 'Finished']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterActive]}><Text style={[styles.filterText, filter === key && { color: colors.white }]}>{label}</Text></Pressable>)}</View>
        {loading && !matches.length ? <ActivityIndicator color={colors.ink} accessibilityLabel="Loading matches" style={{ padding: 28 }} /> : null}
        {error ? <View style={ui.card}><Text accessibilityRole="alert" style={ui.error}>{error}</Text><PrimaryButton title="Try again" variant="secondary" onPress={loadMatches} /></View> : null}
        {!loading && !error && !visible.length ? <View style={styles.empty}><Text style={styles.emptySymbol}>↗</Text><Text style={styles.emptyTitle}>{matches.length ? "Nothing here. Yet." : "The first ball is yours."}</Text><Text style={styles.emptyText}>{matches.length ? "Switch the filter to see your other matches." : "Start your first match. Every run and every wicket will have a home here."}</Text></View> : null}
        {!loading && matches.length === 0 ? <View style={styles.importCard}><Text style={styles.importTitle}>Have matches in your old account?</Text><Text style={styles.importHint}>Copy your saved matches onto this device. This needs internet once; cloud records are kept.</Text><PrimaryButton title="Import saved matches" loading={importing} variant="secondary" onPress={async () => {
          setImporting(true); setError("");
          try { await importLegacyMatches(); await loadMatches(); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "Could not import old matches. Check your connection and try again."); }
          finally { setImporting(false); }
        }} /></View> : null}
        {visible.map(match => <MatchCard key={match.id} match={match} />)}
        <Text style={styles.footer}>MADE FOR THE LOVE OF THE GAME.</Text>
        <ConnectionCheck />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: ui.screen, content: ui.content,
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 12 },
  signOut: { minHeight: 44, justifyContent: 'center', paddingLeft: 12 }, signOutText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  hero: { ...ui.card, ...hardShadow, backgroundColor: colors.lime, padding: 20, marginBottom: 24 },
  eyebrow: { color: colors.ink, fontWeight: '800', fontSize: 10, letterSpacing: 1.6, marginBottom: 22 },
  title: { ...ui.title, fontSize: 40, lineHeight: 43, letterSpacing: -1.9 },
  subtitle: { color: colors.ink, fontSize: 14, lineHeight: 22, marginTop: 14, marginBottom: 24 },
  teams: { ...ui.card, backgroundColor: colors.lavender, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 24 },
  importCard: { ...ui.card, marginTop: 18, backgroundColor: colors.white }, importTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, importHint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  teamIcon: { borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, teamIconText: { color: colors.ink, fontSize: 19, fontWeight: '900' }, teamTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, teamHint: { color: colors.muted, fontSize: 12, marginTop: 4 }, arrow: { color: colors.ink, fontSize: 26 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, sectionTitle: { color: colors.ink, fontSize: 23, letterSpacing: -0.6, fontWeight: '800', flex: 1 }, count: { color: colors.muted, fontWeight: '400', fontSize: 18 }, refresh: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, refreshText: { fontSize: 26, color: colors.ink },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 20 }, filter: { borderWidth: 1, borderColor: colors.ink, borderRadius: 4, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }, filterActive: { backgroundColor: colors.ink }, filterText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  empty: { ...ui.card, backgroundColor: colors.paper, borderStyle: 'dashed', padding: 24 }, emptySymbol: { fontSize: 36, color: colors.ink, marginBottom: 14 }, emptyTitle: { fontSize: 21, fontWeight: '800', color: colors.ink }, emptyText: { fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 8 }, footer: { color: colors.muted, fontSize: 9, letterSpacing: 1.6, textAlign: 'center', marginTop: 16 },
});
