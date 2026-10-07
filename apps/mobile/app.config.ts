import type { ExpoConfig } from 'expo/config';

const stage = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
if (!['development', 'staging', 'production'].includes(stage)) throw new Error('Invalid EXPO_PUBLIC_APP_ENV');
const suffix = stage === 'production' ? '' : stage === 'staging' ? '.staging' : '.dev';
const config: ExpoConfig = {
  name: stage === 'production' ? 'Black Childfree' : `Black Childfree · ${stage}`,
  slug: 'black-childfree', version: '0.1.0',
  scheme: `blackchildfree${stage === 'production' ? '' : stage === 'staging' ? '-staging' : '-dev'}`,
  orientation: 'portrait', userInterfaceStyle: 'light',
  // Working identifiers; confirm ownership before store registration.
  ios: {bundleIdentifier: `com.blackchildfree.app${suffix}`},
  android: {package: `com.blackchildfree.app${suffix}`},
  web: {output: 'static'},
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {typedRoutes: true},
};
export default config;
