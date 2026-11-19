// =====================================================================
//  Yıldız haritası motoru — astronomik olarak doğru gökyüzü
//  Veri: data/gok.json (d3-celestial / Hipparcos, BSD-3). Yöntem:
//  UTC → Jülyen günü → Greenwich ortalama yıldız zamanı → yerel yıldız zamanı
//  → her yıldız için saat açısı → yükseklik/azimut → azimutal eşit uzaklıklı izdüşüm
//  (zenit merkezde, ufuk çemberin kenarında, kuzey yukarıda, doğu solda — gökyüzüne bakar gibi).
// =====================================================================
let DATA = null;
export async function loadSky() {
  if (DATA) return DATA;
  const r = await fetch(new URL('../data/gok.json', import.meta.url));
  if (!r.ok) throw new Error('Yıldız verisi yüklenemedi');
  DATA = await r.json();
  return DATA;
}

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const julian = date => date.getTime() / 864e5 + 2440587.5;
/** Yerel yıldız zamanı (derece) */
export function lst(date, lng) {
  const d = julian(date) - 2451545.0, T = d / 36525;
  let g = 280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000;
  return (((g + lng) % 360) + 360) % 360;
}
/** RA/Dec (derece) → yükseklik/azimut (derece; azimut kuzeyden doğuya) */
export function altAz(raDeg, decDeg, lstDeg, latDeg) {
  const H = (lstDeg - raDeg) * D2R, dec = decDeg * D2R, lat = latDeg * D2R;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
  return { alt: alt * R2D, az: ((az * R2D) + 360) % 360 };
}
// B-V renk indeksinden yaklaşık yıldız rengi
function starColor(bv) {
  if (bv < 0) return [180, 205, 255];
  if (bv < .3) return [215, 228, 255];
  if (bv < .6) return [255, 250, 240];
  if (bv < 1) return [255, 236, 205];
  if (bv < 1.4) return [255, 214, 170];
  return [255, 190, 140];
}
// Deterministik sözde rastgele (aynı girdi → aynı görünüm)
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; }

/**
 * Posteri canvas'a çizer.
 * @param {HTMLCanvasElement} cv
 * @param {{date: Date, lat:number, lng:number, title:string, place:string, sub:string, palette?:string}} o
 */
