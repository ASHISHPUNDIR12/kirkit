import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getHealth } from "../services/api";

export default function ConnectionCheck() {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, alignItems: "center" },
  button: { minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  text: { color: "#c4d2c8", fontSize: 14 },
  message: {
    color: "#c4d2c8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
