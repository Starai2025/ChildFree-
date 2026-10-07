import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createBrotliDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { extract } from 'tar-fs';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

export async function launchBrowser() {
  const directory = await mkdtemp(path.join(tmpdir(), 'childfree-demo-browser-'));
  let browser;
  try {
    const require = createRequire(import.meta.url);
    const bin = path.resolve(path.dirname(require.resolve('@sparticuz/chromium')), '../bin');
    await pipeline(createReadStream(path.join(bin, 'chromium.br')), createBrotliDecompress(), createWriteStream(path.join(directory, 'chromium'), {mode: 0o700}));
    await pipeline(createReadStream(path.join(bin, 'fonts.tar.br')), createBrotliDecompress(), extract(path.join(directory, 'fonts'), {chown: false}));
    await pipeline(createReadStream(path.join(bin, 'swiftshader.tar.br')), createBrotliDecompress(), extract(directory, {chown: false}));
    const config = path.join(directory, 'fonts', 'fonts.conf');
    await writeFile(config, (await readFile(config, 'utf8')).replaceAll('/tmp/fonts', path.join(directory, 'fonts')));
    browser = await playwright.launch({executablePath: path.join(directory, 'chromium'), args: chromium.args.filter(arg => arg !== '--disable-web-security'), env: {...process.env, FONTCONFIG_PATH: path.join(directory, 'fonts'), FONTCONFIG_FILE: config}, headless: true});
    return {browser, close: async () => {await browser.close(); await rm(directory, {recursive: true, force: true});}};
  } catch (error) {await browser?.close(); await rm(directory, {recursive: true, force: true}); throw error;}
}
