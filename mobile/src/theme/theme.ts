import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#F7F5EF', white: '#FFFFFF', ink: '#1B1D19', muted: '#62655D',
  line: '#DADDD2', lime: '#D5F45B', lavender: '#E4DEFA', coral: '#FFD7C8',
  error: '#A42B25', subtle: '#EDEEE7', green: '#30632E',
};
export const hardShadow = { boxShadow: '3px 3px 0px #1B1D19' };
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 6, padding: 18, marginBottom: 18 },
  title: { color: colors.ink, fontSize: 36, lineHeight: 40, letterSpacing: -1.4, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 24 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  fieldLabel: { color: colors.ink, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  input: { color: colors.ink, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, minHeight: 54, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginBottom: 18 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginBottom: 16 },
  backText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
});
