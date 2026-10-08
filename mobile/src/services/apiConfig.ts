export function resolveApiConfig(raw: string | undefined, platform: string) {
  const value = raw?.trim() || (platform === "web" ? "http://localhost:3000" : "");
  const invalid = (error: string) => ({ url: "", error, warning: null });
  if (!value) return invalid("Set EXPO_PUBLIC_API_URL in mobile/.env to a backend address reachable from this device, then reload Expo.");
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)) {
      return invalid("EXPO_PUBLIC_API_URL must be an HTTP(S) origin with no credentials, path, query, or fragment.");
    }
    if (["0.0.0.0", "[::]"].includes(url.hostname)) return invalid("Use the computer's LAN IP or an HTTPS backend tunnel, not a wildcard listener address.");
    const loopback = url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.startsWith("127.") || url.hostname === "[::1]";
    // Explicit loopback can be intentional for an iOS simulator or adb reverse.
    return {
      url: url.origin, error: null,
      warning: platform !== "web" && loopback
        ? "Localhost points to this device. A physical phone normally needs the laptop's LAN IP or an HTTPS backend tunnel."
        : null,
    };
  } catch {
    return invalid("EXPO_PUBLIC_API_URL is not a valid HTTP(S) backend address.");
  }
}
