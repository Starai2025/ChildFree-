import { Image, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Action, navigate, palette, portraits } from '../demo/ui';
import MemberScreen from './member';

export default function Welcome() {
  const {width} = useWindowDimensions();
  if (process.env.EXPO_PUBLIC_APP_ENV === 'production') return <MemberScreen />;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <View style={styles.nav}><Text style={styles.logo}>black childfree<Text style={{color: palette.orange}}> ♥</Text></Text><Text style={styles.badge}>THE MVP1 DEMO</Text></View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>BLACK LOVE. A SHARED CHOICE.</Text>
      <Text accessibilityRole="header" style={styles.title}>A full life.{'\n'}A real connection.{'\n'}<Text style={{color: palette.orange}}>Your own way.</Text></Text>
      <Text style={styles.description}>For Black adults who know parenthood isn’t part of their story—and want someone who feels the same.</Text>
      <View style={styles.portraitRow}>{[0, 1, 2].map((photo, i) => <View key={photo} style={[styles.portrait, {transform: [{rotate: `${(i - 1) * 6}deg`}]}]}><Image source={portraits[photo]} style={[styles.image, {height: (Math.min(Math.max(width - 48, 200), 580) - 20) / 3 / 0.75}]} /><Text style={styles.photoCaption}>{['Amara', 'Malik', 'Imani'][i]} · illustrated demo</Text></View>)}</View>
      <Action onPress={() => navigate('/demo/discover')}>Explore the demo →</Action>
      <Action secondary onPress={() => navigate('/member')}>Open real sign-in setup</Action>
      <Text style={styles.footnote}>A complete interactive preview. All profiles, verification, matches, and messages are synthetic. No real account is created.</Text>
    </View>
    <View style={styles.values}>{[['01', 'Shared intention', 'Never married. No children or parental role. Never seeking parenthood.'], ['02', 'Room to be yourself', 'Thoughtful prompts, inclusive preferences, and meaningful connections.'], ['03', 'A kinder beginning', 'A community pledge, mutual matching, and free text conversations.']].map(([n, title, text]) => <View key={n} style={styles.value}><Text style={styles.number}>{n}</Text><Text style={styles.valueTitle}>{title}</Text><Text style={styles.valueText}>{text}</Text></View>)}</View>
    <Text style={styles.footer}>ATLANTA FOUNDING COHORT · 18+ · BUILT WITH INTENTION</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: palette.cream}, page: {maxWidth: 960, width: '100%', alignSelf: 'center', padding: 24, gap: 30, paddingBottom: 40}, nav: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 14}, logo: {fontSize: 20, fontWeight: '700', color: palette.ink, letterSpacing: -0.7}, badge: {fontSize: 9, fontWeight: '700', letterSpacing: 1, color: '#AD451D', backgroundColor: palette.peach, padding: 9, borderRadius: 20},
  hero: {maxWidth: 580, width: '100%', alignSelf: 'center', gap: 22, paddingVertical: 14}, eyebrow: {fontSize: 10, fontWeight: '700', letterSpacing: 2, color: palette.orange}, title: {fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 48, lineHeight: 55, fontWeight: '600', color: palette.ink, letterSpacing: -1.5}, description: {fontSize: 17, lineHeight: 28, color: palette.muted, maxWidth: 460}, portraitRow: {flexDirection: 'row', gap: 10, paddingVertical: 10}, portrait: {flex: 1, flexBasis: 0, minWidth: 0, borderRadius: 16, backgroundColor: 'white', overflow: 'hidden', borderWidth: 1, borderColor: palette.line}, image: {width: '100%'}, photoCaption: {fontSize: 9, padding: 8, color: palette.muted}, footnote: {fontSize: 12, lineHeight: 20, color: palette.muted, textAlign: 'center'},
  values: {flexDirection: 'row', flexWrap: 'wrap', gap: 24, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 28}, value: {flex: 1, minWidth: 180, gap: 8}, number: {fontSize: 12, color: palette.orange, letterSpacing: 1}, valueTitle: {fontSize: 16, fontWeight: '600', color: palette.ink}, valueText: {fontSize: 13, lineHeight: 22, color: palette.muted}, footer: {fontSize: 9, letterSpacing: 1.5, color: palette.muted, textAlign: 'center'},
});
