import { Linking, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export function Button({label, onPress, disabled = false, secondary = false}: {label: string; onPress: () => void; disabled?: boolean; secondary?: boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => [styles.button, secondary && styles.secondary, (disabled || pressed) && {opacity: 0.55}]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}
export function Field({label, ...props}: TextInputProps & {label: string}) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#59665E" {...props} style={[styles.input, props.multiline && {minHeight: 104, textAlignVertical: 'top'}, props.style]} /></View>;
}
export function Choice({label, selected, onPress, disabled}: {label: string; selected: boolean; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked: selected, disabled: !!disabled}} onPress={onPress} disabled={disabled} style={[styles.choice, selected && styles.chosen]}><Text style={styles.choiceText}>{selected ? '●  ' : '○  '}{label}</Text></Pressable>;
}
export function Check({label, checked, onPress, disabled}: {label: string; checked: boolean; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{checked, disabled: !!disabled}} onPress={onPress} disabled={disabled} style={styles.check}><Text style={styles.choiceText}>{checked ? '☑  ' : '☐  '}{label}</Text></Pressable>;
}
export function ExternalLink({label, url}: {label: string; url: string}) {
  return <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => { void Linking.openURL(url).catch(() => {}); }} style={styles.link}><Text style={styles.linkText}>{label}</Text><Text selectable style={styles.linkUrl}>{url}</Text></Pressable>;
}
export function Notice({children}: {children: string}) { return <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>{children}</Text>; }
export const styles = StyleSheet.create({
  page: {padding: 24, gap: 20, maxWidth: 620, width: '100%', alignSelf: 'center', paddingBottom: 48},
  title: {fontSize: 34, lineHeight: 42, fontWeight: '700', color: '#173F30'},
  subtitle: {fontSize: 23, lineHeight: 31, fontWeight: '600', color: '#173F30'},
  body: {fontSize: 16, lineHeight: 25, color: '#36473E'},
  eyebrow: {fontSize: 12, lineHeight: 20, fontWeight: '700', color: '#40594C', letterSpacing: 1},
  card: {padding: 20, gap: 16, borderWidth: 1, borderColor: '#D8DFD8', backgroundColor: 'white', borderRadius: 18},
  stack: {gap: 16}, row: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  button: {padding: 15, minHeight: 48, backgroundColor: '#173F30', borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  secondary: {backgroundColor: '#E8EEE7'}, buttonText: {color: 'white', fontWeight: '600', fontSize: 16}, secondaryText: {color: '#173F30'},
  label: {fontSize: 15, lineHeight: 23, color: '#173F30', fontWeight: '600'},
  field: {gap: 8}, input: {backgroundColor: 'white', borderColor: '#8B9B8F', borderWidth: 1, borderRadius: 10, padding: 13, fontSize: 16, color: '#173F30', minHeight: 48},
  choice: {borderWidth: 1, borderColor: '#8B9B8F', borderRadius: 10, padding: 14, minHeight: 48, justifyContent: 'center'},
  chosen: {backgroundColor: '#DDEBDF', borderColor: '#173F30'}, choiceText: {fontSize: 16, lineHeight: 24, color: '#173F30'},
  check: {minHeight: 48, justifyContent: 'center', paddingVertical: 12},
  link: {paddingVertical: 10, minHeight: 48}, linkText: {fontSize: 16, color: '#173F30', textDecorationLine: 'underline'}, linkUrl: {fontSize: 12, color: '#40594C'},
  notice: {color: '#733319', backgroundColor: '#FFF2E8', padding: 14, borderRadius: 10, fontSize: 15, lineHeight: 23},
});
