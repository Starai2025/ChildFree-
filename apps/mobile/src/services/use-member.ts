import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { ApiRequest, Snapshot } from '@black-childfree/domain';
import { configuration, getClient } from './client';
import { memberApi, explainError } from './api';

export function useMember() {
  const [session, setSession] = useState<Session | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(configuration.ok);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const userId = useRef<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    if (!configuration.ok) return () => { mounted.current = false; };
    const client = getClient();
    let receivedEvent = false;
    const update = (value: Session | null) => {
      if (!mounted.current) return;
      if (userId.current !== (value?.user.id ?? null)) {
        generation.current++;
        userId.current = value?.user.id ?? null;
        setSnapshot(null); setError(''); setBusy(false);
      }
      setSession(value); setLoading(false);
    };
    const {data} = client.auth.onAuthStateChange((_event, value) => { receivedEvent = true; update(value); });
    void client.auth.getSession().then(result => { if (!receivedEvent) update(result.data.session); }).catch(() => {
      if (mounted.current) { setError('We could not restore your session. Try signing in again.'); setLoading(false); }
    });
    const refresh = () => { if (Platform.OS !== 'web') { if (AppState.currentState === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh(); } };
    refresh();
    const subscription = AppState.addEventListener('change', refresh);
    const invalidate = () => { generation.current++; };
    return () => { mounted.current = false; invalidate(); data.subscription.unsubscribe(); subscription.remove(); if (Platform.OS !== 'web') client.auth.stopAutoRefresh(); };
  }, []);
  const execute = useCallback(async (input: ApiRequest): Promise<Snapshot | null> => {
    const actor = userId.current;
    const version = generation.current;
    setBusy(true); setError('');
    try {
      const result = await memberApi(input);
      if (mounted.current && generation.current === version && userId.current === actor) { setSnapshot(result); return result; }
    } catch (error) {
      if (mounted.current && generation.current === version) setError(explainError(error));
    } finally {
      if (mounted.current && generation.current === version) setBusy(false);
    }
    return null;
  }, []);
  // Auth events only update the session; database calls happen outside the auth SDK's callback lock.
  const currentUser = session?.user.id;
  useEffect(() => {
    if (!currentUser) return;
    const task = setTimeout(() => {void execute({action: 'bootstrap'});}, 0);
    return () => clearTimeout(task);
  }, [currentUser, execute]);
  const signOut = async () => {
    setBusy(true); setError('');
    try {
      const {error} = await getClient().auth.signOut({scope: 'local'});
      if (error) throw error;
    } catch { setError('We could not sign you out. Check your connection and retry.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return {session, snapshot, loading, busy, error, execute, signOut};
}
