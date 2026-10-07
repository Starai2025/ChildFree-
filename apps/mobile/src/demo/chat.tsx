import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { connections, member, unreadCount, type DemoMatch } from '@black-childfree/domain/demo';
import { useDemo } from './store';
import { Action, Avatar, Card, Heading, Icon, Input, Note, Screen, navigate, palette, s } from './ui';

function timeLabel(at: string): string {
  const date = new Date(at), now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
  return date.toLocaleDateString([], {month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric'});
}
export function Connections() {
  const {state} = useDemo(); const all = connections(state);
  const hasMessages = (m: DemoMatch) => state.messages.some(message => message.matchId === m.id && message.status === 'accepted');
  const fresh = all.filter(m => !hasMessages(m)), ongoing = all.filter(hasMessages);
  return <Screen><Heading eyebrow="SOMETHING WORTH EXPLORING" title="Your connections." subtitle="A mutual choice. A little curiosity. The beginning of something." />
    {fresh.length > 0 && <><Text style={s.subtitle}>New matches <Text style={{color: palette.orange}}>· {fresh.length}</Text></Text><View style={s.row}>{fresh.map(match => {const other = member(state, match.users.find(id => id !== state.actor)!); return <Pressable key={match.id} accessibilityRole="button" accessibilityLabel={`Open new match with ${other.profile.display_name}`} onPress={() => navigate(`/demo/conversation?id=${match.id}`)} style={styles.newMatch}><Avatar photo={other.photos[0]} size={84} /><Text style={s.label}>{other.profile.display_name}</Text><Text style={s.small}>Say hello</Text></Pressable>;})}</View></>}
    {ongoing.length > 0 && <><Text style={s.subtitle}>Conversations</Text>{ongoing.map(match => {
      const other = member(state, match.users.find(id => id !== state.actor)!);
      const messages = state.messages.filter(m => m.matchId === match.id && m.status === 'accepted'); const latest = messages[messages.length - 1]; const unread = unreadCount(state, match);
      return <Pressable key={match.id} accessibilityRole="button" accessibilityLabel={`Conversation with ${other.profile.display_name}${unread ? `, ${unread} unread` : ''}`} onPress={() => navigate(`/demo/conversation?id=${match.id}`)} style={styles.conversation}><Avatar photo={other.photos[0]} /><View style={{flex: 1, gap: 5}}><Text style={s.label}>{other.profile.display_name}</Text><Text style={s.small} numberOfLines={1}>{latest?.text}</Text></View><View style={{gap: 6, alignItems: 'flex-end'}}><Text style={s.small}>{timeLabel(latest.at)}</Text>{unread > 0 && <Text style={styles.unread}>{unread}</Text>}</View></Pressable>;
    })}</>}
    {all.length === 0 && <Card><View style={{alignItems: 'center'}}><Icon name="heart-outline" size={56} /></View><Heading title="Good things start with hello." subtitle="Your mutual demo matches will appear here. Start with a profile that catches your curiosity." /><Action onPress={() => navigate('/demo/discover')}>Explore profiles</Action></Card>}
    <Note>Conversations are free. This demo stores synthetic messages locally and does not connect to Stream.</Note>
  </Screen>;
}
export function Conversation() {
  const {id = ''} = useLocalSearchParams<{id: string}>(); const {state} = useDemo();
  return <ConversationBody key={`${state.actor}/${id}`} id={id} />;
}
function ConversationBody({id}: {id: string}) {
  const {state, act, busy, loading} = useDemo();
  const match = connections(state).find(m => m.id === id);
  const other = match ? member(state, match.users.find(user => user !== state.actor)!) : null;
  const messages = match ? state.messages.filter(m => m.matchId === id) : [];
  const [draft, setDraft] = useState(''); const [menu, setMenu] = useState(false);
  const count = messages.length; const available = !!match;
  useEffect(() => {if (!loading && available) void act({type: 'read', matchId: id});}, [loading, available, id, state.actor, count, act]);
  async function send() {
    const result = await act({type: 'send', matchId: id, text: draft, id: `message-${Date.now()}-${Math.random().toString(36).slice(2)}`});
    if (result) setDraft('');
  }
  return <Screen tabs={false} back="/demo/connections">{!other ? <Card><Heading title="This connection is unavailable." subtitle="It may be closed, blocked, paused before approval, or restricted. Demo messages are hidden when access is denied." /><Action onPress={() => navigate('/demo/connections')}>Back to connections</Action></Card> : <>
    <View style={s.between}><View style={s.row}><Avatar photo={other.photos[0]} size={48} /><View><Text style={s.subtitle}>{other.profile.display_name}</Text><Text style={s.small}>Mutual demo match · text only</Text></View></View><Action secondary label="Conversation options" onPress={() => setMenu(!menu)}>•••</Action></View>
    {menu && <Card><Action secondary onPress={() => navigate(`/demo/report?target=${other.id}`)}>Report</Action><Action danger onPress={() => navigate(`/demo/safety?target=${other.id}`)}>Block or unmatch</Action></Card>}
    <Note>This is a local demo conversation. Use “Simulate a reply” or switch fixture users to try both sides.</Note>
    {messages.length === 0 && <View style={styles.emptyChat}><Icon name="sparkles-outline" size={56} /><Text style={s.subtitle}>Send your first message.</Text><Text style={[s.body, {textAlign: 'center'}]}>A thoughtful question is a lovely place to start.</Text></View>}
    <View style={{gap: 18}}>{messages.map(message => <View key={message.id} style={[styles.messageRow, {alignItems: message.sender === state.actor ? 'flex-end' : 'flex-start'}]}>
      <View style={[styles.bubble, message.sender === state.actor ? styles.ownBubble : styles.otherBubble]}><Text selectable style={[styles.messageText, message.sender === state.actor && {color: 'white'}]}>{message.text}</Text></View>
      <Text accessibilityLabel={`${message.status}, ${new Date(message.at).toLocaleString()}`} style={s.small}>{timeLabel(message.at)} · {message.status === 'failed' ? 'Failed · preserved for retry' : message.simulated ? 'Simulated reply' : 'Accepted in demo'}</Text>
      {message.status === 'failed' && message.sender === state.actor && <Action secondary disabled={busy} label="Retry failed message" onPress={() => {void act({type: 'retry', id: message.id});}}>Retry message</Action>}
    </View>)}</View>
    <Input label="Your message" placeholder="Start with something thoughtful…" value={draft} onChangeText={setDraft} multiline maxLength={2000} editable={!busy} />
    <Action disabled={busy || !draft.trim()} onPress={() => {void send();}}>Send message ↑</Action>
    <View style={s.row}><Action secondary disabled={busy} onPress={() => {void act({type: 'reply', matchId: id});}}>Simulate a reply</Action><Action secondary disabled={busy || state.failNextSend} onPress={() => {void act({type: 'fail_next'});}}>Test next send failure</Action></View>
    {state.failNextSend && <Note>The next send will fail in the demo. Retry will reuse its saved message.</Note>}
  </>}</Screen>;
}
const styles = StyleSheet.create({
  newMatch: {padding: 16, gap: 8, alignItems: 'center', backgroundColor: 'white', borderRadius: 22, borderWidth: 1, borderColor: palette.line}, conversation: {flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: palette.line}, unread: {minWidth: 23, padding: 4, borderRadius: 20, color: 'white', backgroundColor: palette.orange, fontSize: 10, textAlign: 'center'}, emptyIcon: {fontSize: 56, color: palette.orange, textAlign: 'center'}, emptyChat: {paddingVertical: 48, gap: 15, alignItems: 'center'}, messageRow: {gap: 6}, bubble: {maxWidth: '80%', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 21}, ownBubble: {backgroundColor: palette.orange, borderBottomRightRadius: 5}, otherBubble: {backgroundColor: 'white', borderWidth: 1, borderColor: palette.line, borderBottomLeftRadius: 5}, messageText: {fontSize: 16, lineHeight: 25, color: palette.ink},
});
