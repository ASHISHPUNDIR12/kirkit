import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
export default function Brand() {
  return <View style={styles.row}><View style={styles.mark}><Text style={styles.k}>k.</Text></View><View><Text style={styles.name}>KIRKIT</Text><Text style={styles.caption}>THE GULLY GAME.</Text></View></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, mark: { width: 42, height: 42, backgroundColor: colors.lime, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }, k: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -2 }, name: { color: colors.ink, fontSize: 20, letterSpacing: -0.8, fontWeight: '900' }, caption: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 } });
