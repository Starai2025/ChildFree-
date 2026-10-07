// The existing onboarding UI runner exports dist-qa before this runner executes.
// This test exercises local synthetic state, never real auth or provider services.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { launchBrowser } from './browser-runtime.mjs';

const root = path.resolve('apps/mobile/dist-qa');
const server = createServer(async (request, response) => {
  const target = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
  if (target !== root && !target.startsWith(root + path.sep)) {response.writeHead(403).end(); return;}
  for (const candidate of [target, target + '.html', path.join(target, 'index.html')]) {
    try {
      const contents = await readFile(candidate);
      const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf'};
      response.writeHead(200, {'Content-Type': types[path.extname(candidate)] ?? 'application/octet-stream'}).end(contents); return;
    } catch { /* Try the next static export layout. */ }
  }
  response.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let runtime, page;
try {
  runtime = await launchBrowser();
  const context = await runtime.browser.newContext({viewport: {width: 390, height: 844}});
  page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const external = []; page.on('request', request => {if (!request.url().startsWith('http://127.0.0.1') && !request.url().startsWith('data:')) external.push(request.url());});
  const address = server.address(); const url = `http://127.0.0.1:${address.port}`;
  const button = name => page.getByRole('button', {name, exact: true});
  const checkbox = name => page.getByRole('checkbox', {name, exact: true});
  const screenshot = async name => {await mkdir('docs/evidence/demo', {recursive: true}); await page.screenshot({path: `docs/evidence/demo/${name}.png`, fullPage: true});};
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('blackchildfree.synthetic-demo.v1')));
  await page.goto(url);
  await button('Explore the demo →').waitFor(); await screenshot('welcome');
  await button('Explore the demo →').click();
  await button('Pass on Imani').waitFor(); await screenshot('discover');
  await button('Pass on Imani').click(); await button('Like Malik').waitFor();
  await page.reload(); await button('Like Malik').waitFor();
  assert.equal((await state()).reactions.filter(r => r.actor === 'amara' && r.kind === 'pass').length, 1);
  await button('Like Malik').click(); await page.getByText('The feeling is mutual.', {exact: true}).filter({visible: true}).waitFor(); await screenshot('match');
  await button('Start a conversation').click();
  await button('Test next send failure').click();
  await page.getByRole('textbox', {name: 'Your message', exact: true}).fill('A thoughtful hello from this synthetic demo.');
  await button('Send message ↑').click(); await button('Retry failed message').waitFor();
  assert.equal((await state()).messages[0].status, 'failed');
  await button('Retry failed message').click(); await page.getByText(/Accepted in demo/).filter({visible: true}).waitFor();
  assert.equal((await state()).messages.length, 1);
  await button('Simulate a reply').click(); await page.getByText(/Simulated reply/).filter({visible: true}).waitFor(); await screenshot('conversation');
  await button('Go back').click(); await button('Conversation with Malik').waitFor(); await screenshot('connections');
  await page.reload(); await button('Conversation with Malik').waitFor();
  await button('Conversation with Malik').click(); await button('Conversation options').click(); await button('Report').click();
  await checkbox('Other').click(); await page.getByRole('textbox', {name: 'Report details (synthetic information only)', exact: true}).fill('An isolated synthetic report for the smoke test.');
  await button('Submit demo report').click(); await page.getByText('Your report has been received.', {exact: true}).filter({visible: true}).waitFor();
  assert.equal((await state()).blocks.length, 0);
  await button('Block this demo member too').click(); await button('Block this demo member').click(); await button('Confirm block').click();
  await page.getByText('Good things start with hello.', {exact: true}).filter({visible: true}).waitFor();
  await button('Settings').click(); await button('Blocked users').click(); await button('Unblock').click();
  await page.getByText('You haven’t blocked any demo members.', {exact: true}).filter({visible: true}).waitFor();
  assert.equal((await state()).matches[0].status, 'closed');
  await button('Go back').click(); await checkbox('Start a new demo profile').click(); await button('Continue onboarding').click();
  await button('Save and continue').click(); await page.getByRole('alert').filter({hasText: /Membership requires/}).waitFor();
  const yes = checkbox('Yes'); assert.equal(await yes.count(), 6);
  for (let i = 0; i < 6; i++) await yes.nth(i).click();
  await checkbox('I agree to the Community Pledge.').click(); await button('Save and continue').click();
  await page.getByRole('textbox', {name: 'Display name', exact: true}).fill('Zuri');
  // The header back action saves incomplete drafts before navigating.
  await button('Go back').click(); await page.reload(); await button('Continue onboarding or view review status').click();
  assert.equal(await page.getByRole('textbox', {name: 'Display name', exact: true}).inputValue(), 'Zuri');
  // Storage rejection must preserve the edited form and prevent navigation.
  await page.getByRole('textbox', {name: 'Display name', exact: true}).fill('Zuri unsaved');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.restoreDemoStorage = () => {Storage.prototype.setItem = original;};
    Storage.prototype.setItem = function(key, value) {
      if (key === 'blackchildfree.synthetic-demo.v1') throw new Error('Simulated storage rejection');
      return original.call(this, key, value);
    };
  });
  await button('Go back').click();
  await page.getByRole('alert').filter({hasText: 'Simulated storage rejection'}).waitFor();
  assert.equal(await page.getByRole('textbox', {name: 'Display name', exact: true}).inputValue(), 'Zuri unsaved');
  assert.equal((await state()).members.find(m => m.id === 'new').profile.display_name, 'Zuri');
  await page.evaluate(() => window.restoreDemoStorage());
  await page.getByRole('textbox', {name: 'Display name', exact: true}).fill('Zuri');
  await page.getByRole('textbox', {name: 'Prompt 1 answer (20–200 characters)', exact: true}).fill('A long walk, a good record, and cooking brunch together.');
  await page.getByRole('textbox', {name: 'Prompt 2 answer (20–200 characters)', exact: true}).fill('An intentional partnership with kindness and room for adventure.');
  await button('Save for later').click(); await page.reload(); await button('Continue onboarding or view review status').click();
  assert.equal(await page.getByRole('textbox', {name: 'Display name', exact: true}).inputValue(), 'Zuri');
  await button('Save and continue').click(); await checkbox('Illustration 1').click(); await checkbox('Illustration 2').click(); await screenshot('photos');
  await button('Save and continue').click(); await button('Save and continue').click();
  await button('Simulate adult identity check').click(); await page.getByText(/Simulation complete/).filter({visible: true}).waitFor();
  await button('Save and continue').click(); await button('Submit for simulated review').click();
  await page.getByText('Your demo profile is in review.', {exact: true}).filter({visible: true}).waitFor();
  await button('Open simulated review console').click(); await button('Simulate approval for Zuri').click();
  await button('Go back').click(); await button('Discover').click(); await button('Like Malik').waitFor();
  await button('Settings').click(); await button('Pause discovery').click(); await button('Resume discovery').waitFor();
  await button('Discover').click(); await page.getByText('A little space for you.', {exact: true}).filter({visible: true}).waitFor();
  await button('Open settings to resume').click(); await button('Resume discovery').click();
  await button('Export my synthetic data').click();
  const downloading = page.waitForEvent('download'); await button('Export synthetic JSON').click();
  const download = await downloading; const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(exported.member.id, 'new'); assert.ok(exported.messages.every(m => m.sender === 'new'));
  await button('Go back').click(); await button('Delete my demo account').click();
  await page.getByRole('textbox', {name: 'Type DELETE to confirm demo deletion', exact: true}).fill('DELETE');
  await button('Confirm demo account deletion').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('blackchildfree.synthetic-demo.v1')).members.find(m => m.id === 'new').lifecycle === 'deleted');
  await button('Discover').click(); await button('Account settings').waitFor();
  await button('Account settings').click(); await button('Reset demo').click(); await button('Confirm reset demo').click();
  await button('Pass on Imani').waitFor();
  await button('Preferences').click(); await page.getByRole('textbox', {name: 'Distance radius (miles)', exact: true}).fill('1');
  await button('Save preferences').click(); await button('Pass on Imani').click();
  await page.getByText('You’re all caught up.', {exact: true}).filter({visible: true}).waitFor(); await screenshot('empty');
  assert.equal(external.length, 0, `Demo made external requests: ${external.join(', ')}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: complete synthetic demo UI — discovery persistence, mutual match, failed-send retry, conversation grouping, report/block/unblock, onboarding header-back/resume and storage rejection, six-step review, pause, downloaded export, delete/reset and empty pool. No external requests.');
} catch (error) {
  if (page) {await mkdir('docs/evidence/demo', {recursive: true}); await page.screenshot({path: 'docs/evidence/demo/debug.png', fullPage: true});}
  throw error;
} finally {
  await runtime?.close(); await new Promise(resolve => server.close(resolve));
}
