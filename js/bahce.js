// =====================================================================
//  Canlı bahçe — 2.5D katmanlı canvas sahnesi
//  • Gökyüzü günün saatine göre (gündüz / gün batımı / gece), mevsime göre zemin ve parçacıklar
//  • Her çiçek kaydı tarlada sabit bir yerde (kimliğinden türetilir → yenilense de yerleşim aynı)
//  • Büyüme etkileşime bağlı: bir çiçekten sonra gönderilen her çiçek onu bir aşama büyütür
//    (0 tohum · 1 filiz · 2 tomurcuk · 3+ çiçek)
// =====================================================================
const TAU = Math.PI * 2;
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; };
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const BUD_COLORS = { gul: [232, 114, 143], lale: [243, 148, 180], papatya: [255, 250, 240], lavanta: [176, 152, 228], sakayik: [245, 166, 190], ortanca: [181, 200, 242] };

/** Günün saatine göre gökyüzü paleti */
function skyFor(hour) {
  const P = {
    night: { top: [12, 16, 40], mid: [28, 30, 70], hor: [60, 50, 95], light: .35, sun: null },
    dawn: { top: [80, 110, 170], mid: [240, 170, 170], hor: [255, 205, 170], light: .8 },
    day: { top: [120, 175, 230], mid: [185, 220, 245], hor: [245, 235, 220], light: 1 },
    dusk: { top: [70, 70, 140], mid: [235, 130, 140], hor: [255, 185, 130], light: .75 },
  };
  if (hour < 5 || hour >= 20.5) return { ...P.night, k: 'night' };
  if (hour < 7.5) return { ...P.dawn, k: 'dawn' };
  if (hour < 17) return { ...P.day, k: 'day' };
  return { ...P.dusk, k: 'dusk' };
}
function seasonOf(m) { return m === 11 || m <= 1 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }

