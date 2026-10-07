import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createDemo, demoStateSchema, member, transition, type DemoAction, type DemoState } from '@black-childfree/domain/demo';

const STORAGE_KEY = 'blackchildfree.synthetic-demo.v1';
type Store = {state: DemoState; loading: boolean; busy: boolean; error: string; clearError: () => void; act: (action: DemoAction) => Promise<DemoState | null>};
const Context = createContext<Store | null>(null);
export function DemoProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState(createDemo);
  const stateRef = useRef(state);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted || !raw) return;
      const parsed = demoStateSchema.parse(JSON.parse(raw));
      member(parsed); // Also reject a missing selected fixture.
      stateRef.current = parsed; setState(parsed);
    }).catch(() => {if (mounted) setError('Saved demo data could not be restored. A fresh demo is loaded; use Reset demo if needed.');})
      .finally(() => {if (mounted) setLoading(false);});
    return () => {mounted = false;};
  }, []);
  const act = useCallback(async (action: DemoAction): Promise<DemoState | null> => {
    setBusy(true); setError('');
    const task = queue.current.then(async () => {
      try {
        const next = transition(stateRef.current, action);
        if (next !== stateRef.current) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          stateRef.current = next; setState(next);
        }
        return next;
      } catch (error) {
        setError(error instanceof Error ? error.message : 'The demo could not be saved. Try again.');
        return null;
      }
    });
    queue.current = task;
    const result = await task;
    if (queue.current === task) setBusy(false);
    return result;
  }, []);
  return <Context.Provider value={{state, loading, busy, error, clearError: () => setError(''), act}}>{children}</Context.Provider>;
}
export function useDemo(): Store {
  const value = useContext(Context);
  if (!value) throw new Error('DemoProvider is required.');
  return value;
}