export function drawSky(cv, data, o) {
  const W = 1080, H = 1440;
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  // arka plan: derin gece mavisi, hafif mor ışıma
  const bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b0f24'); bg.addColorStop(.55, '#121233'); bg.addColorStop(1, '#1d1430');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 560, 50, W / 2, 560, 700);
  glow.addColorStop(0, 'rgba(120,110,200,.18)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  const cx = W / 2, cy = 590, R = 440;
  // gök küresi
  const disk = x.createRadialGradient(cx, cy - 80, 40, cx, cy, R);
  disk.addColorStop(0, '#16204a'); disk.addColorStop(.75, '#0d1433'); disk.addColorStop(1, '#090d24');
  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = disk; x.fill();
  x.clip();

  const L = lst(o.date, o.lng);
  const proj = (ra, dec) => {
    const { alt, az } = altAz(ra, dec, L, o.lat);
    const r = (90 - alt) / 90 * R;
    return { x: cx - r * Math.sin(az * D2R), y: cy - r * Math.cos(az * D2R), alt };
  };

  // Samanyolu: galaktik düzlem (b≈0) boyunca hafif ışıma — galaktik → ekvatoral dönüşümle doğru konumda
  const rnd = rng(Math.round(o.date.getTime() / 6e4) ^ Math.round(o.lat * 100));
  const aN = 192.85948 * D2R, dN = 27.12825 * D2R, lN = 122.93192 * D2R;
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 1100; i++) {
    const l = rnd() * 2 * Math.PI;
    const b = ((rnd() + rnd() + rnd()) / 3 - .5) * 30 * D2R * (1 + .6 * Math.cos(l));   // merkeze doğru daha kalın
    const sd = Math.sin(b) * Math.sin(dN) + Math.cos(b) * Math.cos(dN) * Math.cos(lN - l);
    const dec = Math.asin(sd) * R2D;
    const ra = ((aN + Math.atan2(Math.cos(b) * Math.sin(lN - l), Math.sin(b) * Math.cos(dN) - Math.cos(b) * Math.sin(dN) * Math.cos(lN - l))) * R2D + 360) % 360;
    const p = proj(ra, dec);
    if (p.alt < -2) continue;
    const g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
    g.addColorStop(0, 'rgba(150,160,230,.035)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(p.x - 26, p.y - 26, 52, 52);
  }
  x.globalCompositeOperation = 'source-over';

  // takımyıldız çizgileri
  x.strokeStyle = 'rgba(190,200,255,.32)'; x.lineWidth = 1.4; x.lineCap = 'round';
  for (const line of data.l) {
    x.beginPath(); let started = false;
    for (const [ra, dec] of line) {
      const p = proj(ra, dec);
      if (p.alt < -1) { started = false; continue; }
      started ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); started = true;
    }
    x.stroke();
  }

  // yıldızlar (parlaklığa göre boyut, renk indeksine göre ton)
  const named = [];
  for (const s of data.s) {
    const [ra, dec, mag, bv, name] = s;
    const p = proj(ra, dec);
    if (p.alt < 0) continue;
    const size = Math.max(.6, 5.6 - mag * .9);
    const [r, g, b] = starColor(bv);
    if (mag < 2.2) {
      const halo = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
      halo.addColorStop(0, `rgba(${r},${g},${b},.35)`); halo.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = halo; x.fillRect(p.x - size * 5, p.y - size * 5, size * 10, size * 10);
    }
    x.fillStyle = `rgba(${r},${g},${b},${Math.min(1, 1.15 - mag * .13)})`;
    x.beginPath(); x.arc(p.x, p.y, size, 0, Math.PI * 2); x.fill();
    if (name && mag < 1.6 && p.alt > 6) named.push({ ...p, name });
  }
  // takımyıldız adları
  x.font = '500 17px "Cormorant Garamond", serif'; x.textAlign = 'center';
  x.fillStyle = 'rgba(200,205,255,.55)';
  for (const [ra, dec, n, rank] of data.c) {
    if (rank > 2) continue;
    const p = proj(ra, dec);
    if (p.alt < 12) continue;
    x.fillText(n.toLocaleUpperCase('tr').split('').join(' '), p.x, p.y);
  }
  // parlak yıldız adları
  x.font = 'italic 600 19px "Cormorant Garamond", serif'; x.textAlign = 'left';
  x.fillStyle = 'rgba(255,240,225,.85)';
  for (const p of named) x.fillText(p.name, p.x + 9, p.y - 7);
  x.restore();

  // çerçeve: ince altın çift halka + yön harfleri
  x.strokeStyle = 'rgba(214,186,140,.85)'; x.lineWidth = 2;
  x.beginPath(); x.arc(cx, cy, R + 2, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(214,186,140,.35)'; x.lineWidth = 1;
  x.beginPath(); x.arc(cx, cy, R + 16, 0, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(214,186,140,.9)'; x.font = '600 20px "Manrope", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  [['K', 0, -1], ['G', 0, 1], ['D', -1, 0], ['B', 1, 0]].forEach(([t, dx, dy]) => x.fillText(t, cx + dx * (R + 38), cy + dy * (R + 38)));
  x.textBaseline = 'alphabetic';

  // yazılar
  x.fillStyle = '#f6eadf'; x.textAlign = 'center';
  x.font = '400 92px "Great Vibes", cursive';
  x.fillText(o.title || 'Bizim gökyüzümüz', cx, 1175, W - 120);
  x.fillStyle = 'rgba(214,186,140,.95)'; x.fillRect(cx - 60, 1212, 120, 1.5);
  x.fillStyle = 'rgba(246,234,223,.92)'; x.font = '600 26px "Manrope", sans-serif';
  x.fillText(o.sub, cx, 1262, W - 120);
  x.fillStyle = 'rgba(246,234,223,.7)'; x.font = '500 22px "Manrope", sans-serif';
  x.fillText(o.place, cx, 1302, W - 120);
  x.fillStyle = 'rgba(214,186,140,.75)'; x.font = '600 15px "Manrope", sans-serif';
  x.fillText('E ❤ R  ·  GERÇEK GÖKYÜZÜ  ·  HIPPARCOS KATALOĞU', cx, 1380);
}

/** Koordinatı "41.0082° K · 28.9784° D" biçimine çevir */
export const fmtCoord = (lat, lng) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'K' : 'G'} · ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'D' : 'B'}`;

// Hızlı seçim için Türkiye'nin büyük şehirleri (merkez koordinatları)
export const CITIES = [
  ['İstanbul', 41.0082, 28.9784], ['Ankara', 39.9334, 32.8597], ['İzmir', 38.4237, 27.1428], ['Bursa', 40.1885, 29.061],
  ['Antalya', 36.8969, 30.7133], ['Adana', 37.0, 35.3213], ['Konya', 37.8746, 32.4932], ['Gaziantep', 37.0662, 37.3833],
  ['Kayseri', 38.7312, 35.4787], ['Eskişehir', 39.7767, 30.5206], ['Samsun', 41.2867, 36.33], ['Trabzon', 41.0027, 39.7168],
  ['Diyarbakır', 37.9144, 40.2306], ['Mersin', 36.8, 34.6333], ['Denizli', 37.7765, 29.0864], ['Sakarya', 40.7569, 30.3781],
  ['Kocaeli', 40.8533, 29.8815], ['Muğla', 37.2153, 28.3636], ['Çanakkale', 40.1553, 26.4142], ['Erzurum', 39.9055, 41.2658],
  ['Malatya', 38.3552, 38.3095], ['Edirne', 41.6771, 26.5557], ['Bolu', 40.7395, 31.6116], ['Nevşehir', 38.6244, 34.7239],
];
