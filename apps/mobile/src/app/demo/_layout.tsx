import { Redirect, Stack } from 'expo-router';
import { DemoProvider } from '../../demo/store';
export default function DemoLayout() {
  if (process.env.EXPO_PUBLIC_APP_ENV === 'production') return <Redirect href="/member" />;
  return <DemoProvider><Stack screenOptions={{headerShown: false, animation: 'none'}} /></DemoProvider>;
}
