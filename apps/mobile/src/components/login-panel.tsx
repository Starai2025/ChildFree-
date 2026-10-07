import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { z } from 'zod';
import { configuration, getClient } from '../services/client';
import { Button, Check, ExternalLink, Field, Notice, styles } from './forms';

export function LoginPanel() {
  const [email, setEmail] = useState(''); const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState(''); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const id = setTimeout(() => setCooldown(n => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  if (!configuration.ok) return null;
  const config = configuration.config;
  async function requestCode() {
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success || !consent) { setError('Enter a valid email and read and accept the Terms and Privacy Notice.'); return; }
    setBusy(true); setError('');
    try {
      const {error} = await getClient().auth.signInWithOtp({email: parsed.data, options: {shouldCreateUser: true}});
      if (error) throw error;
      setSentTo(parsed.data); setCode(''); setCooldown(60);
    } catch { setError('We could not send a code. Check your connection and wait before trying again.'); }
    finally { setBusy(false); }
  }
  async function verify() {
    if (!/^\d{6}$/.test(code)) { setError('Enter the six-digit code from your email.'); return; }
    setBusy(true); setError('');
    try {
      const {error} = await getClient().auth.verifyOtp({email: sentTo, token: code, type: 'email'});
      if (error) throw error;
      setCode('');
    } catch { setError('The code could not be verified or your session could not be saved. Request a new code if expired and retry.'); }
    finally { setBusy(false); }
  }
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.subtitle}>A thoughtful beginning.</Text>
    <Text style={styles.body}>For Black adults 18+ who have never legally married, have no children or current parental role, never want parenthood and seek Black partners.</Text>
    {!sentTo ? <>
      <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
      <ExternalLink label="Read the Terms" url={config.termsUrl} /><ExternalLink label="Read the Privacy Notice" url={config.privacyUrl} />
      <Check label="I have read and accept the Terms and Privacy Notice." checked={consent} onPress={() => setConsent(!consent)} disabled={busy} />
      <Button label={busy ? 'Sending…' : 'Email me a sign-in code'} onPress={() => { void requestCode(); }} disabled={busy || !consent} />
    </> : <>
      <Text style={styles.body}>Check {sentTo} for your sign-in code.</Text>
      <Field label="Six-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" editable={!busy} />
      <Button label={busy ? 'Checking…' : 'Sign in'} onPress={() => { void verify(); }} disabled={busy} />
      <Button label={cooldown ? `Resend in ${cooldown}s` : 'Send a new code'} secondary onPress={() => { void requestCode(); }} disabled={busy || cooldown > 0} />
      <Button label="Use a different email" secondary onPress={() => {setSentTo(''); setCode(''); setError('');}} disabled={busy || cooldown > 0} />
    </>}
    {!!error && <Notice>{error}</Notice>}<ExternalLink label="Help and support" url={config.supportUrl} />
  </View>;
}
