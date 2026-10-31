// Bagimliliksiz yerel gelistirme sunucusu: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)), process.env.SERVE_DIR || '.');
const PORT = Number(process.argv[2] || process.env.PORT || 5173);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.ico': 'image/x-icon'
};

// voiceMp3: false (varsayilan) = /assets/manifest.json icindeki `voice` kayitlari bosaltilir (dosya yok gibi; 404/konsol hatasi OLUSMAZ). Eski UI testleri (V7.x-V8.2) kayitli ses dosyasi OLMAYAN
// durumda Turkce TTS YEDEGI yolunu sinamak icin yazilmistir; V8.5'te 106 gercek MP3 eklendigi icin o yol bu bayrakla acikca korunur.
// Gercek dosya yolunu sinayan testler startServer(0, { voiceMp3: true }) ile acar (ui-v85-audio).
export function startServer(port = PORT, { voiceMp3 = false } = {}) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = normalize(join(ROOT, p));
      if (!file.startsWith(ROOT)) throw Object.assign(new Error('forbidden'), { code: 403 });
      if (!(await stat(file)).isFile()) throw Object.assign(new Error('nf'), { code: 404 });
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      let body = await readFile(file);
      if (!voiceMp3 && /^\/(?:www\/)?assets\/manifest\.json$/.test(p)) { const m = JSON.parse(body.toString('utf8')); m.voice = {}; body = Buffer.from(JSON.stringify(m)); }
      res.end(body);
    } catch (e) {
      res.writeHead(e.code === 403 ? 403 : 404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startServer();
  console.log(`ALTEZ MiniLab: http://127.0.0.1:${s.address().port}/`);
}
