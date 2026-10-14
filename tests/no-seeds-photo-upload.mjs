// Isolated regression checks: no real accounts, uploads, or network requests.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../prototype/no-seeds-public-beta/dist/app.js', import.meta.url), 'utf8');
const handlers = app.slice(app.indexOf('async function uploadPhoto('), app.indexOf('async function loadDiscover('));
const file = {type: 'image/png'};
const photo = position => ({id: `photo-${position}`, position, storage_path: `test-member/${position}.jpg`});

function harness(photos = [], failures = {}) {
  const state = {user: {id: 'test-member'}, photos: [...photos], saving: false, error: '', message: ''};
  const calls = [];
  const objects = new Set(photos.map(p => p.storage_path));
  const storage = {
    async upload(path, prepared, options) {
      calls.push(['upload', path, options]);
      if (failures.uploadThrow) throw new Error('Network unavailable');
      if (failures.upload) return {error: {message: 'Storage refused upload'}};
      objects.add(path);
      return {error: null};
    },
    async remove(paths) {
      calls.push(['remove-object', ...paths]);
      if (failures.removeObjectThrow) throw new Error('Network unavailable');
      if (failures.removeObject) return {error: {message: 'Storage refused deletion'}};
      paths.forEach(path => objects.delete(path));
      return {error: null};
    },
  };
  const context = vm.createContext({state,
    supabase: {storage: {from: () => storage}, from: () => ({
      async insert(row) {
        calls.push(['insert', row]);
        if (failures.insert) return {error: {message: 'Photo row refused'}};
        if (state.photos.some(p => p.position === row.position)) return {error: {message: 'Duplicate photo slot'}};
        state.photos.push({...row, id: `photo-${row.position}`});
        return {error: null};
      },
      delete: () => ({eq: async (column, id) => {
        calls.push(['delete-row', column, id]);
        if (failures.deleteRow) return {error: {message: 'Photo deletion refused'}};
        state.photos = state.photos.filter(p => p.id !== id);
        return {error: null};
      }}),
    })},
    reencodeImage: async () => {
      calls.push(['reencode']);
      if (failures.decode) throw new Error('Invalid image');
      return {size: failures.oversize ? 6 * 1024 * 1024 : 1024};
    },
    loadProfile: async () => {calls.push(['reload']); state.photos.sort((a,b) => a.position - b.position);},
    renderAuth: () => calls.push(['render-auth']), renderApp: () => calls.push(['render-app']),
  });
  vm.runInContext(handlers, context);
  return {state, calls, objects, upload: (...args) => context.uploadPhoto(...args), remove: (...args) => context.removePhoto(...args)};
}

let passed = 0;
async function check(name, fn) {await fn(); passed++; console.log(`PASS  ${name}`);}

await check('a signed-in onboarding upload uses private owner storage and JPEG output', async () => {
  const h = harness(); await h.upload(file, {publicFlow: true});
  const [, path, options] = h.calls.find(c => c[0] === 'upload');
  assert.match(path, /^test-member\/.+\.jpg$/);
  assert.deepEqual({...options}, {upsert: false, contentType: 'image/jpeg'});
  assert.equal(h.state.photos[0].position, 0);
  assert.equal(h.state.message, 'Photo added.');
  assert.ok(h.calls.some(c => c[0] === 'render-auth'));
  assert.ok(!h.calls.some(c => c[0] === 'render-app'));
});
await check('deleting a middle photo then uploading fills its free slot', async () => {
  const h = harness(Array.from({length: 6}, (_, i) => photo(i)));
  await h.remove(photo(2), {publicFlow: true}); await h.upload(file, {publicFlow: true});
  assert.equal(h.calls.find(c => c[0] === 'insert')[1].position, 2);
  assert.equal(h.state.photos.length, 6);
  assert.equal(h.state.error, '');
  assert.equal(h.state.photos[0].id, 'photo-0', 'existing cover stays first');
});
await check('a seventh photo is refused before uploading', async () => {
  const h = harness(Array.from({length: 6}, (_, i) => photo(i))); await h.upload(file);
  assert.match(h.state.error, /up to 6/); assert.equal(h.calls.filter(c => c[0] === 'upload').length, 0);
});
await check('signed-out users cannot upload or delete', async () => {
  const h = harness([photo(0)]); h.state.user = null;
  await h.upload(file); await h.remove(photo(0)); assert.equal(h.calls.length, 0);
});
await check('overlapping uploads and removals do not issue duplicate writes', async () => {
  const h = harness([photo(0)]); h.state.saving = true;
  await h.upload(file); await h.remove(photo(0)); assert.equal(h.calls.length, 0);
});
await check('unsupported files and oversized processed files never reach storage', async () => {
  for (const [fileToUpload, failure] of [[{type: 'application/pdf'}, {}], [file, {oversize: true}]]) {
    const h = harness([], failure); await h.upload(fileToUpload);
    assert.ok(h.state.error); assert.equal(h.state.saving, false);
    assert.ok(!h.calls.some(c => c[0] === 'upload'));
  }
});
await check('decode, storage and thrown network errors unlock the form for retry', async () => {
  for (const failure of [{decode: true}, {upload: true}, {uploadThrow: true}]) {
    const h = harness([], failure); await h.upload(file);
    assert.ok(h.state.error); assert.equal(h.state.saving, false); assert.equal(h.state.message, '');
  }
});
await check('a rejected photo row cleans up the newly uploaded object', async () => {
  const h = harness([], {insert: true}); await h.upload(file);
  assert.equal(h.objects.size, 0); assert.match(h.state.error, /row refused/);
  assert.equal(h.state.message, ''); assert.equal(h.state.saving, false);
});
await check('failed cleanup after a rejected photo row reports that the stored file remains', async () => {
  for (const failure of [{insert: true, removeObject: true}, {insert: true, removeObjectThrow: true}]) {
    const h = harness([], failure); await h.upload(file);
    assert.equal(h.objects.size, 1); assert.match(h.state.error, /could not be added.*stored file could not be deleted/);
    assert.equal(h.state.message, ''); assert.equal(h.state.saving, false);
  }
});
await check('failed row deletion preserves the file and shows an error', async () => {
  const h = harness([photo(0)], {deleteRow: true}); await h.remove(photo(0));
  assert.equal(h.objects.size, 1); assert.equal(h.state.photos.length, 1);
  assert.equal(h.state.message, ''); assert.match(h.state.error, /deletion refused/);
  assert.ok(!h.calls.some(c => c[0] === 'remove-object')); assert.equal(h.state.saving, false);
});
await check('failed storage cleanup is reported after removing a photo from the profile', async () => {
  for (const failure of [{removeObject: true}, {removeObjectThrow: true}]) {
    const h = harness([photo(0)], failure); await h.remove(photo(0));
    assert.equal(h.state.photos.length, 0); assert.equal(h.objects.size, 1);
    assert.match(h.state.error, /stored file could not be deleted/); assert.equal(h.state.message, '');
    assert.equal(h.state.saving, false); assert.ok(h.calls.some(c => c[0] === 'reload'));
  }
});
console.log(`\nALL ${passed} PHOTO CHECKS PASSED`);
