/* ==========================================================================
   REEL ENGINE — 1080x1920 dikey animasyon motoru (zaman tabanlı, deterministik)
   Her reel:  Reel({ title, duration, draw(ctx, t, F) })
   - Tarayıcıda açınca oynar (tıkla: durdur/oynat, R: baştan, ←/→: sar)
   - render.mjs ile kare kare MP4'e dönüştürülür (window.__render(t))
   ========================================================================== */
(function () {
  const W = 1080, H = 1920;

  // ---------- AYARLAR: sayfa adını burada değiştir ----------
  const CONFIG = {
    handle: '@saplantisaldisiplin',
    bg: '#07080b',
    ink: '#f4f2ee',
    dim: 'rgba(244,242,238,0.38)',
    faint: 'rgba(244,242,238,0.10)',
    gold: '#f4b740',
    cyan: '#38d6f5',
    red: '#ff4d5e',
    violet: '#9b7bff',
    green: '#3ee08f',
    sans: 'Inter, "Inter Display", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  };
  const params = new URLSearchParams(location.search);
  if (params.get('handle')) CONFIG.handle = params.get('handle');

  // ---------- matematik / easing ----------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    linear: (x) => x,
    inQuad: (x) => x * x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inCubic: (x) => x * x * x,
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) => x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: (x) => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  };
  function rng(seed) { // mulberry32
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const mixHex = (h1, h2, t) => {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const c = (s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  };

  // ---------- arka plan: vinyet + film greni ----------
  const grains = [];
  for (let k = 0; k < 6; k++) {
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gc = g.getContext('2d'), id = gc.createImageData(256, 256), r = rng(99 + k);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    gc.putImageData(id, 0, 0); grains.push(g);
  }
  function background(ctx, t, o = {}) {
    ctx.fillStyle = o.color || CONFIG.bg; ctx.fillRect(0, 0, W, H);
    if (o.tint) {
      const g = ctx.createRadialGradient(W / 2, o.tintY ?? H * 0.45, 0, W / 2, o.tintY ?? H * 0.45, H * 0.6);
      g.addColorStop(0, o.tint); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (o.grid) { // ince teknik ızgara
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
      ctx.restore();
    }
  }
  function finish(ctx, t) { // vinyet + gren, her karenin en üstüne
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    const g = grains[Math.floor(t * 24) % grains.length];
    ctx.fillStyle = ctx.createPattern(g, 'repeat'); ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------- yazı ----------
  function text(ctx, str, x, y, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 800} ${o.size || 48}px ${o.font || CONFIG.sans}`;
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls || 0) + 'px';
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.glow) { ctx.shadowColor = o.glowColor || o.color || CONFIG.ink; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = o.color || CONFIG.ink;
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }
  function measure(ctx, str, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 800} ${o.size || 48}px ${o.font || CONFIG.sans}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (o.ls || 0) + 'px';
    const w = ctx.measureText(str).width; ctx.restore(); return w;
  }
  /* Kelime kelime beliren cümle. *yıldız* içindeki kelimeler vurgu renginde.
     p: 0..1 ilerleme. Ortalanmış tek satır. */
  function revealLine(ctx, str, cx, cy, p, o = {}) {
    const words = str.split(' ');
    // satır taşarsa otomatik küçült
    const maxW = o.maxW || 960;
    const fullW = measure(ctx, str.replace(/\*/g, ''), o);
    if (fullW > maxW && !o._fit) return revealLine(ctx, str, cx, cy, p, { ...o, size: (o.size || 64) * maxW / fullW, _fit: true });
    const size = o.size || 64, gap = size * 0.28;
    let inHi = false; // *birden fazla kelime* vurgusunu destekler
    const parts = words.map((w) => {
      const starts = w.startsWith('*');
      const hi = inHi || starts;
      const stars = (w.match(/\*/g) || []).length;
      if (stars % 2 === 1) inHi = !inHi;
      const clean = w.replace(/\*/g, '');
      return { clean, hi, w: measure(ctx, clean, o) };
    });
    const total = parts.reduce((s, p) => s + p.w, 0) + gap * (parts.length - 1);
    let x = cx - total / 2;
    const n = parts.length, stag = o.stagger ?? 0.55;
    parts.forEach((pt, i) => {
      const a = n === 1 ? 0 : (i / (n - 1)) * stag;
      const k = E.outCubic(clamp((p - a) / (1 - stag)));
      if (k > 0) {
        const col = pt.hi ? (o.accent || CONFIG.gold) : (o.color || CONFIG.ink);
        text(ctx, pt.clean, x, cy + (1 - k) * size * 0.45, {
          ...o, align: 'left', color: col, alpha: (o.alpha ?? 1) * k,
          glow: pt.hi ? (o.hiGlow ?? 28) : o.glow, glowColor: col,
        });
      }
      x += pt.w + gap;
    });
  }

  // ---------- şekiller ----------
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  }
  function panel(ctx, x, y, w, h, o = {}) {
    ctx.save(); ctx.globalAlpha *= o.alpha ?? 1;
    rrect(ctx, x, y, w, h, o.r ?? 22);
    ctx.fillStyle = o.fill || 'rgba(255,255,255,0.035)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = o.stroke || 'rgba(255,255,255,0.09)'; ctx.stroke();
    ctx.restore();
  }
  function glowCircle(ctx, x, y, r, color, a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(color, 0.55 * a)); g.addColorStop(0.4, hexA(color, 0.18 * a)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---------- ÇÖP ADAM ----------
  // açı: düz aşağıdan ölçülür, + yüz yönüne doğru (dir=1 → sağ)
  const D = { T: 64, UA: 34, FA: 33, TH: 44, SH: 44, HR: 19 };
  const P = {
    stand(t = 0) {
      const b = Math.sin(t * 2.2) * 0.03;
      return { lean: 0.02 + b * 0.3, hipL: 0.06, kneeL: 0.04, hipR: -0.06, kneeR: 0.04,
        shL: 0.14 + b, elL: 0.18, shR: -0.14 - b, elR: 0.18, head: 0.0 };
    },
    walk(ph, k = 1) {
      const s = Math.sin(ph);
      return { lean: 0.07 * k, hipL: 0.48 * k * s, kneeL: 0.08 + 0.85 * k * Math.max(0, Math.cos(ph)),
        hipR: -0.48 * k * s, kneeR: 0.08 + 0.85 * k * Math.max(0, -Math.cos(ph)),
        shL: -0.5 * k * s, elL: 0.35 + 0.2 * k, shR: 0.5 * k * s, elR: 0.35 + 0.2 * k, head: 0.04 };
    },
    run(ph, k = 1) {
      const s = Math.sin(ph);
      return { lean: 0.32 * k, hipL: 0.85 * k * s, kneeL: 0.25 + 1.6 * k * Math.max(0, Math.cos(ph)),
        hipR: -0.85 * k * s, kneeR: 0.25 + 1.6 * k * Math.max(0, -Math.cos(ph)),
        shL: -1.0 * k * s, elL: 1.5, shR: 1.0 * k * s, elR: 1.5, head: -0.1, bounce: Math.abs(Math.cos(ph)) * 10 * k };
    },
    sitPhone(t = 0) {
      const b = Math.sin(t * 1.6) * 0.02;
      return { lean: 0.32 + b, hipL: 1.5, kneeL: 1.35, hipR: 1.38, kneeR: 1.3,
        shL: 0.55, elL: 1.75, shR: 0.45, elR: 1.9, head: 0.55, phone: true, sit: true };
    },
    standPhone(t = 0) {
      const b = Math.sin(t * 1.6) * 0.02;
      return { lean: 0.18 + b, hipL: 0.04, kneeL: 0.06, hipR: -0.05, kneeR: 0.06,
        shL: 0.5, elL: 1.85, shR: 0.42, elR: 1.95, head: 0.6, phone: true };
    },
    slump(t = 0) {
      const b = Math.sin(t * 1.2) * 0.03;
      return { lean: 0.55 + b, hipL: 0.25, kneeL: 0.5, hipR: 0.1, kneeR: 0.55,
        shL: -0.05, elL: 0.05, shR: 0.05, elR: 0.05, head: 0.6 };
    },
    celebrate(t = 0) {
      const b = Math.sin(t * 6) * 0.12;
      return { lean: -0.06, hipL: 0.18, kneeL: 0.05, hipR: -0.18, kneeR: 0.05,
        shL: 2.6 + b, elL: 0.2, shR: -2.6 - b, elR: -0.2, head: -0.25 };
    },
    lift(t = 0, k = 1) { // blok taşıma: kollar öne-yukarı
      return { lean: 0.1, hipL: 0.15, kneeL: 0.15, hipR: -0.12, kneeR: 0.2,
        shL: lerp(0.4, 2.1, k), elL: lerp(1.1, 0.4, k), shR: lerp(0.3, 1.9, k), elR: lerp(1.2, 0.5, k), head: -0.15 };
    },
  };
  const mixPose = (a, b, t) => {
    const o = {}; for (const k in a) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k] ?? a[k], t) : (t < 0.5 ? a[k] : b[k]);
    for (const k in b) if (!(k in o)) o[k] = b[k]; return o;
  };
  /* o: {x, y(zemin), s(ölçek), dir, pose, color, glow, glowColor, phoneColor, alpha, lift(yukarı ofset)} */
  function stickman(ctx, o) {
    const s = o.s ?? 1, dir = o.dir ?? 1, p = o.pose;
    const pt = (x, y, len, a) => [x + Math.sin(a) * len, y + Math.cos(a) * len];
    // kalçayı (0,0) kabul et
    const kL = pt(0, 0, D.TH, p.hipL), fL = pt(kL[0], kL[1], D.SH, p.hipL - p.kneeL);
    const kR = pt(0, 0, D.TH, p.hipR), fR = pt(kR[0], kR[1], D.SH, p.hipR - p.kneeR);
    const neck = [Math.sin(p.lean) * D.T, -Math.cos(p.lean) * D.T];
    const ha = p.lean + (p.head || 0);
    const head = [neck[0] + Math.sin(ha) * (D.HR + 6), neck[1] - Math.cos(ha) * (D.HR + 6)];
    const sh = [lerp(0, neck[0], 0.9), lerp(0, neck[1], 0.9)];
    const eL = pt(sh[0], sh[1], D.UA, p.shL), hL = pt(eL[0], eL[1], D.FA, p.shL + p.elL);
    const eR = pt(sh[0], sh[1], D.UA, p.shR), hR = pt(eR[0], eR[1], D.FA, p.shR + p.elR);
    const ground = p.sit ? 0 : Math.max(fL[1], fR[1]); // oturuşta (x,y) = kalça/oturak noktası
    const ox = o.x, oy = o.y - (ground + (p.bounce || 0) + (o.lift || 0)) * s;
    const X = (v) => ox + v[0] * s * dir, Y = (v) => oy + v[1] * s;

    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    const col = o.color || CONFIG.ink;
    // telefon ışığı yüze vurur
    if (p.phone && o.phoneColor) glowCircle(ctx, X(hR), Y(hR) - 10 * s, 150 * s, o.phoneColor, o.phoneGlow ?? 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = (o.lw || 9.5) * s;
    const passes = o.glow ? 2 : 1;
    for (let i = 0; i < passes; i++) {
      if (o.glow) { ctx.shadowColor = o.glowColor || col; ctx.shadowBlur = (i === 0 ? o.glow * 1.6 : o.glow * 0.5) * s; }
      ctx.beginPath();
      ctx.moveTo(X(fL), Y(fL)); ctx.lineTo(X(kL), Y(kL)); ctx.lineTo(X([0, 0]), Y([0, 0])); ctx.lineTo(X(kR), Y(kR)); ctx.lineTo(X(fR), Y(fR));
      ctx.moveTo(X([0, 0]), Y([0, 0])); ctx.lineTo(X(neck), Y(neck));
      ctx.moveTo(X(hL), Y(hL)); ctx.lineTo(X(eL), Y(eL)); ctx.lineTo(X(sh), Y(sh)); ctx.lineTo(X(eR), Y(eR)); ctx.lineTo(X(hR), Y(hR));
      ctx.stroke();
      ctx.beginPath(); ctx.arc(X(head), Y(head), D.HR * s, 0, Math.PI * 2);
      ctx.fillStyle = o.headColor || col; ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (p.phone) {
      const px = X(hR), py = Y(hR);
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35 * dir);
      rrect(ctx, -11 * s, -30 * s, 22 * s, 38 * s, 5 * s); ctx.fillStyle = '#15161a'; ctx.fill();
      ctx.lineWidth = 2.5 * s; ctx.strokeStyle = '#2a2c33'; ctx.stroke();
      rrect(ctx, -8 * s, -27 * s, 16 * s, 32 * s, 3 * s); ctx.fillStyle = o.phoneColor || '#5af'; ctx.fill();
      ctx.restore();
      // yüz telefon rengine bürünür
      if (o.phoneColor) {
        ctx.save(); ctx.globalAlpha *= 0.55 * (o.phoneGlow ?? 1);
        ctx.beginPath(); ctx.arc(X(head), Y(head), D.HR * s, 0, Math.PI * 2);
        ctx.fillStyle = o.phoneColor; ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();
    return { head: [X(head), Y(head)], handR: [X(hR), Y(hR)], handL: [X(hL), Y(hL)] };
  }

  // ---------- parçacıklar (deterministik: t'den hesaplanır) ----------
  function embers(ctx, t, o) { // yükselen kıvılcımlar
    const r = rng(o.seed || 7), n = o.n || 30;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const life = 0.8 + r() * 1.2, off = r() * life, ph = ((t + off) % life) / life;
      const x = o.x + (r() - 0.5) * (o.w || 80) + Math.sin((t + i) * 3) * 6;
      const y = o.y - ph * (o.h || 160);
      const a = (1 - ph) * (o.alpha ?? 1);
      const rad = (1 - ph) * (o.size || 5) + 1;
      ctx.fillStyle = hexA(o.color || CONFIG.gold, a);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- marka katmanları ----------
  function handleTag(ctx, alpha = 1) {
    text(ctx, CONFIG.handle, W / 2, H - 150, { size: 26, weight: 500, color: CONFIG.dim, alpha, ls: 2 });
  }
  function endCard(ctx, t, t0) { // t0'dan itibaren kararıp hesap adı gelir
    const k = prog(t, t0, t0 + 0.7);
    if (k <= 0) return;
    ctx.save(); ctx.fillStyle = `rgba(4,5,7,${E.outCubic(k)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    const k2 = E.outBack(prog(t, t0 + 0.25, t0 + 1.0));
    const cy = H / 2 - 40;
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(lerp(0.6, 1, k2), lerp(0.6, 1, k2)); ctx.globalAlpha = clamp(k2);
    // minimal logo: halka + nokta
    ctx.lineWidth = 7; ctx.strokeStyle = CONFIG.ink; ctx.shadowColor = CONFIG.gold; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = CONFIG.gold; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    text(ctx, CONFIG.handle.toUpperCase(), W / 2, cy + 120, { size: 40, weight: 800, ls: 3, alpha: prog(t, t0 + 0.45, t0 + 1.0) });
    const k3 = prog(t, t0 + 0.8, t0 + 1.3);
    const pw = 300, ph = 72;
    panel(ctx, W / 2 - pw / 2, cy + 185, pw, ph, { r: 36, alpha: k3, fill: 'rgba(244,183,64,0.10)', stroke: hexA(CONFIG.gold, 0.5) });
    text(ctx, 'Takip et →', W / 2, cy + 185 + ph / 2, { size: 30, weight: 700, color: CONFIG.gold, alpha: k3 });
  }

  // ---------- oynatıcı ----------
  window.F = { W, H, CONFIG, clamp, lerp, prog, E, rng, hexA, mixHex, background, finish, text, measure, revealLine,
    rrect, panel, glowCircle, stickman, P, mixPose, embers, handleTag, endCard };

  const TR = 'AaZz09 ĞğŞşİıÜüÖöÇç→×%';
  window.Reel = function (def) {
    document.title = def.title || 'Reel';
    const fps = 30;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.id = 'reel';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const draw = (t) => { ctx.save(); def.draw(ctx, t, window.F); ctx.restore(); finish(ctx, t); };

    window.__reel = { duration: def.duration, fps, cues: def.cues ? def.cues() : null };
    window.__render = (t) => draw(t);

    const freeze = params.get('t');
    const ui = document.createElement('div'); ui.id = 'ui';
    ui.innerHTML = '<div id="bar"><div id="fill"></div></div><div id="hint">tıkla: oynat/durdur · R: baştan · ←/→ sar</div>';
    if (!params.has('export')) document.body.appendChild(ui);
    const fill = ui.querySelector('#fill'), bar = ui.querySelector('#bar');

    let playing = freeze == null && !params.has('export'), t = freeze ? +freeze : 0, last = null;
    const loop = (now) => {
      if (last != null && playing) t = (t + (now - last) / 1000) % def.duration;
      last = now; draw(t); fill.style.width = (t / def.duration) * 100 + '%';
      if (!params.has('export')) requestAnimationFrame(loop);
    };
    canvas.addEventListener('click', () => (playing = !playing));
    bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); t = ((e.clientX - r.left) / r.width) * def.duration; });
    addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') t = 0;
      if (e.key === 'ArrowRight') t = Math.min(def.duration - 0.01, t + 1);
      if (e.key === 'ArrowLeft') t = Math.max(0, t - 1);
      if (e.key === ' ') playing = !playing;
    });
    document.fonts.ready.then(() => Promise.all([
      ...['500', '700', '800', '900'].map((w) => document.fonts.load(`${w} 40px Inter`, TR)),
      ...['500', '700'].map((w) => document.fonts.load(`${w} 40px "JetBrains Mono"`, TR)),
    ])).then(() => { window.__ready = true; requestAnimationFrame(loop); });
  };
})();
