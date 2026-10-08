import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrimaryButton from "../components/PrimaryButton";
import { authenticate } from "../services/api";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try { await authenticate(mode, email, password); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  };
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>GULLY CRICKET</Text>
          <Text style={styles.title}>{mode === "login" ? "Welcome back." : "Your game starts here."}</Text>
          <Text style={styles.subtitle}>{mode === "login" ? "Sign in to your matches and scoreboards." : "Create an account to save your matches."}</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput accessibilityLabel="Email" style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy} maxLength={254} />
          <Text style={styles.label}>Password</Text>
          <TextInput key={mode} accessibilityLabel="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={mode === "signup" ? "new-password" : "current-password"} editable={!busy} returnKeyType="go" onSubmitEditing={submit} />
          {mode === "signup" ? <Text style={styles.subtitle}>Use at least 12 characters.</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={mode === "login" ? "Sign in" : "Create account"} loading={busy} onPress={submit} />
          <Pressable accessibilityRole="button" disabled={busy} style={styles.switch} onPress={() => { setMode(mode === "login" ? "signup" : "login"); setPassword(""); setError(""); }}>
            <Text style={styles.link}>{mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#10281b" },
  content: { padding: 24, paddingTop: 64, width: "100%", maxWidth: 520, alignSelf: "center" },
  brand: { color: "#b8e46a", fontWeight: "700", letterSpacing: 3, marginBottom: 24 },
  title: { color: "white", fontSize: 36, fontWeight: "800" },
  subtitle: { color: "#c4d2c8", fontSize: 16, lineHeight: 24, marginVertical: 16 },
  label: { color: "white", marginBottom: 8, fontWeight: "600" },
  input: { backgroundColor: "#f6f8ef", color: "#10281b", borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20, minHeight: 54 },
  error: { color: "#ffb4ab", marginBottom: 16, lineHeight: 22 },
  switch: { minHeight: 54, justifyContent: "center", alignItems: "center", marginTop: 12 },
  link: { color: "#b8e46a", fontSize: 15 },
});
