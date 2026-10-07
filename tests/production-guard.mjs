// Compile and render the production-stage guard; this does not deploy a service.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { launchBrowser } from './browser-runtime.mjs';
import { staticServer } from './static-server.mjs';

await new Promise((resolve, reject) => {
  const child = spawn('npm', ['run', 'export:web', '--workspace', '@black-childfree/mobile', '--', '--output-dir', 'dist-production-guard', '--max-workers', '2', '--clear'], {
    env: {...process.env, CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_PUBLIC_APP_ENV: 'production',
      EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', EXPO_PUBLIC_TERMS_URL: '', EXPO_PUBLIC_PRIVACY_URL: '', EXPO_PUBLIC_SUPPORT_URL: ''}, stdio: 'inherit',
  });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Production guard export failed: ${code}`)));
});
const server = await staticServer('apps/mobile/dist-production-guard');
let runtime;
try {
  runtime = await launchBrowser();
  const page = await runtime.browser.newPage({viewport: {width: 390, height: 844}});
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url);
  await page.getByText('The next chapter is taking shape.', {exact: true}).waitFor();
  assert.equal(await page.getByRole('button', {name: 'Explore the demo →', exact: true}).count(), 0);
  await page.goto(server.url + '/demo/review');
  await page.waitForURL('**/member');
  await page.getByText('The next chapter is taking shape.', {exact: true}).waitFor();
  assert.equal(await page.getByRole('heading', {name: 'Simulated review console.', exact: true}).count(), 0);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: production-stage root has no demo entry and direct demo review routes redirect to real onboarding. No deployment performed.');
} finally {await runtime?.close(); await server.close();}
