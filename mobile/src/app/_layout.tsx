import { useSyncExternalStore } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { getSession, subscribeSession } from "../services/session";

export default function RootLayout() {
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="auth" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="create-match" />
          <Stack.Screen name="setup-innings" />
          <Stack.Screen name="innings/[inningsId]" />
          <Stack.Screen name="matches/[matchId]" />
        </Stack.Protected>
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
