#!/usr/bin/env node
/* Reel'i kare kare render edip MP4 yapar (1080x1920, 30fps, H.264).
   Kullanım:
     node render.cjs 01-yuzde-bir.html                  -> out/01-yuzde-bir.mp4
     node render.cjs 01-yuzde-bir.html --handle @ad     -> sayfa adını değiştir
     node render.cjs 01-yuzde-bir.html --snap 1,5,10    -> sadece o saniyelerin PNG'leri (önizleme)
   Gerekenler: Node, Playwright (chromium), ffmpeg */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => a.endsWith('.html'));
  if (!file) { console.error('Kullanım: node render.cjs <reel.html> [--snap 1,2] [--handle @ad] [--out dir]'); process.exit(1); }
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const outDir = path.resolve(opt('--out') || path.join(__dirname, 'out'));
  fs.mkdirSync(outDir, { recursive: true });
  const name = path.basename(file, '.html');
  const q = new URLSearchParams({ export: '1' });
  if (opt('--handle')) q.set('handle', opt('--handle'));
  const url = 'file://' + path.resolve(file) + '?' + q;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', (e) => console.error('Sayfa hatası:', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  const { duration, fps } = await page.evaluate(() => window.__reel);
  const grab = (t, type) => page.evaluate(([t, type]) => {
    window.__render(t);
    return document.getElementById('reel').toDataURL(type, 0.94).split(',')[1];
  }, [t, type]);

  const snap = opt('--snap');
  if (snap) {
    for (const s of snap.split(',').map(Number)) {
      const f = path.join(outDir, `${name}_t${s}.png`);
      fs.writeFileSync(f, Buffer.from(await grab(s, 'image/png'), 'base64'));
      console.log(f);
    }
    await browser.close(); return;
  }

  const out = path.join(outDir, `${name}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(duration * fps);
  for (let i = 0; i < total; i++) {
    const buf = Buffer.from(await grab(i / fps, 'image/jpeg'), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) process.stdout.write(`\r${name}: ${i}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\r${name}: bitti -> ${out}`);
  await browser.close();
})();
