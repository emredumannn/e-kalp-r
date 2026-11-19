// =====================================================================
//  E ❤ R'nin Yaşayan Dünyası — Three.js (r128, projeye sabit sürüm olarak eklendi)
//  Bulutların arasında süzülen küçük bir ada: ev, ağaçlar, gölet, patika, çiçek tarhı,
//  anı köşesi, şövale. Mevcut kayıtlardan beslenir; kendi veritabanı yoktur.
//  Yerleşim kayıt kimliklerinden türetilir → her açılışta aynı dünya.
// =====================================================================
let threeP = null;
export function loadThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  threeP ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('../vendor/three.r128.min.js', import.meta.url).href;
    s.onload = () => res(window.THREE); s.onerror = () => rej(new Error('3D motoru yüklenemedi'));
    document.head.append(s);
  });
  return threeP;
}
const hash = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)) >>> 0) / 4294967296; };
const BLOOM = { gul: 0xe8728f, lale: 0xf394b4, papatya: 0xfffaf0, lavanta: 0xb098e4, sakayik: 0xf5a6be, ortanca: 0xb5c8f2 };

function timeOfDay(h) {
  if (h < 5 || h >= 20.5) return 'night';
  if (h < 7.5) return 'dawn';
  if (h < 17) return 'day';
  return 'dusk';
}
const SKY = {
  day: { top: '#6fa6e0', hor: '#efe3d2', fog: 0xd8e4ee, sun: 0xfff0d8, sunI: 1.35, hemi: [0xcfe2ff, 0x5f6f48, .42], exp: .82 },
  dawn: { top: '#6e86c4', hor: '#f8c8b4', fog: 0xf0d2c8, sun: 0xffc9a0, sunI: 1.05, hemi: [0xffd9c8, 0x5a5a48, .42], exp: .88 },
  dusk: { top: '#4a4f96', hor: '#f4a98c', fog: 0xd9a9a8, sun: 0xffb58a, sunI: 1.0, hemi: [0xf0b8c8, 0x4a4040, .4], exp: .88 },
  night: { top: '#0b1030', hor: '#2f2a5a', fog: 0x1b1d3c, sun: 0x9fb4ff, sunI: .32, hemi: [0x3d4a85, 0x141420, .32], exp: .9 },
};

/**
 * @param {HTMLElement} host
 * @param {{flowers:any[], memories:{id:string,title:string,url:string}[], drawingUrl?:string, starMaps:number, special:boolean, season:string}} data
 * @param {{reduce?:boolean, onGo:(hash:string)=>void, onPhoto:(m:any)=>void, onReady?:()=>void}} opts
 */
