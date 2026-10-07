import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingRoute, type ApiRequest } from '@black-childfree/domain';
import { configuration } from '../services/client';
import { useMember } from '../services/use-member';
import { Button, ExternalLink, Notice, styles } from '../components/forms';
import { LoginPanel } from '../components/login-panel';
import { EligibilityPanel } from '../components/eligibility-panel';
import { ProfilePanel } from '../components/profile-panel';

export default function MemberScreen() {
  const member = useMember();
  return <MemberFlow key={member.session?.user.id ?? 'signed-out'} member={member} />;
}

function MemberFlow({member}: {member: ReturnType<typeof useMember>}) {
  const [override, setOverride] = useState<'eligibility' | 'profile' | null>(null);
  const [formReset, setFormReset] = useState(0);
  const snapshot = member.snapshot;
  const route = snapshot ? onboardingRoute(snapshot) : null;
  const screen = route === 'restricted' || route === 'status' ? route : override ?? route;
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {scroll.current?.scrollTo({y: 0, animated: false});}, [screen]);
  async function execute(request: ApiRequest) {
    const result = await member.execute(request);
    if (result && (request.action === 'profile_save' || ((request.action === 'eligibility' || request.action === 'pledge_accept') && result.eligible && result.pledge.accepted))) setOverride(null);
    return result;
  }
  return <SafeAreaView style={{flex: 1, backgroundColor: '#F7F4EE'}}>
    <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <Text style={styles.eyebrow}>BLACK CHILDFREE{configuration.ok && configuration.config.stage === 'production' ? '' : ' · DEVELOPMENT BUILD'}</Text>
        <Text accessibilityRole="header" style={styles.title}>Black love.{ '\n' }Your own blueprint.</Text>
        {!configuration.ok ? <View style={styles.card}>
          <Text style={styles.subtitle}>The next chapter is taking shape.</Text>
          <Text style={styles.body}>A community for Black adults who have chosen life without parenthood. This development build needs setup before accounts can be created.</Text>
          <Text selectable style={styles.body}>Missing or invalid settings: {configuration.fields.join(', ')}.</Text>
          <Text style={styles.body}>Developer setup: see docs/LOCAL_SETUP.md in the project. No member information is stored on this screen.</Text>
        </View> : member.loading ? <ActivityIndicator accessibilityLabel="Restoring session" /> : !member.session ? <LoginPanel /> : !snapshot ? <View style={styles.card}>
          <Text style={styles.body}>{member.busy ? 'Loading your saved progress…' : 'Your saved progress could not be loaded.'}</Text>
          <Button label="Retry loading" disabled={member.busy} onPress={() => {void execute({action: 'bootstrap'});}} />
        </View> : screen === 'eligibility' ? <EligibilityPanel key={`${member.session.user.id}/${snapshot.pledge.version}/${formReset}`} snapshot={snapshot} busy={member.busy} execute={execute} /> : screen === 'profile' ? <ProfilePanel key={`${member.session.user.id}/${snapshot.draft.revision}/${formReset}`} snapshot={snapshot} busy={member.busy} execute={execute} back={() => setOverride('eligibility')} /> : screen === 'photos' ? <View style={styles.card}>
          <Text style={styles.eyebrow}>PHOTOS · STEP 3 OF 6</Text><Text accessibilityRole="header" style={styles.subtitle}>Your profile draft is saved.</Text>
          <Text style={styles.body}>Photo uploads, preferences and identity checks are the next build steps. Your profile cannot enter review or discovery yet.</Text>
          <Button label="Edit saved profile" onPress={() => setOverride('profile')} disabled={member.busy} />
          <Button label="Check review requirements" secondary onPress={() => {void execute({action: 'profile_submit', revision: snapshot.profile_revision});}} disabled={member.busy} />
        </View> : <View style={styles.card}>
          <Text accessibilityRole="header" style={styles.subtitle}>{screen === 'restricted' ? 'Your account needs attention.' : 'Your account status'}</Text>
          <Text style={styles.body}>Status: {snapshot.lifecycle.replaceAll('_', ' ')}. Contact support for account, appeal, export or deletion help. Discovery and conversations are not implemented in this build.</Text>
        </View>}
        {!!member.error && <Notice>{member.error}</Notice>}
        {configuration.ok && member.session && <View style={styles.stack}>
          <Button label="Reload saved information (discard unsaved edits)" secondary onPress={() => {void execute({action: 'bootstrap'}).then(result => {if (result) {setOverride(null); setFormReset(n => n + 1);}});}} disabled={member.busy} />
          <ExternalLink label="Support, appeals and account requests" url={configuration.config.supportUrl} />
          <ExternalLink label="Privacy Notice" url={configuration.config.privacyUrl} />
          <Button label="Sign out" secondary onPress={() => {void member.signOut();}} disabled={member.busy} />
        </View>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
