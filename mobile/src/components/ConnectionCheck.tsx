import { colors } from "../theme/theme";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_URL, getHealth } from "../services/api";

export default function ConnectionCheck() {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  async function check() {
    setChecking(true);
    try {
      const health = await getHealth();
      setMessage(
        health.status === "ok" && health.database === "connected"
          ? "Backend and database are connected."
          : "Database is unavailable.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect.");
    } finally {
      setChecking(false);
    }
  }
  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.button}><Text style={styles.text}>{expanded ? '− Connection help' : '+ Connection help'}</Text></Pressable>
      {expanded ? <>
      {__DEV__ && API_URL ? <Text selectable style={styles.message}>API: {API_URL}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={checking}
        onPress={check}
        style={styles.button}
      >
        <Text style={styles.text}>
          {checking ? "Checking…" : "Check connection"}
        </Text>
      </Pressable>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      </> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, alignItems: "center" },
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  text: { color: colors.muted, fontSize: 14 },
  message: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
