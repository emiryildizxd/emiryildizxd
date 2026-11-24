#!/usr/bin/env node
/* Reel'i kare kare render edip MP4 yapar (1080x1920, 30fps, H.264).
   Kullanım:
     node render.cjs 01-yuzde-bir.html                  -> out/01-yuzde-bir.mp4
     node render.cjs 01-yuzde-bir.html --handle @ad     -> sayfa adını değiştir
     node render.cjs 01-yuzde-bir.html --snap 1,5,10    -> sadece o saniyelerin PNG'leri (önizleme)
     node render.cjs 01-yuzde-bir.html --audio-only     -> görüntüyü yeniden üretmeden sadece sesi yenile
     node render.cjs 01-yuzde-bir.html --no-audio       -> sessiz video
   Ses: reel'in cues() listesi -> audio.py (sentetik müzik + efekt) -> MP4'e eklenir.
   Gerekenler: Node, Playwright (chromium), ffmpeg, Python3 + numpy */
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
  const silentDir = path.join(outDir, '_silent');
  fs.mkdirSync(silentDir, { recursive: true });
  const silent = path.join(silentDir, `${name}.mp4`);
  const cues = await page.evaluate(() => window.__reel.cues);

  // aynı reel'i aynı anda iki işlem render etmesin (dosya bozulmasını önler)
  const lock = path.join(silentDir, `${name}.lock`);
  try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); }
  catch { console.error(`${name}: başka bir render çalışıyor (${lock}). Değilse bu dosyayı sil.`); process.exit(1); }
  process.on('exit', () => { try { fs.unlinkSync(lock); } catch {} });

  if (!args.includes('--audio-only')) {
    const tmp = silent.replace(/\.mp4$/, `.tmp-${process.pid}.mp4`);
    await renderVideo(tmp);
    verify(tmp, Math.round(duration * fps), false);
    fs.renameSync(tmp, silent);
  }
  await browser.close();

  if (args.includes('--no-audio') || !cues) { fs.copyFileSync(silent, out); console.log(`${name}: sessiz -> ${out}`); return; }
  const cueFile = path.join(silentDir, `${name}.cues.json`), wav = path.join(silentDir, `${name}.wav`);
  fs.writeFileSync(cueFile, JSON.stringify({ duration, ...cues }, null, 1));
  run('python3', [path.join(__dirname, 'audio.py'), cueFile, wav]);
  run('ffmpeg', ['-y', '-v', 'error', '-i', silent, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
    '-af', 'loudnorm=I=-14:TP=-1.0:LRA=9', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  verify(out, Math.round(duration * fps), true);
  console.log(`${name}: sesli -> ${out} (doğrulandı)`);

  // video akışı 0. saniyeden başlamalı ve kare sayısı tam olmalı
  function verify(file, frames, withAudio) {
    const r = require('child_process').spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-show_entries',
      'stream=codec_type,start_time,nb_read_packets', '-of', 'json', file], { encoding: 'utf8' });
    const st = JSON.parse(r.stdout).streams;
    const v = st.find((x) => x.codec_type === 'video'), a = st.find((x) => x.codec_type === 'audio');
    const bad = [];
    if (!v) bad.push('video yok');
    else {
      if (Math.abs(+v.start_time) > 0.05) bad.push(`video ${v.start_time}s'de başlıyor`);
      if (+v.nb_read_packets !== frames) bad.push(`kare sayısı ${v.nb_read_packets}/${frames}`);
    }
    if (withAudio && (!a || Math.abs(+a.start_time) > 0.05)) bad.push('ses akışı hatalı');
    if (bad.length) { console.error(`${name}: DOĞRULAMA BAŞARISIZ -> ${bad.join(', ')}`); process.exit(1); }
  }

  function run(cmd, a) {
    const r = require('child_process').spawnSync(cmd, a, { stdio: 'inherit' });
    if (r.status !== 0) { console.error(cmd + ' başarısız'); process.exit(1); }
  }
  async function renderVideo(out) {
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
  console.log(`\r${name}: görüntü bitti`);
  }
})();
