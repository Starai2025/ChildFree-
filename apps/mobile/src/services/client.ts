import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPublicConfig } from '@black-childfree/domain/config';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Expo requires literal env accesses so these public values are inlined by Metro.
export const configuration = readPublicConfig({
  stage: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  termsUrl: process.env.EXPO_PUBLIC_TERMS_URL,
  privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL,
  supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL,
});
let instance: SupabaseClient | null = null;
export function getClient(): SupabaseClient {
  if (!configuration.ok) throw new Error('CONFIGURATION_REQUIRED');
  if (!instance) {
    instance = createClient(configuration.config.supabaseUrl, configuration.config.publishableKey, {
      auth: {
        autoRefreshToken: true, persistSession: true, detectSessionInUrl: false,
        storage: {
          async getItem(key: string) {
            if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
            return SecureStore.getItemAsync(key);
          },
          async setItem(key: string, value: string) {
            if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); return; }
            // Native storage errors propagate: never fall back to plaintext session persistence.
            await SecureStore.setItemAsync(key, value, {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
          },
          async removeItem(key: string) {
            if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); return; }
            await SecureStore.deleteItemAsync(key);
          },
        },
      },
    });
  }
  return instance;
}