export class GardenScene {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{flowers:any[], imgs:Record<string,HTMLImageElement>, onTap?:(f:any)=>void, reduce?:boolean}} o
   */
  constructor(canvas, o) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.o = o;
    this.t0 = performance.now(); this.raf = 0; this.running = false;
    const now = new Date();
    this.hour = o.hour ?? now.getHours() + now.getMinutes() / 60;
    this.sky = skyFor(this.hour);
    this.season = o.season ?? seasonOf(now.getMonth());
    this.setFlowers(o.flowers);
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.onTap = e => this.tap(e);
    canvas.addEventListener('click', this.onTap);
    this.onVis = () => (document.visibilityState === 'visible' ? this.start() : this.stop());
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.start();
  }
  destroy() { this.stop(); removeEventListener('resize', this.resize); this.cv.removeEventListener('click', this.onTap); document.removeEventListener('visibilitychange', this.onVis); }
  setFlowers(list) {
    // büyüme aşaması: bu çiçekten SONRA gönderilen çiçek sayısı
    const days = list.map(f => f.day).sort();
    this.plants = list.map(f => {
      const r = rng(hash(f.id));
      const later = days.filter(d => d > f.day).length;
      return { f, stage: Math.min(3, later), depth: Math.pow(r(), .8), x: r(), phase: r() * TAU, sway: .6 + r() * .6, tall: .85 + r() * .35 };
    }).sort((a, b) => a.depth - b.depth);
    this.statics = null;
  }
  resize() {
    const w = this.cv.clientWidth || 360, h = this.cv.clientHeight || 420, dpr = Math.min(2, devicePixelRatio || 1);
    this.W = Math.round(w * dpr); this.H = Math.round(h * dpr); this.dpr = dpr;
    this.cv.width = this.W; this.cv.height = this.H;
    this.statics = null;
    this.particles = this.makeParticles();
    if (!this.running) this.frame(performance.now(), true);
  }
  start() { if (this.running || this.o.reduce) { if (this.o.reduce) this.frame(performance.now(), true); return; } this.running = true; const loop = t => { if (!this.running) return; this.frame(t); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  // ---------- sabit katmanlar (bir kez çizilir) ----------
  buildStatics() {
    const { W, H } = this, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), sky = this.sky, horizon = H * .44;
    // gökyüzü
    const g = x.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, rgb(sky.top)); g.addColorStop(.6, rgb(sky.mid)); g.addColorStop(1, rgb(sky.hor));
    x.fillStyle = g; x.fillRect(0, 0, W, horizon + 2);
    // yıldızlar (gece)
    if (sky.k === 'night') {
      const r = rng(7);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${.25 + r() * .6})`; x.beginPath(); x.arc(r() * W, r() * horizon * .9, r() * 1.3 * this.dpr, 0, TAU); x.fill(); }
    }
    // güneş / ay
    const night = sky.k === 'night';
    const sunX = W * (sky.k === 'dawn' ? .2 : sky.k === 'dusk' ? .8 : night ? .76 : .72);
    const sunY = sky.k === 'day' ? horizon * .26 : night ? horizon * .24 : horizon * .62;
    const glow = x.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * (night ? .28 : .4));
    glow.addColorStop(0, night ? 'rgba(225,230,255,.32)' : sky.k === 'day' ? 'rgba(255,248,225,.8)' : 'rgba(255,214,170,.85)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, horizon);
    if (night) {
      // hilal: ayı çiz, gölge tarafını ayın etrafındaki gök rengiyle kapat
      const mr = 15 * this.dpr;
      const mg = x.createRadialGradient(sunX - mr * .3, sunY - mr * .3, 0, sunX, sunY, mr);
      mg.addColorStop(0, '#fffdf3'); mg.addColorStop(1, '#e6e4f2');
      x.fillStyle = mg; x.beginPath(); x.arc(sunX, sunY, mr, 0, TAU); x.fill();
      const behind = x.getImageData(Math.round(sunX + mr * 2.2), Math.round(sunY), 1, 1).data;
      x.fillStyle = `rgb(${behind[0]},${behind[1]},${behind[2]})`;
      x.beginPath(); x.arc(sunX + mr * .55, sunY - mr * .3, mr * .92, 0, TAU); x.fill();
    } else {
      x.fillStyle = sky.k === 'day' ? '#fffaf0' : '#ffe9c8';
      x.beginPath(); x.arc(sunX, sunY, 24 * this.dpr, 0, TAU); x.fill();
    }
    // tepeler: atmosferik perspektifle 4 katman
    const hillBase = this.season === 'winter' ? [190, 205, 215] : this.season === 'autumn' ? [150, 150, 95] : [120, 165, 115];
    for (let k = 0; k < 4; k++) {
      const r = rng(31 + k), t = k / 3;
      const col = mix(mix(sky.hor, hillBase, .25 + t * .55), [20, 30, 25], sky.k === 'night' ? .45 : 0);
      const y0 = horizon - H * (.11 - k * .03);
      x.fillStyle = rgb(col);
      x.beginPath(); x.moveTo(0, horizon + 4);
      const amp = H * (.05 + r() * .03), f1 = 1 + r() * 2, f2 = 3 + r() * 3, ph = r() * TAU;
      for (let i = 0; i <= 60; i++) { const u = i / 60; x.lineTo(u * W, y0 + Math.sin(u * TAU * f1 + ph) * amp * .6 + Math.sin(u * TAU * f2 + ph * 2) * amp * .25); }
      x.lineTo(W, horizon + 4); x.closePath(); x.fill();
    }
    // uzak ağaç siluetleri: gövde + üst üste binen taç kümeleri, sise gömülü
    const tr = rng(99);
    const treeCol = rgb(mix(mix([52, 84, 58], sky.hor, .35), [12, 16, 30], sky.k === 'night' ? .6 : 0));
    for (let i = 0; i < 11; i++) {
      const tx = tr() * W, ty = horizon + tr() * H * .01, s = (7 + tr() * 9) * this.dpr;
      x.fillStyle = treeCol;
      x.fillRect(tx - s * .08, ty - s * 1.2, s * .16, s * 1.2);
      for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(tx + (k - 1) * s * .38, ty - s * (1.25 + (k === 1 ? .35 : 0)), s * (.48 + (k === 1 ? .12 : 0)), 0, TAU); x.fill(); }
    }
    // çayır: derinlikle açılan renk
    const grassNear = this.season === 'winter' ? [205, 215, 220] : this.season === 'autumn' ? [128, 150, 70] : this.season === 'summer' ? [110, 160, 70] : [120, 175, 95];
    const grassFar = mix(grassNear, sky.hor, .45);
    const gg = x.createLinearGradient(0, horizon, 0, H);
    gg.addColorStop(0, rgb(mix(grassFar, [20, 25, 50], sky.k === 'night' ? .42 : 0)));
    gg.addColorStop(1, rgb(mix(grassNear, [15, 25, 35], sky.k === 'night' ? .48 : 0)));
    x.fillStyle = gg; x.fillRect(0, horizon, W, H - horizon);
    // ışığın düştüğü taraf (güneş/ay yönünde) çayırda yumuşak aydınlık
    const pool = x.createRadialGradient(sunX, horizon + H * .18, 0, sunX, horizon + H * .18, W * .7);
    pool.addColorStop(0, night ? 'rgba(170,185,255,.16)' : 'rgba(255,240,200,.28)'); pool.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = pool; x.fillRect(0, horizon, W, H - horizon);
    // çimen dokusu (perspektifli küçük çizgiler)
    const gr = rng(5);
    for (let i = 0; i < 2600; i++) {
      const d = Math.pow(gr(), .7), y = lerp(horizon + 3, H, d), gx = gr() * W, len = lerp(1.5, 9, d) * this.dpr;
      const shade = mix(grassNear, [30, 70, 30], .2 + gr() * .3);
      x.strokeStyle = rgb(mix(shade, [10, 15, 30], sky.k === 'night' ? .55 : 0), .5);
      x.lineWidth = lerp(.5, 1.4, d) * this.dpr;
      x.beginPath(); x.moveTo(gx, y); x.lineTo(gx + (gr() - .5) * len * .6, y - len); x.stroke();
    }
    // kış: kar lekeleri
    if (this.season === 'winter') { const sr = rng(11); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 400; i++) { const d = sr(); x.beginPath(); x.ellipse(sr() * W, lerp(horizon, H, d), lerp(2, 14, d) * this.dpr, lerp(.6, 4, d) * this.dpr, 0, 0, TAU); x.fill(); } }
    // ön planda yumuşak sis ve vinyet
    const fog = x.createLinearGradient(0, horizon - H * .05, 0, horizon + H * .12);
    fog.addColorStop(0, rgb(sky.hor, 0)); fog.addColorStop(.5, rgb(sky.hor, sky.k === 'night' ? .12 : .35)); fog.addColorStop(1, rgb(sky.hor, 0));
    x.fillStyle = fog; x.fillRect(0, horizon - H * .05, W, H * .17);
    const vg = x.createRadialGradient(W / 2, H * .55, H * .2, W / 2, H * .55, H * .9);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(20,10,20,${sky.k === 'night' ? .45 : .22})`);
    x.fillStyle = vg; x.fillRect(0, 0, W, H);
    this.horizon = horizon;
    this.statics = c;
  }
  makeParticles() {
    const r = rng(1234), n = this.sky.k === 'night' ? 14 : this.season === 'winter' ? 40 : 18;
    return Array.from({ length: n }, () => ({ x: r(), y: r(), s: .3 + r(), ph: r() * TAU, k: r() }));
  }
  // ---------- bitki çizimi ----------
  plantPos(p) {
    const { W, H } = this, hz = this.horizon ?? H * .44;
    const y = lerp(hz + H * .07, H * .95, p.depth), scale = lerp(.55, 1.55, p.depth) * this.dpr;
    const x = lerp(W * .06, W * .94, p.x);
    return { x, y, scale };
  }
  drawPlant(x, p, t) {
    const { x: px, y: py, scale } = this.plantPos(p);
    const night = this.sky.k === 'night';
    const wind = Math.sin(t * .0011 * p.sway + p.phase) * .09 + Math.sin(t * .0027 + p.phase * 2) * .03;
    // gölge
    x.fillStyle = `rgba(30,25,20,${night ? .18 : .22})`;
    x.beginPath(); x.ellipse(px + 6 * scale, py + 2 * scale, 14 * scale, 3.5 * scale, 0, 0, TAU); x.fill();
    if (p.stage === 0) { // tohum: toprak tümseği + minik filiz noktası
      x.fillStyle = night ? '#4a3a33' : '#7a5a45'; x.beginPath(); x.ellipse(px, py, 9 * scale, 4 * scale, 0, Math.PI, 0); x.fill();
      x.fillStyle = night ? '#5e8a5e' : '#8cc08a'; x.beginPath(); x.arc(px, py - 4 * scale, 1.8 * scale, 0, TAU); x.fill();
      return;
    }
    const h = (p.stage === 1 ? 20 : p.stage === 2 ? 46 : 70) * scale * p.tall;
    const tipX = px + Math.sin(wind) * h, tipY = py - Math.cos(wind) * h;
    // gövde
    x.strokeStyle = night ? '#4f7a58' : '#6fa676'; x.lineWidth = Math.max(1, 2.2 * scale); x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.sin(wind) * h * .3, py - h * .55, tipX, tipY); x.stroke();
    // yapraklar
    x.fillStyle = night ? '#5a8a63' : '#8cc395';
    const leaf = (side, k) => { const lx = lerp(px, tipX, k), ly = lerp(py, tipY, k); x.save(); x.translate(lx, ly); x.rotate(side * .9 + wind); x.beginPath(); x.ellipse(side * 6 * scale, 0, 7 * scale, 2.6 * scale, 0, 0, TAU); x.fill(); x.restore(); };
    leaf(-1, .35); if (p.stage > 1) leaf(1, .55);
    if (p.stage === 1) return;
    const col = BUD_COLORS[p.f.kind] ?? [232, 114, 143];
    if (p.stage === 2) { // tomurcuk
      x.save(); x.translate(tipX, tipY); x.rotate(wind);
      x.fillStyle = rgb(mix(col, [90, 140, 90], .35)); x.beginPath(); x.ellipse(0, -5 * scale, 4.2 * scale, 7 * scale, 0, 0, TAU); x.fill();
      x.fillStyle = rgb(col); x.beginPath(); x.ellipse(0, -8 * scale, 2.6 * scale, 4.5 * scale, 0, 0, TAU); x.fill();
      x.restore(); return;
    }
    // açmış çiçek: hazır çiçek çizimi (baş kısmı) + hafif ışıma
    const img = this.o.imgs[p.f.kind];
    const s = 42 * scale;
    if (!night) { const gl = x.createRadialGradient(tipX, tipY - s * .2, 0, tipX, tipY - s * .2, s * .9); gl.addColorStop(0, rgb(col, .25)); gl.addColorStop(1, rgb(col, 0)); x.fillStyle = gl; x.fillRect(tipX - s, tipY - s, s * 2, s * 2); }
    if (img?.complete) {
      x.save(); x.translate(tipX, tipY); x.rotate(wind * .7);
      // çiçek görselinin sadece üst yarısı (taç) — gövdeyi kendimiz çizdik
      x.drawImage(img, 0, 0, 80, 68, -s / 2, -s * .78, s, s * .85);   // görsel 80×120 üretilir; üstteki 80×68 taç kısmı
      x.restore();
    }
    if (night) { const ng = x.createRadialGradient(tipX, tipY - s * .35, 0, tipX, tipY - s * .35, s * .5); ng.addColorStop(0, rgb(col, .12)); ng.addColorStop(1, rgb(col, 0)); x.fillStyle = ng; x.fillRect(tipX - s * .5, tipY - s * .85, s, s); }
  }
  drawParticles(x, t) {
    const { W, H } = this, hz = this.horizon, night = this.sky.k === 'night';
    for (const p of this.particles) {
      if (night) { // ateş böcekleri
        const px = (p.x + Math.sin(t * .0003 * p.s + p.ph) * .04) * W, py = lerp(hz, H * .9, p.y) + Math.cos(t * .0005 + p.ph) * 12 * this.dpr;
        const a = Math.max(0, Math.sin(t * .0016 * p.s + p.ph)) ** 2, rr = 6 * this.dpr;
        if (a > .02) {
          const g = x.createRadialGradient(px, py, 0, px, py, rr); g.addColorStop(0, `rgba(255,236,140,${a * .9})`); g.addColorStop(.3, `rgba(255,220,110,${a * .35})`); g.addColorStop(1, 'rgba(255,220,110,0)');
          x.fillStyle = g; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
          x.fillStyle = `rgba(255,252,220,${a})`; x.beginPath(); x.arc(px, py, 1.1 * this.dpr, 0, TAU); x.fill();
        }
      } else if (this.season === 'winter') { // kar
        const py = ((p.y + t * .00004 * p.s) % 1) * H, px = (p.x + Math.sin(t * .0006 + p.ph) * .02) * W;
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(px, py, (1 + p.k * 2) * this.dpr, 0, TAU); x.fill();
      } else if (this.season === 'autumn' || this.season === 'spring') { // düşen yaprak / taç yaprak
        const py = ((p.y + t * .000025 * p.s) % 1) * H, px = ((p.x + t * .00001 + Math.sin(t * .0008 + p.ph) * .03) % 1) * W;
        x.save(); x.translate(px, py); x.rotate(t * .001 * p.s + p.ph);
        x.fillStyle = this.season === 'autumn' ? rgb(mix([214, 120, 60], [235, 180, 80], p.k), .85) : 'rgba(250,200,215,.85)';
        x.beginPath(); x.ellipse(0, 0, 5 * this.dpr, 2.4 * this.dpr, 0, 0, TAU); x.fill(); x.restore();
      }
      if (!night && p.k > .82) { // kelebek
        const bx = (p.x + Math.sin(t * .00025 * p.s + p.ph) * .15) * W, by = lerp(hz * 1.05, H * .7, p.y) + Math.sin(t * .0012 + p.ph) * 18 * this.dpr;
        const flap = Math.abs(Math.sin(t * .012 + p.ph)) * .8 + .2;
        x.fillStyle = p.k > .92 ? 'rgba(255,190,90,.9)' : 'rgba(240,160,200,.9)';
        x.save(); x.translate(bx, by);
        x.beginPath(); x.ellipse(-4 * this.dpr * flap, 0, 4.5 * this.dpr * flap, 3.2 * this.dpr, -.4, 0, TAU); x.fill();
        x.beginPath(); x.ellipse(4 * this.dpr * flap, 0, 4.5 * this.dpr * flap, 3.2 * this.dpr, .4, 0, TAU); x.fill();
        x.restore();
      }
    }
  }
  frame(t, once) {
    if (!this.statics) this.buildStatics();
    const x = this.ctx, el = t - this.t0;
    x.drawImage(this.statics, 0, 0);
    // bulutlar (gündüz/gün batımı) yavaşça kayar
    if (this.sky.k !== 'night') {
      const r = rng(77);
      for (let i = 0; i < 4; i++) {
        const cy = this.horizon * (.18 + r() * .35), w = this.W * (.18 + r() * .14), cx = ((r() + el * .000006 * (1 + i * .3)) % 1.3 - .15) * this.W;
        x.fillStyle = `rgba(255,255,255,${this.sky.k === 'day' ? .55 : .35})`;
        for (let k = 0; k < 5; k++) { x.beginPath(); x.ellipse(cx + (k - 2) * w * .18, cy + Math.sin(k * 1.7) * w * .04, w * .2, w * .09, 0, 0, TAU); x.fill(); }
      }
    }
    for (const p of this.plants) this.drawPlant(x, p, once ? 0 : el);
    if (!once) this.drawParticles(x, el);
  }
  tap(e) {
    const r = this.cv.getBoundingClientRect(), mx = (e.clientX - r.left) * this.dpr, my = (e.clientY - r.top) * this.dpr;
    let best = null, bd = Infinity;
    for (const p of this.plants) {
      const { x, y, scale } = this.plantPos(p), h = (p.stage === 0 ? 8 : p.stage === 1 ? 20 : p.stage === 2 ? 46 : 70) * scale;
      const d = Math.hypot(mx - x, my - (y - h * .6));
      if (d < Math.max(28 * this.dpr, h * .7) && d < bd) { bd = d; best = p; }
    }
    if (best) this.o.onTap?.(best.f, best.stage);
  }
}

/** Çiçek SVG'lerini canvas'ta kullanılacak görsellere çevir */
export function flowerImages(flowerSvg, kinds) {
  const out = {};
  for (const k of kinds) {
    const im = new Image();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(flowerSvg(k).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120" '));
    out[k] = im;
  }
  return out;
}
