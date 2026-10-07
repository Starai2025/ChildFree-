import { useState } from 'react';
import { Image, Text, View, useWindowDimensions } from 'react-native';
import { ageOn, dobSchema, eligibilityLabels, genderSchema, profileSchema, type Profile } from '@black-childfree/domain';
import { cities, demoPledge, demoPrompts, eligible, member, preferencesSchema, today, type DemoMember, type Preferences } from '@black-childfree/domain/demo';
import { useDemo } from './store';
import { Action, Card, Chip, Heading, Input, Note, Screen, navigate, portraits, s } from './ui';

const genderNames = {woman: 'Woman', man: 'Man', nonbinary: 'Nonbinary', self_described: 'Self-described'};
const steps = ['Eligibility', 'Your story', 'Photos', 'Preferences', 'Identity', 'Review'];
export function Onboarding() {
  const {state, act, busy, loading} = useDemo(); const person = member(state);
  return <Screen tabs={false} back="/demo/settings">{!loading && <OnboardingForm key={`${person.id}/${person.step}`} person={person} act={act} busy={busy} />}</Screen>;
}
function OnboardingForm({person, act, busy}: {person: DemoMember; act: ReturnType<typeof useDemo>['act']; busy: boolean}) {
  const {width} = useWindowDimensions();
  const step = person.step;
  const [draft, setDraft] = useState(person);
  const [error, setError] = useState('');
  const [pendingIdentity, setPendingIdentity] = useState(false);
  function profile(patch: Partial<Profile>) {setDraft({...draft, profile: {...draft.profile, ...patch}});}
  async function save(next: number) {
    setError('');
    if (step === 0 && next > step) {
      if (!dobSchema.safeParse(draft.dob).success) {setError('Enter a real birth date as YYYY-MM-DD.'); return;}
      if (!eligible(draft)) {setError('Membership requires age 18+, every eligibility statement, and the separate Community Pledge. You can correct your answers.'); return;}
    }
    if (step === 1 && next > step && !profileSchema.safeParse(draft.profile).success) {setError('Choose a gender, enter a 2–60 character name, and answer two different prompts with 20–200 characters each.'); return;}
    if (step === 2 && next > step && draft.photos.length < 2) {setError('Choose at least two demo illustrations.'); return;}
    if (step === 3 && !preferencesSchema.safeParse(draft.preferences).success) {setError('Choose partner genders, ages 18–99 in order, and a radius from 1–500 miles.'); return;}
    if (step === 4 && next > step && draft.identity !== 'simulated_verified') {setError('Complete the labeled identity simulation to continue.'); return;}
    const patch = step === 0 ? {dob: draft.dob, answers: draft.answers, pledged: draft.pledged} : step === 1 ? {profile: draft.profile} : step === 2 ? {photos: draft.photos} : step === 3 ? {preferences: draft.preferences} : step === 4 ? {identity: draft.identity} : {};
    return act({type: 'save', patch: {...patch, step: next}});
  }
  async function verify() {
    setPendingIdentity(true);
    const result = await act({type: 'save', patch: {identity: 'pending'}});
    if (result) {
      const verified = await act({type: 'save', patch: {identity: 'simulated_verified'}});
      if (verified) setDraft({...draft, identity: 'simulated_verified'});
    }
    setPendingIdentity(false);
  }
  if (['deleted', 'suspended'].includes(person.lifecycle)) return <Card><Heading title="This account needs attention." subtitle={`Demo status: ${person.lifecycle}. Settings, support information, and deletion remain accessible.`} /><Action onPress={() => navigate('/demo/settings')}>Open settings</Action></Card>;
  return <>
    <View style={s.row}>{steps.map((title, i) => <View key={title} style={{flex: 1, height: 4, borderRadius: 3, backgroundColor: i <= step ? '#E95D2A' : '#E9E1D7'}} />)}</View>
    <Heading eyebrow={`${steps[step].toUpperCase()} · STEP ${step + 1} OF 6`} title={['A shared choice.', 'Make room for your story.', 'A little more you.', 'Your kind of connection.', 'A thoughtful introduction.', 'Ready for a new chapter.'][step]} subtitle="This is a synthetic walkthrough. Progress is saved on this device." />
    {step === 0 && <>
      <Input label="Demo birth date (YYYY-MM-DD)" value={draft.dob} onChangeText={dob => setDraft({...draft, dob})} editable={!busy} />
      <Text style={s.small}>Use invented details only. These are self-attestations; identity checks do not verify race, marital history, or parenthood choices.</Text>
      {(Object.entries(eligibilityLabels) as [keyof typeof draft.answers, string][]).map(([key, label]) => <Card key={key}><Text style={s.body}>{label}</Text><View style={s.row}><Chip selected={draft.answers[key]} onPress={() => setDraft({...draft, answers: {...draft.answers, [key]: true}})}>Yes</Chip><Chip selected={!draft.answers[key]} onPress={() => setDraft({...draft, answers: {...draft.answers, [key]: false}})}>No</Chip></View></Card>)}
      <Card><Text style={s.subtitle}>Our community, our commitment.</Text><Text style={s.body}>{demoPledge}</Text><Chip selected={draft.pledged} onPress={() => setDraft({...draft, pledged: !draft.pledged})}>I agree to the Community Pledge.</Chip></Card>
    </>}
    {step === 1 && <>
      <Input label="Display name" value={draft.profile.display_name} onChangeText={display_name => profile({display_name})} maxLength={60} />
      <Text style={s.label}>Gender</Text><View style={s.row}>{genderSchema.options.map(gender => <Chip key={gender} selected={draft.profile.gender === gender} onPress={() => profile({gender})}>{genderNames[gender]}</Chip>)}</View>
      {draft.profile.gender === 'self_described' && <Input label="Your gender description" value={draft.profile.gender_description} onChangeText={gender_description => profile({gender_description})} />}
      {draft.profile.prompts.map((p, index) => <Card key={index}><Text style={s.label}>Prompt {index + 1}</Text><View style={s.stack}>{demoPrompts.map(prompt => <Chip key={prompt.id} selected={p.id === prompt.id} onPress={() => profile({prompts: draft.profile.prompts.map((old, i) => i === index ? {...old, id: prompt.id, version: 1} : old)})}>{prompt.text}</Chip>)}</View><Input label={`Prompt ${index + 1} answer (20–200 characters)`} value={p.answer} multiline maxLength={200} onChangeText={answer => profile({prompts: draft.profile.prompts.map((old, i) => i === index ? {...old, answer} : old)})} /></Card>)}
      <Input label="Bio (optional)" value={draft.profile.bio} multiline maxLength={500} onChangeText={bio => profile({bio})} />
      <Note>Here for a serious relationship. Marriage intent is optional.</Note><View style={s.row}>{(['wants_marriage', 'open', 'not_seeking_marriage', 'prefer_not_to_say'] as const).map(intent => <Chip key={intent} selected={draft.profile.marriage_intent === intent} onPress={() => profile({marriage_intent: intent})}>{{wants_marriage: 'Wants marriage', open: 'Open to marriage', not_seeking_marriage: 'Not seeking marriage', prefer_not_to_say: 'Prefer not to say'}[intent]}</Chip>)}</View>
    </>}
    {step === 2 && <>
      <Note>Select 2–6 original demo illustrations. No image upload or live photo moderation occurs.</Note>
      <View style={s.row}>{portraits.map((source, i) => <View key={i} style={{width: '46%', gap: 8}}><Image source={source} style={{width: '100%', height: (Math.min(width, 620) - 44) * 0.46 / 0.8, borderRadius: 18}} /><Chip selected={draft.photos.includes(i)} onPress={() => setDraft({...draft, photos: draft.photos.includes(i) ? draft.photos.filter(p => p !== i) : [...draft.photos, i]})}>{`Illustration ${i + 1}`}</Chip></View>)}</View>
      {draft.photos.length > 0 && <Card><Text style={s.label}>Photo order · first is primary</Text>{draft.photos.map((p, i) => <View key={p} style={s.between}><Text style={s.body}>{i + 1}. Illustration {p + 1}{i === 0 ? ' · primary' : ''}</Text>{i > 0 && <Action secondary label={`Make illustration ${p + 1} primary`} onPress={() => setDraft({...draft, photos: [p, ...draft.photos.filter(x => x !== p)]})}>Make primary</Action>}</View>)}</Card>}
    </>}
    {step === 3 && <PreferencesFields value={draft.preferences} onChange={preferences => setDraft({...draft, preferences})} />}
    {step === 4 && <Card><Text style={s.subtitle}>Identity is a trust step.</Text><Text style={s.body}>The live app will use Persona for adult identity evidence. This demo does not collect an ID or selfie and does not contact Persona.</Text><Note>Status: {draft.identity === 'simulated_verified' ? 'Simulation complete · not a real verification' : draft.identity.replaceAll('_', ' ')}</Note><Action disabled={busy || pendingIdentity} onPress={() => {void verify();}}>{pendingIdentity ? 'Running simulation…' : 'Simulate adult identity check'}</Action></Card>}
    {step === 5 && <Card><Text style={s.subtitle}>{person.lifecycle === 'pending_review' ? 'Your demo profile is in review.' : person.lifecycle === 'active' ? 'Your demo profile was approved.' : 'Your story is ready to share.'}</Text><Text style={s.body}>{draft.profile.display_name} · {ageOn(draft.dob, today())} · {draft.preferences.city}</Text><Text style={s.body}>{draft.photos.length} illustrations · two prompts · identity simulation complete</Text>{!!person.feedback && <Note>{person.feedback}</Note>}<Action disabled={busy} onPress={() => {void act({type: 'submit'});}}>Submit for simulated review</Action><Action secondary onPress={() => navigate('/demo/review')}>Open simulated review console</Action>{person.lifecycle === 'active' && <Action onPress={() => navigate('/demo/discover')}>Start discovering</Action>}</Card>}
    {!!error && <Note error>{error}</Note>}
    {step < 5 && <Action disabled={busy} onPress={() => {void save(step + 1);}}>Save and continue</Action>}
    {step > 0 && <Action secondary disabled={busy} onPress={() => {void save(step - 1);}}>Save and go back</Action>}
    <Action secondary disabled={busy} onPress={() => {void save(step).then(result => {if (result) navigate('/demo/settings');});}}>Save for later</Action>
  </>;
}
export function PreferencesFields({value, onChange}: {value: Preferences; onChange: (value: Preferences) => void}) {
  return <><Text style={s.label}>Partner genders</Text><View style={s.row}>{genderSchema.options.map(g => <Chip key={g} selected={value.genders.includes(g)} onPress={() => onChange({...value, genders: value.genders.includes(g) ? value.genders.filter(x => x !== g) : [...value.genders, g]})}>{genderNames[g]}</Chip>)}</View>
    <Input label="Minimum age" keyboardType="number-pad" value={String(value.ageMin)} onChangeText={v => onChange({...value, ageMin: Number(v)})} />
    <Input label="Maximum age" keyboardType="number-pad" value={String(value.ageMax)} onChangeText={v => onChange({...value, ageMax: Number(v)})} />
    <Input label="Distance radius (miles)" keyboardType="number-pad" value={String(value.radius)} onChangeText={v => onChange({...value, radius: Number(v)})} />
    <Text style={s.label}>City · demo centroids</Text><View style={s.row}>{Object.keys(cities).map(city => <Chip key={city} selected={value.city === city} onPress={() => onChange({...value, city: city as Preferences['city']})}>{city}</Chip>)}</View>
    <Text style={s.small}>Approximate city-based distance. No GPS permission is requested in this demo. Both members’ preferences apply; filters never widen automatically.</Text>
  </>;
}
export function PreferencesScreen() {
  const {state, act, busy, loading} = useDemo(); const person = member(state);
  return <Screen back="/demo/discover">{!loading && <PreferencesForm key={person.id} person={person} act={act} busy={busy} />}</Screen>;
}
function PreferencesForm({person, act, busy}: {person: DemoMember; act: ReturnType<typeof useDemo>['act']; busy: boolean}) {
  const [value, setValue] = useState(person.preferences); const [error, setError] = useState('');
  async function save() {if (!preferencesSchema.safeParse(value).success) {setError('Choose at least one gender, ages 18–99 in order, and 1–500 miles.'); return;} if (await act({type: 'save', patch: {preferences: value}})) navigate('/demo/discover');}
  return <><Heading eyebrow="YOUR PREFERENCES" title="Make room for your kind of connection." /><PreferencesFields value={value} onChange={setValue} />{!!error && <Note error>{error}</Note>}<Action disabled={busy} onPress={() => {void save();}}>Save preferences</Action></>;
}
