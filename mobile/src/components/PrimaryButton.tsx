import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, hardShadow } from '../theme/theme';

type Props = { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary'; };
export default function PrimaryButton({ title, onPress, loading = false, disabled = false, variant = 'primary' }: Props) {
  const inactive = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondary,
      pressed && { transform: [{ translateX: 2 }, { translateY: 2 }], boxShadow: '0px 0px 0px transparent' }, inactive && styles.disabled]}>
    {loading ? <ActivityIndicator color={colors.ink} /> : <><Text style={styles.text}>{title}</Text><Text importantForAccessibility="no" style={styles.arrow}>↗</Text></>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { ...hardShadow, backgroundColor: colors.lime, minHeight: 56, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, marginBottom: 4, gap: 10 },
  secondary: { backgroundColor: colors.white, boxShadow: '0px 0px 0px transparent' },
  disabled: { opacity: 0.5, boxShadow: '0px 0px 0px transparent' },
  text: { color: colors.ink, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  arrow: { color: colors.ink, fontSize: 23, fontWeight: '600' },
});
