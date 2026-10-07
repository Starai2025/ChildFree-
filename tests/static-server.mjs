import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function staticServer(directory) {
  const root = path.resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const target = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      if (target !== root && !target.startsWith(root + path.sep)) {response.writeHead(403).end(); return;}
      for (const file of [target, target + '.html', path.join(target, 'index.html')]) {
        try {
          const contents = await readFile(file);
          const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf'};
          response.writeHead(200, {'Content-Type': types[path.extname(file)] ?? 'application/octet-stream'}).end(contents); return;
        } catch { /* Try the next static export layout. */ }
      }
      response.writeHead(404).end();
    } catch {response.writeHead(400).end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {url: `http://127.0.0.1:${address.port}`, close: () => new Promise(resolve => server.close(resolve))};
}
