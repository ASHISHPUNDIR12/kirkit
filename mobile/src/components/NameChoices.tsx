import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../theme/theme';
export default function NameChoices({ names, onSelect, disabled = false }: { names: string[]; onSelect: (name: string) => void; disabled?: boolean }) {
  if (!names.length) return null;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>{names.map(name => <Pressable key={name} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={`Select ${name}`} onPress={() => onSelect(name)} style={({ pressed }) => [styles.choice, pressed && { backgroundColor: colors.lime }, disabled && { opacity: 0.5 }]}><Text style={styles.text}>+ {name}</Text></Pressable>)}</ScrollView>;
}
const styles = StyleSheet.create({ row: { gap: 8, paddingBottom: 12 }, choice: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.ink, borderRadius: 4, paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }, text: { color: colors.ink, fontWeight: '600', fontSize: 13 } });
