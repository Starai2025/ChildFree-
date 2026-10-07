import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDemo } from './store';

export const palette = {ink: '#28231F', muted: '#746B62', orange: '#C84B23', cream: '#FBF7F1', line: '#E9E1D7', peach: '#FFF0E7', green: '#3B614E'};
export const portraits: ImageSourcePropType[] = [
  require('../../assets/demo/amara.png'), require('../../assets/demo/malik.png'), require('../../assets/demo/imani.png'),
  require('../../assets/demo/theo.png'), require('../../assets/demo/nia.png'), require('../../assets/demo/jordan.png'),
];
export function navigate(path: string) {router.push(path as Href);}
export function Icon({name, size = 24, color = palette.orange}: {name: ComponentProps<typeof Ionicons>['name']; size?: number; color?: string}) {return <Ionicons name={name} size={size} color={color} accessible={false} />;}
export function Action({children, onPress, secondary = false, danger = false, disabled = false, label}: {children: ReactNode; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; label?: string}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (typeof children === 'string' ? children : undefined)} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed}) => [s.button, secondary && s.secondary, danger && s.danger, (pressed || disabled) && {opacity: 0.5}]}><Text style={[s.buttonText, secondary && {color: palette.ink}, danger && {color: '#A12D27'}]}>{children}</Text></Pressable>;
}
export function Chip({children, selected, onPress, disabled = false}: {children: string; selected: boolean; onPress: () => void; disabled?: boolean}) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={children} accessibilityState={{checked: selected, disabled}} disabled={disabled} onPress={onPress} style={[s.chip, selected && s.chipSelected, disabled && {opacity: 0.5}]}><Text style={[s.chipText, selected && {color: '#AE3D15'}]}>{selected ? '✓  ' : ''}{children}</Text></Pressable>;
}
export function Input({label, ...props}: TextInputProps & {label: string}) {return <View style={s.stack}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={palette.muted} {...props} style={[s.input, props.multiline && {minHeight: 108, textAlignVertical: 'top'}, props.style]} /></View>;}
export function Heading({eyebrow, title, subtitle}: {eyebrow?: string; title: string; subtitle?: string}) {return <View style={{gap: 8}}>{eyebrow && <Text style={s.eyebrow}>{eyebrow}</Text>}<Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle && <Text style={s.body}>{subtitle}</Text>}</View>;}
export function Card({children}: {children: ReactNode}) {return <View style={s.card}>{children}</View>;}
export function Note({children, error = false}: {children: ReactNode; error?: boolean}) {return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.note, error && {color: '#A12D27', backgroundColor: '#FFF0ED'}]}>{children}</Text>;}
export function Avatar({photo = 0, size = 56}: {photo?: number; size?: number}) {return <Image source={portraits[photo] ?? portraits[0]} accessibilityLabel="Original illustrated demo avatar" style={{width: size, height: size, borderRadius: size / 2, backgroundColor: palette.peach}} />;}
export function Screen({children, back, tabs = true}: {children: ReactNode; back?: string; tabs?: boolean}) {
  const path = usePathname(); const {loading, busy, error, clearError} = useDemo();
  const links = [{path: '/demo/discover', icon: 'compass-outline', text: 'Discover'}, {path: '/demo/connections', icon: 'chatbubbles-outline', text: 'Connections'}, {path: '/demo/profile', icon: 'person-outline', text: 'Profile'}, {path: '/demo/settings', icon: 'options-outline', text: 'Settings'}] as const;
  return <SafeAreaView style={s.safe}>
    <View style={s.frame}>
      <View style={s.topbar}>{back ? <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigate(back)} style={s.back}><Text style={s.backText}>‹</Text></Pressable> : <Text style={s.brandMark}>b.</Text>}<Text style={s.brand}>black childfree<Text style={{color: palette.orange}}> ♥</Text></Text><Text style={s.demoTag}>DEMO</Text></View>
      <View style={s.demoStrip}><Text style={s.demoStripText}>A preview of possibility. All people and activity are synthetic.</Text></View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{flex: 1}}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          {loading ? <ActivityIndicator accessibilityLabel="Loading demo" color={palette.orange} /> : children}
          {!!error && <View style={s.stack}><Note error>{error}</Note><Action secondary onPress={clearError}>Dismiss notice</Action></View>}
          {busy && <ActivityIndicator accessibilityLabel="Saving demo" color={palette.orange} />}
        </ScrollView>
      </KeyboardAvoidingView>
      {tabs && <View style={s.tabs}>{links.map(link => <Pressable key={link.path} accessibilityRole="button" accessibilityLabel={link.text} accessibilityState={{selected: path === link.path}} onPress={() => navigate(link.path)} style={s.tab}><Icon name={link.icon} size={23} color={path === link.path ? palette.orange : palette.muted} /><Text style={[s.tabText, path === link.path && {color: palette.orange}]}>{link.text}</Text></Pressable>)}</View>}
    </View>
  </SafeAreaView>;
}
export const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#EEE7DE'}, frame: {flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', backgroundColor: palette.cream},
  topbar: {height: 72, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: palette.line},
  brandMark: {fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontWeight: '700', fontSize: 34, color: palette.orange}, brand: {fontSize: 18, fontWeight: '700', color: palette.ink, flex: 1, letterSpacing: -0.5}, demoTag: {fontSize: 10, letterSpacing: 1, fontWeight: '700', color: '#9C3B18', paddingHorizontal: 9, paddingVertical: 5, backgroundColor: palette.peach, borderRadius: 20},
  demoStrip: {paddingVertical: 9, paddingHorizontal: 20, backgroundColor: '#F2EBE1'}, demoStripText: {fontSize: 11, lineHeight: 17, color: '#655B51', textAlign: 'center'},
  content: {padding: 22, gap: 22, paddingBottom: 36}, title: {fontSize: 32, lineHeight: 39, fontWeight: '700', color: palette.ink, letterSpacing: -1}, subtitle: {fontSize: 21, lineHeight: 29, fontWeight: '600', color: palette.ink}, body: {fontSize: 15, lineHeight: 24, color: palette.muted}, small: {fontSize: 12, lineHeight: 19, color: palette.muted}, eyebrow: {fontSize: 10, lineHeight: 17, fontWeight: '700', letterSpacing: 2, color: palette.orange},
  button: {minHeight: 50, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.orange}, buttonText: {fontSize: 15, lineHeight: 22, fontWeight: '600', color: 'white', textAlign: 'center'}, secondary: {backgroundColor: '#F0E9DF'}, danger: {backgroundColor: '#FFF0ED'},
  row: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10}, between: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12}, stack: {gap: 10}, card: {borderRadius: 22, backgroundColor: 'white', padding: 20, gap: 16, borderWidth: 1, borderColor: palette.line},
  label: {fontSize: 13, lineHeight: 20, fontWeight: '600', color: palette.ink}, input: {fontSize: 16, lineHeight: 23, padding: 15, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#D7CBBD', backgroundColor: 'white', color: palette.ink},
  chip: {minHeight: 44, paddingVertical: 11, paddingHorizontal: 15, borderRadius: 24, borderWidth: 1, borderColor: '#D7CBBD', backgroundColor: 'white'}, chipSelected: {backgroundColor: palette.peach, borderColor: '#ECA386'}, chipText: {fontSize: 13, lineHeight: 20, color: palette.muted}, note: {padding: 16, borderRadius: 15, backgroundColor: '#EEEFE7', color: palette.green, fontSize: 13, lineHeight: 21},
  tabs: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: palette.line, paddingVertical: 10, paddingHorizontal: 6, backgroundColor: 'white'}, tab: {flex: 1, alignItems: 'center', minHeight: 50, justifyContent: 'center', gap: 4}, tabIcon: {fontSize: 25, color: palette.muted}, tabText: {fontSize: 10, color: palette.muted, fontWeight: '600'},
  back: {minWidth: 40, minHeight: 44, justifyContent: 'center'}, backText: {fontSize: 34, color: palette.ink}, rule: {height: 1, backgroundColor: palette.line},
});
