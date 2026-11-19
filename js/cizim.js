// =====================================================================
//  Ortak çizim tahtası motoru (çerçeveden bağımsız)
//  Çizgiler 0..1 aralığında normalize saklanır → her ekran boyutunda aynı görünür.
//  Senkron: tamamlanan çizgi + canlı ara noktalar yayın kanalıyla gider; kalıcı kayıt ayrı.
// =====================================================================
export const ASPECT = 4 / 3;   // yükseklik / genişlik
export const PAPER = '#fffaf4';

const uid = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + '';

export function drawStroke(ctx, s, W, H) {
  const p = s.p;
  if (!p?.length) return;
  ctx.save();
  ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.e ? 'rgba(0,0,0,1)' : s.c;
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = s.w * W;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.length === 1) {
    ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(p[0][0] * W, p[0][1] * H);
    for (let i = 1; i < p.length - 1; i++) {
      const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
      ctx.quadraticCurveTo(p[i][0] * W, p[i][1] * H, mx * W, my * H);
    }
    const l = p[p.length - 1]; ctx.lineTo(l[0] * W, l[1] * H);
    ctx.stroke();
  }
  ctx.restore();
}

export class DrawBoard {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{me:string, onStroke?:Function, onLive?:Function, onChange?:Function}} o
   */
  constructor(canvas, o) {
    this.cv = canvas; this.o = o;
    this.ctx = canvas.getContext('2d');
    this.strokes = []; this.removed = new Set();
    this.color = '#b4587a'; this.width = .012; this.eraser = false;
    this.redo = []; this.cleared = null;
    this.remote = new Map();           // karşı tarafın yarım çizgileri
    this.cur = null; this.liveBuf = []; this.liveT = 0;
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
    const down = e => this.down(e), move = e => this.move(e), up = e => this.up(e);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', up);
    this.off = () => { removeEventListener('resize', this.resize); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', up); };
  }
  destroy() { this.off(); }
  resize() {
    const w = this.cv.clientWidth || 300, dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(w * ASPECT * dpr);
    this.cv.style.height = `${w * ASPECT}px`;
    this.render();
  }
  pt(e) {
    const r = this.cv.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }
  down(e) {
    e.preventDefault();
    try { this.cv.setPointerCapture?.(e.pointerId); } catch {}
    this.cur = { id: uid(), u: this.o.me, c: this.color, w: this.eraser ? this.width * 2.2 : this.width, e: this.eraser, p: [this.pt(e)] };
    this.liveBuf = [this.cur.p[0]];
    this.render();
  }
  move(e) {
    if (!this.cur) return;
    e.preventDefault();
    const co = e.getCoalescedEvents?.();
    const evs = co && co.length ? co : [e];   // bazı tarayıcılar boş liste döndürür
    for (const ev of evs) {
      const q = this.pt(ev), l = this.cur.p[this.cur.p.length - 1];
      if (Math.hypot(q[0] - l[0], q[1] - l[1]) < .0015) continue;
      const r = [Math.round(q[0] * 1e4) / 1e4, Math.round(q[1] * 1e4) / 1e4];
      this.cur.p.push(r); this.liveBuf.push(r);
    }
    const now = performance.now();
    if (now - this.liveT > 45 && this.liveBuf.length) {
      this.o.onLive?.({ id: this.cur.id, u: this.cur.u, c: this.cur.c, w: this.cur.w, e: this.cur.e, p: this.liveBuf });
      this.liveBuf = [this.cur.p[this.cur.p.length - 1]]; this.liveT = now;
    }
    this.render();
  }
  up() {
    if (!this.cur) return;
    const s = this.cur; this.cur = null;
    this.strokes.push(s); this.redo = []; this.cleared = null;
    this.o.onStroke?.(s); this.o.onChange?.();
    this.render();
  }
  // ---- uzaktan gelenler
  addRemote(s) {
    this.remote.delete(s.id);
    if (this.removed.has(s.id) || this.strokes.some(x => x.id === s.id)) return;
    this.strokes.push(s); this.render();
  }
  liveRemote(part) {
    const r = this.remote.get(part.id) ?? { ...part, p: [] };
    r.p.push(...part.p); this.remote.set(part.id, r); this.render();
  }
  removeIds(ids) { ids.forEach(id => this.removed.add(id)); this.strokes = this.strokes.filter(s => !ids.includes(s.id)); this.render(); }
  restore(list) { list.forEach(s => { this.removed.delete(s.id); if (!this.strokes.some(x => x.id === s.id)) this.strokes.push(s); }); this.render(); }
  // ---- düzen
  undo() {
    if (this.cleared) { const back = this.cleared; this.cleared = null; this.restore(back); this.o.onChange?.(); return { restore: back }; }
    for (let i = this.strokes.length - 1; i >= 0; i--) {
      if (this.strokes[i].u === this.o.me) {
        const [s] = this.strokes.splice(i, 1); this.redo.push(s); this.removed.add(s.id);
        this.render(); this.o.onChange?.(); return { remove: [s.id] };
      }
    }
    return null;
  }
  redoOne() {
    const s = this.redo.pop(); if (!s) return null;
    this.removed.delete(s.id); this.strokes.push(s); this.render(); this.o.onChange?.();
    return { restore: [s] };
  }
  clear() {
    if (!this.strokes.length) return null;
    this.cleared = this.strokes.slice();
    const ids = this.strokes.map(s => s.id);
    ids.forEach(id => this.removed.add(id));
    this.strokes = []; this.render(); this.o.onChange?.();
    return { remove: ids };
  }
  /** Sunucudaki çizgilerle birleştir (silinenler hariç) */
  merge(server = []) {
    for (const s of server) if (!this.removed.has(s.id) && !this.strokes.some(x => x.id === s.id)) this.strokes.push(s);
    this.render();
  }
  render() {
    const { ctx, cv } = this, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    for (const s of this.strokes) drawStroke(ctx, s, W, H);
    for (const s of this.remote.values()) drawStroke(ctx, s, W, H);
    if (this.cur) drawStroke(ctx, this.cur, W, H);
  }
  /** Kâğıt zeminli PNG (paylaşma/kayıt için) */
  async toBlob(width = 1080) {
    const c = document.createElement('canvas'); c.width = width; c.height = Math.round(width * ASPECT);
    const x = c.getContext('2d');
    const layer = document.createElement('canvas'); layer.width = c.width; layer.height = c.height;
    const lx = layer.getContext('2d');
    for (const s of this.strokes) drawStroke(lx, s, c.width, c.height);
    x.fillStyle = PAPER; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(layer, 0, 0);
    return new Promise(res => c.toBlob(res, 'image/png'));
  }
}
