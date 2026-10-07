import { useState } from 'react';
import { Image, Platform, Share, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { demoPledge, demoPrompts, exportOwnDemo, member, type DemoMember } from '@black-childfree/domain/demo';
import { useDemo } from './store';
import { Action, Avatar, Card, Chip, Heading, Input, Note, Screen, navigate, portraits, s } from './ui';

export function Profile() {
  const {width} = useWindowDimensions();
  const {state, act, busy} = useDemo(); const person = member(state);
  async function edit(step: number) {if (await act({type: 'save', patch: {step}})) navigate('/demo/onboarding');}
  return <Screen><Heading eyebrow="YOUR OWN BLUEPRINT" title="Your profile." subtitle="An introduction that feels like you." />
    <Card><View style={s.row}><Avatar photo={person.photos[0]} size={84} /><View style={{flex: 1}}><Text style={s.subtitle}>{person.profile.display_name}</Text><Text style={s.small}>{person.preferences.city} · {person.lifecycle.replaceAll('_', ' ')}</Text></View></View>
      <Text style={s.body}>{person.profile.bio || 'Your story is still taking shape.'}</Text><Action disabled={busy} onPress={() => {void edit(1);}}>Edit profile and prompts</Action><Action secondary disabled={busy} onPress={() => {void edit(2);}}>Edit photos</Action>
    </Card>
    {person.photos.length > 0 && <View style={s.row}>{person.photos.map((p, i) => <View key={p} style={{width: '46%', gap: 7}}><Image source={portraits[p]} style={{width: '100%', height: (Math.min(width, 620) - 44) * 0.46 / 0.8, borderRadius: 18}} /><Text style={s.small}>{i === 0 ? 'Primary illustration' : `Illustration ${i + 1}`}</Text></View>)}</View>}
    {person.profile.prompts.map(p => <Card key={p.id}><Text style={s.eyebrow}>{demoPrompts.find(prompt => prompt.id === p.id)?.text}</Text><Text style={s.subtitle}>{p.answer}</Text></Card>)}
    <Note>Editing your story or photos returns the demo profile to review before discovery. No live profile is changed.</Note>
    <Action secondary onPress={() => navigate('/demo/preferences')}>Edit partner preferences</Action>
  </Screen>;
}
export function Settings() {
  const {state, act, busy} = useDemo(); const person = member(state);
  const [confirmReset, setConfirmReset] = useState(false); const [confirmation, setConfirmation] = useState(''); const [deleting, setDeleting] = useState(false);
  async function switchTo(id: string) {if (await act({type: 'switch', id})) navigate('/demo/discover');}
  return <Screen><Heading eyebrow="MAKE SPACE FOR WHAT MATTERS" title="Your settings." />
    <Card><View style={s.row}><Avatar photo={person.photos[0]} /><View style={{flex: 1}}><Text style={s.subtitle}>{person.profile.display_name}</Text><Text style={s.small}>Demo status · {person.lifecycle.replaceAll('_', ' ')}</Text></View></View>
      {!['suspended', 'deleted'].includes(person.lifecycle) && <><Action secondary onPress={() => navigate('/demo/onboarding')}>Continue onboarding or view review status</Action><Action disabled={busy || !['active', 'paused'].includes(person.lifecycle)} onPress={() => {void act({type: 'pause'});}}>{person.lifecycle === 'paused' ? 'Resume discovery' : 'Pause discovery'}</Action><Text style={s.small}>Pausing hides you from discovery; eligible existing conversations stay available.</Text><Chip selected={person.notifications} disabled={busy} onPress={() => {void act({type: 'save', patch: {notifications: !person.notifications}});}}>Demo notifications enabled</Chip><Text style={s.small}>This preference is simulated. No push notifications are sent.</Text></>}
    </Card>
    <Card><Action secondary onPress={() => navigate('/demo/blocked')}>Blocked users</Action><Action secondary onPress={() => navigate('/demo/about')}>Community pledge and help</Action><Action secondary onPress={() => navigate('/demo/export')}>Export my synthetic data</Action><Action danger onPress={() => setDeleting(!deleting)}>Delete my demo account</Action>
      {deleting && <><Note error>This deletes the selected local demo member’s profile and conversations. It does not delete a live account. Reset demo can restore the fixtures.</Note><Input label="Type DELETE to confirm demo deletion" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" /><Action danger disabled={busy || confirmation !== 'DELETE'} onPress={() => {void act({type: 'delete'}).then(result => {if (result) {setDeleting(false); setConfirmation('');}});}}>Confirm demo account deletion</Action></>}
    </Card>
    <Card><Heading eyebrow="DEMO TOOLS" title="Try another point of view." subtitle="Switch synthetic members to test reciprocal likes, messaging, and restrictions." /><View style={s.row}>{state.members.map(p => <Chip key={p.id} selected={state.actor === p.id} disabled={busy} onPress={() => {void switchTo(p.id);}}>{p.id === 'new' ? 'Start a new demo profile' : p.profile.display_name}</Chip>)}</View><Action secondary onPress={() => navigate('/demo/review')}>Simulated review console</Action><Action secondary onPress={() => setConfirmReset(!confirmReset)}>Reset demo</Action>{confirmReset && <><Note>Reset clears all local synthetic messages, decisions, and profiles and restores the original fixtures.</Note><Action danger disabled={busy} onPress={() => {void act({type: 'reset'}).then(result => {if (result) {setConfirmReset(false); navigate('/demo/discover');}});}}>Confirm reset demo</Action><Action secondary onPress={() => setConfirmReset(false)}>Cancel reset</Action></>}</Card>
    <Action secondary onPress={() => navigate('/')}>Leave demo</Action>
  </Screen>;
}
export function BlockedUsers() {
  const {state, act, busy} = useDemo(); const blocks = state.blocks.filter(b => b.actor === state.actor);
  return <Screen back="/demo/settings"><Heading title="A boundary, respected." subtitle="Unblocking does not reopen a closed match." />{blocks.length ? blocks.map(b => <Card key={b.target}><View style={s.row}><Avatar photo={member(state, b.target).photos[0]} /><Text style={s.subtitle}>{member(state, b.target).profile.display_name}</Text></View><Action secondary disabled={busy} onPress={() => {void act({type: 'unblock', target: b.target});}}>Unblock</Action></Card>) : <Note>You haven’t blocked any demo members.</Note>}</Screen>;
}
export const reportCategories = ['Eligibility misrepresentation', 'Impersonation, scam, or money solicitation', 'Harassment or discrimination', 'Sexual content', 'Threats or safety', 'Suspected underage member', 'Other'];
export function Report() {
  const {target = ''} = useLocalSearchParams<{target: string}>(); const {state, act, busy} = useDemo();
  const person = state.members.find(m => m.id === target); const [category, setCategory] = useState(''); const [detail, setDetail] = useState(''); const [receipt, setReceipt] = useState('');
  async function submit() {
    const id = `report-${Date.now()}`;
    if (await act({type: 'report', target, category, detail, id})) setReceipt(id);
  }
  return <Screen back="/demo/connections">{!person ? <Note error>This demo profile was not found.</Note> : receipt ? <Card><Heading title="Your report has been received." subtitle="Synthetic receipt only. No real moderator or emergency service has been contacted." /><Text selectable style={s.small}>Receipt: {receipt}</Text><Action secondary onPress={() => navigate(`/demo/safety?target=${target}`)}>Block this demo member too</Action><Action onPress={() => navigate('/demo/settings')}>Back to settings</Action></Card> : <><Heading title="You deserve to feel comfortable." subtitle={`Report ${person.profile.display_name}. Reporting and blocking are separate actions.`} /><View style={s.stack}>{reportCategories.map(c => <Chip key={c} selected={category === c} onPress={() => setCategory(c)}>{c}</Chip>)}</View><Input label="Report details (synthetic information only)" value={detail} onChangeText={setDetail} multiline maxLength={1000} /><Action disabled={busy || !category} onPress={() => {void submit();}}>Submit demo report</Action></>}</Screen>;
}
export function Safety() {
  const {target = ''} = useLocalSearchParams<{target: string}>(); const {state, act, busy} = useDemo(); const person = state.members.find(m => m.id === target); const [confirmation, setConfirmation] = useState<'block' | 'unmatch' | null>(null);
  async function close() {if (await act({type: 'close', target, block: confirmation === 'block'})) navigate('/demo/connections');}
  return <Screen back="/demo/connections">{!person ? <Note error>This profile is unavailable.</Note> : <Card><Heading title="Your boundaries come first." subtitle={`Choose how to close your connection with ${person.profile.display_name}.`} /><Action secondary onPress={() => navigate(`/demo/report?target=${target}`)}>Report independently</Action><Action danger onPress={() => setConfirmation('block')}>Block this demo member</Action><Action secondary onPress={() => setConfirmation('unmatch')}>Unmatch this demo member</Action>{confirmation && <><Note>{confirmation === 'block' ? 'Blocking hides this member, closes your match, and prevents demo messages.' : 'Unmatching closes this connection. It will not rematch in this demo.'}</Note><Action danger disabled={busy} onPress={() => {void close();}}>{confirmation === 'block' ? 'Confirm block' : 'Confirm unmatch'}</Action><Action secondary onPress={() => setConfirmation(null)}>Cancel</Action></>}</Card>}</Screen>;
}
export function Export() {
  const {state} = useDemo(); const data = exportOwnDemo(state);
  async function download() {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'black-childfree-synthetic-export.json'; anchor.click(); URL.revokeObjectURL(url);
    } else {await Share.share({message: data, title: 'Synthetic demo export'});}
  }
  return <Screen back="/demo/settings"><Heading title="Your story belongs to you." subtitle="This export contains the selected fixture’s local synthetic profile, sent messages, and reports. It excludes other members’ private details." /><Action onPress={() => {void download();}}>Export synthetic JSON</Action><Card><Text selectable style={[s.small, {fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'}]}>{data}</Text></Card></Screen>;
}
export function About() {
  return <Screen back="/demo/settings"><Heading title="Our community, our commitment." /><Card><Text style={s.body}>{demoPledge}</Text></Card><Card><Text style={s.subtitle}>Room for boundaries.</Text><Text style={s.body}>Report and block independently from a profile or conversation. All demo reports remain on this device. There is no staffed support, live verification, or emergency response in this preview.</Text><Text style={s.body}>In an immediate emergency, contact your local emergency services. Live Terms, Privacy, support, appeals, and deletion policies must be supplied before real registration.</Text></Card><Action secondary onPress={() => navigate('/member')}>Open real application setup</Action></Screen>;
}
export function Review() {
  const {state} = useDemo();
  return <Screen back="/demo/settings" tabs={false}><Heading eyebrow="SYNTHETIC FIXTURE TOOL" title="Simulated review console." subtitle="This console only changes local demo state. It has no live administrative access and is not production MFA or moderation." />
    {state.members.filter(p => p.lifecycle !== 'deleted').map(p => <ReviewMember key={p.id} person={p} />)}
    <Heading title="Reports" />{state.reports.length === 0 ? <Note>No synthetic reports yet.</Note> : state.reports.map(r => <ReviewReport key={r.id} id={r.id} />)}
    <Heading title="Local review history" />{state.audit.length ? state.audit.slice().reverse().map(a => <Card key={a.id}><Text style={s.label}>{member(state, a.target).profile.display_name}</Text><Text style={s.body}>{a.action}</Text><Text style={s.small}>{new Date(a.at).toLocaleString()}</Text></Card>) : <Text style={s.body}>Simulated review decisions will appear here.</Text>}
  </Screen>;
}
function ReviewMember({person}: {person: DemoMember}) {
  const {act, busy} = useDemo(); const [reason, setReason] = useState('Synthetic review for the MVP1 walkthrough.');
  async function review(decision: 'approve' | 'changes' | 'suspend' | 'restore') {await act({type: 'moderate', target: person.id, decision, reason});}
  return <Card><View style={s.row}><Avatar photo={person.photos[0]} /><View style={{flex: 1}}><Text style={s.subtitle}>{person.profile.display_name}</Text><Text style={s.small}>{person.lifecycle.replaceAll('_', ' ')} · {person.photos.length} illustrations</Text></View></View><Text style={s.small}>Identity: {person.identity.replaceAll('_', ' ')} · review {person.reviewed ? 'simulated approved' : 'required'}</Text><Input label={`Review reason for ${person.profile.display_name}`} value={reason} onChangeText={setReason} />
    <View style={s.row}><Action disabled={busy} label={`Simulate approval for ${person.profile.display_name}`} onPress={() => {void review('approve');}}>Approve demo</Action><Action secondary disabled={busy} label={`Request changes for ${person.profile.display_name}`} onPress={() => {void review('changes');}}>Request changes</Action><Action danger disabled={busy} label={`Suspend ${person.profile.display_name}`} onPress={() => {void review('suspend');}}>Suspend</Action>{person.lifecycle === 'suspended' && <Action secondary disabled={busy} onPress={() => {void review('restore');}}>Restore demo account</Action>}</View>
  </Card>;
}
function ReviewReport({id}: {id: string}) {
  const {state, act, busy} = useDemo(); const r = state.reports.find(r => r.id === id)!;
  return <Card><Text style={s.label}>{r.category}</Text><Text style={s.body}>{r.detail || 'No additional synthetic details.'}</Text><Text style={s.small}>Subject: {member(state, r.target).profile.display_name} · {r.status}</Text><Action secondary disabled={busy || r.status === 'reviewed'} onPress={() => {void act({type: 'review_report', id});}}>Mark demo report reviewed</Action></Card>;
}