export async function createWorld(host, data, opts) {
  const THREE = await loadThree();
  const now = new Date(), hour = data.hour ?? now.getHours() + now.getMinutes() / 60;
  const tod = timeOfDay(hour), P = SKY[tod], night = tod === 'night';
  const season = data.season;

  // ---------- çizici ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let pr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = P.exp;
  host.append(renderer.domElement);
  renderer.domElement.className = 'world-canvas';

  const scene = new THREE.Scene();
  // gökyüzü: dikey degrade
  const skyCv = document.createElement('canvas'); skyCv.width = 4; skyCv.height = 256;
  const sg = skyCv.getContext('2d'), grd = sg.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, P.top); grd.addColorStop(.65, P.hor); grd.addColorStop(1, P.hor);
  sg.fillStyle = grd; sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCv); skyTex.encoding = THREE.sRGBEncoding;
  scene.background = skyTex;
  scene.fog = new THREE.Fog(P.fog, 34, 85);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 400);

  // ---------- ışıklar ----------
  const hemi = new THREE.HemisphereLight(P.hemi[0], P.hemi[1], P.hemi[2]); scene.add(hemi);
  const sun = new THREE.DirectionalLight(P.sun, P.sunI);
  const sunAng = tod === 'dawn' ? -.9 : tod === 'dusk' ? 2.3 : tod === 'night' ? 1.2 : .6;
  const sunEl = tod === 'day' ? 30 : tod === 'night' ? 26 : 10;
  sun.position.set(Math.cos(sunAng) * 30, sunEl, Math.sin(sunAng) * 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 });
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, night ? .06 : .08));

  // ---------- malzemeler ----------
  const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, flatShading: true, ...o });
  const grassCol = season === 'winter' ? 0xdfe8ee : season === 'autumn' ? 0x7f9e44 : season === 'summer' ? 0x5f9a48 : 0x6faa52;
  const mats = {
    grass: M(grassCol, { roughness: .95 }), dirt: M(0x8a6248), rock: M(0x9a8f88), rockDark: M(0x6f6460),
    wall: M(0xf6ece0), roof: M(0xb3555f), wood: M(0x8a5c3c), woodDark: M(0x6b4430), stone: M(0xcfc6bb),
    trunk: M(0x7a5236), leaf: M(season === 'autumn' ? 0xd9893a : season === 'winter' ? 0xdfe9ec : 0x6fa86a),
    leaf2: M(season === 'autumn' ? 0xe8b04e : season === 'spring' ? 0xf4b8c8 : season === 'winter' ? 0xffffff : 0x86bd77),
    water: new THREE.MeshStandardMaterial({ color: night ? 0x31407a : 0x86bfdc, roughness: .08, metalness: .25, transparent: true, opacity: .92 }),
    pad: M(0x6fa36b), soil: M(0x6e4a38), stem: M(0x5f9a64),
    glass: new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: night ? 1.4 : .15, roughness: .3 }),
    cloud: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: night ? .35 : .92 }),
    frame: M(0xf3e6d6), paper: new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: .9 }),
  };
  const add = (geo, mat, x = 0, y = 0, z = 0, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
    (o.parent ?? scene).add(m); return m;
  };
  const interactive = [];
  const tagGo = (obj, go, label) => { obj.traverse?.(c => { c.userData.go = go; c.userData.label = label; }); obj.userData.go = go; obj.userData.label = label; interactive.push(obj); };

  // ---------- ada ----------
  const world = new THREE.Group(); scene.add(world);
  const R0 = 10;
  // çimen yüzeyi: düz ve yumuşak gölgeli; arazi hissini ayrı yumuşak tümsekler verir
  const grassSmooth = new THREE.MeshStandardMaterial({ color: grassCol, roughness: .95, metalness: 0 });
  add(new THREE.CylinderGeometry(R0, R0 - .3, .6, 96, 1), grassSmooth, 0, 0, 0, { parent: world, cast: false });
  { const r = rng(3); [[-6.2, -.8, 2.8], [6.4, 5.4, 2.2], [-1.5, -6.6, 2.4], [7.2, -3.4, 1.6]].forEach(([x, z, s]) => {
    const m = add(new THREE.SphereGeometry(s, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), grassSmooth, x, .28, z, { parent: world, cast: false }); m.scale.y = .2 + r() * .08; }); }
  const body = new THREE.ConeGeometry(R0 - .2, 8.5, 28, 6);
  { const p = body.attributes.position, r = rng(9); for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 4.2 && y > -4.2) { p.setX(i, p.getX(i) * (1 + (r() - .5) * .16)); p.setZ(i, p.getZ(i) * (1 + (r() - .5) * .16)); p.setY(i, y + (r() - .5) * .4); } } body.computeVertexNormals(); }
  const bodyM = add(body, mats.dirt, 0, -4.55, 0, { parent: world }); bodyM.rotation.x = Math.PI;
  // kenar kayaları
  { const r = rng(21); for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = R0 - .4 - r() * .6, s = .25 + r() * .45; const m = add(new THREE.DodecahedronGeometry(s, 0), r() > .5 ? mats.rock : mats.stone, Math.cos(a) * d, .1, Math.sin(a) * d, { parent: world }); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = .6; } }
  // havada süzülen küçük kayalar
  const floaters = [];
  { const r = rng(44); for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = 11 + r() * 5, s = .4 + r() * .9; const g = new THREE.Group(); add(new THREE.DodecahedronGeometry(s, 0), mats.rockDark, 0, 0, 0, { parent: g }); add(new THREE.CylinderGeometry(s * .9, s * .9, .18, 8), mats.grass, 0, s * .45, 0, { parent: g, cast: false }); g.position.set(Math.cos(a) * d, -1.5 - r() * 4, Math.sin(a) * d); g.userData.ph = r() * 6; world.add(g); floaters.push(g); } }

  // ---------- ev ----------
  const house = new THREE.Group(); house.position.set(-3.2, .3, -2.4); house.rotation.y = .35; world.add(house);
  add(new THREE.BoxGeometry(3.4, 2.3, 2.7), mats.wall, 0, 1.15, 0, { parent: house });
  const roof = add(new THREE.ConeGeometry(2.75, 1.7, 4), mats.roof, 0, 3.15, 0, { parent: house }); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, .95);
  add(new THREE.BoxGeometry(.42, 1.1, .42), mats.stone, .9, 3.5, -.3, { parent: house });
  add(new THREE.BoxGeometry(.75, 1.3, .08), mats.wood, -.6, .65, 1.36, { parent: house });
  add(new THREE.SphereGeometry(.05, 8, 6), M(0xd8b26a, { metalness: .6, roughness: .3 }), -.35, .65, 1.42, { parent: house });
  [[.75, 1.35, 1.36], [-1.36 - .3, 1.35, 0]].forEach(([x, y, z], i) => {
    const w = add(new THREE.BoxGeometry(.7, .65, .06), mats.glass, x, y, z, { parent: house, cast: false });
    if (i === 1) { w.position.set(-1.71, 1.35, .2); w.rotation.y = Math.PI / 2; }
    add(new THREE.BoxGeometry(.8, .08, .12), mats.wood, w.position.x, y - .38, w.position.z + (i ? 0 : .04), { parent: house }).rotation.y = w.rotation.y;
  });
  add(new THREE.BoxGeometry(1.1, .12, .6), mats.stone, -.6, .06, 1.6, { parent: house });
  if (night) { const l = new THREE.PointLight(0xffb870, 1.1, 7, 2); l.position.set(0, 1.4, 2.2); house.add(l); }
  tagGo(house, '#/anilar', 'Evimiz · Anılarımız');
  // baca dumanı
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smoke = Array.from({ length: 7 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: .0, depthWrite: false, color: night ? 0x8890b0 : 0xffffff })); s.userData.t = i / 7; house.add(s); return s; });

  // ---------- ağaçlar ----------
  const trees = [];
  const tree = (x, z, s, seed) => {
    const r = rng(seed), g = new THREE.Group(); g.position.set(x, .3, z);
    // gövde + iki dal
    add(new THREE.CylinderGeometry(.11 * s, .19 * s, 1.7 * s, 8), mats.trunk, 0, .85 * s, 0, { parent: g });
    [-1, 1].forEach(k => { const b = add(new THREE.CylinderGeometry(.04 * s, .07 * s, .8 * s, 6), mats.trunk, k * .22 * s, 1.55 * s, 0, { parent: g }); b.rotation.z = -k * .7; });
    // taç: çok sayıda küçük yaprak kümesi, içten dışa açılan tonlar
    const n = 9 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = r() * .85 * s, hh = (1.9 + r() * 1.2) * s;
      const rad = (.42 + r() * .32) * s * (1 - rr / (2.2 * s));
      const m = add(new THREE.IcosahedronGeometry(rad, 1), r() > .45 ? mats.leaf2 : mats.leaf, Math.cos(a) * rr, hh, Math.sin(a) * rr, { parent: g });
      m.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    g.userData.ph = r() * 6; world.add(g); trees.push(g); return g;
  };
  [[-7.2, -4.2, 1.15, 1], [-6.6, 2.4, .95, 2], [6.8, -5.2, 1.2, 3], [7.6, 3.2, .9, 4], [1.4, -7.2, 1.05, 5], [-2.6, 7.4, .8, 6], [8.3, -.8, .75, 7]].forEach(a => tree(...a));

  // ---------- patika ----------
  { const pts = [[-3.6, 1.9], [-2.9, 2.9], [-1.9, 3.7], [-.6, 4.3], [.8, 4.4], [2.1, 3.9], [3.2, 3.2], [-4.4, 2.9], [-5.3, 3.9]]; const r = rng(12);
    pts.forEach(([x, z]) => { const m = add(new THREE.CylinderGeometry(.42 + r() * .12, .46, .1, 9), mats.stone, x, .32, z, { parent: world, cast: false }); m.rotation.y = r() * 3; }); }

  // ---------- gölet ----------
  const pond = new THREE.Group(); pond.position.set(4.3, .32, 1.6); world.add(pond);
  const water = add(new THREE.CircleGeometry(2.1, 48), mats.water, 0, .02, 0, { parent: pond, cast: false }); water.rotation.x = -Math.PI / 2; water.scale.set(1.25, 1, 1);
  { const r = rng(55); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, m = add(new THREE.DodecahedronGeometry(.2 + r() * .14, 0), mats.stone, Math.cos(a) * 2.6, .05, Math.sin(a) * 2.1, { parent: pond }); m.scale.y = .55; } }
  const pads = []; { const r = rng(66); for (let i = 0; i < 4; i++) { const m = add(new THREE.CircleGeometry(.28, 12, .3, Math.PI * 1.8), mats.pad, (r() - .5) * 2.4, .06, (r() - .5) * 1.8, { parent: pond, cast: false }); m.rotation.x = -Math.PI / 2; m.userData.ph = r() * 6; pads.push(m); if (i < 2) add(new THREE.SphereGeometry(.09, 8, 6), M(0xfbd3e0), m.position.x, .12, m.position.z, { parent: pond }); } }
  tagGo(pond, '#/dualar', 'Gölet · huzur köşesi');
  // bank
  { const b = new THREE.Group(); b.position.set(4.6, .3, -1.4); b.rotation.y = -.3; add(new THREE.BoxGeometry(1.6, .1, .45), mats.wood, 0, .5, 0, { parent: b }); add(new THREE.BoxGeometry(1.6, .45, .08), mats.wood, 0, .8, -.22, { parent: b }); [[-.7, .25, .15], [.7, .25, .15], [-.7, .25, -.15], [.7, .25, -.15]].forEach(p => add(new THREE.BoxGeometry(.08, .5, .08), mats.woodDark, ...p, { parent: b })); world.add(b); }

  // ---------- çiçek tarhı (gerçek çiçek kayıtları) ----------
  const bed = new THREE.Group(); bed.position.set(-1.2, .3, 3.0); world.add(bed);
  const bedSoil = add(new THREE.CylinderGeometry(2.6, 2.7, .14, 40), mats.soil, 0, .05, 0, { parent: bed, cast: false }); bedSoil.scale.z = .75;
  { const r = rng(77); for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; add(new THREE.DodecahedronGeometry(.13, 0), mats.stone, Math.cos(a) * 2.7, .1, Math.sin(a) * 2.02, { parent: bed }).scale.y = .6; } }
  const blooms = [];
  const days = data.flowers.map(f => f.day).sort();
  data.flowers.slice(-90).forEach(f => {
    const r = rng(hash(f.id)), a = r() * Math.PI * 2, d = Math.sqrt(r()) * 2.3;
    const g = new THREE.Group(); g.position.set(Math.cos(a) * d, .1, Math.sin(a) * d * .74);
    const stage = Math.min(3, days.filter(x => x > f.day).length);
    const h = [.12, .42, .75, 1.05][stage] * (.85 + r() * .3);
    if (stage === 0) add(new THREE.SphereGeometry(.09, 6, 4), mats.soil, 0, .02, 0, { parent: g });
    else {
      add(new THREE.CylinderGeometry(.025, .035, h, 6), mats.stem, 0, h / 2, 0, { parent: g, cast: false });
      add(new THREE.SphereGeometry(.07, 6, 4), mats.pad, .07, h * .45, 0, { parent: g, cast: false }).scale.set(1.6, .5, .8);
      const col = BLOOM[f.kind] ?? 0xe8728f;
      if (stage === 2) add(new THREE.SphereGeometry(.07, 8, 6), M(col), 0, h + .05, 0, { parent: g }).scale.y = 1.6;
      if (stage === 3) {
        const pm = M(col, { roughness: .6 });
        for (let k = 0; k < 6; k++) { const pa = k / 6 * Math.PI * 2; add(new THREE.SphereGeometry(.11, 8, 6), pm, Math.cos(pa) * .13, h + .05, Math.sin(pa) * .13, { parent: g }).scale.set(1.2, .55, 1.2); }
        add(new THREE.SphereGeometry(.075, 8, 6), M(f.kind === 'papatya' ? 0xf4c25b : 0xfff1d6), 0, h + .1, 0, { parent: g });
      }
    }
    g.userData.ph = r() * 6; g.userData.f = f; bed.add(g); blooms.push(g);
  });
  tagGo(bed, '#/bahce', 'Çiçek tarhımız · Bahçemiz');

  // ---------- anı köşesi: çit + fotoğraflar ----------
  const corner = new THREE.Group(); corner.position.set(2.8, .3, -5.6); corner.rotation.y = -.25; world.add(corner);
  add(new THREE.BoxGeometry(4.6, .12, .12), mats.wood, 0, 1.25, 0, { parent: corner });
  add(new THREE.BoxGeometry(4.6, .12, .12), mats.wood, 0, .55, 0, { parent: corner });
  [-2.2, -.73, .73, 2.2].forEach(x => add(new THREE.BoxGeometry(.14, 1.5, .14), mats.woodDark, x, .75, 0, { parent: corner }));
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  data.memories.slice(0, 4).forEach((m, i) => {
    const fr = new THREE.Group(); fr.position.set(-1.65 + i * 1.1, 1.0, .1); fr.rotation.z = (i % 2 ? .06 : -.05);
    add(new THREE.BoxGeometry(.86, .86, .05), mats.frame, 0, 0, 0, { parent: fr });
    const photo = add(new THREE.PlaneGeometry(.74, .74), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8 }), 0, 0, .03, { parent: fr, cast: false });
    loader.load(m.url, t => { t.encoding = THREE.sRGBEncoding; photo.material.map = t; photo.material.needsUpdate = true; }, undefined, () => {});
    fr.traverse(c => { c.userData.memory = m; }); fr.userData.memory = m; interactive.push(fr);
    corner.add(fr);
  });
  if (!data.memories.length) tagGo(corner, '#/anilar', 'Anı köşesi');

  // ---------- şövale: son çizim ----------
  const easel = new THREE.Group(); easel.position.set(6.4, .3, -2.8); easel.rotation.y = -.9; world.add(easel);
  [[-.35, 0], [.35, 0]].forEach(([x]) => { const l = add(new THREE.BoxGeometry(.07, 1.9, .07), mats.wood, x, .95, 0, { parent: easel }); l.rotation.z = x > 0 ? -.12 : .12; });
  add(new THREE.BoxGeometry(.07, 1.7, .07), mats.wood, 0, .85, -.35, { parent: easel }).rotation.x = -.25;
  const canvasM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 });
  const board = add(new THREE.BoxGeometry(.95, 1.25, .05), mats.paper, 0, 1.3, .05, { parent: easel });
  const art = add(new THREE.PlaneGeometry(.88, 1.17), canvasM, 0, 1.3, .081, { parent: easel, cast: false });
  if (data.drawingUrl) loader.load(data.drawingUrl, t => { t.encoding = THREE.sRGBEncoding; canvasM.map = t; canvasM.needsUpdate = true; }, undefined, () => {});
  board.rotation.x = art.rotation.x = -.12;
  tagGo(easel, '#/cizim', 'Şövale · Çizim defterimiz');

  // ---------- fenerler ----------
  [[-4.6, 2.2], [2.7, 4.7]].forEach(([x, z]) => {
    const g = new THREE.Group(); g.position.set(x, .3, z); world.add(g);
    add(new THREE.CylinderGeometry(.05, .07, 1.6, 6), mats.woodDark, 0, .8, 0, { parent: g });
    add(new THREE.BoxGeometry(.26, .3, .26), new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffc06a, emissiveIntensity: night ? 2 : .2 }), 0, 1.7, 0, { parent: g, cast: false });
    if (night) { const l = new THREE.PointLight(0xffc27a, .7, 5, 2); l.position.set(0, 1.7, 0); g.add(l); }
  });

  // ---------- özel gün süsü: çatıda ışık zinciri + kalp balon ----------
  const twinkles = [];
  if (data.special) {
    const bulbM = c => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 });
    for (let i = 0; i < 22; i++) { const t = i / 21, b = add(new THREE.SphereGeometry(.07, 8, 6), bulbM([0xffd27a, 0xff9fb8, 0xfff1d6][i % 3]), -1.9 + t * 3.8, 2.38 - Math.sin(t * Math.PI) * .25, 1.42, { parent: house, cast: false }); twinkles.push(b); }
    const heart = new THREE.Group(); const hm = M(0xe8577e, { roughness: .35, flatShading: false });
    add(new THREE.SphereGeometry(.38, 18, 14), hm, -.24, 0, 0, { parent: heart }); add(new THREE.SphereGeometry(.38, 18, 14), hm, .24, 0, 0, { parent: heart });
    const c = add(new THREE.ConeGeometry(.52, .75, 18), hm, 0, -.42, 0, { parent: heart }); c.rotation.z = Math.PI;
    heart.position.set(-1.2, 5.6, -2.0); heart.userData.balloon = true; world.add(heart); twinkles.push(heart);
  }

  // ---------- bulutlar ----------
  const clouds = [];
  { const r = rng(88); for (let i = 0; i < 9; i++) { const g = new THREE.Group(); const n = 4 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const m = add(new THREE.IcosahedronGeometry(.9 + r() * .9, 1), mats.cloud, k * 1.1 - n * .5, r() * .5, (r() - .5) * 1.2, { parent: g, cast: false, receive: false }); m.scale.y = .6; } const a = r() * Math.PI * 2, d = 18 + r() * 14; g.position.set(Math.cos(a) * d, -3 + r() * 9, Math.sin(a) * d); g.userData = { a, d, s: .0004 + r() * .0006 }; scene.add(g); clouds.push(g); } }

  // ---------- gece gökyüzü + yıldız haritalarımız ----------
  if (night || tod === 'dusk') {
    const n = 900, pos = new Float32Array(n * 3), r = rng(5);
    for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, ph = Math.acos(r() * .85 + .15), rad = 150; pos.set([Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad, Math.sin(ph) * Math.sin(th) * rad], i * 3); }
    const sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.Points(sg2, new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, sizeAttenuation: false, transparent: true, opacity: night ? .85 : .3, fog: false })));
  }
  const starSprites = [];
  { const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const rr = g.createRadialGradient(32, 32, 0, 32, 32, 32); rr.addColorStop(0, 'rgba(255,248,230,1)'); rr.addColorStop(.25, 'rgba(255,220,180,.6)'); rr.addColorStop(1, 'rgba(255,200,160,0)'); g.fillStyle = rr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const r = rng(17);
    for (let i = 0; i < Math.min(data.starMaps, 12); i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: night ? 1 : .55 }));
      const th = r() * Math.PI * 2; s.position.set(Math.cos(th) * 70, 34 + r() * 22, Math.sin(th) * 70); s.scale.setScalar(6); s.userData.ph = r() * 6;
      s.userData.go = '#/yildizlar'; s.userData.label = 'Yıldız haritalarımız'; scene.add(s); interactive.push(s); starSprites.push(s);
    } }

  // ---------- kamera kontrolü (sürükle döndür, iki parmakla yakınlaştır) ----------
  const cam = { th: .75, el: .4, dist: 26, target: new THREE.Vector3(0, .8, 0) };
  let idleAt = performance.now();
  const place = () => {
    const c = Math.cos(cam.el);
    camera.position.set(cam.target.x + Math.sin(cam.th) * c * cam.dist, cam.target.y + Math.sin(cam.el) * cam.dist, cam.target.z + Math.cos(cam.th) * c * cam.dist);
    camera.lookAt(cam.target);
  };
  const el = renderer.domElement, pts = new Map();
  let downAt = null, moved = 0, pinch = 0;
  const onDown = e => { try { el.setPointerCapture?.(e.pointerId); } catch {} pts.set(e.pointerId, [e.clientX, e.clientY]); downAt = [e.clientX, e.clientY, performance.now()]; moved = 0; idleAt = Infinity; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } };
  const onMove = e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy); cam.th -= dx * .006; cam.el = Math.min(1.05, Math.max(.22, cam.el + dy * .004)); }
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.dist = Math.min(fitDist * 1.25, Math.max(fitDist * .4, cam.dist * pinch / d)); pinch = d; moved += 10; }
    place();
  };
  const onUp = e => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = 0;
    if (!pts.size) idleAt = performance.now();
    if (downAt && moved < 8 && performance.now() - downAt[2] < 400) pick(e);
    if (!pts.size) downAt = null;
  };
  const onWheel = e => { e.preventDefault(); cam.dist = Math.min(fitDist * 1.25, Math.max(fitDist * .4, cam.dist * (1 + Math.sign(e.deltaY) * .08))); place(); };
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(interactive, true)[0];
    if (!hit) return;
    let o = hit.object; while (o && !o.userData.go && !o.userData.memory) o = o.parent;
    if (o?.userData.memory) opts.onPhoto(o.userData.memory);
    else if (o?.userData.go) opts.onGo(o.userData.go);
  }

  // ---------- boyut ----------
  // kamera: adanın tamamı (yarıçap ~12) ekrana sığacak uzaklık, ekran oranına göre
  let fitDist = 26;
  const resize = () => {
    const w = host.clientWidth || 360, h = host.clientHeight || 520;
    renderer.setSize(w, h, false); el.style.width = w + 'px'; el.style.height = h + 'px';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const vh = camera.fov * Math.PI / 360, hh = Math.atan(Math.tan(vh) * camera.aspect);
    fitDist = 12.5 / Math.tan(Math.min(vh, hh));
    cam.dist = fitDist;
    scene.fog.near = fitDist * 1.3; scene.fog.far = fitDist * 3.2;
    camera.far = fitDist * 6; camera.updateProjectionMatrix();
    place();
  };
  addEventListener('resize', resize); resize();

  // ---------- canlandırma döngüsü ----------
  let raf = 0, running = false, frames = 0, ft = 0, last = performance.now();
  const clock = new THREE.Clock();
  const tick = () => {
    const t = clock.getElapsedTime(), dt = performance.now() - last; last = performance.now();
    // ilk 90 karede yavaşsa kaliteyi düşür
    if (frames < 90) { frames++; ft += dt; if (frames === 90 && ft / 90 > 30) { renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } }
    if (!opts.reduce) {
      if (performance.now() - idleAt > 3500) { cam.th += .0009; place(); }
      trees.forEach(g => { g.rotation.z = Math.sin(t * .9 + g.userData.ph) * .025; g.rotation.x = Math.cos(t * .7 + g.userData.ph) * .015; });
      blooms.forEach(g => { g.rotation.z = Math.sin(t * 1.6 + g.userData.ph) * .09; });
      pads.forEach(p => { p.position.y = .06 + Math.sin(t * 1.3 + p.userData.ph) * .015; p.rotation.z = Math.sin(t * .4 + p.userData.ph) * .2; });
      water.material.opacity = .88 + Math.sin(t * 1.2) * .04;
      floaters.forEach(g => { g.position.y += Math.sin(t * .6 + g.userData.ph) * .003; g.rotation.y += .0015; });
      world.position.y = Math.sin(t * .45) * .12;
      clouds.forEach(c => { c.userData.a += c.userData.s; c.position.x = Math.cos(c.userData.a) * c.userData.d; c.position.z = Math.sin(c.userData.a) * c.userData.d; });
      smoke.forEach(s => { const k = (s.userData.t + t * .12) % 1; s.position.set(.9 + Math.sin(k * 6 + t) * .15 * k, 4.1 + k * 2.6, -.3); s.scale.setScalar(.35 + k * 1.1); s.material.opacity = (1 - k) * (night ? .25 : .45) * Math.min(1, k * 5); });
      twinkles.forEach((b, i) => { if (b.userData.balloon) { b.position.y = 5.6 + Math.sin(t * .8) * .25; b.rotation.y = Math.sin(t * .5) * .4; } else b.material.emissiveIntensity = 1 + Math.sin(t * 3 + i) * .7; });
      starSprites.forEach(s => s.material.opacity = (night ? .75 : .4) + Math.sin(t * 2 + s.userData.ph) * .25);
    }
    renderer.render(scene, camera);
  };
  const loop = () => { if (!running) return; tick(); raf = requestAnimationFrame(loop); };
  const start = () => { if (running) return; if (opts.reduce) { tick(); return; } running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
  document.addEventListener('visibilitychange', onVis);
  start(); tick(); opts.onReady?.();
  if (opts.reduce) setTimeout(tick, 600); // dokular yüklensin diye bir kez daha çiz

  return {
    destroy() {
      stop(); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis);
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('wheel', onWheel);
      scene.traverse(o => { o.geometry?.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); }); } });
      renderer.dispose(); el.remove();
    },
    hotspots: [
      ['#/anilar', 'Evimiz · Anılarımız'], ['#/bahce', 'Çiçek tarhımız'], ['#/cizim', 'Şövale · Çizimlerimiz'],
      ['#/yildizlar', 'Yıldız haritalarımız'], ['#/dualar', 'Gölet · huzur köşesi'],
    ],
  };
}
