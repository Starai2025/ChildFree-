import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ageOn } from '@black-childfree/domain';
import { candidates, canDiscover, compatible, connections, demoPrompts, distance, member, today, type DemoMember } from '@black-childfree/domain/demo';
import { useDemo } from './store';
import { Action, Avatar, Card, Heading, Icon, Note, Screen, navigate, palette, portraits, s } from './ui';

function ProfileCard({person, full = false}: {person: DemoMember; full?: boolean}) {
  const {state} = useDemo(); const [photo, setPhoto] = useState(0);
  const {width} = useWindowDimensions();
  const index = Math.min(photo, Math.max(0, person.photos.length - 1));
  return <View style={styles.profileCard}>
    <Image source={portraits[person.photos[index] ?? 0]} accessibilityLabel={`Original illustration for ${person.profile.display_name}, photo ${index + 1}`} style={[styles.hero, {height: (Math.min(width, 620) - 46) / 0.9}]} />
    <View style={styles.photoDots}>{person.photos.map((_, i) => <View key={i} style={[styles.dot, index === i && {backgroundColor: palette.orange, width: 26}]} />)}</View>
    <View style={styles.details}>
      <View style={s.between}><Text style={styles.name}>{person.profile.display_name}, {ageOn(person.dob, today())}</Text><Text style={styles.intent}>INTENTIONAL</Text></View>
      <Text style={s.small}>{person.preferences.city} · approximately {Math.round(distance(member(state), person))} miles away</Text>
      <Text style={s.body}>{person.profile.bio || 'Making space for something meaningful.'}</Text>
      <View style={s.row}><Text style={styles.tag}>Childfree by choice</Text><Text style={styles.tag}>Serious relationship</Text></View>
      {person.photos.length > 1 && <View style={s.row}><Action secondary label="Previous profile photo" onPress={() => setPhoto((index + person.photos.length - 1) % person.photos.length)}>‹ Previous</Action><Action secondary label="Next profile photo" onPress={() => setPhoto((index + 1) % person.photos.length)}>Next ›</Action></View>}
      {full ? person.profile.prompts.map(p => <View key={p.id} style={styles.prompt}><Text style={s.eyebrow}>{demoPrompts.find(x => x.id === p.id)?.text ?? p.id}</Text><Text style={s.subtitle}>{p.answer}</Text></View>) : <Action secondary onPress={() => navigate(`/demo/person?id=${person.id}`)}>Read full profile →</Action>}
    </View>
  </View>;
}
export function Discover() {
  const {state, act, busy, loading} = useDemo(); const viewer = member(state);
  const [celebration, setCelebration] = useState<{id: string; target: string} | null>(null);
  const preferenceKey = JSON.stringify(viewer.preferences);
  useEffect(() => {if (!loading) void act({type: 'discover'});}, [loading, state.actor, viewer.lifecycle, preferenceKey, act]);
  const queue = candidates(state); const candidate = queue[0];
  const assigned = state.exposures.filter(e => e.actor === state.actor && e.day === today()).length;
  async function react(kind: 'like' | 'pass') {
    if (!candidate) return;
    const next = await act({type: 'react', target: candidate.id, kind});
    const match = next?.matches.find(m => m.status === 'ready' && m.users.includes(viewer.id) && m.users.includes(candidate.id));
    if (match && !state.matches.some(m => m.id === match.id)) setCelebration({id: match.id, target: candidate.id});
  }
  return <Screen>
    <View style={s.between}><View style={{flex: 1, minWidth: 0}}><Heading eyebrow="A LITTLE POSSIBILITY, EVERY DAY" title="Meet your kind of person." /></View><Avatar photo={viewer.photos[0]} size={44} /></View>
    <View style={s.between}><Text style={s.small}>{viewer.preferences.city} · {viewer.preferences.radius} mile radius</Text><Action secondary onPress={() => navigate('/demo/preferences')}>Preferences</Action></View>
    {!canDiscover(viewer) ? <Card><Heading title={viewer.lifecycle === 'paused' ? 'A little space for you.' : 'Your next chapter starts here.'} subtitle={viewer.lifecycle === 'paused' ? 'You’re paused. Existing eligible conversations remain available.' : `Demo status: ${viewer.lifecycle.replaceAll('_', ' ')}. Complete onboarding and simulated review before discovery.`} /><Action onPress={() => navigate(viewer.lifecycle === 'paused' || ['suspended', 'deleted'].includes(viewer.lifecycle) ? '/demo/settings' : '/demo/onboarding')}>{viewer.lifecycle === 'paused' ? 'Open settings to resume' : ['suspended', 'deleted'].includes(viewer.lifecycle) ? 'Account settings' : 'Continue onboarding'}</Action>{viewer.lifecycle === 'pending_review' && <Action secondary onPress={() => navigate('/demo/review')}>Open simulated review console</Action>}</Card> : celebration ? <Card>
      <View style={{alignItems: 'center'}}><Icon name="heart" size={64} /></View><Heading eyebrow="A MUTUAL DEMO MATCH" title="The feeling is mutual." subtitle={`You and ${member(state, celebration.target).profile.display_name} both chose to connect. See where a conversation takes you.`} />
      <View style={s.row}><Avatar photo={viewer.photos[0]} size={90} /><Avatar photo={member(state, celebration.target).photos[0]} size={90} /></View>
      <Note>This match and its ready conversation are simulated.</Note>
      <Action onPress={() => {setCelebration(null); navigate(`/demo/conversation?id=${celebration.id}`);}}>Start a conversation</Action><Action secondary onPress={() => setCelebration(null)}>Keep discovering</Action>
    </Card> : candidate ? <View style={s.stack}>
      <ProfileCard key={candidate.id} person={candidate} />
      <View style={styles.reactions}><View style={{flex: 1}}><Action secondary disabled={busy} label={`Pass on ${candidate.profile.display_name}`} onPress={() => {void react('pass');}}>×  Pass</Action></View><View style={{flex: 1}}><Action disabled={busy} label={`Like ${candidate.profile.display_name}`} onPress={() => {void react('like');}}>♡  Like</Action></View></View>
      <Text style={[s.small, {textAlign: 'center'}]}>Shared preferences. A shared childfree choice. No invented compatibility scores.</Text>
    </View> : <Card><View style={{alignItems: 'center'}}><Icon name="sunny-outline" size={60} /></View><Heading title="You’re all caught up." subtitle="There are no more eligible demo profiles within both members’ preferences. We won’t widen your filters or invent people." /><Action secondary onPress={() => navigate('/demo/preferences')}>Review your preferences</Action><Action onPress={() => navigate('/demo/connections')}>Visit your connections</Action></Card>}
    <Text style={s.small}>{assigned} of 5 new demo assignments today · {queue.length} unanswered. Closing the app preserves your place.</Text>
  </Screen>;
}
export function Person() {
  const {id} = useLocalSearchParams<{id: string}>(); const {state} = useDemo();
  const found = state.members.find(m => m.id === id);
  const person = found && (found.id === state.actor || (compatible(state, member(state), found) && state.exposures.some(e => e.actor === state.actor && e.target === found.id)) || connections(state).some(m => m.users.includes(found.id))) ? found : null;
  return <Screen back="/demo/discover">{person ? <><ProfileCard person={person} full /><Action secondary onPress={() => navigate(`/demo/report?target=${person.id}`)}>Report this demo profile</Action><Action danger onPress={() => navigate(`/demo/safety?target=${person.id}`)}>Block or unmatch</Action></> : <Note error>This profile is unavailable.</Note>}</Screen>;
}
const styles = StyleSheet.create({
  profileCard: {borderRadius: 26, overflow: 'hidden', backgroundColor: 'white', borderWidth: 1, borderColor: palette.line}, hero: {width: '100%'}, photoDots: {flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 16}, dot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#DDD4C8'}, details: {padding: 22, gap: 15}, name: {fontSize: 28, fontWeight: '700', color: palette.ink, letterSpacing: -0.7, flexShrink: 1}, intent: {fontSize: 8, letterSpacing: 1, color: palette.green, backgroundColor: '#EDF1E9', padding: 7, borderRadius: 12}, tag: {fontSize: 11, color: '#9C461F', backgroundColor: palette.peach, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18}, prompt: {paddingVertical: 20, gap: 12, borderTopWidth: 1, borderTopColor: palette.line}, reactions: {flexDirection: 'row', gap: 12}, heart: {fontSize: 60, color: palette.orange, textAlign: 'center'},
});
