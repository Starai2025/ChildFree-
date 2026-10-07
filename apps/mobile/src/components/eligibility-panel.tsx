import { useState } from 'react';
import { Text, View } from 'react-native';
import { dobSchema, eligibilityLabels, type ApiRequest, type EligibilityAnswers, type Snapshot } from '@black-childfree/domain';
import { Button, Check, Choice, Field, Notice, styles } from './forms';

export function EligibilityPanel({snapshot, execute, busy}: {snapshot: Snapshot; busy: boolean; execute: (request: ApiRequest) => Promise<Snapshot | null>}) {
  const [dob, setDob] = useState(snapshot.dob ?? '');
  const [answers, setAnswers] = useState<Record<keyof EligibilityAnswers, boolean | null>>(() => snapshot.answers ?? {
    identifies_black: null, never_married: null, no_children: null, no_parental_role: null, never_parent: null, seeks_black: null,
  });
  const [pledged, setPledged] = useState(snapshot.pledge.accepted);
  const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const disabled = busy || working;
  async function save() {
    if (!dobSchema.safeParse(dob).success || Object.values(answers).some(value => value === null)) {
      setError('Enter your birth date as YYYY-MM-DD and answer every requirement.'); return;
    }
    if (!pledged) {setError('Read and acknowledge the separate Community Pledge before continuing.'); return;}
    setError(''); setWorking(true);
    try {
      const result = await execute({action: 'eligibility', dob, answers: answers as EligibilityAnswers, policy_version: 1});
      if (result?.eligible && !result.pledge.accepted) await execute({action: 'pledge_accept', version: snapshot.pledge.version});
    } finally {setWorking(false);}
  }
  return <View style={styles.stack}>
    <Text style={styles.eyebrow}>ELIGIBILITY · STEP 1 OF 6</Text>
    <Text accessibilityRole="header" style={styles.subtitle}>A shared choice for the life ahead.</Text>
    <Text style={styles.body}>These are your own statements. Identity checks will not verify race, relationship history or parenthood choices.</Text>
    {snapshot.lifecycle === 'ineligible' && <Notice>Your current answers do not meet our membership requirements. You can correct your answers or contact support. Your profile is not visible.</Notice>}
    <Field label="Birth date (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1994-06-15" autoCapitalize="none" editable={!disabled && !snapshot.dob} />
    {snapshot.dob && <Text style={styles.body}>Birth date corrections need support and identity reconciliation.</Text>}
    {(Object.entries(eligibilityLabels) as [keyof EligibilityAnswers, string][]).map(([key, label]) => <View key={key} style={styles.card}>
      <Text style={styles.body}>{label}</Text><View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        <Choice label="Yes" selected={answers[key] === true} onPress={() => setAnswers({...answers, [key]: true})} disabled={disabled} />
        <Choice label="No" selected={answers[key] === false} onPress={() => setAnswers({...answers, [key]: false})} disabled={disabled} />
      </View>
    </View>)}
    <View style={styles.card}><Text accessibilityRole="header" style={styles.subtitle}>Our community, our commitment.</Text><Text style={styles.body}>{snapshot.pledge.text}</Text>
      <Check label="I agree to the Community Pledge." checked={pledged} onPress={() => setPledged(!pledged)} disabled={disabled || snapshot.pledge.accepted} />
    </View>
    {!!error && <Notice>{error}</Notice>}<Button label={disabled ? 'Saving…' : 'Save and continue'} onPress={() => { void save(); }} disabled={disabled} />
  </View>;
}
