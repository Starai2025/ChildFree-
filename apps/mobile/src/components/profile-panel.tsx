import { useState } from 'react';
import { Text, View } from 'react-native';
import { profileSchema, type Profile, type Snapshot, type ApiRequest } from '@black-childfree/domain';
import { Button, Choice, Field, Notice, styles } from './forms';

export function ProfilePanel({snapshot, execute, busy, back}: {snapshot: Snapshot; busy: boolean; execute: (request: ApiRequest) => Promise<Snapshot | null>; back: () => void}) {
  const saved = snapshot.draft.fields;
  const [profile, setProfile] = useState<Omit<Profile, 'gender'> & {gender?: Profile['gender']}>({
    display_name: saved.display_name ?? '', gender: saved.gender, gender_description: saved.gender_description ?? '', bio: saved.bio ?? '',
    prompts: saved.prompts?.length === 2 ? saved.prompts : snapshot.prompts.slice(0, 2).map(prompt => ({id: prompt.id, version: prompt.version, answer: ''})),
    relationship_goal: 'serious_relationship', marriage_intent: saved.marriage_intent ?? 'prefer_not_to_say',
  });
  const [error, setError] = useState(''); const [savedNotice, setSavedNotice] = useState('');
  async function save(complete: boolean) {
    setError(''); setSavedNotice('');
    if (complete) {
      const parsed = profileSchema.safeParse(profile);
      if (!parsed.success) {setError('Use a name of 2–60 characters, two different prompts with answers of 20–200 characters, and describe your gender if self-described. Bio is optional (up to 500 characters).'); return;}
      await execute({action: 'profile_save', expected_revision: snapshot.draft.revision, fields: parsed.data});
    } else {
      const result = await execute({action: 'draft_save', expected_revision: snapshot.draft.revision, fields: profile});
      if (result) setSavedNotice('Your draft is saved. You can return to it later.');
    }
  }
  return <View style={styles.stack}>
    <Text style={styles.eyebrow}>PROFILE · STEP 2 OF 6</Text><Text accessibilityRole="header" style={styles.subtitle}>Make room for your story.</Text>
    <Text style={styles.body}>Your draft stays private. Choose the prompts that feel like you. Saved draft revision: {snapshot.draft.revision}.</Text>
    <Field label="Display name" value={profile.display_name} onChangeText={display_name => setProfile({...profile, display_name})} maxLength={60} editable={!busy} />
    <Text style={styles.label}>Gender</Text><View accessibilityRole="radiogroup" accessibilityLabel="Gender" style={styles.row}>
      {(['woman', 'man', 'nonbinary', 'self_described'] as const).map(gender => <Choice key={gender} label={{woman: 'Woman', man: 'Man', nonbinary: 'Nonbinary', self_described: 'Self-described'}[gender]} selected={profile.gender === gender} onPress={() => setProfile({...profile, gender})} disabled={busy} />)}
    </View>
    {profile.gender === 'self_described' && <Field label="How you describe your gender" value={profile.gender_description} onChangeText={gender_description => setProfile({...profile, gender_description})} maxLength={60} editable={!busy} />}
    {profile.prompts.map((answer, index) => <View key={index} style={styles.card}>
      <Text style={styles.label}>Prompt {index + 1} · choose one</Text><View accessibilityRole="radiogroup" style={styles.stack}>
        {snapshot.prompts.map(prompt => <Choice key={`${prompt.id}/${prompt.version}`} label={prompt.text} selected={answer.id === prompt.id} disabled={busy} onPress={() => setProfile({...profile, prompts: profile.prompts.map((old, i) => i === index ? {...old, id: prompt.id, version: prompt.version} : old)})} />)}
      </View>
      <Field label={`Your answer to prompt ${index + 1} (20–200 characters)`} value={answer.answer} onChangeText={text => setProfile({...profile, prompts: profile.prompts.map((old, i) => i === index ? {...old, answer: text} : old)})} multiline maxLength={200} editable={!busy} />
    </View>)}
    <Field label="Bio (optional, up to 500 characters)" value={profile.bio} onChangeText={bio => setProfile({...profile, bio})} multiline maxLength={500} editable={!busy} />
    <Text style={styles.body}>Relationship goal: a serious relationship.</Text><Text style={styles.label}>Marriage intent (optional)</Text>
    <View accessibilityRole="radiogroup" style={styles.stack}>
      {(['wants_marriage', 'open', 'not_seeking_marriage', 'prefer_not_to_say'] as const).map(marriage_intent => <Choice key={marriage_intent} label={{wants_marriage: 'I want marriage', open: 'I am open to marriage', not_seeking_marriage: 'I am not seeking marriage', prefer_not_to_say: 'Prefer not to say'}[marriage_intent]} selected={profile.marriage_intent === marriage_intent} onPress={() => setProfile({...profile, marriage_intent})} disabled={busy} />)}
    </View>
    {!!error && <Notice>{error}</Notice>}{!!savedNotice && <Text accessibilityLiveRegion="polite" style={styles.body}>{savedNotice}</Text>}
    <Button label={busy ? 'Saving…' : 'Save and continue'} onPress={() => { void save(true); }} disabled={busy} />
    <Button label="Save draft for later" secondary onPress={() => { void save(false); }} disabled={busy} />
    <Button label="Save draft and go back to eligibility" secondary onPress={() => {void execute({action: 'draft_save', expected_revision: snapshot.draft.revision, fields: profile}).then(result => {if (result) back();});}} disabled={busy} />
  </View>;
}
