// Internal cloud readiness check of the actual Metro development server.
import assert from 'node:assert/strict';
import { launchBrowser } from '../tests/browser-runtime.mjs';

const runtime = await launchBrowser();
try {
  const page = await runtime.browser.newPage({viewport: {width: 390, height: 844}});
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8081', {timeout: 60000});
  await page.getByRole('button', {name: 'Explore the demo →', exact: true}).click();
  await page.getByRole('button', {name: 'Pass on Imani', exact: true}).waitFor({timeout: 60000});
  await page.getByRole('button', {name: 'Pass on Imani', exact: true}).click();
  await page.getByRole('button', {name: 'Like Malik', exact: true}).waitFor();
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: actual Metro development server renders the demo and accepts a persisted discovery decision.');
} finally {await runtime.close();}
