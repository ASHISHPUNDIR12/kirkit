import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

type Props = { title: string; onPress: () => void; loading?: boolean };

export default function PrimaryButton({
  title,
  onPress,
  loading = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || loading) && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#10281b" />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#b8e46a",
    minHeight: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  pressed: { opacity: 0.65 },
  text: { color: "#10281b", fontSize: 16, fontWeight: "700" },
});
