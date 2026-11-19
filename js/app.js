import { api, DEMO } from './api.js';
import { START, TOGETHER, VAPID_PUBLIC_KEY } from './config.js';
import { CATEGORIES } from './dualar.js';
import { ic, flower, FLOWERS, nazar } from './icons.js';
import { TOT } from './oyunlar.js';
import { QUESTIONS } from './sorular.js';
import { loadSky, drawSky, fmtCoord, CITIES } from './yildiz.js';
import { DrawBoard } from './cizim.js';
import { GardenScene, flowerImages } from './bahce.js';
import { createWorld } from './dunya.js';

// ================================================================== yardımcılar
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DEFAULTS = {
  title: 'E ❤ R',
  start: START,
  together: TOGETHER,
  kicker: 'Seni ilk gördüğüm andan beri',
  love: '…ve her saniye seni daha çok seviyorum',
  jarTitle: 'Seni neden seviyorum',
  prayerBanner: 'Allah bizi her türlü kötü gözden ve sözden korusun',
};
const state = { me: null, admin: false, people: {}, partner: null, urls: {}, cache: {}, s: { ...DEFAULTS }, since: null };
const nameOf = id => id ? state.people[id]?.name ?? '…' : 'Hazır';
const partnerName = () => state.partner?.name ?? 'Sevgilin';
const isMine = row => row.author === state.me.id;
const PRIVATE = ['letters', 'surprises', 'quiz_questions'];
const canEdit = (table, row) => PRIVATE.includes(table) ? isMine(row) : isMine(row) || state.admin;
const brand = t => esc(t).replace('❤', '<span class="heart">❤</span>');

const fmtDate = d => d ? new Date(String(d).length === 10 ? d + 'T12:00' : d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtShort = d => new Date(String(d).length === 10 ? d + 'T12:00' : d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
const fmtDateTime = d => new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const localISO = d => new Date(+d - d.getTimezoneOffset() * 6e4).toISOString();
const todayISO = () => localISO(new Date()).slice(0, 10);
const dayOf = ts => localISO(new Date(ts)).slice(0, 10);
const toLocalInput = v => v ? localISO(new Date(v)).slice(0, 16) : '';
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} gün önce`;
  return fmtDate(d);
}
function until(d) {
  const s = Math.max(0, (new Date(d) - Date.now()) / 1000);
  const days = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  if (days > 0) return `${days} gün ${h} saat`;
  if (h > 0) return `${h} saat ${m} dakika`;
  return `${Math.max(1, m)} dakika`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
}

const HEART_FILL = ['#f4a7bf', '#e07a9c', '#f7c6d4', '#c95a80', '#fbd9e3'];
function hearts(n = 26) {
  if (document.documentElement.getAttribute('data-motion') === 'reduce') return;
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.className = 'fall';
    h.innerHTML = `<svg viewBox="0 0 24 24"><path fill="${HEART_FILL[i % 5]}" d="M12 20.5s-7.6-4.5-9.4-9.2C1.3 7.9 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.6 3.4 4.3 6.8-1.8 4.7-9.4 9.2-9.4 9.2z"/></svg>`;
    h.style.left = Math.random() * 100 + 'vw';
    h.style.animationDuration = 2.8 + Math.random() * 2.5 + 's';
    h.style.animationDelay = Math.random() * 1.2 + 's';
    const sz = 12 + Math.random() * 20; h.style.width = h.style.height = sz + 'px';
    document.body.append(h);
    setTimeout(() => h.remove(), 7000);
  }
}

function modal(html, cls = '') {
  const root = document.createElement('div');
  root.className = 'modal-back';
  root.innerHTML = `<div class="modal ${cls}"><button class="x" aria-label="Kapat">${ic('x')}</button>${html}</div>`;
  const close = () => { root.classList.remove('show'); setTimeout(() => root.remove(), 250); };
  root.addEventListener('click', e => { if (e.target === root || e.target.closest('.x')) close(); });
  document.body.append(root);
  requestAnimationFrame(() => root.classList.add('show'));
  root.close = close;
  return root;
}
const closeModals = () => $$('.modal-back').forEach(m => m.close?.() ?? m.remove());

// İmzalı fotoğraf linkleri 6 saat geçerli; 5 saatte bir yenile
let urlsAt = Date.now();
async function loadUrls(paths) {
  if (Date.now() - urlsAt > 5 * 3600e3) { state.urls = {}; urlsAt = Date.now(); }
  const need = [...new Set(paths.filter(p => p && !state.urls[p]))];
  if (need.length) Object.assign(state.urls, await api.signedUrls(need));
}
// Bir dosyayı sadece hiçbir yerde (anı, galeri, mesaj) kullanılmıyorsa depodan sil
async function removeUnused(paths) {
  paths = paths.filter(Boolean);
  if (!paths.length) return;
  try {
    const [msgs, phs, mems, cf, sm, dr] = await Promise.all([api.list('messages', 1000), api.list('photos', 1000), api.list('memories', 1000),
      api.list('comfort_items', 1000).catch(() => []), api.list('star_maps', 1000).catch(() => []), api.list('drawings', 1000).catch(() => [])]);
    const used = new Set([...msgs.flatMap(m => [m.photo, m.audio]), ...phs.map(p => p.path), ...mems.flatMap(m => m.photos ?? []),
      ...cf.map(c => c.media), ...sm.map(s => s.image_path), ...dr.map(d => d.image_path)]);
    const free = paths.filter(p => !used.has(p));
    if (free.length) await api.removeFiles(free);
  } catch {}
}
const img = p => state.urls[p] ? `<img src="${esc(state.urls[p])}" loading="lazy" alt="">` : `<div class="img-missing">${ic('image')}</div>`;

async function compress(file, max = 1600, q = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Fotoğraf okunamadı')); i.src = url; });
    const r = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
async function uploadAll(files, btn) {
  const paths = [];
  for (let i = 0; i < files.length; i++) {
    btn.textContent = `Fotoğraf yükleniyor ${i + 1}/${files.length}…`;
    paths.push(await api.upload(await compress(files[i])));
  }
  return paths;
}

const acts = (table, row) => canEdit(table, row)
  ? `<span class="acts"><button class="icon-btn" data-edit="${table}:${row.id}" aria-label="Düzenle">${ic('edit')}</button><button class="icon-btn danger" data-del="${table}:${row.id}" aria-label="Sil">${ic('trash')}</button></span>`
  : '';
const cache = (table, rows) => { state.cache[table] = rows; return rows; };

// ================================================================== içerik şeması
const EMOJIS = ['😍', '🥰', '😊', '🤗', '😌', '😴', '🥺', '😔', '😤', '🤒'];
const SCHEMA = {
  memories: { one: 'Anı', icon: 'book', label: r => r.title, fields: [
    { k: 'title', l: 'Başlık', req: 1, ph: 'İlk kahvemiz' },
    { k: 'happened_on', l: 'Tarih', t: 'date', req: 1, def: todayISO, half: 1 },
    { k: 'location', l: 'Yer', ph: 'İsteğe bağlı', half: 1 },
    { k: 'body', l: 'Anlat', t: 'textarea', rows: 5, ph: 'O gün…' },
    { k: 'photos', l: 'Fotoğraflar', t: 'photos' },
  ] },
  letters: { one: 'Mektup', icon: 'mail', label: r => r.title, fields: [
    { k: 'title', l: 'Başlık', req: 1, ph: 'Sana' },
    { k: 'body', l: 'Mektubun', t: 'textarea', rows: 10, req: 1 },
    { k: 'open_at', l: 'Belli bir zamanda açılsın (boş bırakırsan hemen okunur)', t: 'datetime' },
  ] },
  photos: { one: 'Fotoğraf', icon: 'image', label: r => r.caption || r.album, fields: [
    { k: 'album', l: 'Albüm', req: 1, def: 'Genel', list: 'albums' },
    { k: 'taken_on', l: 'Tarih', t: 'date', half: 1 },
    { k: 'caption', l: 'Not', half: 1 },
  ] },
  reasons: { one: 'Sebep', icon: 'jar', label: r => r.text, fields: [
    { k: 'text', l: 'Seni seviyorum çünkü…', t: 'textarea', rows: 3, req: 1 },
  ] },
  prayers: { one: 'Dua', icon: 'moon', label: r => r.title, fields: [
    { k: 'cat', l: 'Kategori', t: 'select', opts: CATEGORIES.map(c => [c.key, c.name]), def: 'bizim' },
    { k: 'title', l: 'Başlık', req: 1 },
    { k: 'note', l: 'Kısa açıklama', ph: 'Ne zaman okunur, kaynağı…' },
    { k: 'ar', l: 'Arapça metin', t: 'textarea', rows: 3, rtl: 1 },
    { k: 'tr', l: 'Okunuşu', t: 'textarea', rows: 3 },
    { k: 'body', l: 'Anlamı / duanın kendisi', t: 'textarea', rows: 5, req: 1 },
    { k: 'target', l: 'Tesbih hedefi', t: 'number', def: 1, half: 1 },
    { k: 'sort', l: 'Sıra', t: 'number', def: 500, half: 1 },
  ] },
  prayer_logs: { one: 'Dua kaydı', icon: 'moon', label: r => `${r.prayer_title} · ${r.count} kez`, fields: [
    { k: 'prayer_title', l: 'Dua', req: 1 },
    { k: 'count', l: 'Kaç kez', t: 'number', def: 1 },
  ] },
  moods: { one: 'Ruh hali', icon: 'smile', label: r => `${r.emoji} ${r.note ?? ''}`, fields: [
    { k: 'emoji', l: 'Nasılsın?', t: 'emoji', req: 1 },
    { k: 'note', l: 'Bir not', ph: 'İsteğe bağlı' },
  ] },
  firsts: { one: 'İlk', icon: 'flag', label: r => r.title, fields: [
    { k: 'title', l: 'İlk…', req: 1, ph: 'İlk sinemamız' },
    { k: 'happened_on', l: 'Tarih', t: 'date', def: todayISO },
    { k: 'note', l: 'Not', t: 'textarea', rows: 3 },
  ] },
  todos: { one: 'Hayal', icon: 'check', label: r => r.text, fields: [
    { k: 'text', l: 'Birlikte…', req: 1, ph: 'Kapadokya’da balona binmek' },
    { k: 'note', l: 'Not', t: 'textarea', rows: 2 },
    { k: 'done', l: 'Bunu yaptık', t: 'check' },
  ] },
  songs: { one: 'Şarkı', icon: 'music', label: r => `${r.title}${r.artist ? ' · ' + r.artist : ''}`, fields: [
    { k: 'title', l: 'Şarkı', req: 1, half: 1 },
    { k: 'artist', l: 'Sanatçı', half: 1 },
    { k: 'url', l: 'Spotify ya da YouTube linki', t: 'url', ph: 'https://open.spotify.com/track/…' },
    { k: 'note', l: 'Neden bizim şarkımız?', t: 'textarea', rows: 3 },
  ] },
  places: { one: 'Yer', icon: 'pin', label: r => r.name, fields: [
    { k: 'name', l: 'Yerin adı', req: 1 },
    { k: 'visited_on', l: 'Tarih', t: 'date', half: 1 },
    { k: 'note', l: 'Not', half: 1 },
    { k: 'lat', l: 'Enlem', t: 'number', req: 1, half: 1 },
    { k: 'lng', l: 'Boylam', t: 'number', req: 1, half: 1 },
  ] },
  surprises: { one: 'Sürpriz', icon: 'gift', label: r => r.message, fields: [
    { k: 'message', l: 'Açılışta görecek olduğu mesaj', t: 'textarea', rows: 5, req: 1, ph: 'Bugün çok güzeldin, aklımdan çıkmıyorsun.' },
  ] },
  greetings: { one: 'Selam', icon: 'sun', label: r => `${r.kind === 'morning' ? 'Günaydın' : 'İyi geceler'} · ${r.text}`, fields: [
    { k: 'kind', l: 'Ne zaman', t: 'select', opts: [['morning', 'Sabah (05:00–12:00)'], ['night', 'Gece (20:00–05:00)']], def: 'morning' },
    { k: 'text', l: 'Not', t: 'textarea', rows: 3, req: 1 },
  ] },
  thoughts: { one: 'Düşünce', icon: 'heart', label: r => `${fmtDateTime(r.created_at)}`, fields: [] },
  flowers: { one: 'Çiçek', icon: 'flower', label: r => `${FLOWERS.find(f => f[0] === r.kind)?.[1] ?? r.kind} · ${fmtDate(r.day)}`, fields: [
    { k: 'kind', l: 'Çiçek', t: 'select', opts: FLOWERS.map(([k, n]) => [k, n]) },
    { k: 'day', l: 'Gün', t: 'date', req: 1 },
    { k: 'note', l: 'Not' },
  ] },
  coupons: { one: 'Kupon', icon: 'ticket', label: r => r.title, fields: [
    { k: 'title', l: 'Kupon', req: 1, ph: 'Film gecesi' },
    { k: 'description', l: 'Açıklama', t: 'textarea', rows: 3, ph: 'Filmi sen seçersin, patlamış mısır benden.' },
  ] },
  quiz_questions: { one: 'Soru', icon: 'quiz', label: r => r.question, fields: [], custom: r => quizForm(r) },
  messages: { one: 'Mesaj', icon: 'chat', label: r => r.body || (r.photo ? 'Fotoğraf' : 'Sesli mesaj'), fields: [
    { k: 'body', l: 'Mesaj', t: 'textarea', rows: 4 },
  ] },
  tot_questions: { one: 'Soru', icon: 'split', label: r => `${r.a} ya da ${r.b}`, fields: [
    { k: 'a', l: 'Birinci seçenek', req: 1, ph: 'Deniz', half: 1 },
    { k: 'b', l: 'İkinci seçenek', req: 1, ph: 'Dağ', half: 1 },
  ] },
  star_maps: { one: 'Yıldız haritası', icon: 'star', label: r => r.title, fields: [
    { k: 'title', l: 'Başlık', req: 1 },
    { k: 'location_label', l: 'Yer adı' },
    { k: 'note', l: 'Not', t: 'textarea', rows: 3 },
  ] },
  drawings: { one: 'Çizim', icon: 'brush', label: r => r.title, fields: [{ k: 'title', l: 'Adı', req: 1 }] },
  shared_media: { one: 'Film/kitap', icon: 'film', label: r => `${r.title} · ${MEDIA_KIND[r.kind]?.[0] ?? ''}`, fields: [
    { k: 'kind', l: 'Tür', t: 'select', opts: [['film', 'Film'], ['dizi', 'Dizi'], ['kitap', 'Kitap']], def: 'film' },
    { k: 'title', l: 'Adı', req: 1, ph: 'Notebook' },
    { k: 'status', l: 'Durum', t: 'select', opts: [['plan', 'Sırada'], ['devam', 'Devam ediyor'], ['bitti', 'Bitti']], def: 'plan', half: 1 },
    { k: 'finished_on', l: 'Bitirdiğimiz gün', t: 'date', half: 1 },
    { k: 'note', l: 'Not', ph: 'İsteğe bağlı' },
  ] },
  media_quizzes: { one: 'Test', icon: 'quiz', label: r => r.title, fields: [], custom: () => toast('Testler gönderildikten sonra değiştirilemez; silip yeniden hazırlayabilirsin') },
  comfort_items: { one: 'Destek kartı', icon: 'heart', label: r => `${r.kind} · ${r.body ?? ''}`, fields: [], custom: () => toast('Kartı silip yeniden hazırlayabilirsin') },
  memory_scores: { one: 'Skor', icon: 'cards', label: r => `${mmss(r.seconds)} · ${r.moves} hamle · ${r.pairs} çift`, fields: [] },
  special_days: { one: 'Özel gün', icon: 'calendar', label: r => r.title, fields: [
    { k: 'title', l: 'Ne günü?', req: 1, ph: 'Rabia’nın doğum günü' },
    { k: 'day', l: 'Tarih', t: 'date', req: 1 },
    { k: 'yearly', l: 'Her yıl tekrarlansın', t: 'check', def: true },
    { k: 'note', l: 'Not', t: 'textarea', rows: 2 },
  ] },
};

function fieldHTML(f, row) {
  const raw = row?.[f.k];
  const v = raw ?? (row ? '' : (typeof f.def === 'function' ? f.def() : f.def ?? ''));
  const req = f.req ? 'required' : '';
  const ph = f.ph ? `placeholder="${esc(f.ph)}"` : '';
  switch (f.t) {
    case 'textarea':
      return `<label>${esc(f.l)}<textarea name="${f.k}" rows="${f.rows || 4}" ${req} ${ph} ${f.rtl ? 'dir="rtl" class="ar-input"' : ''}>${esc(v)}</textarea></label>`;
    case 'select':
      return `<label>${esc(f.l)}<select name="${f.k}">${f.opts.map(([val, txt]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(txt)}</option>`).join('')}</select></label>`;
    case 'check':
      return `<label class="check"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.l)}</label>`;
    case 'emoji':
      return `<label>${esc(f.l)}</label><div class="emoji-pick">${EMOJIS.map(e => `<button type="button" data-emo="${e}" class="${e === v ? 'on' : ''}">${e}</button>`).join('')}</div>
        <input type="hidden" name="${f.k}" value="${esc(v)}">`;
    case 'photos':
      return `<label>${esc(f.l)}</label>
        <div class="previews existing">${(raw || []).map(p => `<button type="button" class="keep" data-path="${esc(p)}">${img(p)}<span>${ic('x')}</span></button>`).join('')}</div>
        <label class="file">${ic('camera')} Fotoğraf ekle<input type="file" accept="image/*" multiple></label>
        <div class="previews fresh"></div>`;
    case 'datetime':
      return `<label>${esc(f.l)}<input type="datetime-local" name="${f.k}" value="${toLocalInput(raw)}"></label>`;
    case 'number':
      return `<label>${esc(f.l)}<input type="number" step="any" inputmode="decimal" name="${f.k}" value="${esc(v)}" ${req}></label>`;
    default:
      return `<label>${esc(f.l)}<input type="${f.t || 'text'}" name="${f.k}" value="${esc(v)}" ${req} ${ph} ${f.list ? `list="${f.list}"` : ''}></label>`;
  }
}
function fieldsHTML(fields, row) {
  let out = '';
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].half && fields[i + 1]?.half) { out += `<div class="row">${fieldHTML(fields[i], row)}${fieldHTML(fields[i + 1], row)}</div>`; i++; }
    else out += fieldHTML(fields[i], row);
  }
  return out;
}

/** Her tablo için ortak ekle/düzenle formu */
async function editForm(table, row = null, { defaults = {}, extra = {}, after, heading } = {}) {
  const sc = SCHEMA[table];
  if (sc.custom) return sc.custom(row);
  if (!sc.fields.length) return toast('Bu kayıt düzenlenemez, sadece silinebilir');
  const base = row ?? (Object.keys(defaults).length ? { ...Object.fromEntries(sc.fields.map(f => [f.k, typeof f.def === 'function' ? f.def() : f.def])), ...defaults } : null);
  if (base?.photos) await loadUrls(base.photos);
  const m = modal(`<h2>${heading ?? `${row ? 'Düzenle' : 'Yeni'} · ${sc.one.toLocaleLowerCase('tr')}`}</h2>
    <form>${fieldsHTML(sc.fields, base)}<p class="err"></p><button class="btn">Kaydet</button></form>`, table === 'letters' ? 'paper-modal' : '');
  const form = $('form', m);

  $$('[data-emo]', form).forEach(b => b.onclick = () => {
    $$('[data-emo]', form).forEach(x => x.classList.toggle('on', x === b));
    form.elements.emoji.value = b.dataset.emo;
  });
  const removed = new Set();
  $$('.keep', form).forEach(b => b.onclick = () => {
    const p = b.dataset.path;
    removed.has(p) ? removed.delete(p) : removed.add(p);
    b.classList.toggle('gone', removed.has(p));
  });
  const fileInput = $('input[type=file]', form);
  if (fileInput) fileInput.onchange = () => {
    $('.fresh', form).innerHTML = [...fileInput.files].map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join('');
  };

  form.onsubmit = async e => {
    e.preventDefault();
    const b = $('button.btn', form), err = $('.err', form);
    const data = {};
    for (const f of sc.fields) {
      const el = form.elements[f.k];
      if (f.t === 'photos') continue;
      if (f.t === 'check') data[f.k] = el.checked;
      else if (f.t === 'number') data[f.k] = el.value === '' ? null : Number(el.value);
      else if (f.t === 'datetime') data[f.k] = el.value ? new Date(el.value).toISOString() : null;
      else { const v = el.value.trim(); data[f.k] = v === '' ? null : v; }
      if (f.req && (data[f.k] === null || data[f.k] === '')) { err.textContent = `“${f.l}” boş olamaz`; return; }
    }
    if (table === 'letters' && data.open_at && !row && new Date(data.open_at) <= new Date()) { err.textContent = 'Açılma zamanı gelecekte olmalı'; return; }
    if (table === 'todos') data.done_at = data.done ? (row?.done_at ?? new Date().toISOString()) : null;
    b.disabled = true;
    try {
      if (sc.fields.some(f => f.t === 'photos')) {
        const fresh = await uploadAll([...(fileInput?.files ?? [])], b);
        data.photos = [...(base?.photos ?? []).filter(p => !removed.has(p)), ...fresh];
      }
      b.textContent = 'Kaydediliyor…';
      if (row) await api.update(table, row.id, data);
      else await api.insert(table, { ...data, ...extra });
      if (removed.size && row) await removeUnused([...removed]);
      m.close();
      if (!row) hearts(12);
      toast(row ? 'Değişiklik kaydedildi' : `${sc.one} eklendi`);
      after ? after() : rerender();
    } catch (er) { err.textContent = er.message; b.disabled = false; b.textContent = 'Kaydet'; }
  };
  return m;
}

document.addEventListener('click', async e => {
  const ed = e.target.closest('[data-edit]');
  if (ed) {
    e.preventDefault(); e.stopPropagation();
    const [t, id] = ed.dataset.edit.split(':');
    const r = state.cache[t]?.find(x => x.id === id);
    if (r) { closeModals(); editForm(t, r); }
    return;
  }
  const de = e.target.closest('[data-del]');
  if (de) {
    e.preventDefault(); e.stopPropagation();
    const [t, id] = de.dataset.del.split(':');
    const r = state.cache[t]?.find(x => x.id === id);
    if (!r || !confirm(`Bu ${SCHEMA[t].one.toLocaleLowerCase('tr')} silinsin mi? Geri alınamaz.`)) return;
    try {
      await api.remove(t, id);
      if (t === 'memories') await removeUnused(r.photos ?? []);
      if (t === 'photos') await removeUnused([r.path]);
      if (t === 'messages') await removeUnused([r.photo, r.audio]);
      if (t === 'comfort_items') await removeUnused([r.media]);
      if (t === 'star_maps' || t === 'drawings') await removeUnused([r.image_path]);
      if (t === 'star_maps' && location.hash.startsWith('#/yildizlar/')) location.hash = '#/yildizlar';
      closeModals(); toast('Silindi'); rerender();
    } catch (er) { toast(er.message); }
  }
});

function lightbox(path, caption = '', meta = '', actions = '') {
  modal(`<div class="lb-img">${img(path)}</div>
    ${caption ? `<p class="lb-cap">${esc(caption)}</p>` : ''}
    ${meta ? `<p class="muted center small">${esc(meta)}</p>` : ''}
    ${actions ? `<p class="center">${actions}</p>` : ''}`, 'lightbox');
}

// ================================================================== sayaç
let START_D = new Date(START);        // ilk görüş: büyük sayaç
let TOGETHER_D = new Date(TOGETHER);  // sevgili olduğumuz an: dönüm noktaları
const addMonthsFrom = (base, n) => new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes()));
const addMonths = n => addMonthsFrom(TOGETHER_D, n);
function elapsed(base = START_D) {
  const now = Date.now();
  const s = Math.floor(Math.max(0, now - base) / 1000);
  let n = 0; while (addMonthsFrom(base, n + 1) <= now) n++;
  return {
    d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60,
    months: n, years: Math.floor(n / 12), monthsRest: n % 12, daysAfterMonths: Math.max(0, Math.floor((now - addMonthsFrom(base, n)) / 864e5)),
  };
}
const togetherDays = () => Math.max(0, Math.floor((new Date(todayISO() + 'T12:00') - new Date(dayOf(TOGETHER_D) + 'T12:00')) / 864e5)) + 1;
function nextMilestone() {
  const e = elapsed(TOGETHER_D), nm = e.months + 1;
  const monthly = { at: addMonths(nm), label: nm % 12 === 0 ? `${nm / 12}. yılımıza` : `${nm}. ayımıza` };
  const k = Math.floor(e.d / 100) + 1;
  const hundred = { at: new Date(+TOGETHER_D + k * 100 * 864e5), label: `${k * 100}. günümüze` };
  return monthly.at < hundred.at ? monthly : hundred;
}
function isMilestoneToday() {
  const e = elapsed(TOGETHER_D), t = todayISO();
  if (e.months >= 1 && dayOf(addMonths(e.months)) === t) return e.months % 12 === 0 ? `${e.months / 12}. yılımız` : `${e.months}. ayımız`;
  if (e.d > 0 && e.d % 100 === 0) return `${e.d}. günümüz`;
  return null;
}
const pad = n => String(n).padStart(2, '0');
function tick() {
  const e = elapsed();
  const big = $('#counter');
  if (big) {
    $('[data-c=d]', big).textContent = e.d;
    $('[data-c=h]', big).textContent = pad(e.h);
    $('[data-c=m]', big).textContent = pad(e.m);
    $('[data-c=s]', big).textContent = pad(e.s);
    $('[data-c=cal]', big).textContent = [e.years && `${e.years} yıl`, e.monthsRest && `${e.monthsRest} ay`, e.months && `${e.daysAfterMonths} gün`].filter(Boolean).join(' ');
    const nx = nextMilestone();
    $('[data-c=next]', big).textContent = `${nx.label} ${until(nx.at)} kaldı`;
    const td = $('[data-c=tog]', big);
    if (td) td.innerHTML = Date.now() < TOGETHER_D
      ? `Sevgili olmamıza ${until(TOGETHER_D)} kaldı`
      : `${new Date(dayOf(TOGETHER_D) + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}’dan beri sevgiliyiz · <b>${togetherDays()}.</b> günümüz`;
  }
  const mini = $('#mini');
  if (mini) mini.textContent = `${e.d} gün ${pad(e.h)}:${pad(e.m)}:${pad(e.s)}`;
}

// ================================================================== giriş
function showLogin(err = '', email = '') {
  document.body.className = 'login-page';
  document.body.innerHTML = `
  <div class="login">
    <div class="logo">${brand(DEFAULTS.title)}</div>
    <p class="muted">Sadece ikimize ait küçük bir dünya</p>
    <form id="lf" class="card">
      <label>E-posta<input type="email" name="email" autocomplete="username" value="${esc(email)}" required></label>
      <label>Şifre<input type="password" name="password" autocomplete="current-password" required></label>
      <p class="err">${esc(err)}</p>
      <button class="btn">Giriş yap</button>
    </form>
  </div>`;
  $('#lf').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), b = $('button', e.target);
    b.disabled = true; b.textContent = 'Giriş yapılıyor…';
    try { await enter(await api.signIn(f.get('email').trim(), f.get('password'))); }
    catch (er) { showLogin(er.message, f.get('email').trim()); }
  });
}

async function loadSettings() {
  state.s = { ...DEFAULTS, ...(await api.settings()) };
  START_D = new Date(state.s.start || START);
  if (isNaN(START_D)) START_D = new Date(START);
  TOGETHER_D = new Date(state.s.together || TOGETHER);
  if (isNaN(TOGETHER_D)) TOGETHER_D = new Date(TOGETHER);
}

async function enter(user) {
  state.me = user;
  const [profs] = await Promise.all([api.profiles(), loadSettings()]);
  const me = profs.find(p => p.id === user.id);
  if (!me) {
    document.body.innerHTML = `<div class="login"><div class="logo">${brand(DEFAULTS.title)}</div>
      <div class="card"><p>Hesabın henüz bu siteye tanımlanmamış.</p><p class="muted">Kurulum rehberindeki “profiles” adımını tamamlayın.</p>
      <button class="btn" id="lo">Çıkış yap</button></div></div>`;
    $('#lo').onclick = async () => { await api.signOut(); location.reload(); };
    return;
  }
  state.admin = !!me.is_admin;
  state.people = Object.fromEntries(profs.map(p => [p.id, p]));
  state.partner = profs.find(p => p.id !== user.id) ?? null;
  // Görünüm tercihleri hesaba bağlı: hesapta yoksa bu cihazdakini hesaba taşı
  const acct = state.people[user.id].prefs ?? {};
  if (!Object.keys(acct).length && Object.keys(localPrefs()).length) {
    state.people[user.id].prefs = { ...localPrefs() };
    api.rpc('set_my_prefs', { prefs: state.people[user.id].prefs }).catch(() => {});
  }
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(myPrefs())); } catch {}
  applyTheme();
  try { const prev = await api.rpc('touch_seen'); state.since = prev ? new Date(prev) : null; } catch {}
  try { navigator.clearAppBadge?.(); } catch {}
  shell();
  showLock();
  addEventListener('hashchange', route);
  await route();
  setInterval(tick, 1000);
  refreshBell();
  refreshChatBadge();
  startRealtime();
  syncPush();
  await showSurprises();
  const ms = isMilestoneToday();
  if (ms && sessionStorage.getItem('ms') !== todayISO()) {
    try { sessionStorage.setItem('ms', todayISO()); } catch {}
    setTimeout(() => { hearts(45); toast(`Bugün ${ms}`); }, 600);
  }
}

// ---------------------------------------------------------------- açılış sürprizi
async function showSurprises() {
  let list = [];
  try { list = (await api.list('surprises')).filter(s => s.recipient === state.me.id && !s.shown_at).reverse(); } catch { return; }
  for (const s of list) {
    await new Promise(done => {
      const o = document.createElement('div');
      o.className = 'surprise';
      o.innerHTML = `<div class="surprise-card">
          <p class="surprise-kicker">${esc(nameOf(s.author))}’dan sana</p>
          <p class="surprise-msg">${esc(s.message)}</p>
          <p class="surprise-sign">— ${esc(nameOf(s.author))}</p>
          <button class="btn light">Ben de seni seviyorum</button>
        </div>`;
      document.body.append(o);
      requestAnimationFrame(() => o.classList.add('show'));
      hearts(40);
      const iv = setInterval(() => hearts(10), 2600);
      $('button', o).onclick = async () => {
        clearInterval(iv);
        try { await api.rpc('mark_surprise_shown', { sid: s.id }); } catch {}
        o.classList.remove('show'); setTimeout(() => { o.remove(); done(); }, 500);
      };
    });
  }
}

// ================================================================== iskelet
const TABS = [['', 'home', 'Biz'], ['mektuplar', 'mail', 'Mektup'], ['dunya', 'island', 'Dünyamız'], ['galeri', 'image', 'Galeri'], ['dualar', 'moon', 'Dualar'], ['daha', 'grid', 'Daha']];
function shell() {
  document.body.className = '';
  document.title = state.s.title;
  document.body.innerHTML = `
    ${DEMO ? '<div class="demo">Demo modu · veriler kaydedilmez</div>' : ''}
    <header class="top">
      <a href="#/" class="brand">${brand(state.s.title)}</a>
      <span id="mini"></span>
      <a class="icon-btn bell" href="#/fisilti" aria-label="Fısıltı">${ic('chat')}<span class="chat-n bell-n" hidden></span></a>
      <button class="icon-btn bell" id="bell" aria-label="Yenilikler">${ic('bell')}<span class="bell-n" id="bellN" hidden></span></button>
      ${state.admin ? `<a class="icon-btn" href="#/admin" aria-label="Admin paneli">${ic('shield')}</a>` : ''}
      <button class="icon-btn" id="settings" aria-label="Hesap">${ic('user')}</button>
    </header>
    <main id="view"></main>
    <nav class="tabs">${TABS.map(([h, i, t]) => `<a href="#/${h}" data-tab="${h}">${ic(i)}<span>${t}</span></a>`).join('')}</nav>`;
  $('#settings').onclick = settings;
  $('#bell').onclick = openBell;
  tick();
  applyTheme();   // kar katmanı vb. yeniden kurulsun
}

const MORE = ['ruh-hali', 'ilkler', 'yapacaklar', 'sarkilar', 'muzik', 'harita', 'kavanoz', 'admin', 'bahce', 'kuponlar', 'test',
  'ozel-gunler', 'surprizler', 'selamlar', 'bumuo', 'hafiza', 'ozet', 'gunun-sorusu', 'zor-gun', 'yildizlar', 'cizim', 'sampiyona', 'anilar'];
const ROUTES = {
  '': home, anilar: memories, mektuplar: letters, galeri: gallery, dualar: prayers, daha: more,
  'ruh-hali': moods, ilkler: firsts, yapacaklar: todos, sarkilar: songs, muzik: songs, harita: map, kavanoz: jar, admin,
  bahce: gardenLive, kuponlar: coupons, yildizlar: starsPage, cizim: drawPage, sampiyona: champPage, dunya: worldPage, test: quiz, 'ozel-gunler': specialDays, surprizler: surprises, selamlar: greetings,
  fisilti: chat, bumuo: thisOrThat, hafiza: memoryGame, ozet: wraps, 'gunun-sorusu': dailyPage, 'zor-gun': comfort,
};
async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const key = parts[0];
  let fn = ROUTES[key] ?? home;
  if (fn === admin && !state.admin) fn = home;
  const tab = key === 'fisilti' ? null : MORE.includes(key) ? 'daha' : ROUTES[key] ? key : '';
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  document.body.classList.toggle('is-home', fn === home);
  document.body.classList.toggle('is-chat', fn === chat);
  document.body.classList.toggle('is-world', fn === worldPage);
  try { pageCleanup?.(); } catch {}
  pageCleanup = null;
  if (fn !== chat) { chatRefresh = null; clearInterval(chatPoll); playing?.audio.pause(); playing = null; }
  $$('.modal-back').forEach(m => m.remove());
  const v = $('#view');
  v.innerHTML = '<div class="loading"><span class="heart beat">❤</span></div>';
  scrollTo(0, 0);
  try { await fn(v, parts.slice(1)); tick(); }
  catch (e) { v.innerHTML = `<div class="card"><p>Bir şeyler ters gitti.</p><p class="muted">${esc(e.message)}</p></div>`; }
}
const rerender = () => route();
const head = (title, btn = '', sub = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted small sub-head">${sub}</p>` : ''}</div>${btn}</div>`;
const addBtn = (id = 'add', txt = 'Ekle') => `<button class="btn small" id="${id}">${ic('plus')}${txt}</button>`;
const back = (href = '#/daha', txt = 'Daha') => `<a class="back" href="${href}">${ic('back')}${txt}</a>`;
const empty = (icon, txt) => `<div class="card empty">${ic(icon, 'xl')}<p>${txt}</p></div>`;
const sectionTitle = (icon, txt, link = '') => `<div class="sec-title">${ic(icon)}<h3>${txt}</h3>${link}</div>`;

// ================================================================== ana sayfa
function greetingSlot() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 20 || h < 5) return 'night';
  return null;
}
function dailyPick(arr) {
  if (!arr.length) return null;
  let h = 0; for (const c of todayISO()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}
function nextOccurrence(dateStr, yearly) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const today = new Date(todayISO() + 'T00:00');
  let dt = new Date(yearly ? today.getFullYear() : y, m - 1, d);
  if (yearly && dt < today) dt = new Date(today.getFullYear() + 1, m - 1, d);
  return { date: dt, left: Math.round((dt - today) / 864e5), years: dt.getFullYear() - y };
}
function upcomingDays(rows) {
  const e = elapsed(TOGETHER_D);
  const nm = Date.now() < TOGETHER_D ? 0 : e.months + 1;
  const auto = [
    { title: 'Seni ilk gördüğüm gün', day: dayOf(START_D), yearly: true, auto: true },
    { title: 'Sevgili olduğumuz gün', day: dayOf(TOGETHER_D), yearly: true, auto: true },
    ...(nm && nm % 12 ? [{ title: `${nm}. ayımız`, day: dayOf(addMonths(nm)), yearly: false, auto: true }] : []),
  ];
  return [...auto, ...rows]
    .map(r => ({ ...r, ...nextOccurrence(r.day, r.yearly) }))
    .filter(r => r.left >= 0)
    .sort((a, b) => a.left - b.left);
}

async function home(v) {
  const [logs, letterRows, locked, reasons, mems, moodRows, greets, thoughts, flowers, coupons, days, photos, prayersAll, songRows, pings, comforts, dailyQ] = await Promise.all([
    api.list('prayer_logs', 30), api.list('letters'), api.rpc('locked_letters'), api.list('reasons'), api.list('memories'), api.list('moods', 50),
    api.list('greetings'), api.list('thoughts', 500), api.list('flowers'), api.list('coupons'), api.list('special_days'), api.list('photos'),
    api.list('prayers'), api.list('songs'), api.list('support_pings', 20).catch(() => []), api.list('comfort_items', 200).catch(() => []),
    dailyCard(),
  ]);
  const hisPings = pings.filter(p => !isMine(p) && Date.now() - new Date(p.created_at) < 864e5);
  const hisComforts = comforts.filter(c => !isMine(c)).length;
  const nazarList = prayersAll.filter(p => p.cat === 'nazar' && p.tr);
  const song = dailyPick(songRows);
  cache('reasons', reasons);
  const t = todayISO();
  const forMe = logs.filter(l => !isMine(l) && Date.now() - new Date(l.created_at) < 7 * 864e5).slice(0, 3);
  const unread = letterRows.filter(l => l.recipient === state.me.id && !l.read_at);
  const used = coupons.filter(c => isMine(c) && c.used_at && Date.now() - new Date(c.used_at) < 7 * 864e5);
  const lm = new Date(); lm.setMonth(lm.getMonth() - 1);
  const lmISO = localISO(lm).slice(0, 10);
  const onThisDay = mems.filter(m => m.happened_on !== t && (m.happened_on.slice(5) === t.slice(5) || m.happened_on === lmISO));
  const myMood = moodRows.find(isMine), hisMood = moodRows.find(m => !isMine(m));
  const slot = greetingSlot();
  const greet = slot && greets.find(g => !isMine(g) && g.kind === slot);
  const hisThoughts = thoughts.filter(x => !isMine(x) && dayOf(x.created_at) === t).length;
  const myThoughts = thoughts.filter(x => isMine(x) && dayOf(x.created_at) === t).length;
  const myFlower = flowers.find(f => isMine(f) && f.day === t);
  const hisFlower = flowers.find(f => !isMine(f) && f.day === t);
  const nextDay = upcomingDays(days)[0];
  const pool = [...photos.map(p => ({ path: p.path, cap: p.caption || p.album, date: p.taken_on || p.created_at })),
    ...mems.flatMap(m => m.photos.map(path => ({ path, cap: m.title, date: m.happened_on })))];
  const daily = dailyPick(pool);
  await loadUrls([...(daily ? [daily.path] : []), ...mems.slice(0, 3).flatMap(m => m.photos.slice(0, 1))]);
  const [activity, ps] = await Promise.all([loadActivity(true).catch(() => []), pushState().catch(() => 'unsupported')]);
  const fresh = freshItems(activity);
  const wrapMonth = Date.now() >= TOGETHER_D ? elapsed(TOGETHER_D).months : 0;
  const wrapReady = wrapMonth >= 1 && Date.now() - addMonths(wrapMonth) < 4 * 864e5 && !seenWrap(wrapMonth);

  const notes = [
    ...forMe.map(l => `<p>${ic('moon')}<span><b>${esc(partnerName())}</b> senin için ${esc(l.prayer_title)} okudu${l.count > 1 ? ` · ${l.count} kez` : ''} <span class="muted">${ago(l.created_at)}</span></span></p>`),
    ...(unread.length ? [`<a href="#/mektuplar">${ic('mail')}<span><b>${esc(partnerName())}</b>’dan okunmamış ${unread.length} mektubun var</span></a>`] : []),
    ...locked.map(l => `<a href="#/mektuplar">${ic('lock')}<span>Bir mektup ${fmtDateTime(l.open_at)}’da açılacak</span></a>`),
    ...used.map(c => `<a href="#/kuponlar">${ic('ticket')}<span><b>${esc(partnerName())}</b> “${esc(c.title)}” kuponunu kullandı <span class="muted">${ago(c.used_at)}</span></span></a>`),
    ...hisPings.slice(0, 1).map(p => `<a href="#/fisilti" class="note-strong">${ic('heart')}<span><b>${esc(partnerName())}</b> bugün biraz zor bir gün geçiriyor${p.mood ? ` · ${esc(moodName(p.mood))}` : ''} <span class="muted">${ago(p.created_at)}</span><br><span class="small">Ona bir fısıltı gönder</span></span></a>`),
    ...(nextDay && nextDay.left <= 30 ? [`<a href="#/ozel-gunler">${ic('calendar')}<span>${esc(nextDay.title)} · ${nextDay.left === 0 ? '<b>bugün</b>' : `${nextDay.left} gün kaldı`}</span></a>`] : []),
  ];

  v.innerHTML = `
    ${greet ? `<section class="card greeting ${slot}">
      ${ic(slot === 'morning' ? 'sun' : 'moon', 'lg')}
      <p class="greet-kicker">${slot === 'morning' ? 'Günaydın' : 'İyi geceler'}</p>
      <p class="greet-text">${esc(greet.text)}</p>
      <p class="greet-sign">— ${esc(nameOf(greet.author))}</p>
    </section>` : ''}

    <section class="counter card" id="counter">
      <p class="kicker">${esc(state.s.kicker)}</p>
      <p class="cal" data-c="cal"></p>
      <div class="boxes">
        <div><b data-c="d">0</b><small>gün</small></div>
        <div><b data-c="h">00</b><small>saat</small></div>
        <div><b data-c="m">00</b><small>dakika</small></div>
        <div><b data-c="s">00</b><small>saniye</small></div>
      </div>
      <p class="love">${esc(state.s.love)}</p>
      <p class="together" data-c="tog"></p>
      <p class="next" data-c="next"></p>
    </section>

    ${fresh.length && !state.newsClosed ? `<section class="card news" id="news">
      <div class="sec-title">${ic('sparkle')}<h3>Sen yokken ${esc(partnerName())}…</h3><button class="icon-btn" id="newsX" aria-label="Kapat">${ic('x')}</button></div>
      ${fresh.slice(0, 6).map(i => actRow(i)).join('')}
      ${fresh.length > 6 ? `<button class="link" id="newsAll">ve ${fresh.length - 6} şey daha</button>` : ''}
    </section>` : ''}

    ${ps === 'off' && !dismissed('push') ? `<section class="card prompt">
      <span class="list-ic">${ic('bell')}</span>
      <div class="grow"><b>Bildirimleri aç</b><p class="muted small">${esc(partnerName())} sana bir şey gönderdiğinde telefonuna gelsin.</p>
        <div class="prompt-btns"><button class="btn small" id="pushOn">Aç</button><button class="link" id="pushLater">Sonra</button></div></div>
    </section>` : ''}
    ${ps === 'needs-home' && !dismissed('home') ? `<section class="card prompt">
      <span class="list-ic">${ic('phone')}</span>
      <div class="grow"><b>Ana ekrana ekle</b><p class="muted small">Bildirim alabilmek için Safari’de <b>Paylaş → Ana Ekrana Ekle</b> de, sonra uygulamayı ana ekrandaki simgeden aç.</p></div>
      <button class="icon-btn" id="homeX" aria-label="Kapat">${ic('x')}</button>
    </section>` : ''}

    ${wrapReady ? `<button class="card wrap-ready" id="wrapReady">
      <span class="list-ic">${ic('sparkle')}</span>
      <span class="grow"><b>${wrapMonth}. ayımızın özeti hazır</b><br><span class="small">Bu ayın hikâyesini birlikte izleyin</span></span>
      ${ic('play')}</button>` : ''}

    <section class="nazar-wrap">
      <button class="nazar" id="nazar" aria-label="Nazar duası oku">${nazar()}</button>
      <div class="nazar-read" id="nazarRead"><p class="nazar-hint">Dokun, bir nazar duası oku</p></div>
    </section>

    ${dailyQ.html}

    <section class="card bloom">
      ${sectionTitle('flower', 'Bugünün çiçeği', '<a class="more-link" href="#/bahce">Bahçemiz</a>')}
      <div class="bloom-row">
        <div class="bloom-slot">${hisFlower ? flower(hisFlower.kind, 'grow-in') : '<div class="bud"></div>'}
          <p>${hisFlower ? `<b>${esc(partnerName())}</b> sana ${esc(FLOWERS.find(f => f[0] === hisFlower.kind)?.[1] ?? '')} gönderdi` : `${esc(partnerName())} henüz göndermedi`}</p>
          ${hisFlower?.note ? `<p class="bloom-note">“${esc(hisFlower.note)}”</p>` : ''}</div>
        <div class="bloom-slot">${myFlower ? flower(myFlower.kind) : '<div class="bud"></div>'}
          <p>${myFlower ? 'Bugünkü çiçeğini gönderdin' : ''}</p>
          ${myFlower ? '' : `<button class="btn small" id="sendFlower">${ic('flower')}Çiçek gönder</button>`}</div>
      </div>
    </section>

    ${daily ? `<section class="polaroid-wrap"><button class="polaroid" id="daily">
      <span class="pol-img">${img(daily.path)}</span>
      <span class="pol-cap">${esc(daily.cap || 'Günün fotoğrafı')}</span>
      <span class="pol-date">Günün fotoğrafı · ${fmtShort(daily.date)}</span>
    </button></section>` : ''}

    ${notes.length ? `<section class="card notes">${notes.join('')}</section>` : ''}

    <section class="card mood">
      ${sectionTitle('smile', 'Bugün nasılsın?')}
      <div class="emoji-pick" id="moodPick">${EMOJIS.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>
      <div class="mood-now">
        ${hisMood ? `<p><b>${esc(nameOf(hisMood.author))}</b> <span class="big">${hisMood.emoji}</span> ${hisMood.note ? `“${esc(hisMood.note)}”` : ''} <span class="muted small">${ago(hisMood.created_at)}</span></p>` : ''}
        ${myMood ? `<p><b>Sen</b> <span class="big">${myMood.emoji}</span> ${myMood.note ? `“${esc(myMood.note)}”` : ''} <span class="muted small">${ago(myMood.created_at)}</span></p>` : ''}
      </div>
    </section>

    <a class="card hard-day" href="#/zor-gun">
      <span class="list-ic">${ic('heart')}</span>
      <span class="grow"><b>Bugün biraz zor mu?</b><br><span class="muted small">${hisComforts ? `${esc(partnerName())} senin için ${hisComforts} kart hazırladı` : `${esc(partnerName())}’ya haber ver ya da ona destek kartı hazırla`}</span></span>
      ${ic('chevron', 'chev')}
    </a>

    <section class="card think">
      <button class="think-btn" id="think" aria-label="Seni düşünüyorum">${ic('heart')}</button>
      <p class="think-title">Seni düşünüyorum</p>
      <p class="think-count" id="thinkHis">${hisThoughts ? `<b>${esc(partnerName())}</b> bugün seni <b>${hisThoughts}</b> kez düşündü` : `Dokun, ${esc(partnerName())} düşündüğünü görsün`}</p>
      <p class="muted small" id="thinkMine">${myThoughts ? `Sen bugün ${myThoughts} kez` : ''}</p>
    </section>

    <section class="card jar">
      <h3 class="serif">${esc(state.s.jarTitle)}</h3>
      <button class="jar-btn" id="jarBtn" aria-label="Kavanozdan çek">${ic('jar')}</button>
      <p class="reason" id="reason">${reasons.length ? 'Kavanoza dokun, bir sebep çek' : 'Kavanoz henüz boş. İlk sebebi sen yaz.'}</p>
      <button class="btn ghost small" id="addReason">${ic('plus')}Sebep ekle</button>
      <p class="muted small"><a href="#/kavanoz">${reasons.length} sebep birikti</a></p>
    </section>

    ${onThisDay.length ? `<section class="card">
      ${sectionTitle('calendar', 'Bu tarihte')}
      ${onThisDay.map(m => `<a href="#/anilar" class="mini-mem"><b>${esc(m.title)}</b><span class="muted">${fmtDate(m.happened_on)}</span></a>`).join('')}
    </section>` : ''}

    <section class="card">
      ${sectionTitle('book', 'Son anılarımız', '<a class="more-link" href="#/anilar">Tümü</a>')}
      ${mems.length ? mems.slice(0, 3).map(m => `<a href="#/anilar" class="mini-mem">
        <span class="thumb">${m.photos[0] ? img(m.photos[0]) : ic('book')}</span>
        <span><b>${esc(m.title)}</b><br><span class="muted small">${fmtDate(m.happened_on)}</span></span></a>`).join('')
      : '<p class="muted">İlk anınızı Anılar sekmesinden yazabilirsiniz.</p>'}
    </section>

    <section class="card song-day">
      ${sectionTitle('music', 'Günün şarkısı', '<a class="more-link" href="#/muzik">Müziğimiz</a>')}
      ${song ? `<p class="song-name"><b>${esc(song.title)}</b>${song.artist ? ` <span class="muted">· ${esc(song.artist)}</span>` : ''}</p>
        ${song.note ? `<p class="quote">“${esc(song.note)}”</p>` : ''}
        ${embed(song.url)}`
      : '<p class="muted small">Müziğimiz’e ilk şarkıyı ekleyin; her gün biri burada çalsın.</p>'}
    </section>`;

  let lastNazar = -1;
  $('#nazar').onclick = () => {
    const b = $('#nazar'), r = $('#nazarRead');
    b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
    try { navigator.vibrate?.(20); } catch {}
    if (!nazarList.length) return;
    let i; do { i = Math.floor(Math.random() * nazarList.length); } while (nazarList.length > 1 && i === lastNazar);
    lastNazar = i;
    const p = nazarList[i];
    r.classList.remove('show'); void r.offsetWidth;
    r.innerHTML = `<p class="nazar-title">${esc(p.title)}</p><p class="nazar-text">${esc(p.tr)}</p>`;
    r.classList.add('show');
  };

  dailyQ.bind(v);
  $('#wrapReady')?.addEventListener('click', async () => { await openWrap(wrapMonth); $('#wrapReady')?.remove(); });
  $('#newsX')?.addEventListener('click', () => { state.newsClosed = true; $('#news').remove(); });
  $('#newsAll')?.addEventListener('click', openBell);
  $('#pushOn')?.addEventListener('click', async () => {
    try { await enablePush(); toast('Bildirimler açıldı'); rerender(); } catch (er) { toast(er.message); }
  });
  $('#pushLater')?.addEventListener('click', () => { dismiss('push'); rerender(); });
  $('#homeX')?.addEventListener('click', () => { dismiss('home'); rerender(); });

  // seni düşünüyorum
  let mine = myThoughts, busy = false;
  $('#think').onclick = async () => {
    const b = $('#think');
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    floatHearts(b);
    if (busy) return; busy = true;
    try { await api.insert('thoughts', {}); mine++; $('#thinkMine').textContent = `Sen bugün ${mine} kez`; }
    catch (er) { toast(er.message); }
    setTimeout(() => { busy = false; }, 700);
  };
  $('#sendFlower')?.addEventListener('click', flowerPicker);
  $('#daily')?.addEventListener('click', () => lightbox(daily.path, daily.cap, fmtDate(daily.date)));
  $$('#moodPick [data-emo]').forEach(b => b.onclick = async () => {
    await api.insert('moods', { emoji: b.dataset.emo });
    toast(`${partnerName()} bugün nasıl olduğunu görecek`); rerender();
  });
  let last = -1;
  $('#jarBtn').onclick = () => {
    if (!reasons.length) return;
    let i; do { i = Math.floor(Math.random() * reasons.length); } while (reasons.length > 1 && i === last);
    last = i;
    const r = reasons[i], el = $('#reason'), jb = $('#jarBtn');
    jb.classList.remove('shake'); void jb.offsetWidth; jb.classList.add('shake');
    el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    el.innerHTML = `“${esc(r.text)}”<br><span class="muted small">— ${esc(nameOf(r.author))}</span>`;
  };
  $('#addReason').onclick = () => editForm('reasons', null, { heading: esc(state.s.jarTitle) });
}

function floatHearts(el) {
  if (reduceMotion()) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const h = document.createElement('span');
    h.className = 'float-heart';
    h.innerHTML = ic('heart');
    h.style.left = r.left + r.width / 2 - 9 + (Math.random() * 40 - 20) + 'px';
    h.style.top = r.top + 'px';
    h.style.animationDelay = i * 0.07 + 's';
    document.body.append(h);
    setTimeout(() => h.remove(), 1600);
  }
}

function flowerPicker() {
  let pick = FLOWERS[0][0];
  const m = modal(`<h2>${esc(partnerName())}’ya bugünün çiçeği</h2>
    <p class="muted small">Her gün bir çiçek. Bahçeniz sizinle birlikte büyüsün.</p>
    <div class="flower-pick">${FLOWERS.map(([k, n, mean], i) => `<button type="button" data-f="${k}" class="${i ? '' : 'on'}">${flower(k)}<b>${n}</b><span>${mean}</span></button>`).join('')}</div>
    <form><label>Bir not<input name="note" placeholder="İsteğe bağlı"></label><p class="err"></p><button class="btn">Gönder</button></form>`);
  $$('[data-f]', m).forEach(b => b.onclick = () => { pick = b.dataset.f; $$('[data-f]', m).forEach(x => x.classList.toggle('on', x === b)); });
  $('form', m).onsubmit = async e => {
    e.preventDefault();
    try {
      await api.insert('flowers', { kind: pick, day: todayISO(), note: e.target.note.value.trim() || null });
      m.close(); hearts(18); toast('Çiçeğin gönderildi'); rerender();
    } catch (er) { $('.err', m).textContent = er.message; }
  };
}

// ================================================================== yenilikler (zil + "sen yokken" kartı)
let actCache = null;
async function loadActivity(force = false) {
  if (!force && actCache && Date.now() - actCache.t < 20000) return actCache.items;
  const lim = 60;
  const [mems, letterRows, locked, photos, reasons, logs, moods, firsts, todos, songs, places, thoughts, flowers, coupons, quizQ, days, totA, mScores, pingRows, skyRows, drawRows, mediaRows, mQuiz] = await Promise.all([
    api.list('memories', lim), api.list('letters', lim), api.rpc('locked_letters'), api.list('photos', 200), api.list('reasons', lim),
    api.list('prayer_logs', lim), api.list('moods', lim), api.list('firsts', lim), api.list('todos', lim), api.list('songs', lim),
    api.list('places', lim), api.list('thoughts', 300), api.list('flowers', 200), api.list('coupons', lim), api.rpc('quiz_for_me'), api.list('special_days', lim),
    api.list('tot_answers', 300), api.list('memory_scores', lim), api.list('support_pings', lim),
    api.list('star_maps', lim), api.list('drawings', lim), api.list('shared_media', lim), api.rpc('media_quizzes_for_me'),
  ].map(p => p.catch(() => [])));
  const items = [];
  const cutoff = Date.now() - 14 * 864e5;
  const add = (at, icon, text, href) => { if (at && new Date(at) >= cutoff) items.push({ at: new Date(at), icon, text, href }); };
  const his = r => r.author && !isMine(r);
  const byDay = (rows, icon, text, href) => {
    const g = {};
    rows.forEach(r => { const d = dayOf(r.created_at); (g[d] ??= []).push(r); });
    Object.values(g).forEach(list => add(list.map(r => r.created_at).sort().pop(), icon, text(list.length), href));
  };
  mems.filter(his).forEach(m => add(m.created_at, 'book', `yeni bir anı ekledi: “${esc(m.title)}”`, '#/anilar'));
  letterRows.filter(l => his(l) && l.recipient === state.me.id).forEach(l => add(l.created_at, 'mail', `sana bir mektup yazdı: “${esc(l.title)}”`, '#/mektuplar'));
  locked.forEach(l => add(l.created_at, 'lock', `sana mühürlü bir mektup yazdı · ${fmtShort(l.open_at)}’da açılacak`, '#/mektuplar'));
  byDay(photos.filter(his), 'image', n => `${n} fotoğraf ekledi`, '#/galeri');
  reasons.filter(his).forEach(r => add(r.created_at, 'jar', `kavanoza yeni bir sebep attı`, '#/kavanoz'));
  logs.filter(his).forEach(l => add(l.created_at, 'moon', `senin için ${esc(l.prayer_title)} okudu`, '#/dualar'));
  moods.filter(his).forEach(m => add(m.created_at, 'smile', `bugün ${m.emoji}${m.note ? ` · “${esc(m.note)}”` : ''}`, '#/ruh-hali'));
  firsts.filter(his).forEach(f => add(f.created_at, 'flag', `yeni bir ilk ekledi: “${esc(f.title)}”`, '#/ilkler'));
  todos.filter(his).forEach(t => add(t.created_at, 'check', `hayal listenize ekledi: “${esc(t.text)}”`, '#/yapacaklar'));
  songs.filter(his).forEach(s => add(s.created_at, 'music', `bir şarkı ekledi: “${esc(s.title)}”`, '#/muzik'));
  places.filter(his).forEach(p => add(p.created_at, 'pin', `haritaya ekledi: “${esc(p.name)}”`, '#/harita'));
  byDay(thoughts.filter(his), 'heart', n => `seni ${n} kez düşündü`, '#/');
  flowers.filter(his).forEach(f => add(f.created_at, 'flower', `sana bir ${esc((FLOWERS.find(x => x[0] === f.kind)?.[1] ?? 'çiçek').toLocaleLowerCase('tr'))} gönderdi`, '#/bahce'));
  coupons.filter(c => his(c) && c.recipient === state.me.id).forEach(c => add(c.created_at, 'ticket', `sana bir kupon yazdı: “${esc(c.title)}”`, '#/kuponlar'));
  coupons.filter(c => isMine(c) && c.used_at).forEach(c => add(c.used_at, 'ticket', `“${esc(c.title)}” kuponunu kullandı`, '#/kuponlar'));
  byDay(quizQ.filter(q => q.choice === null), 'quiz', n => `sana ${n} yeni soru sordu`, '#/test');
  days.filter(his).forEach(d => add(d.created_at, 'calendar', `bir özel gün ekledi: “${esc(d.title)}”`, '#/ozel-gunler'));
  byDay(totA.filter(his), 'split', n => `“Bu mu, o mu?”da ${n} soru cevapladı`, '#/bumuo');
  skyRows.filter(his).forEach(s => add(s.created_at, 'star', `bir yıldız haritası oluşturdu: “${esc(s.title)}”`, `#/yildizlar/${s.id}`));
  drawRows.filter(his).forEach(d => add(d.created_at, 'brush', `yeni bir çizim başlattı: “${esc(d.title)}”`, `#/cizim/${d.id}`));
  mediaRows.filter(his).forEach(m => add(m.created_at, 'film', `listeye ekledi: “${esc(m.title)}”`, '#/sampiyona'));
  (mQuiz ?? []).filter(q => !q.attempted).forEach(q => add(q.created_at, 'crown', `sana bir test hazırladı: “${esc(q.title)}”`, '#/sampiyona'));
  pingRows.filter(his).forEach(p => add(p.created_at, 'heart', `biraz zor bir gün geçirdiğini söyledi${p.mood ? ` · ${esc(moodName(p.mood))}` : ''}`, '#/fisilti'));
  mScores.filter(his).forEach(s => add(s.created_at, 'cards', `hafıza oyununu ${mmss(s.seconds)}’de bitirdi`, '#/hafiza'));
  items.sort((a, b) => b.at - a.at);
  actCache = { t: Date.now(), items };
  return items;
}
const freshItems = items => state.since ? items.filter(i => i.at > state.since) : [];
const actRow = (i, isNew = false) => `<a class="act-row ${isNew ? 'is-new' : ''}" href="${i.href}">${ic(i.icon)}<span class="grow"><b>${esc(partnerName())}</b> ${i.text}<br><span class="muted small">${ago(i.at)}</span></span></a>`;

async function refreshBell() {
  try {
    const n = freshItems(await loadActivity()).length;
    const b = $('#bellN');
    if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  } catch {}
}
async function openBell() {
  const items = await loadActivity(true);
  const m = modal(`<h2>Yenilikler</h2>
    <p class="muted small">${esc(partnerName())}’nın son iki haftada paylaştıkları</p>
    <div class="acts-list">${items.length ? items.slice(0, 40).map(i => actRow(i, state.since && i.at > state.since)).join('') : `<div class="empty">${ic('bell', 'xl')}<p>Henüz yeni bir şey yok</p></div>`}</div>`);
  $$('.act-row', m).forEach(a => a.addEventListener('click', () => m.close()));
  state.since = new Date();
  refreshBell();
}

// ================================================================== telefon bildirimleri
const NOTIFY_CATS = [
  ['messages', 'Fısıltı mesajları'], ['daily', 'Günün sorusu'], ['support', 'Zor gün haberleri'], ['letters', 'Mektuplar'], ['prayers', 'Senin için edilen dualar'], ['thoughts', 'Seni düşünüyorum (en fazla 3 saatte bir)'],
  ['flowers', 'Çiçekler'], ['fun', 'Kuponlar ve test soruları'], ['shares', 'Anılar, fotoğraflar ve diğer paylaşımlar'],
];
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
async function pushState() {
  if (DEMO || !VAPID_PUBLIC_KEY) return 'unavailable';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return isIOS && !isStandalone() ? 'needs-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}
const b64uToBytes = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
async function saveSub(sub) {
  const j = sub.toJSON();
  await api.upsert('push_subscriptions', { user_id: state.me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, 'endpoint');
}
async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Bildirim izni verilmedi');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(VAPID_PUBLIC_KEY) });
  await saveSub(sub);
}
async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) { await api.removeWhere('push_subscriptions', 'endpoint', sub.endpoint); await sub.unsubscribe(); }
}
async function syncPush() {
  try {
    if (await pushState() !== 'on') return;
    const sub = await (await navigator.serviceWorker.getRegistration()).pushManager.getSubscription();
    if (sub) await saveSub(sub);
  } catch {}
}
const dismissed = k => { try { return localStorage.getItem('dismiss-' + k) === '1'; } catch { return false; } };
const dismiss = k => { try { localStorage.setItem('dismiss-' + k, '1'); } catch {} };

// ================================================================== görünüm: gece modu + tema paketleri + hareket (hesaba bağlı)
const PREFS_KEY = 'ekalpr-prefs';
const PACKS = [['auto', 'Takvime göre'], ['pembe', 'Pembe'], ['ilkbahar', 'İlkbahar'], ['yildonumu', 'Yıldönümü'], ['kis', 'Kış Masalı'], ['gece', 'Gece Bahçesi'], ['minimal', 'Minimal']];
const PACK_SW = {
  auto: 'conic-gradient(#f4a7bf 0 25%, #9cc79c 0 50%, #cfe0f5 0 75%, #e8cfa9 0)',
  pembe: 'linear-gradient(135deg,#f9d3df,#b4587a)', ilkbahar: 'linear-gradient(135deg,#fbe3e6,#9cc79c)',
  yildonumu: 'linear-gradient(135deg,#f3e3c8,#a8707e)', kis: 'linear-gradient(135deg,#eef4fb,#6f8fc0)',
  gece: 'linear-gradient(135deg,#2a2950,#b7a6ff)', minimal: 'linear-gradient(135deg,#f3efea,#9b8b86)',
};
const packName = k => PACKS.find(p => p[0] === k)?.[1] ?? k;
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
function localPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    const legacy = localStorage.getItem('ekalpr-theme');
    if (legacy && !p.appearance) p.appearance = legacy;
    return p;
  } catch { return {}; }
}
const myPrefs = () => ({ appearance: 'auto', pack: 'auto', motion: 'auto', ...localPrefs(), ...(state.me ? state.people[state.me.id]?.prefs ?? {} : {}) });
// Takvime göre tema: yıl/ay dönümleri ve 14 Şubat → Yıldönümü; Aralık–Şubat → Kış; Mart–Mayıs → İlkbahar
function autoPack(now = new Date()) {
  const t = localISO(now).slice(0, 10), md = t.slice(5);
  const special = [dayOf(START_D).slice(5), dayOf(TOGETHER_D).slice(5), '02-14'];
  const monthly = now >= TOGETHER_D && t.slice(8) === dayOf(TOGETHER_D).slice(8);
  if (special.includes(md) || monthly) return 'yildonumu';
  const m = now.getMonth();
  if (m === 11 || m <= 1) return 'kis';
  if (m >= 2 && m <= 4) return 'ilkbahar';
  return 'pembe';
}
const reduceMotion = () => document.documentElement.getAttribute('data-motion') === 'reduce';
function applyTheme() {
  const p = myPrefs(), root = document.documentElement;
  const pack = p.pack === 'auto' ? autoPack() : p.pack;
  const dark = pack === 'gece' || p.appearance === 'dark' || (p.appearance === 'auto' && mq('(prefers-color-scheme: dark)'));
  const reduce = p.motion === 'reduce' || (p.motion === 'auto' && mq('(prefers-reduced-motion: reduce)')) || pack === 'minimal';
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-pack', pack);
  reduce ? root.setAttribute('data-motion', 'reduce') : root.removeAttribute('data-motion');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) $('meta[name=theme-color]')?.setAttribute('content', bg);
  try { localStorage.setItem('ekalpr-resolved', JSON.stringify({ theme: dark ? 'dark' : 'light', pack, motion: reduce ? 'reduce' : '' })); } catch {}
  snow(pack === 'kis' && !reduce);
}
async function savePrefs(patch) {
  const next = { ...myPrefs(), ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
  if (state.me && state.people[state.me.id]) {
    state.people[state.me.id].prefs = next;
    try { await api.rpc('set_my_prefs', { prefs: next }); } catch (er) { toast(er.message); }
  }
  applyTheme();
}
// Kış Masalı: hafif kar (sayfa arka plandayken durur)
let snowStop = null, snowCanvas = null;
function snow(on) {
  if (!on) { snowStop?.(); snowStop = null; return; }
  if (snowStop && document.body.contains(snowCanvas)) return;
  snowStop?.();
  const c = snowCanvas = document.createElement('canvas');
  c.className = 'snow';
  document.body.append(c);
  const ctx = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
  const flakes = Array.from({ length: 38 }, () => ({ x: Math.random(), y: Math.random(), r: .8 + Math.random() * 2, s: .25 + Math.random() * .5, d: Math.random() * 6 }));
  let w, h, raf;
  const size = () => { w = c.width = innerWidth * dpr; h = c.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (document.visibilityState !== 'visible') return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255,255,255,.75)' : 'rgba(150,175,215,.55)';
    for (const f of flakes) {
      f.y += f.s / 900; f.d += .012; f.x += Math.sin(f.d) * .0005;
      if (f.y > 1.02) { f.y = -.02; f.x = Math.random(); }
      ctx.beginPath(); ctx.arc(f.x * w, f.y * h, f.r * dpr, 0, 7); ctx.fill();
    }
  };
  frame();
  snowStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', size); c.remove(); };
}
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme()); } catch {}
applyTheme();

// ================================================================== uygulama kilidi (sadece bu cihazda)
const LOCK_KEY = 'ekalpr-lock';
const LOCK_DELAYS = [[0, 'Her açılışta'], [60, '1 dakika sonra'], [900, '15 dakika sonra'], [3600, '1 saat sonra']];
const lockCfg = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)); } catch { return null; } };
const saveLock = c => { try { c ? localStorage.setItem(LOCK_KEY, JSON.stringify(c)) : localStorage.removeItem(LOCK_KEY); } catch {} };
async function pinHash(salt, pin) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
/** Tam ekran 4 haneli şifre tuş takımı. check(pin) true dönerse kapanır. */
function pinPad({ sub, check, extra }) {
  const o = document.createElement('div');
  o.className = 'lock';
  o.innerHTML = `<div class="lock-box">
    <div class="logo">${brand(state.s?.title ?? DEFAULTS.title)}</div>
    <p class="lock-sub">${esc(sub)}</p>
    <div class="pin-dots"><span></span><span></span><span></span><span></span></div>
    <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
      <button data-k="x" class="pad-link">${extra ? esc(extra.label) : ''}</button><button data-k="0">0</button>
      <button data-k="del" class="pad-link" aria-label="Sil">${ic('back')}</button></div>
  </div>`;
  document.body.append(o);
  requestAnimationFrame(() => o.classList.add('show'));
  let pin = '', busy = false;
  const dots = $$('.pin-dots span', o);
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const close = () => { o.classList.remove('show'); removeEventListener('keydown', onKey); setTimeout(() => o.remove(), 300); };
  const press = async k => {
    if (busy) return;
    if (k === 'x') { if (extra) extra.run(close); return; }
    if (k === 'del') { pin = pin.slice(0, -1); paint(); return; }
    if (pin.length >= 4) return;
    pin += k; paint();
    try { navigator.vibrate?.(8); } catch {}
    if (pin.length === 4) {
      busy = true;
      const ok = await check(pin);
      if (ok) close();
      else { $('.pin-dots', o).classList.add('shake'); setTimeout(() => { $('.pin-dots', o)?.classList.remove('shake'); pin = ''; paint(); busy = false; }, 450); }
    }
  };
  const onKey = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); };
  addEventListener('keydown', onKey);
  $$('[data-k]', o).forEach(b => b.onclick = () => press(b.dataset.k));
  return o;
}
const askPin = sub => new Promise(res => pinPad({
  sub, check: async pin => { res(pin); return true; },
  extra: { label: 'Vazgeç', run: close => { close(); res(null); } },
}));
let lockedNow = false, hiddenAt = 0;
function showLock() {
  const c = lockCfg();
  if (!c || lockedNow || !state.me) return;
  lockedNow = true;
  pinPad({
    sub: 'Şifreni gir',
    check: async pin => { const ok = (await pinHash(c.salt, pin)) === c.hash; if (ok) lockedNow = false; return ok; },
    extra: {
      label: 'Unuttum', run: async () => {
        if (!confirm('Kilit sıfırlanacak ve çıkış yapılacak. Hesap şifrenle tekrar girebilirsin.')) return;
        saveLock(null); await api.signOut(); location.hash = ''; location.reload();
      },
    },
  });
}
document.addEventListener('visibilitychange', () => {
  const c = lockCfg();
  if (!c || !state.me) return;
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); if (c.delay === 0) showLock(); }
  else if (hiddenAt && Date.now() - hiddenAt >= c.delay * 1000) showLock();
});
async function setupLock() {
  const a = await askPin('Yeni 4 haneli şifreni belirle'); if (!a) return false;
  const b = await askPin('Şifreyi tekrar gir'); if (!b) return false;
  if (a !== b) { toast('Şifreler eşleşmedi, tekrar dene'); return false; }
  const salt = crypto.randomUUID();
  saveLock({ salt, hash: await pinHash(salt, a), delay: lockCfg()?.delay ?? 60 });
  return true;
}
async function verifyPin() {
  const c = lockCfg(); if (!c) return true;
  const p = await askPin('Mevcut şifreni gir'); if (!p) return false;
  if ((await pinHash(c.salt, p)) !== c.hash) { toast('Şifre yanlış'); return false; }
  return true;
}

// ================================================================== aylık özet
const monthRange = n => ({ from: addMonths(n - 1), to: addMonths(n) });
const monthsSoFar = () => Date.now() < TOGETHER_D ? 0 : elapsed(TOGETHER_D).months + 1;   // son eleman = devam eden ay
const fmtDM = d => new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
// Türkçe bulunma eki: "Aralık" → "Aralık’ta", "Kasım" → "Kasım’da", "Eylül" → "Eylül’de"
function ekDa(word) {
  const w = word.toLocaleLowerCase('tr');
  const v = [...w].reverse().find(c => 'aeıioöuü'.includes(c)) ?? 'a';
  const hard = 'çfhkpsşt'.includes(w.at(-1));
  return `${word}’${hard ? 't' : 'd'}${'aıou'.includes(v) ? 'a' : 'e'}`;
}
const seenWrap = n => { try { return localStorage.getItem('ozet-' + n) === '1'; } catch { return false; } };
const markWrap = n => { try { localStorage.setItem('ozet-' + n, '1'); } catch {} };

async function wrapData(n) {
  const { from, to } = monthRange(n);
  const end = Math.min(+to, Date.now());
  const inRange = ts => { const t = +new Date(ts); return t >= +from && t < end; };
  const L = t => api.list(t, 2000).catch(() => []);
  const [msgs, thoughts, flowers, mems, photos, letters, logs, moods, reasons, songs, places, firsts, scores, tot] = await Promise.all(
    ['messages', 'thoughts', 'flowers', 'memories', 'photos', 'letters', 'prayer_logs', 'moods', 'reasons', 'songs', 'places', 'firsts', 'memory_scores', 'tot_answers'].map(L));
  const f = rows => rows.filter(r => inRange(r.created_at));
  const split = rows => ({ me: rows.filter(isMine).length, him: rows.filter(r => !isMine(r)).length, all: rows.length });
  const d = {
    n, from, to, end, done: +to <= Date.now(),
    days: Math.max(1, Math.round((end - from) / 864e5)),
    msgs: f(msgs), thoughts: f(thoughts), flowers: f(flowers), mems: f(mems), photos: f(photos), letters: f(letters),
    logs: f(logs), moods: f(moods), reasons: f(reasons), songs: f(songs), places: f(places), firsts: f(firsts), scores: f(scores),
  };
  d.msgSplit = split(d.msgs); d.thoughtSplit = split(d.thoughts); d.flowerSplit = split(d.flowers);
  const byDay = {}; d.msgs.forEach(m => { const k = dayOf(m.created_at); byDay[k] = (byDay[k] || 0) + 1; });
  d.busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] ?? null;
  const favFlower = {}; d.flowers.forEach(x => { favFlower[x.kind] = (favFlower[x.kind] || 0) + 1; });
  d.favFlower = Object.entries(favFlower).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topEmoji = rows => { const c = {}; rows.forEach(r => { c[r.emoji] = (c[r.emoji] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
  d.moodMe = topEmoji(d.moods.filter(isMine)); d.moodHim = topEmoji(d.moods.filter(r => !isMine(r)));
  const prayCount = {}; d.logs.forEach(l => { prayCount[l.prayer_title] = (prayCount[l.prayer_title] || 0) + (l.count || 1); });
  d.topPrayer = Object.entries(prayCount).sort((a, b) => b[1] - a[1])[0] ?? null;
  d.prayTotal = d.logs.reduce((s, l) => s + (l.count || 1), 0);
  d.reason = d.reasons.length ? d.reasons[Math.floor(Math.random() * d.reasons.length)] : null;
  d.pics = [...d.photos.map(p => p.path), ...d.mems.flatMap(m => m.photos)].sort(() => Math.random() - .5).slice(0, 4);
  const myA = Object.fromEntries(tot.filter(isMine).map(a => [a.qkey, a.pick])), hisA = Object.fromEntries(tot.filter(a => !isMine(a)).map(a => [a.qkey, a.pick]));
  const both = Object.keys(myA).filter(k => k in hisA);
  d.compat = both.length >= 3 ? Math.round(both.filter(k => myA[k] === hisA[k]).length / both.length * 100) : null;
  d.bestScore = d.scores.slice().sort((a, b) => a.seconds - b.seconds)[0] ?? null;
  await loadUrls(d.pics);
  return d;
}

function wrapSlides(d) {
  const P = esc(partnerName()), S = [];
  const bar = (a, b) => { const t = Math.max(1, a + b); return `<div class="w-bar"><span style="width:${a / t * 100}%"></span></div><div class="w-legend"><span>Sen · ${a}</span><span>${P} · ${b}</span></div>`; };
  S.push({ bg: 'w1', html: `<p class="w-kicker">${brand(state.s.title)}</p><p class="w-script">${d.n}. ayımız</p>
    <p class="w-sub">${fmtDM(d.from)} – ${fmtDM(d.done ? d.to : Date.now())}${d.done ? '' : ' · devam ediyor'}</p><p class="w-hint">Dokunarak ilerle</p>` });
  const hours = Math.round((d.end - d.from) / 36e5);
  S.push({ bg: 'w2', html: `<p class="w-kicker">Bu ay birlikte</p><p class="w-big">${d.days}</p><p class="w-label">gün</p>
    <p class="w-sub">${hours.toLocaleString('tr-TR')} saat · ${(hours * 60).toLocaleString('tr-TR')} dakika</p><p class="w-quote">…ve her saniyesinde seni biraz daha sevdim</p>` });
  if (d.msgSplit.all) S.push({ bg: 'w3', html: `<p class="w-kicker">Fısıltılarımız</p><p class="w-big">${d.msgSplit.all}</p><p class="w-label">mesaj</p>${bar(d.msgSplit.me, d.msgSplit.him)}
    ${d.busiest ? `<p class="w-sub">En çok fısıldaştığımız gün<br><b>${fmtDM(d.busiest[0])}</b> · ${d.busiest[1]} mesaj</p>` : ''}` });
  if (d.thoughtSplit.all) S.push({ bg: 'w4', html: `<p class="w-kicker">Seni düşünüyorum</p>
    <p class="w-line"><b>${P}</b> seni</p><p class="w-big">${d.thoughtSplit.him}</p><p class="w-label">kez düşündü</p>
    ${d.thoughtSplit.me ? `<p class="w-sub">Sen de onu ${d.thoughtSplit.me} kez düşündün</p>` : ''}` });
  if (d.flowerSplit.all) S.push({ bg: 'w5', html: `<p class="w-kicker">Bahçemiz</p><div class="w-garden">${d.flowers.slice(0, 14).map(x => flower(x.kind)).join('')}</div>
    <p class="w-big sm">${d.flowerSplit.all}</p><p class="w-label">çiçek açtı</p>${bar(d.flowerSplit.me, d.flowerSplit.him)}
    ${d.favFlower ? `<p class="w-sub">Bu ayın çiçeği: <b>${esc(FLOWERS.find(f => f[0] === d.favFlower)?.[1] ?? '')}</b></p>` : ''}` });
  if (d.mems.length || d.photos.length) S.push({ bg: 'w6', html: `<p class="w-kicker">Anılarımız</p>
    ${d.pics.length ? `<div class="w-collage n${d.pics.length}">${d.pics.map(p => `<span>${img(p)}</span>`).join('')}</div>` : ''}
    <p class="w-sub"><b>${d.mems.length}</b> anı · <b>${d.photos.length}</b> fotoğraf${d.firsts.length ? ` · <b>${d.firsts.length}</b> ilk` : ''}</p>
    ${d.mems[0] ? `<p class="w-quote">“${esc(d.mems[0].title)}”</p>` : ''}` });
  if (d.logs.length) S.push({ bg: 'w7', html: `<p class="w-kicker">Dualarımız</p><div class="w-nazar">${nazar()}</div>
    <p class="w-big sm">${d.prayTotal}</p><p class="w-label">kez birbirimiz için okuduk</p>
    ${d.topPrayer ? `<p class="w-sub">En çok okunan: <b>${esc(d.topPrayer[0])}</b></p>` : ''}` });
  if (d.moodMe || d.moodHim) S.push({ bg: 'w8', html: `<p class="w-kicker">Bu ayın halleri</p>
    <div class="w-moods">${d.moodMe ? `<div><span>${d.moodMe}</span><b>Sen</b></div>` : ''}${d.moodHim ? `<div><span>${d.moodHim}</span><b>${P}</b></div>` : ''}</div>` });
  if (d.letters.length || d.reasons.length) S.push({ bg: 'w9', html: `<p class="w-kicker">Kalpten</p>
    <p class="w-sub"><b>${d.letters.length}</b> mektup · <b>${d.reasons.length}</b> “seni neden seviyorum”</p>
    ${d.reason ? `<p class="w-quote big">“${esc(d.reason.text)}”</p><p class="w-sub">— ${esc(nameOf(d.reason.author))}</p>` : ''}` });
  if (d.compat !== null || d.bestScore) S.push({ bg: 'w10', html: `<p class="w-kicker">Oyunlarımız</p>
    ${d.compat !== null ? `<p class="w-big">${d.compat}%</p><p class="w-label">uyumluyuz</p>` : ''}
    ${d.bestScore ? `<p class="w-sub">Hafıza rekoru: <b>${mmss(d.bestScore.seconds)}</b> · ${esc(nameOf(d.bestScore.author))}</p>` : ''}` });
  S.push({ bg: 'w11', html: `<p class="w-script">Seni seviyorum</p><p class="w-quote">${esc(state.s.love)}</p>
    <p class="w-sub">${d.done ? `${d.n + 1}. ayımızda görüşmek üzere` : `${d.n}. ayımız ${ekDa(fmtDM(d.to))} tamamlanacak`}</p>
    <button class="btn light" data-close>Kapat</button>` });
  return S;
}

function story(slides, onClose) {
  const o = document.createElement('div');
  o.className = 'story';
  o.innerHTML = `<div class="st-bars">${slides.map(() => '<span><i></i></span>').join('')}</div>
    <button class="st-x" aria-label="Kapat">${ic('x')}</button><div class="st-slide"></div>`;
  document.body.append(o);
  requestAnimationFrame(() => o.classList.add('show'));
  let i = 0, t = null;
  const DUR = 6500;
  const close = () => { clearTimeout(t); o.classList.remove('show'); setTimeout(() => o.remove(), 350); onClose?.(); };
  const show = k => {
    i = Math.max(0, Math.min(slides.length - 1, k));
    o.className = `story show ${slides[i].bg}`;
    const s = $('.st-slide', o);
    s.innerHTML = `<div class="st-in">${slides[i].html}</div>`;
    $$('.st-bars span', o).forEach((b, j) => { b.className = j < i ? 'done' : j === i ? 'run' : ''; });
    $('[data-close]', s)?.addEventListener('click', e => { e.stopPropagation(); close(); });
    clearTimeout(t);
    if (i < slides.length - 1) t = setTimeout(() => show(i + 1), DUR);
  };
  o.addEventListener('click', e => {
    if (e.target.closest('.st-x')) return close();
    if (e.target.closest('[data-close]')) return;
    const x = e.clientX / innerWidth;
    show(x < .3 ? i - 1 : i + 1);
  });
  show(0);
}
async function openWrap(n) {
  toast('Özet hazırlanıyor…');
  try { const d = await wrapData(n); story(wrapSlides(d), () => {}); if (d.done) markWrap(n); hearts(20); }
  catch (er) { toast(er.message); }
}
async function wraps(v) {
  const total = monthsSoFar();
  v.innerHTML = `${back()}${head('Aylık özetimiz', '', 'Her ay dönümünde o ayın hikâyesi hazırlanır')}
    ${total ? Array.from({ length: total }, (_, k) => total - k).map(n => {
      const { from, to } = monthRange(n), done = +to <= Date.now();
      return `<button class="card wrap-item ${done ? '' : 'live'}" data-w="${n}">
        <span class="wrap-n">${n}</span>
        <span class="grow"><b>${n}. ayımız</b><br><span class="muted small">${fmtDM(from)} – ${fmtDM(to)}${done ? '' : ' · devam ediyor'}</span></span>
        ${ic(done ? 'play' : 'sparkle')}</button>`;
    }).join('') : empty('sparkle', 'Sevgili olduğunuz günden itibaren burada her ayın özeti olacak')}`;
  $$('[data-w]', v).forEach(b => b.onclick = () => openWrap(+b.dataset.w));
}

// ================================================================== günün sorusu
const DAILY_EPOCH = '2026-11-19';
const dailyIdx = (day = todayISO()) => {
  const n = Math.round((new Date(day + 'T12:00') - new Date(DAILY_EPOCH + 'T12:00')) / 864e5);
  return ((n % QUESTIONS.length) + QUESTIONS.length) % QUESTIONS.length;
};
/** Bugünün sorusu kartı: html + olay bağlama */
async function dailyCard(withArchiveLink = true) {
  const day = todayISO(), q = QUESTIONS[dailyIdx(day)];
  let st = {};
  try { st = (await api.rpc('daily_for_me', { d: day }))?.[0] ?? {}; } catch {}
  const P = esc(partnerName());
  const html = `<section class="card daily" id="daily">
    ${sectionTitle('quiz', 'Günün sorusu', withArchiveLink ? '<a class="more-link" href="#/gunun-sorusu">Arşiv</a>' : '')}
    <p class="daily-q">${esc(q)}</p>
    ${!st.mine ? `
      ${st.they_answered ? `<p class="daily-wait on">${ic('check')}<span><b>${P}</b> cevapladı, seninkini bekliyor</span></p>` : ''}
      <form id="dailyForm"><textarea name="a" rows="3" required placeholder="Cevabın…"></textarea>
        <div class="daily-foot"><span class="muted small">İkiniz de cevaplayınca cevaplar açılır</span><button class="btn small">Gönder</button></div></form>`
    : `<div class="daily-a me"><b>Sen</b><p>${esc(st.mine)}</p></div>
       ${st.theirs ? `<div class="daily-a them"><b>${P}</b><p>${esc(st.theirs)}</p></div>`
         : `<p class="daily-wait">${ic('lock')}<span><b>${P}</b>’nın cevabı, o da cevaplayınca burada açılacak</span></p>`}`}
  </section>`;
  const bind = root => {
    const f = $('#dailyForm', root);
    if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      const answer = f.a.value.trim(); if (!answer) return;
      const b = $('button', f); b.disabled = true;
      try {
        await api.insert('daily_answers', { day, qidx: dailyIdx(day), answer });
        hearts(10); toast(st.they_answered ? 'Cevaplarınız açıldı' : `${partnerName()} cevaplayınca birbirinizinkini göreceksiniz`);
        const next = await dailyCard(withArchiveLink);
        const old = $('#daily', root); old.outerHTML = next.html; next.bind(root);
      } catch (er) { toast(er.message); b.disabled = false; }
    };
  };
  return { html, bind };
}
async function dailyPage(v) {
  const [card, hist] = await Promise.all([dailyCard(false), api.rpc('daily_history').catch(() => [])]);
  const past = (hist ?? []).filter(h => h.day !== todayISO());
  v.innerHTML = `${back()}${head('Günün sorusu', '', 'Her gün ikinize aynı soru; cevaplar ikiniz de cevaplayınca açılır')}
    ${card.html}
    ${past.length ? `${sectionTitle('book', 'Birbirimizi tanıdıkça')}${past.map(h => `<div class="card daily-old">
      <p class="date">${fmtDate(h.day)}</p><p class="daily-q sm">${esc(QUESTIONS[h.qidx] ?? '')}</p>
      <div class="daily-a me"><b>Sen</b><p>${esc(h.mine)}</p></div>
      <div class="daily-a them"><b>${esc(partnerName())}</b><p>${esc(h.theirs)}</p></div></div>`).join('')}`
      : `<p class="muted small center pad">İkinizin de cevapladığı sorular burada bir defter gibi birikecek.</p>`}`;
  card.bind(v);
}

// ================================================================== kötü gün modu
const MOODS = [['uzgun', 'Üzgünüm'], ['stres', 'Stresliyim'], ['yorgun', 'Yorgunum'], ['ozledim', 'Seni özledim'], ['konus', 'Konuşmak istiyorum'], ['yanimda', 'Sadece yanımda ol']];
const moodName = k => MOODS.find(m => m[0] === k)?.[1] ?? 'Her zaman';
const COMFORT_KINDS = [['note', 'Not', 'edit'], ['photo', 'Fotoğraf', 'image'], ['audio', 'Ses', 'mic'], ['memory', 'Anı', 'book'], ['letter', 'Mektup', 'mail'], ['call', 'Arama', 'phone']];
let comfortTab = 'al', comfortMood = null;

async function comfort(v) {
  const [items, mems, letterRows, reasons, photos] = await Promise.all([
    api.list('comfort_items', 300), api.list('memories', 300), api.list('letters', 300), api.list('reasons', 300), api.list('photos', 300),
  ]);
  cache('comfort_items', items);
  const P = esc(partnerName());
  if (comfortTab === 'al') {
    const forMe = items.filter(i => !isMine(i));
    const list = forMe.filter(i => !comfortMood || i.mood === 'hepsi' || i.mood === comfortMood);
    const hisReasons = reasons.filter(r => !isMine(r));
    const reason = hisReasons.length ? hisReasons[Math.floor(Math.random() * hisReasons.length)] : null;
    const pool = [...photos.map(p => p.path), ...mems.flatMap(m => m.photos)];
    const pic = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    await loadUrls([...list.flatMap(i => [i.media]), ...list.filter(i => i.kind === 'memory').map(i => mems.find(m => m.id === i.ref_id)?.photos?.[0]), pic].filter(Boolean));
    v.innerHTML = `<div class="comfort">${back()}
      <div class="cf-head"><p class="cf-kicker">Buradayım</p><h1>Bugün biraz zor mu?</h1>
        <p class="muted">Ne hissettiğini seçebilirsin; seçmek zorunda değilsin.</p></div>
      ${segComfort()}
      <div class="cf-moods">${MOODS.map(([k, l]) => `<button data-md="${k}" class="${comfortMood === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${list.length ? `<p class="cf-sub">${P} senin için hazırladı</p>${list.map(i => comfortCard(i, mems, letterRows)).join('')}`
        : `<div class="card cf-empty"><p>${forMe.length ? `${P} bu his için henüz bir şey hazırlamadı; ama her zaman yanında.` : `${P} henüz destek kartı hazırlamadı. Bu arada şunlar iyi gelebilir:`}</p></div>`}
      ${(reason || pic) ? `<p class="cf-sub">Bir de bunlar</p>
        ${reason ? `<div class="card cf-card note"><p class="quote">“${esc(reason.text)}”</p><span class="by">— ${esc(nameOf(reason.author))}, seni neden sevdiğini yazmıştı</span></div>` : ''}
        ${pic ? `<button class="card cf-card photo" data-pic="${esc(pic)}">${img(pic)}</button>` : ''}` : ''}
      <div class="card cf-tell">
        <p><b>${P}’ya haber vermek ister misin?</b><br><span class="muted small">Telefonuna “bugün biraz zor bir gün geçiriyorsun” diye bildirim gider; ayrıntı yazmaz.</span></p>
        <button class="btn" id="cfTell">${ic('heart')}${P}’ya haber ver</button>
      </div></div>`;
    $$('[data-md]', v).forEach(b => b.onclick = () => { comfortMood = comfortMood === b.dataset.md ? null : b.dataset.md; rerender(); });
    $$('[data-pic]', v).forEach(b => b.onclick = () => lightbox(b.dataset.pic));
    $$('[data-letter]', v).forEach(b => b.onclick = () => { const l = letterRows.find(x => x.id === b.dataset.letter); if (l) openLetter(l); });
    $$('[data-mem]', v).forEach(b => b.onclick = () => { const m = mems.find(x => x.id === b.dataset.mem); if (m?.photos?.[0]) lightbox(m.photos[0], m.title, fmtDate(m.happened_on)); else location.hash = '#/anilar'; });
    bindAudio(v);
    $('#cfTell').onclick = () => {
      const m = modal(`<h2>${P}’ya haber ver</h2>
        <p>${P}’nın telefonuna <b>“${esc(nameOf(state.me.id))} bugün biraz zor bir gün geçiriyor”</b> diye bildirim gidecek.</p>
        ${comfortMood ? `<label class="check"><input type="checkbox" id="cfShare"> Ne hissettiğimi de görsün (“${esc(moodName(comfortMood))}”)</label>` : ''}
        <button class="btn" id="cfSend">Gönder</button>`);
      $('#cfSend', m).onclick = async () => {
        try {
          await api.insert('support_pings', { mood: $('#cfShare', m)?.checked ? comfortMood : null });
          m.close(); toast(`${partnerName()}’ya haber verildi`);
        } catch (er) { toast(er.message); }
      };
    };
  } else {
    const mine = items.filter(isMine);
    await loadUrls(mine.map(i => i.media).filter(Boolean));
    v.innerHTML = `<div class="comfort">${back()}
      <div class="cf-head"><p class="cf-kicker">Onun için</p><h1>Zor günler için hazırla</h1>
        <p class="muted">${P} kendini kötü hissettiğinde açacağı kartlar: bir not, sesin, bir fotoğraf, bir anı, bir mektup ya da seni arama butonu.</p></div>
      ${segComfort()}
      <button class="btn" id="cfAdd">${ic('plus')}Kart hazırla</button>
      ${mine.length ? mine.map(i => `<div class="card cf-mine"><span class="list-ic">${ic(COMFORT_KINDS.find(k => k[0] === i.kind)?.[2] ?? 'heart')}</span>
        <span class="grow"><b>${esc(COMFORT_KINDS.find(k => k[0] === i.kind)?.[1] ?? '')}</b> · <span class="muted small">${esc(moodName(i.mood))}</span><br>
        <span class="small">${esc(i.kind === 'memory' ? (mems.find(m => m.id === i.ref_id)?.title ?? '') : i.kind === 'letter' ? (letterRows.find(l => l.id === i.ref_id)?.title ?? '') : i.body ?? (i.kind === 'audio' ? `${mmss(i.audio_secs || 0)} ses kaydı` : ''))}</span></span>
        ${acts('comfort_items', i)}</div>`).join('') : `<p class="muted small center pad">Henüz kart hazırlamadın.</p>`}
    </div>`;
    $('#cfAdd').onclick = () => comfortForm(mems, letterRows);
  }
  $$('.seg button', v).forEach(b => b.onclick = () => { comfortTab = b.dataset.t; rerender(); });
}
const segComfort = () => `<div class="seg"><button data-t="al" class="${comfortTab === 'al' ? 'on' : ''}">Bana iyi gelsin</button><button data-t="hazirla" class="${comfortTab === 'hazirla' ? 'on' : ''}">Onun için hazırla</button></div>`;

function comfortCard(i, mems, letterRows) {
  const by = `<span class="by">— ${esc(nameOf(i.author))}${i.mood !== 'hepsi' ? ` · ${esc(moodName(i.mood))}` : ''}</span>`;
  switch (i.kind) {
    case 'note': return `<div class="card cf-card note"><p class="quote">“${esc(i.body)}”</p>${by}</div>`;
    case 'photo': return `<div class="card cf-card"><button class="cf-photo" data-pic="${esc(i.media)}">${img(i.media)}</button>${i.body ? `<p class="quote sm">${esc(i.body)}</p>` : ''}${by}</div>`;
    case 'audio': return `<div class="card cf-card"><div class="m-audio cf-audio" data-src="${esc(i.media)}" data-secs="${i.audio_secs || 0}"><button class="play" type="button" aria-label="Dinle">${ic('play')}</button><div class="bar"><span></span></div><span class="dur">${mmss(i.audio_secs || 0)}</span></div>${i.body ? `<p class="quote sm">${esc(i.body)}</p>` : ''}${by}</div>`;
    case 'memory': {
      const m = mems.find(x => x.id === i.ref_id); if (!m) return '';
      return `<button class="card cf-card cf-link" data-mem="${m.id}"><span class="thumb">${m.photos?.[0] ? img(m.photos[0]) : ic('book')}</span><span class="grow"><b>${esc(m.title)}</b><br><span class="muted small">${fmtDate(m.happened_on)} · birlikte bir anı</span>${i.body ? `<br><span class="small">${esc(i.body)}</span>` : ''}</span></button>`;
    }
    case 'letter': {
      const l = letterRows.find(x => x.id === i.ref_id); if (!l) return '';
      return `<button class="card cf-card cf-link" data-letter="${l.id}"><span class="list-ic">${ic('mail')}</span><span class="grow"><b>${esc(l.title)}</b><br><span class="muted small">${esc(nameOf(l.author))}’dan bir mektup · dokun, aç</span></span></button>`;
    }
    case 'call': return `<div class="card cf-card cf-call"><a class="btn" href="tel:${esc((i.body || '').replace(/[^\d+]/g, ''))}">${ic('phone')}${esc(nameOf(i.author))}’yı ara</a><p class="muted small center">Sesini duymak iyi gelebilir</p></div>`;
  }
  return '';
}

function comfortForm(mems = [], letterRows = []) {
  const myLetters = letterRows.filter(l => isMine(l) && (!l.open_at || new Date(l.open_at) <= new Date()));
  let kind = 'note', rec = null, chunks = [], started = 0, stream = null, audio = null, tmr = null;
  const m = modal(`<h2>Destek kartı hazırla</h2>
    <form>
      <label>Hangi his için?<select name="mood"><option value="hepsi">Her zaman</option>${MOODS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Ne hazırlamak istersin?</label>
      <div class="cf-kinds">${COMFORT_KINDS.map(([k, l, i]) => `<button type="button" data-kind="${k}" class="${k === kind ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div>
      <div class="cf-fields"></div>
      <p class="err"></p><button class="btn">Kaydet</button>
    </form>`);
  const form = $('form', m), box = $('.cf-fields', m);
  const stopRec = () => { clearInterval(tmr); stream?.getTracks().forEach(t => t.stop()); };
  const draw = () => {
    stopRec(); audio = null;
    box.innerHTML = {
      note: `<label>Notun<textarea name="body" rows="4" required placeholder="Ne olursa olsun yanındayım…"></textarea></label>`,
      photo: `<label class="file">${ic('camera')} Fotoğraf seç<input type="file" accept="image/*"></label><div class="previews fresh"></div><label>Kısa bir not<input name="body" placeholder="İsteğe bağlı"></label>`,
      audio: `<div class="cf-rec"><button type="button" class="btn small" id="recBtn">${ic('mic')}Kaydı başlat</button><span id="recInfo" class="muted small">En fazla 3 dakika</span></div><audio id="recPrev" controls hidden></audio><label>Kısa bir not<input name="body" placeholder="İsteğe bağlı"></label>`,
      memory: mems.length ? `<label>Hangi anı?<select name="ref">${mems.map(x => `<option value="${x.id}">${esc(x.title)} · ${fmtDate(x.happened_on)}</option>`).join('')}</select></label><label>Kısa bir not<input name="body" placeholder="İsteğe bağlı"></label>` : `<p class="muted small">Önce Anılar’a bir anı ekleyin.</p>`,
      letter: myLetters.length ? `<label>Hangi mektup?<select name="ref">${myLetters.map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select></label>` : `<p class="muted small">${esc(partnerName())}’ya yazdığın, açılmış bir mektup yok. Önce Mektuplar’dan yaz.</p>`,
      call: `<label>Telefon numaran<input name="body" type="tel" required placeholder="+90 5…" inputmode="tel"></label><p class="muted small">Kartta “${esc(nameOf(state.me.id))}’yı ara” butonu çıkar.</p>`,
    }[kind];
    const fi = $('input[type=file]', box);
    if (fi) fi.onchange = () => { $('.fresh', box).innerHTML = [...fi.files].map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join(''); };
    const rb = $('#recBtn', box);
    if (rb) rb.onclick = async () => {
      if (rec?.state === 'recording') { rec.stop(); return; }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Bu cihaz ses kaydını desteklemiyor');
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Mikrofon izni verilmedi'); }
      const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      rec = new MediaRecorder(stream, type ? { mimeType: type } : {}); chunks = []; started = Date.now();
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stopRec();
        const mime = (rec.mimeType || type || 'audio/mp4').split(';')[0];
        audio = { blob: new Blob(chunks, { type: mime }), secs: Math.round((Date.now() - started) / 1000), mime };
        const pv = $('#recPrev', box); pv.src = URL.createObjectURL(audio.blob); pv.hidden = false;
        rb.innerHTML = `${ic('mic')}Yeniden kaydet`; $('#recInfo', box).textContent = `${mmss(audio.secs)} kaydedildi`;
      };
      rec.start(250);
      rb.innerHTML = `${ic('pause')}Durdur`;
      tmr = setInterval(() => { const s = (Date.now() - started) / 1000; $('#recInfo', box).textContent = `Kaydediliyor ${mmss(s)}`; if (s >= 180) rec.stop(); }, 250);
    };
  };
  $$('[data-kind]', m).forEach(b => b.onclick = () => { kind = b.dataset.kind; $$('[data-kind]', m).forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
  const _close = m.close; m.close = () => { stopRec(); _close(); };
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.x')) stopRec(); });
  form.onsubmit = async e => {
    e.preventDefault();
    const err = $('.err', form), b = $('button.btn', form);
    const row = { mood: form.mood.value, kind, body: form.body?.value.trim() || null };
    try {
      b.disabled = true;
      if (kind === 'photo') {
        const f = $('input[type=file]', box)?.files?.[0]; if (!f) throw new Error('Bir fotoğraf seç');
        b.textContent = 'Yükleniyor…'; row.media = await api.upload(await compress(f));
      }
      if (kind === 'audio') {
        if (!audio) throw new Error('Önce sesini kaydet');
        b.textContent = 'Yükleniyor…';
        row.media = await api.upload(audio.blob, audio.mime.includes('webm') ? 'webm' : 'm4a', audio.mime); row.audio_secs = audio.secs;
      }
      if (kind === 'memory' || kind === 'letter') { if (!form.ref) throw new Error('Seçilecek bir şey yok'); row.ref_id = form.ref.value; }
      await api.insert('comfort_items', row);
      m.close(); toast('Kart hazır; zor bir günde onu bekliyor'); comfortTab = 'hazirla'; rerender();
    } catch (er) { err.textContent = er.message; b.disabled = false; b.textContent = 'Kaydet'; }
  };
}

// ================================================================== Fısıltı (mesajlaşma)
let chatRefresh = null, rtStop = null, chatPoll = null;
function startRealtime() {
  if (rtStop) return;
  try {
    rtStop = api.subscribe('messages', () => { refreshChatBadge(); chatRefresh?.(); });
  } catch {}
}
async function refreshChatBadge() {
  try {
    const rows = await api.list('messages', 200);
    const n = rows.filter(m => !isMine(m) && !m.read_at).length;
    const b = $('.chat-n');
    if (b) { b.hidden = !n; b.textContent = n > 9 ? '9+' : n; }
  } catch {}
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s)) % 60).padStart(2, '0')}`;
const dayLabel = d => d === todayISO() ? 'Bugün' : d === localISO(new Date(Date.now() - 864e5)).slice(0, 10) ? 'Dün' : fmtDate(d);
const timeOf = ts => new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

let playing = null;
function bindAudio(root) {
  $$('.m-audio', root).forEach(el => {
    const btn = $('.play', el), bar = $('.bar span', el), dur = $('.dur', el);
    btn.onclick = e => {
      e.stopPropagation();
      if (playing?.el === el) { playing.audio.paused ? playing.audio.play() : playing.audio.pause(); return; }
      if (playing) { playing.audio.pause(); playing.el.classList.remove('on'); $('.play', playing.el).innerHTML = ic('play'); }
      const a = new Audio(state.urls[el.dataset.src]);
      playing = { el, audio: a };
      a.onplay = () => { el.classList.add('on'); btn.innerHTML = ic('pause'); };
      a.onpause = () => { btn.innerHTML = ic('play'); };
      a.ontimeupdate = () => { if (a.duration) { bar.style.width = `${a.currentTime / a.duration * 100}%`; dur.textContent = mmss(a.currentTime); } };
      a.onended = () => { el.classList.remove('on'); btn.innerHTML = ic('play'); bar.style.width = '0'; dur.textContent = mmss(+el.dataset.secs || 0); playing = null; };
      a.play().catch(() => toast('Ses çalınamadı'));
    };
  });
}

function bubble(m) {
  const mine = isMine(m);
  return `<div class="msg ${mine ? 'me' : 'them'} ${m.hearted ? 'has-heart' : ''}" data-mid="${m.id}">
    <div class="bubble ${m.photo && !m.body ? 'photo-only' : ''}">
      ${m.photo ? `<span class="m-photo">${img(m.photo)}</span>` : ''}
      ${m.audio ? `<div class="m-audio" data-src="${esc(m.audio)}" data-secs="${m.audio_secs || 0}"><button class="play" type="button" aria-label="Dinle">${ic('play')}</button><div class="bar"><span></span></div><span class="dur">${mmss(m.audio_secs || 0)}</span></div>` : ''}
      ${m.body ? `<p>${esc(m.body)}</p>` : ''}
      <span class="m-meta">${timeOf(m.created_at)}${mine ? (m.read_at ? ' · Okundu' : ' · İletildi') : ''}</span>
      ${m.hearted ? `<span class="m-heart">${ic('heart')}</span>` : ''}
    </div></div>`;
}

async function chat(v) {
  v.innerHTML = `
    <div class="chat-head">
      <a class="icon-btn" href="#/" aria-label="Geri">${ic('back')}</a>
      <div class="grow"><h1>Fısıltı</h1><p class="muted small">Sadece ${esc(nameOf(state.me.id))} ve ${esc(partnerName())}</p></div>
    </div>
    <div class="msgs" id="msgs"></div>
    <div class="composer-wrap">
      <form class="composer" id="composer">
        <label class="icon-btn" aria-label="Fotoğraf gönder">${ic('camera')}<input type="file" accept="image/*" id="cPhoto" hidden></label>
        <textarea id="cText" rows="1" placeholder="${esc(partnerName())}’ya bir fısıltı…"></textarea>
        <button type="button" class="icon-btn mic" id="cMic" aria-label="Sesli mesaj">${ic('mic')}</button>
        <button type="submit" class="send" id="cSend" aria-label="Gönder" hidden>${ic('send')}</button>
      </form>
      <div class="recbar" id="recbar" hidden>
        <span class="rec-dot"></span><span id="recTime">0:00</span><span class="grow muted small">Kaydediliyor…</span>
        <button type="button" class="link danger" id="recCancel">Vazgeç</button>
        <button type="button" class="send" id="recSend" aria-label="Gönder">${ic('send')}</button>
      </div>
    </div>`;

  const box = $('#msgs');
  let lastHtml = '';
  const render = async (forceBottom = false) => {
    const rows = cache('messages', (await api.list('messages', 300)).slice().reverse());
    await loadUrls(rows.flatMap(m => [m.photo, m.audio]).filter(Boolean));
    let last = '';
    const html = rows.length ? rows.map(m => {
      const d = dayOf(m.created_at), sep = d !== last ? `<div class="day-sep"><span>${dayLabel(d)}</span></div>` : '';
      last = d; return sep + bubble(m);
    }).join('') : `<div class="chat-empty">${ic('chat', 'xl')}<p>İlk fısıltıyı sen yaz</p><p class="muted small">Mesaja iki kez dokununca kalp bırakırsın, bir kez dokununca seçenekler açılır.</p></div>`;
    if (html === lastHtml && !forceBottom) return;
    const nearBottom = innerHeight + scrollY >= document.body.scrollHeight - 160;
    lastHtml = html; box.innerHTML = html; bindAudio(box);
    if (forceBottom || nearBottom) requestAnimationFrame(() => scrollTo(0, document.body.scrollHeight));
    if (rows.some(m => !isMine(m) && !m.read_at) && document.visibilityState === 'visible') {
      api.rpc('mark_messages_read').then(refreshChatBadge).catch(() => {});
    }
  };
  chatRefresh = () => render();
  clearInterval(chatPoll);
  chatPoll = setInterval(() => { if (location.hash.startsWith('#/fisilti') && document.visibilityState === 'visible') render(); else clearInterval(chatPoll); }, 12000);
  await render(true);

  // ---- tek dokunuş: seçenekler, çift dokunuş: kalp
  let tapT = null, tapId = null;
  box.onclick = e => {
    if (e.target.closest('.m-audio')) return;
    const el = e.target.closest('.msg'); if (!el) return;
    const m = state.cache.messages.find(x => x.id === el.dataset.mid); if (!m) return;
    if (tapId === m.id && tapT) {
      clearTimeout(tapT); tapT = null; tapId = null;
      if (!isMine(m)) heartMsg(m, el);
      return;
    }
    tapId = m.id;
    tapT = setTimeout(() => { tapT = null; tapId = null; msgSheet(m); }, 280);
  };
  const heartMsg = async (m, el) => {
    try {
      await api.rpc('toggle_heart', { mid: m.id });
      if (el) { const r = el.getBoundingClientRect(); floatHearts({ getBoundingClientRect: () => r }); }
      render();
    } catch (er) { toast(er.message); }
  };
  const msgSheet = m => {
    const mine = isMine(m);
    const sh = modal(`<div class="sheet">
      ${m.photo ? `<button data-a="photo">${ic('image')}Fotoğrafı büyüt</button>` : ''}
      ${!mine ? `<button data-a="heart">${ic('heart')}${m.hearted ? 'Kalbi kaldır' : 'Kalp bırak'}</button>` : ''}
      ${m.body || m.photo ? `<button data-a="pin">${ic('book')}Anılara ekle</button>` : ''}
      ${m.body ? `<button data-a="copy">${ic('copy')}Kopyala</button>` : ''}
      ${mine || state.admin ? `<button data-a="del" class="danger">${ic('trash')}Sil</button>` : ''}
      <p class="muted small center">${fmtDateTime(m.created_at)}</p></div>`, 'sheet-modal');
    $$('[data-a]', sh).forEach(b => b.onclick = async () => {
      sh.close();
      const a = b.dataset.a;
      if (a === 'photo') lightbox(m.photo, '', fmtDateTime(m.created_at));
      if (a === 'heart') heartMsg(m);
      if (a === 'copy') { try { await navigator.clipboard.writeText(m.body); toast('Kopyalandı'); } catch { toast('Kopyalanamadı'); } }
      if (a === 'pin') editForm('memories', null, {
        heading: 'Anılara ekle',
        defaults: { title: `${nameOf(m.author)}’dan bir fısıltı`, body: m.body ?? '', happened_on: dayOf(m.created_at), photos: m.photo ? [m.photo] : [] },
        after: () => toast('Anılarınıza eklendi'),
      });
      if (a === 'del') {
        if (!confirm('Bu mesaj silinsin mi?')) return;
        try { await api.remove('messages', m.id); await removeUnused([m.photo, m.audio]); render(); }
        catch (er) { toast(er.message); }
      }
    });
  };

  // ---- yazı
  const text = $('#cText'), send = $('#cSend'), mic = $('#cMic');
  const sync = () => {
    text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight, 140) + 'px';
    const has = !!text.value.trim(); send.hidden = !has; mic.hidden = has;
  };
  text.oninput = sync;
  text.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !isIOS && matchMedia('(pointer: fine)').matches) { e.preventDefault(); $('#composer').requestSubmit(); } };
  $('#composer').onsubmit = async e => {
    e.preventDefault();
    const body = text.value.trim(); if (!body) return;
    text.value = ''; sync(); text.focus();
    try { await api.insert('messages', { body }); render(true); } catch (er) { toast(er.message); text.value = body; sync(); }
  };

  // ---- fotoğraf
  $('#cPhoto').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    toast('Fotoğraf gönderiliyor…');
    try { const path = await api.upload(await compress(f)); await api.insert('messages', { photo: path }); render(true); }
    catch (er) { toast(er.message); }
  };

  // ---- sesli mesaj
  let rec = null, chunks = [], started = 0, stream = null, timer = null, cancelled = false;
  const recbar = $('#recbar'), comp = $('#composer');
  const stopUI = () => { clearInterval(timer); recbar.hidden = true; comp.hidden = false; stream?.getTracks().forEach(t => t.stop()); };
  mic.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Bu cihaz ses kaydını desteklemiyor');
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return toast('Mikrofon izni verilmedi'); }
    const type = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(stream, type ? { mimeType: type } : {});
    chunks = []; cancelled = false; started = Date.now();
    rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data); };
    rec.onstop = async () => {
      const secs = Math.round((Date.now() - started) / 1000);
      stopUI();
      if (cancelled || secs < 1) return;
      const mime = (rec.mimeType || type || 'audio/mp4').split(';')[0];
      const ext = mime.includes('webm') ? 'webm' : 'm4a';
      toast('Sesli mesaj gönderiliyor…');
      try {
        const path = await api.upload(new Blob(chunks, { type: mime }), ext, mime);
        await api.insert('messages', { audio: path, audio_secs: secs }); render(true);
      } catch (er) { toast(er.message); }
    };
    rec.start(250);
    comp.hidden = true; recbar.hidden = false; $('#recTime').textContent = '0:00';
    timer = setInterval(() => {
      const s = (Date.now() - started) / 1000;
      $('#recTime').textContent = mmss(s);
      if (s >= 180) rec.state === 'recording' && rec.stop();
    }, 250);
  };
  $('#recCancel').onclick = () => { cancelled = true; rec?.state === 'recording' && rec.stop(); };
  $('#recSend').onclick = () => { rec?.state === 'recording' && rec.stop(); };
}

// ================================================================== oyunlar: Bu mu, o mu?
let totTab = 'play';
async function thisOrThat(v) {
  const [custom, answers] = await Promise.all([api.list('tot_questions'), api.list('tot_answers')]);
  cache('tot_questions', custom);
  const qs = [...TOT.map(([a, b], i) => ({ key: 'b' + i, a, b })), ...custom.map(q => ({ key: 'c' + q.id, a: q.a, b: q.b, row: q }))];
  const mine = Object.fromEntries(answers.filter(isMine).map(a => [a.qkey, a.pick]));
  const his = Object.fromEntries(answers.filter(a => !isMine(a)).map(a => [a.qkey, a.pick]));
  const both = qs.filter(q => q.key in mine && q.key in his);
  const same = both.filter(q => mine[q.key] === his[q.key]).length;
  const pct = both.length ? Math.round(same / both.length * 100) : null;
  const next = qs.find(q => !(q.key in mine));
  const done = qs.filter(q => q.key in mine).length;

  v.innerHTML = `${back()}${head('Bu mu, o mu?', addBtn('add', 'Soru'), 'İkiniz de seçin, ne kadar uyumlu olduğunuzu görün')}
    <div class="seg"><button data-t="play" class="${totTab === 'play' ? 'on' : ''}">Oyna</button><button data-t="res" class="${totTab === 'res' ? 'on' : ''}">Uyumumuz</button></div>
    ${totTab === 'play' ? (next ? `
      <p class="muted small center">${done + 1} / ${qs.length}</p>
      <div class="tot" id="tot">
        <button class="tot-opt" data-pick="0"><span>${esc(next.a)}</span></button>
        <span class="tot-or">ya da</span>
        <button class="tot-opt" data-pick="1"><span>${esc(next.b)}</span></button>
      </div>
      <p class="tot-reveal" id="totReveal"></p>`
      : `<div class="card empty">${ic('check', 'xl')}<p>Hepsini cevapladın.</p><p class="muted small">Yeni bir soru ekleyebilirsin, ${esc(partnerName())} da cevaplasın.</p></div>`)
    : `
      <div class="compat card">
        <div class="ring" style="--p:${pct ?? 0}"><b>${pct === null ? '—' : pct + '%'}</b><span>uyumluyuz</span></div>
        <p class="muted small">${both.length ? `${both.length} sorunun ${same} tanesinde aynı şeyi seçtiniz` : `İkiniz de cevapladıkça burada görünecek`}</p>
      </div>
      ${both.slice().reverse().map(q => `<div class="card tot-row ${mine[q.key] === his[q.key] ? 'same' : ''}">
        <span class="grow"><b>${esc(q.a)}</b> <span class="muted">ya da</span> <b>${esc(q.b)}</b><br>
        <span class="small">Sen: ${esc(mine[q.key] ? q.b : q.a)} · ${esc(partnerName())}: ${esc(his[q.key] ? q.b : q.a)}</span></span>
        ${mine[q.key] === his[q.key] ? ic('heart') : ''}${q.row ? acts('tot_questions', q.row) : ''}</div>`).join('')}`}`;

  $$('.seg button', v).forEach(b => b.onclick = () => { totTab = b.dataset.t; rerender(); });
  $('#add').onclick = () => editForm('tot_questions');
  $$('[data-pick]', v).forEach(b => b.onclick = async () => {
    const pick = +b.dataset.pick;
    $$('[data-pick]', v).forEach(x => { x.disabled = true; x.classList.toggle('chosen', x === b); });
    try {
      await api.upsert('tot_answers', { author: state.me.id, qkey: next.key, pick }, 'author,qkey');
      const r = $('#totReveal');
      if (next.key in his) {
        const ok = his[next.key] === pick;
        r.innerHTML = ok ? `Aynı şeyi seçtiniz` : `${esc(partnerName())} “${esc(his[next.key] ? next.b : next.a)}” dedi`;
        r.className = 'tot-reveal show ' + (ok ? 'ok' : '');
        if (ok) hearts(14);
      } else {
        r.textContent = `${partnerName()} cevaplayınca uyumunuz görünecek`;
        r.className = 'tot-reveal show';
      }
      setTimeout(rerender, 1300);
    } catch (er) { toast(er.message); }
  });
}

// ================================================================== oyunlar: fotoğraflarla hafıza
async function memoryGame(v) {
  const [photos, mems, scores] = await Promise.all([api.list('photos', 300), api.list('memories', 300), api.list('memory_scores', 200)]);
  cache('memory_scores', scores);
  const pool = [...new Set([...photos.map(p => p.path), ...mems.flatMap(m => m.photos)])];
  const best = who => scores.filter(s => who(s)).sort((a, b) => a.seconds - b.seconds || a.moves - b.moves)[0];
  const myBest = best(isMine), hisBest = best(s => !isMine(s));
  const recordCard = `<div class="records card">
    <div><span class="muted small">Senin rekorun</span><b>${myBest ? mmss(myBest.seconds) : '—'}</b><span class="small">${myBest ? `${myBest.moves} hamle` : ''}</span></div>
    <div><span class="muted small">${esc(partnerName())}’nın rekoru</span><b>${hisBest ? mmss(hisBest.seconds) : '—'}</b><span class="small">${hisBest ? `${hisBest.moves} hamle` : ''}</span></div>
  </div>`;
  if (pool.length < 4) {
    v.innerHTML = `${back()}${head('Hafıza oyunu', '', 'Kartların arkasında sizin fotoğraflarınız var')}${recordCard}
      ${empty('cards', `Oyun için en az 4 fotoğraf gerekiyor. Galeriye ya da anılara fotoğraf ekleyin (şu an ${pool.length}).`)}`;
    return;
  }
  const pairs = Math.min(8, pool.length);
  const chosen = pool.sort(() => Math.random() - .5).slice(0, pairs);
  await loadUrls(chosen);
  const deck = [...chosen, ...chosen].map((p, i) => ({ p, i })).sort(() => Math.random() - .5);
  v.innerHTML = `${back()}${head('Hafıza oyunu', `<button class="btn small ghost" id="again">Yeniden</button>`, 'Aynı iki fotoğrafı bul')}
    ${recordCard}
    <div class="mg-stats"><span id="mgTime">0:00</span><span id="mgMoves">0 hamle</span><span id="mgPairs">0 / ${pairs}</span></div>
    <div class="mgrid c${pairs <= 6 ? 3 : 4}">${deck.map((c, i) => `<button class="mcard" data-i="${i}"><span class="mc-inner"><span class="mc-front">${ic('heart')}</span><span class="mc-back">${img(c.p)}</span></span></button>`).join('')}</div>`;
  $('#again').onclick = rerender;
  let first = null, lock = false, moves = 0, found = 0, start = 0, tmr = null;
  const tickT = () => { $('#mgTime') ? ($('#mgTime').textContent = mmss((Date.now() - start) / 1000)) : clearInterval(tmr); };
  $$('.mcard', v).forEach(b => b.onclick = async () => {
    if (lock || b.classList.contains('open') || b.classList.contains('done')) return;
    if (!start) { start = Date.now(); tmr = setInterval(tickT, 250); }
    b.classList.add('open');
    if (!first) { first = b; return; }
    moves++; $('#mgMoves').textContent = `${moves} hamle`;
    const a = deck[+first.dataset.i].p, c = deck[+b.dataset.i].p;
    if (a === c) {
      first.classList.add('done'); b.classList.add('done'); first = null; found++;
      $('#mgPairs').textContent = `${found} / ${pairs}`;
      try { navigator.vibrate?.(20); } catch {}
      if (found === pairs) {
        clearInterval(tmr);
        const seconds = Math.round((Date.now() - start) / 1000);
        hearts(36);
        const record = !myBest || seconds < myBest.seconds;
        const beat = hisBest && seconds < hisBest.seconds;
        try { await api.insert('memory_scores', { seconds, moves, pairs }); } catch {}
        const m = modal(`<div class="center"><h2>${record ? 'Yeni rekor!' : 'Tebrikler'}</h2>
          <p class="big-time">${mmss(seconds)}</p><p class="muted">${moves} hamle · ${pairs} çift</p>
          ${beat ? `<p class="quote">${esc(partnerName())}’nın rekorunu kırdın</p>` : hisBest ? `<p class="muted small">${esc(partnerName())}’nın rekoru: ${mmss(hisBest.seconds)}</p>` : ''}
          <button class="btn" id="again2">Tekrar oyna</button></div>`);
        $('#again2', m).onclick = () => { m.close(); rerender(); };
      }
    } else {
      lock = true;
      const f = first; first = null;
      setTimeout(() => { f.classList.remove('open'); b.classList.remove('open'); lock = false; }, 850);
    }
  });
}

// ================================================================== sayfa temizliği (animasyonlar, kanallar)
let pageCleanup = null;

// ================================================================== yıldız haritamız
const SKY_TZ_OFFSET = '+03:00';   // Türkiye: kalıcı UTC+3
async function starsPage(v, [id]) {
  const rows = cache('star_maps', await api.list('star_maps'));
  if (id) return starView(v, rows.find(r => r.id === id));
  v.innerHTML = `${back()}${head('Yıldız haritamız', addBtn('add', 'Harita'), 'Önemli anlarımızda gökyüzü tam olarak nasıldı?')}
    ${rows.length ? rows.map(r => `<a class="card sky-item" href="#/yildizlar/${r.id}">
      <span class="sky-dot">${ic('star')}</span>
      <span class="grow"><b>${esc(r.title)}</b><br><span class="muted small">${fmtDateTime(r.event_at)} · ${esc(r.location_label || '')}</span></span>
      ${ic('chevron', 'chev')}</a>`).join('')
      : `<div class="card empty">${ic('star', 'xl')}<p>İlk yıldız haritanızı oluşturun. Örneğin 7 Kasım 19:00, ilk gördüğün an.</p></div>`}
    <p class="muted small center pad">Haritalar gerçek yıldız konumlarıyla hesaplanır (Hipparcos kataloğu, yaklaşık 4.000 yıldız).</p>`;
  $('#add').onclick = () => starForm();
}

function starForm() {
  const def = localISO(new Date(START)).slice(0, 16);
  const m = modal(`<h2>Yeni yıldız haritası</h2>
    <form>
      <label>Başlık<input name="title" required value="Seni ilk gördüğüm an"></label>
      <label>Tarih ve saat (Türkiye saati)<input type="datetime-local" name="at" required value="${def}"></label>
      <label>Şehir<select name="city"><option value="">— Haritadan ya da koordinatla seç —</option>${CITIES.map(([n], i) => `<option value="${i}" ${n === 'İstanbul' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button type="button" class="btn small ghost" id="pickMap">${ic('pin')}Haritadan tam yer seç</button>
      <div id="miniMap" class="mini-map" hidden></div>
      <div class="row"><label>Enlem<input name="lat" type="number" step="any" required value="41.0082"></label><label>Boylam<input name="lng" type="number" step="any" required value="28.9784"></label></div>
      <label>Yer adı<input name="place" value="İstanbul" placeholder="Ör. Moda sahili"></label>
      <label>Not<textarea name="note" rows="2" placeholder="O an aklımızda kalan…"></textarea></label>
      <label class="file">${ic('camera')} İsteğe bağlı fotoğraf<input type="file" accept="image/*"></label>
      <div class="previews fresh"></div>
      <p class="err"></p><button class="btn">Haritayı oluştur</button>
    </form>`);
  const f = $('form', m);
  f.city.onchange = () => { const c = CITIES[+f.city.value]; if (c) { f.lat.value = c[1]; f.lng.value = c[2]; f.place.value = c[0]; } };
  const fi = $('input[type=file]', f);
  fi.onchange = () => { $('.fresh', f).innerHTML = [...fi.files].map(x => `<img src="${URL.createObjectURL(x)}" alt="">`).join(''); };
  $('#pickMap', m).onclick = async () => {
    const box = $('#miniMap', m); box.hidden = false;
    const L = await loadLeaflet();
    const map = L.map(box).setView([+f.lat.value || 39, +f.lng.value || 35], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    let mk = L.marker([+f.lat.value, +f.lng.value]).addTo(map);
    map.on('click', e => { f.lat.value = e.latlng.lat.toFixed(5); f.lng.value = e.latlng.lng.toFixed(5); mk.setLatLng(e.latlng); f.city.value = ''; if (!f.place.value) f.place.value = 'Seçilen yer'; });
    setTimeout(() => map.invalidateSize(), 150);
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const b = $('button.btn', f), lat = +f.lat.value, lng = +f.lng.value;
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) { $('.err', f).textContent = 'Koordinatlar geçersiz'; return; }
    b.disabled = true;
    try {
      let image_path = null;
      if (fi.files[0]) { b.textContent = 'Fotoğraf yükleniyor…'; image_path = await api.upload(await compress(fi.files[0])); }
      const row = await api.insert('star_maps', {
        title: f.title.value.trim(), event_at: new Date(f.at.value + ':00' + SKY_TZ_OFFSET).toISOString(), tz: 'Europe/Istanbul',
        lat, lng, location_label: f.place.value.trim() || null, note: f.note.value.trim() || null, image_path, map_type: 'accurate',
      });
      m.close(); hearts(14); location.hash = `#/yildizlar/${row.id}`;
    } catch (er) { $('.err', f).textContent = er.message; b.disabled = false; b.textContent = 'Haritayı oluştur'; }
  };
}

async function starView(v, r) {
  if (!r) { location.hash = '#/yildizlar'; return; }
  if (r.image_path) await loadUrls([r.image_path]);
  const when = new Date(r.event_at);
  const sub = when.toLocaleString('tr-TR', { timeZone: r.tz || 'Europe/Istanbul', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  v.innerHTML = `${back('#/yildizlar', 'Haritalar')}
    <div class="sky-poster"><canvas id="sky"></canvas><div class="sky-glints">${Array.from({ length: 7 }, (_, i) => `<i style="--d:${i * .7}s;left:${12 + i * 12}%;top:${10 + (i * 37) % 55}%"></i>`).join('')}</div></div>
    <div class="sky-actions"><button class="btn" id="save">${ic('download')}Görsel olarak kaydet</button></div>
    <div class="card">
      <h3 class="serif">${esc(r.title)}</h3>
      <p class="small">${esc(sub)} · ${esc(r.location_label || '')}<br><span class="muted">${fmtCoord(r.lat, r.lng)}</span></p>
      ${r.note ? `<p class="quote">“${esc(r.note)}”</p>` : ''}
      ${r.image_path ? `<button class="sky-photo" data-ph="${esc(r.image_path)}">${img(r.image_path)}</button>` : ''}
      <p class="by">${esc(nameOf(r.author))} oluşturdu ${acts('star_maps', r)}</p>
    </div>
    <p class="muted small center pad">Gerçek gökyüzü: o an, o yerde ufkun üstündeki yıldızlar; merkez başucu noktası, kenar ufuk. Gezegenler ve Ay gösterilmez.</p>`;
  const cv = $('#sky'), data = await loadSky();
  try { await document.fonts.ready; } catch {}
  drawSky(cv, data, { date: when, lat: r.lat, lng: r.lng, title: r.title, sub, place: [r.location_label, fmtCoord(r.lat, r.lng)].filter(Boolean).join('  ·  ') });
  $$('[data-ph]', v).forEach(b => b.onclick = () => lightbox(b.dataset.ph));
  $('#save').onclick = () => cv.toBlob(async blob => {
    const file = new File([blob], `yildiz-haritasi-${dayOf(when)}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: r.title }); return; }
    } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, 'image/png');
}

// ================================================================== ortak çizim defteri
const DRAW_COLORS = ['#3a2a32', '#b4587a', '#e8728f', '#f4a7bf', '#8a6fd1', '#5a8fd6', '#6fa86a', '#f2b24c', '#ffffff'];
const DRAW_SIZES = [[.005, 'İnce'], [.012, 'Orta'], [.026, 'Kalın']];
async function drawPage(v, [id]) {
  if (id) return drawBoardPage(v, id);
  const rows = cache('drawings', await api.list('drawings'));
  await loadUrls(rows.map(r => r.image_path).filter(Boolean));
  v.innerHTML = `${back()}${head('Çizim defterimiz', addBtn('add', 'Yeni çizim'), 'Aynı sayfaya iki telefondan birlikte çizin')}
    ${rows.length ? `<div class="draw-grid">${rows.map(r => `<a class="draw-card" href="#/cizim/${r.id}">
      <span class="draw-thumb">${r.image_path ? img(r.image_path) : ic('brush', 'xl')}</span>
      <b>${esc(r.title)}</b><span class="muted small">${ago(r.updated_at)}</span></a>`).join('')}</div>`
      : `<div class="card empty">${ic('brush', 'xl')}<p>İlk çiziminizi başlatın. ${esc(partnerName())} da aynı anda açarsa çizgileri canlı görürsünüz.</p></div>`}`;
  $('#add').onclick = () => {
    const m = modal(`<h2>Yeni çizim</h2><form><label>Adı<input name="t" value="Çizimimiz" required></label><button class="btn">Başla</button></form>`);
    $('form', m).onsubmit = async e => {
      e.preventDefault();
      try { const row = await api.insert('drawings', { title: e.target.t.value.trim(), strokes: [] }); m.close(); location.hash = `#/cizim/${row.id}`; }
      catch (er) { toast(er.message); }
    };
  };
}

async function drawBoardPage(v, id) {
  const row = await api.getOne('drawings', id);
  if (!row) { location.hash = '#/cizim'; return; }
  cache('drawings', [row]);
  const P = esc(partnerName());
  v.innerHTML = `<div class="draw-page">
    <div class="draw-head">${back('#/cizim', 'Çizimler')}<span class="grow"></span><span class="presence" id="pres"><i></i><span>${P} burada değil</span></span></div>
    <h2 class="draw-title">${esc(row.title)}</h2>
    <div class="paper-wrap"><canvas id="board" class="board"></canvas></div>
    <div class="draw-tools">
      <div class="swatches">${DRAW_COLORS.map((c, i) => `<button data-c="${c}" class="${i === 1 ? 'on' : ''}" style="--c:${c}" aria-label="Renk"></button>`).join('')}</div>
      <div class="tool-row">
        ${DRAW_SIZES.map(([w, l], i) => `<button data-w="${w}" class="size ${i === 1 ? 'on' : ''}" aria-label="${l}"><i style="--s:${4 + i * 5}px"></i></button>`).join('')}
        <button id="eraser" class="tool" aria-label="Silgi">${ic('eraser')}</button>
        <button id="undo" class="tool" aria-label="Geri al">${ic('undo')}</button>
        <button id="redo" class="tool" aria-label="İleri al">${ic('redo')}</button>
        <button id="clear" class="tool" aria-label="Temizle">${ic('trash')}</button>
      </div>
      <div class="tool-row end"><span class="muted small" id="saveSt">Hazır</span><button class="btn small" id="saveBtn">${ic('download')}Kaydet</button></div>
    </div>
  </div>`;
  const draftKey = `draw-${id}`;
  let dirty = false, saveT = null, seenAt = 0, snapDirty = false;
  const st = t => { const s = $('#saveSt'); if (s) s.textContent = t; };
  const board = new DrawBoard($('#board'), {
    me: state.me.id,
    onStroke: s => ch.send('stroke', s),
    onLive: p => ch.send('live', p),
    onChange: () => { dirty = true; snapDirty = true; st('Kaydediliyor…'); clearTimeout(saveT); saveT = setTimeout(save, 2500); try { localStorage.setItem(draftKey, JSON.stringify({ strokes: board.strokes, removed: [...board.removed] })); } catch {} },
  });
  board.merge(row.strokes ?? []);
  try { const d = JSON.parse(localStorage.getItem(draftKey)); if (d) { d.removed?.forEach(x => board.removed.add(x)); board.merge(d.strokes); board.removeIds(d.removed ?? []); dirty = true; saveT = setTimeout(save, 800); } } catch {}
  const ch = api.channel(`draw-${id}`, {
    stroke: s => board.addRemote(s),
    live: p => board.liveRemote(p),
    remove: ({ ids }) => board.removeIds(ids),
    restore: ({ strokes }) => board.restore(strokes),
    hello: () => { const first = Date.now() - seenAt > 15000; seenAt = Date.now(); paintPres(); if (first) ch.send('hello', {}); },
    _status: s => { if (s === 'online') ch.send('hello', {}); },
  });
  const paintPres = () => { const on = Date.now() - seenAt < 15000, p = $('#pres'); if (!p) return; p.classList.toggle('on', on); $('span', p).textContent = on ? `${partnerName()} burada, birlikte çiziyorsunuz` : `${partnerName()} burada değil`; };
  const hb = setInterval(() => { ch.send('hello', {}); paintPres(); }, 7000);
  async function save() {
    if (!dirty) return;
    try {
      const srv = await api.getOne('drawings', id);
      board.merge(srv?.strokes ?? []);
      await api.update('drawings', id, { strokes: board.strokes, updated_at: new Date().toISOString() });
      dirty = false; st('Kaydedildi'); try { localStorage.removeItem(draftKey); } catch {}
    } catch { st('Bağlantı yok · çizim bu cihazda saklandı'); }
  }
  async function snapshot() {
    const blob = await board.toBlob(900);
    const old = (await api.getOne('drawings', id))?.image_path;
    const path = await api.upload(blob, 'png', 'image/png');
    await api.update('drawings', id, { image_path: path, strokes: board.strokes, updated_at: new Date().toISOString() });
    if (old) api.removeFiles([old]).catch(() => {});
    snapDirty = false; dirty = false;
  }
  $$('[data-c]', v).forEach(b => b.onclick = () => { board.color = b.dataset.c; board.eraser = false; $('#eraser').classList.remove('on'); $$('[data-c]', v).forEach(x => x.classList.toggle('on', x === b)); });
  $$('[data-w]', v).forEach(b => b.onclick = () => { board.width = +b.dataset.w; $$('[data-w]', v).forEach(x => x.classList.toggle('on', x === b)); });
  $('#eraser').onclick = e => { board.eraser = !board.eraser; e.currentTarget.classList.toggle('on', board.eraser); };
  const relay = r => { if (!r) return; if (r.remove) ch.send('remove', { ids: r.remove }); if (r.restore) ch.send('restore', { strokes: r.restore }); };
  $('#undo').onclick = () => relay(board.undo());
  $('#redo').onclick = () => relay(board.redoOne());
  $('#clear').onclick = () => { if (!board.strokes.length) return; const r = board.clear(); relay(r); toast('Sayfa temizlendi · geri almak için ↶'); };
  $('#saveBtn').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; st('Kaydediliyor…');
    try { await snapshot(); st('Kaydedildi · çizimler listesinde'); hearts(10); } catch (er) { st(er.message); }
    b.disabled = false;
  };
  pageCleanup = () => {
    clearInterval(hb); clearTimeout(saveT); board.destroy(); ch.close();
    if (dirty || snapDirty) (async () => { try { await save(); if (board.strokes.length) await snapshot(); } catch {} })();
  };
}

// ================================================================== film & kitap şampiyonası
const MEDIA_KIND = { film: ['Film', 'film'], dizi: ['Dizi', 'tv'], kitap: ['Kitap', 'book'] };
const MEDIA_STATUS = { plan: 'Sırada', devam: 'Devam ediyor', bitti: 'Bitti' };
let champTab = 'kutuphane', mediaKind = 'hepsi';
const monthKey = d => localISO(new Date(d)).slice(0, 7);
const monthName = k => new Date(k + '-15T12:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

async function champPage(v) {
  const [media, forMe, mine, attempts] = await Promise.all([
    api.list('shared_media'), api.rpc('media_quizzes_for_me').catch(() => []), api.list('media_quizzes').catch(() => []), api.list('media_quiz_attempts').catch(() => []),
  ]);
  cache('shared_media', media); cache('media_quizzes', mine);
  const P = esc(partnerName()), titleOf = id => media.find(m => m.id === id)?.title;
  const seg = `<div class="seg three"><button data-t="kutuphane" class="${champTab === 'kutuphane' ? 'on' : ''}">Kütüphane</button><button data-t="testler" class="${champTab === 'testler' ? 'on' : ''}">Testler</button><button data-t="sampiyon" class="${champTab === 'sampiyon' ? 'on' : ''}">Şampiyona</button></div>`;
  let body = '';
  if (champTab === 'kutuphane') {
    const list = media.filter(m => mediaKind === 'hepsi' || m.kind === mediaKind);
    const group = st => list.filter(m => m.status === st);
    const item = m => `<div class="card media-item">
      <span class="list-ic">${ic(MEDIA_KIND[m.kind][1])}</span>
      <span class="grow"><b>${esc(m.title)}</b><br><span class="muted small">${MEDIA_KIND[m.kind][0]}${m.finished_on ? ` · ${fmtDate(m.finished_on)}` : ''}${m.note ? ` · ${esc(m.note)}` : ''}</span>
        <span class="media-btns">${m.status !== 'bitti' ? `<button class="link" data-next="${m.id}">${m.status === 'plan' ? 'Başladık' : 'Bitirdik'}</button>` : `<button class="link" data-quiz="${m.id}">${ic('quiz')}Test hazırla</button>`}</span></span>
      ${acts('shared_media', m)}</div>`;
    body = `<div class="chips">${[['hepsi', 'Tümü'], ['film', 'Filmler'], ['dizi', 'Diziler'], ['kitap', 'Kitaplar']].map(([k, l]) => `<button class="chip ${mediaKind === k ? 'on' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
      ${['devam', 'plan', 'bitti'].map(st => group(st).length ? `${sectionTitle(st === 'bitti' ? 'check' : st === 'devam' ? 'play' : 'calendar', MEDIA_STATUS[st])}${group(st).map(item).join('')}` : '').join('')}
      ${!list.length ? `<div class="card empty">${ic('film', 'xl')}<p>Birlikte izlediğiniz filmleri, dizileri ve okuduğunuz kitapları ekleyin. Bitenler için birbirinize test hazırlayın.</p></div>` : ''}`;
  } else if (champTab === 'testler') {
    const todo = forMe.filter(q => !q.attempted), done = forMe.filter(q => q.attempted);
    const myAttempt = q => attempts.find(a => a.quiz_id === q.id && a.author !== state.me.id);
    body = `<button class="btn" id="newQuiz">${ic('plus')}${P}’ya test hazırla</button>
      ${sectionTitle('quiz', `${P} sana hazırladı`)}
      ${todo.map(q => `<div class="card quiz-card fresh"><span class="grow"><b>${esc(q.title)}</b><br><span class="muted small">${q.questions.length} soru${titleOf(q.media_id) ? ` · ${esc(titleOf(q.media_id))}` : ''}</span></span><button class="btn small" data-solve="${q.id}">Çöz</button></div>`).join('')}
      ${done.map(q => `<div class="card quiz-card"><span class="grow"><b>${esc(q.title)}</b><br><span class="muted small">${titleOf(q.media_id) ? esc(titleOf(q.media_id)) + ' · ' : ''}${q.score}/${q.total} doğru</span></span><button class="link" data-review="${q.id}">Cevaplar</button></div>`).join('')}
      ${!forMe.length ? `<p class="muted small pad">${P} henüz test hazırlamadı.</p>` : ''}
      ${sectionTitle('edit', 'Senin hazırladıkların')}
      ${mine.map(q => { const a = myAttempt(q); return `<div class="card quiz-card"><span class="grow"><b>${esc(q.title)}</b><br><span class="muted small">${q.questions.length} soru · ${a ? `${P}: ${a.score}/${a.total}` : 'henüz çözmedi'}</span></span>${a ? '' : acts('media_quizzes', q)}</div>`; }).join('') || `<p class="muted small pad">Henüz test hazırlamadın.</p>`}`;
  } else {
    const season = monthKey(new Date());
    const tally = (rows) => {
      const t = {}; for (const id of Object.keys(state.people)) t[id] = { pts: 0, tests: 0, total: 0 };
      rows.forEach(a => { const x = t[a.author] ??= { pts: 0, tests: 0, total: 0 }; x.pts += a.score; x.tests++; x.total += a.total; });
      return t;
    };
    const winner = t => {
      const ids = Object.keys(t).filter(k => state.people[k]);
      const sorted = ids.sort((a, b) => t[b].pts - t[a].pts || t[b].tests - t[a].tests);
      if (!sorted.length || !t[sorted[0]].tests) return null;
      const [a, b] = sorted;
      return b && t[a].pts === t[b].pts && t[a].tests === t[b].tests ? 'tie' : a;
    };
    const now = tally(attempts.filter(a => monthKey(a.created_at) === season));
    const w = winner(now);
    const months = [...new Set(attempts.map(a => monthKey(a.created_at)))].filter(k => k !== season).sort().reverse();
    const ids = Object.keys(state.people);
    const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), left = Math.ceil((end - Date.now()) / 864e5);
    body = `<div class="card champ">
        <p class="champ-kicker">${esc(monthName(season))} sezonu · ${left} gün kaldı</p>
        ${w && w !== 'tie' ? `<div class="crown">${ic('crown')}</div><p class="champ-name">${esc(nameOf(w))}</p><p class="muted small">şu an önde</p>`
          : w === 'tie' ? `<div class="crown">${ic('crown')}</div><p class="champ-name">Berabere</p><p class="muted small">taç paylaşılıyor</p>`
          : `<p class="muted">Bu ay henüz test çözülmedi. Birbirinize test hazırlayın, çözdükçe puanlar burada.</p>`}
        <div class="score-row">${ids.map(id => { const x = now[id] ?? { pts: 0, tests: 0, total: 0 }; return `<div class="${w === id ? 'lead' : ''}"><b>${x.pts}</b><span>${esc(nameOf(id))}</span><small>${x.tests} test · %${x.total ? Math.round(x.pts / x.total * 100) : 0}</small></div>`; }).join('')}</div>
      </div>
      <p class="muted small pad">Puanlar, karşı tarafın hazırladığı testlerdeki doğru cevaplardan gelir. Beraberlikte çözülen test sayısına bakılır.</p>
      ${months.length ? `${sectionTitle('crown', 'Geçmiş şampiyonlar')}${months.map(k => { const t = tally(attempts.filter(a => monthKey(a.created_at) === k)), wk = winner(t); return `<div class="card row-item"><span class="list-ic">${ic('crown')}</span><span class="grow"><b>${wk === 'tie' ? 'Berabere' : esc(nameOf(wk))}</b><br><span class="muted small">${esc(monthName(k))} · ${ids.map(id => `${esc(nameOf(id))} ${t[id]?.pts ?? 0}`).join(' – ')}</span></span></div>`; }).join('')}` : ''}`;
  }
  v.innerHTML = `${back()}${head('Film & kitap şampiyonası', champTab === 'kutuphane' ? addBtn('add', 'Ekle') : '', 'Birlikte izlediklerimiz, okuduklarımız ve testlerimiz')}${seg}${body}`;
  $$('.seg button', v).forEach(b => b.onclick = () => { champTab = b.dataset.t; rerender(); });
  $$('[data-k]', v).forEach(b => b.onclick = () => { mediaKind = b.dataset.k; rerender(); });
  $('#add')?.addEventListener('click', () => editForm('shared_media'));
  $$('[data-next]', v).forEach(b => b.onclick = async () => {
    const m = media.find(x => x.id === b.dataset.next), next = m.status === 'plan' ? 'devam' : 'bitti';
    try { await api.update('shared_media', m.id, { status: next, finished_on: next === 'bitti' ? todayISO() : m.finished_on }); if (next === 'bitti') hearts(12); rerender(); } catch (er) { toast(er.message); }
  });
  $$('[data-quiz]', v).forEach(b => b.onclick = () => quizBuilder(media, b.dataset.quiz));
  $('#newQuiz')?.addEventListener('click', () => quizBuilder(media));
  $$('[data-solve]', v).forEach(b => b.onclick = () => quizSolver(forMe.find(q => q.id === b.dataset.solve), titleOf));
  $$('[data-review]', v).forEach(b => b.onclick = () => quizReview(forMe.find(q => q.id === b.dataset.review)));
}

function quizBuilder(media, mediaId = '') {
  const done = media.filter(m => m.status === 'bitti');
  const m = modal(`<h2>${esc(partnerName())}’ya test</h2>
    <form><label>Test adı<input name="title" required value="${esc(media.find(x => x.id === mediaId)?.title ? media.find(x => x.id === mediaId).title + ' testi' : '')}" placeholder="Notebook testi"></label>
    <label>Hangi film / kitap?<select name="media"><option value="">Bağımsız test</option>${done.map(x => `<option value="${x.id}" ${x.id === mediaId ? 'selected' : ''}>${esc(x.title)} · ${MEDIA_KIND[x.kind][0]}</option>`).join('')}</select></label>
    <div id="qs"></div>
    <button type="button" class="btn small ghost" id="addQ">${ic('plus')}Soru ekle</button>
    <p class="muted small">Doğru şıkkı soldaki daireyle işaretle. Gönderdikten sonra sorular değiştirilemez; ${esc(partnerName())} bir kez çözebilir.</p>
    <p class="err"></p><button class="btn">Testi gönder</button></form>`);
  const f = $('form', m), qs = $('#qs', m);
  const addQ = () => {
    if (qs.children.length >= 15) return toast('En fazla 15 soru');
    const n = qs.children.length;
    const d = document.createElement('div'); d.className = 'qb card soft';
    d.innerHTML = `<div class="row-top"><b class="grow">Soru ${n + 1}</b>${n ? `<button type="button" class="icon-btn danger" data-rm aria-label="Sil">${ic('trash')}</button>` : ''}</div>
      <input name="q" required placeholder="Soru">
      ${[0, 1, 2, 3].map(i => `<div class="opt-row"><input type="radio" name="a${n}" value="${i}" ${i ? '' : 'checked'} aria-label="Doğru"><input name="o" placeholder="${i + 1}. şık${i > 1 ? ' (isteğe bağlı)' : ''}"></div>`).join('')}`;
    $('[data-rm]', d)?.addEventListener('click', () => d.remove());
    qs.append(d);
  };
  addQ(); addQ(); addQ();
  $('#addQ', m).onclick = addQ;
  f.onsubmit = async e => {
    e.preventDefault();
    const err = $('.err', f), questions = [], answers = [];
    for (const [i, d] of [...qs.children].entries()) {
      const q = $('[name=q]', d).value.trim(), all = $$('[name=o]', d).map(x => x.value.trim());
      const pick = +$('input[type=radio]:checked', d).value;
      if (!q) { err.textContent = `${i + 1}. soru boş`; return; }
      if (!all[pick]) { err.textContent = `${i + 1}. soruda doğru işaretli şık boş`; return; }
      const o = all.filter(Boolean); if (o.length < 2) { err.textContent = `${i + 1}. soruda en az 2 şık olmalı`; return; }
      questions.push({ q, o }); answers.push(o.indexOf(all[pick]));
    }
    if (!questions.length) { err.textContent = 'En az bir soru ekle'; return; }
    try { await api.insert('media_quizzes', { title: f.title.value.trim(), media_id: f.media.value || null, questions, answers }); m.close(); hearts(12); toast('Test gönderildi'); champTab = 'testler'; rerender(); }
    catch (er) { err.textContent = er.message; }
  };
}

function quizSolver(q, titleOf) {
  if (!q) return;
  const picks = Array(q.questions.length).fill(null);
  let i = 0;
  const m = modal(`<div id="solve"></div>`, 'quiz-modal');
  const box = $('#solve', m);
  const draw = () => {
    const cur = q.questions[i];
    box.innerHTML = `<p class="muted small">${esc(q.title)}${titleOf(q.media_id) ? ` · ${esc(titleOf(q.media_id))}` : ''}</p>
      <div class="q-progress"><span style="width:${(i) / q.questions.length * 100}%"></span></div>
      <p class="muted small">Soru ${i + 1} / ${q.questions.length}</p>
      <h3 class="serif q-text">${esc(cur.q)}</h3>
      <div class="q-opts">${cur.o.map((o, k) => `<button data-k="${k}" class="${picks[i] === k ? 'right' : ''}">${esc(o)}</button>`).join('')}</div>
      <div class="q-nav">${i ? '<button class="link" id="prev">Önceki</button>' : '<span></span>'}
        ${i < q.questions.length - 1 ? '<button class="btn small" id="next" disabled>Sonraki</button>' : '<button class="btn small" id="send" disabled>Bitir ve gönder</button>'}</div>`;
    const nx = $('#next', box) || $('#send', box);
    nx.disabled = picks[i] === null;
    $$('[data-k]', box).forEach(b => b.onclick = () => { picks[i] = +b.dataset.k; draw(); });
    $('#prev', box)?.addEventListener('click', () => { i--; draw(); });
    $('#next', box)?.addEventListener('click', () => { i++; draw(); });
    $('#send', box)?.addEventListener('click', async () => {
      try {
        const r = await api.rpc('media_quiz_submit', { qid: q.id, picks });
        const pct = r.total ? r.score / r.total : 0;
        if (pct >= .7) hearts(30);
        box.innerHTML = `<div class="center"><p class="muted small">${esc(q.title)}</p><p class="big-time">${r.score}/${r.total}</p>
          <p class="quote">${pct === 1 ? 'Kusursuz! Her ayrıntıyı hatırlıyorsun' : pct >= .7 ? 'Harika, gerçekten dikkatle izlemişsin' : pct >= .4 ? 'Fena değil, bir dahakine daha iyi' : 'Bu sefer olmadı, ama bir film daha izlemek için güzel bir bahane'}</p></div>
          ${q.questions.map((qq, k) => `<div class="card q-done ${picks[k] === r.answers[k] ? 'ok' : 'no'}"><b>${esc(qq.q)}</b><p class="small">Senin cevabın: ${esc(qq.o[picks[k]] ?? '—')}${picks[k] === r.answers[k] ? '' : ` · Doğrusu: <b>${esc(qq.o[r.answers[k]])}</b>`}</p></div>`).join('')}
          <button class="btn" id="ok">Tamam</button>`;
        $('#ok', box).onclick = () => { m.close(); rerender(); };
      } catch (er) { toast(er.message); }
    });
  };
  draw();
}
function quizReview(q) {
  if (!q) return;
  modal(`<h2>${esc(q.title)}</h2><p class="big-time center">${q.score}/${q.total}</p>
    ${q.questions.map((qq, k) => `<div class="card q-done ${q.picks?.[k] === q.answers?.[k] ? 'ok' : 'no'}"><b>${esc(qq.q)}</b><p class="small">Senin cevabın: ${esc(qq.o[q.picks?.[k]] ?? '—')}${q.picks?.[k] === q.answers?.[k] ? '' : ` · Doğrusu: <b>${esc(qq.o[q.answers?.[k]] ?? '')}</b>`}</p></div>`).join('')}`);
}

// ================================================================== canlı bahçe
let gardenTab = 'canli', gardenWho = 'hepsi';
async function gardenLive(v) {
  if (gardenTab === 'takvim') {
    await gardenCalendar(v);
    const head0 = $('.page-head', v); head0?.insertAdjacentHTML('afterend', gardenSeg());
    bindGardenSeg(v); return;
  }
  const rows = cache('flowers', await api.list('flowers', 500));
  const mine = rows.filter(isMine), his = rows.filter(f => !isMine(f));
  const list = gardenWho === 'ben' ? mine : gardenWho === 'o' ? his : rows;
  const t = todayISO(), sentToday = rows.some(f => isMine(f) && f.day === t);
  v.innerHTML = `${back()}${head('Bahçemiz', sentToday ? '' : addBtn('send', 'Çiçek'), 'Her gönderdiğiniz çiçek burada büyür')}
    ${gardenSeg()}
    <div class="garden-stage"><canvas id="gcv"></canvas>
      <div class="garden-chips">${[['hepsi', 'Tümü'], ['ben', 'Benimkiler'], ['o', esc(partnerName()) + '’nınkiler']].map(([k, l]) => `<button data-who="${k}" class="${gardenWho === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div class="stats card"><div><b>${rows.length}</b><span>çiçek</span></div><div><b>${mine.length}</b><span>senden</span></div><div><b>${his.length}</b><span>${esc(partnerName())}’dan</span></div></div>
    <div class="card grow-legend"><b>Bahçe nasıl büyür?</b><p class="small muted">Her çiçek önce tohum olarak düşer. Ondan sonra gönderilen her çiçek onu bir adım büyütür: <b>tohum → filiz → tomurcuk → çiçek</b>. Birbirinize çiçek gönderdikçe bahçeniz açar. Bir çiçeğe dokununca kimden geldiğini görürsün.</p></div>`;
  bindGardenSeg(v);
  $('#send')?.addEventListener('click', flowerPicker);
  $$('[data-who]', v).forEach(b => b.onclick = () => { gardenWho = b.dataset.who; rerender(); });
  const scene = new GardenScene($('#gcv'), {
    flowers: list, imgs: flowerImages(flower, FLOWERS.map(f => f[0])), reduce: reduceMotion(),
    onTap: (f, stage) => {
      const meta = FLOWERS.find(x => x[0] === f.kind);
      modal(`<div class="center">${flower(f.kind, 'big-flower')}<h2>${esc(meta?.[1] ?? '')}</h2>
        <p class="muted">${esc(meta?.[2] ?? '')} · ${esc(nameOf(f.author))} · ${fmtDate(f.day)}</p>
        <p class="stage-pill">${['Tohum', 'Filiz', 'Tomurcuk', 'Açtı'][stage]}</p>
        ${f.note ? `<p class="lb-cap">“${esc(f.note)}”</p>` : ''}${stage < 3 ? `<p class="small muted">${3 - stage} çiçek daha gönderildikçe açacak</p>` : ''}</div>`);
    },
  });
  pageCleanup = () => scene.destroy();
}
const gardenSeg = () => `<div class="seg"><button data-gt="canli" class="${gardenTab === 'canli' ? 'on' : ''}">Bahçe</button><button data-gt="takvim" class="${gardenTab === 'takvim' ? 'on' : ''}">Gün gün</button></div>`;
const bindGardenSeg = v => $$('[data-gt]', v).forEach(b => b.onclick = () => { gardenTab = b.dataset.gt; rerender(); });

// ================================================================== yaşayan dünya
async function worldPage(v) {
  const [flowers, mems, drawings, stars, days] = await Promise.all([
    api.list('flowers', 500), api.list('memories', 60), api.list('drawings', 5).catch(() => []), api.list('star_maps').catch(() => []), api.list('special_days').catch(() => []),
  ]);
  const withPhoto = mems.filter(m => m.photos?.[0]).slice(0, 4);
  const latestDrawing = drawings.find(d => d.image_path);
  await loadUrls([...withPhoto.map(m => m.photos[0]), latestDrawing?.image_path].filter(Boolean));
  const t = todayISO();
  const special = !!isMilestoneToday() || autoPack() === 'yildonumu' || days.some(d => (d.yearly ? d.day.slice(5) === t.slice(5) : d.day === t));
  const m0 = new Date().getMonth(), season = m0 === 11 || m0 <= 1 ? 'winter' : m0 <= 4 ? 'spring' : m0 <= 7 ? 'summer' : 'autumn';
  v.innerHTML = `<div class="world">
    <div class="world-host" id="wh"><div class="world-load"><span class="heart beat">❤</span><p>Dünyamız hazırlanıyor…</p></div></div>
    <div class="world-top"><div><p class="world-kicker">${brand(state.s.title)}</p><h1>Dünyamız</h1></div></div>
    <p class="world-hint">Sürükle, döndür · iki parmakla yakınlaştır · bir şeye dokun</p>
  </div>
  <div class="world-list card"><b>Dünyada neler var?</b><div class="world-spots" id="spots"></div>
    <p class="muted small">Çiçek tarhı gönderdiğiniz çiçeklerle dolar, çitte anı fotoğraflarınız asılı, şövalede son çiziminiz durur; gece fenerler yanar, yıldız haritalarınız gökte parlar. Özel günlerde ev ışıklarla süslenir.</p></div>`;
  const host = $('#wh');
  try {
    const w = await createWorld(host, {
      flowers, memories: withPhoto.map(m => ({ id: m.id, title: m.title, date: m.happened_on, url: state.urls[m.photos[0]] })),
      drawingUrl: latestDrawing ? state.urls[latestDrawing.image_path] : null, starMaps: stars.length, special, season,
    }, {
      reduce: reduceMotion(),
      onGo: h => { location.hash = h; },
      onPhoto: m => { const mem = withPhoto.find(x => x.id === m.id); if (mem) lightbox(mem.photos[0], mem.title, fmtDate(mem.happened_on)); },
      onReady: () => $('.world-load', host)?.remove(),
    });
    $('#spots').innerHTML = w.hotspots.map(([h, l]) => `<a class="chip" href="${h}">${esc(l)}</a>`).join('');
    pageCleanup = () => w.destroy();
  } catch (er) {
    host.innerHTML = `<div class="world-load"><p>Bu cihazda 3D dünya açılamadı.</p><p class="muted small">${esc(er.message)}</p></div>`;
    $('#spots').innerHTML = [['#/anilar', 'Anılarımız'], ['#/bahce', 'Bahçemiz'], ['#/cizim', 'Çizimlerimiz'], ['#/yildizlar', 'Yıldız haritalarımız']].map(([h, l]) => `<a class="chip" href="${h}">${l}</a>`).join('');
  }
}

// ================================================================== anılar
async function memories(v) {
  const rows = cache('memories', await api.list('memories'));
  await loadUrls(rows.flatMap(r => r.photos));
  v.innerHTML = `
    ${head('Anılarımız', addBtn('add', 'Anı'))}
    ${rows.length ? `<div class="timeline">${rows.map(r => `
      <article class="card mem">
        <span class="dot"></span>
        <p class="date">${fmtDate(r.happened_on)}${r.location ? ` · ${esc(r.location)}` : ''}</p>
        <h3>${esc(r.title)}</h3>
        ${r.body ? `<p class="body">${esc(r.body)}</p>` : ''}
        ${r.photos.length ? `<div class="pgrid n${Math.min(r.photos.length, 3)}">${r.photos.map(p => `<button data-ph="${esc(p)}">${img(p)}</button>`).join('')}</div>` : ''}
        <p class="by">${esc(nameOf(r.author))} yazdı ${acts('memories', r)}</p>
      </article>`).join('')}</div>`
      : empty('book', 'Henüz anı yok. İlkini birlikte yazın.')}`;
  $('#add').onclick = () => editForm('memories');
  $$('[data-ph]', v).forEach(b => b.onclick = () => lightbox(b.dataset.ph));
}

// ================================================================== mektuplar
let letterTab = 'in';
async function letters(v) {
  const [rows, locked] = await Promise.all([api.list('letters'), api.rpc('locked_letters')]);
  cache('letters', rows);
  const incoming = rows.filter(l => l.recipient === state.me.id);
  const outgoing = rows.filter(l => l.author === state.me.id);
  v.innerHTML = `
    ${head('Mektuplar', state.partner ? addBtn('write', 'Yaz') : '')}
    <div class="seg"><button data-t="in" class="${letterTab === 'in' ? 'on' : ''}">Bana gelenler</button><button data-t="out" class="${letterTab === 'out' ? 'on' : ''}">Yazdıklarım</button></div>
    <div class="letters">
      ${letterTab === 'in' ? `
        ${locked.map(l => `<div class="envelope locked">
          <span class="seal">${ic('lock')}</span><b>${esc(l.title)}</b>
          <span class="muted">${esc(nameOf(l.author))} · ${fmtDateTime(l.open_at)}’da açılacak</span>
          <span class="soon">${until(l.open_at)} kaldı</span></div>`).join('')}
        ${incoming.map(l => `<button class="envelope" data-open="${l.id}">
          <span class="seal">${ic('mail')}</span><b>${esc(l.title)}</b>
          <span class="muted">${esc(nameOf(l.author))} · ${fmtDate(l.created_at)}</span>
          ${l.read_at ? '' : '<span class="badge">Yeni</span>'}</button>`).join('')}
        ${!locked.length && !incoming.length ? empty('mail', 'Henüz sana gelen mektup yok') : ''}`
      : outgoing.map(l => {
          const lockedNow = l.open_at && new Date(l.open_at) > new Date();
          return `<div class="envelope out">
            <button class="env-open" data-open="${l.id}"><span class="seal">${ic(lockedNow ? 'lock' : 'mail')}</span><b>${esc(l.title)}</b>
            <span class="muted">${fmtDate(l.created_at)} · ${lockedNow ? `${fmtDateTime(l.open_at)}’da açılacak` : l.read_at ? `Okundu · ${ago(l.read_at)}` : 'Henüz okunmadı'}</span></button>
            ${acts('letters', l)}</div>`;
        }).join('') || empty('mail', 'Henüz mektup yazmadın')}
    </div>`;

  $$('.seg button', v).forEach(b => b.onclick = () => { letterTab = b.dataset.t; rerender(); });
  $('#write')?.addEventListener('click', () => editForm('letters', null, {
    heading: `${esc(partnerName())}’ya mektup`, extra: { recipient: state.partner.id }, defaults: { body: `Sevgili ${partnerName()},\n\n` },
    after: () => { letterTab = 'out'; rerender(); },
  }));
  $$('[data-open]', v).forEach(b => b.onclick = async () => {
    const l = rows.find(x => x.id === b.dataset.open);
    openLetter(l);
    if (l.recipient === state.me.id && !l.read_at) {
      await api.rpc('mark_letter_read', { letter_id: l.id }); l.read_at = new Date().toISOString();
      $('.badge', b)?.remove();
    }
  });
}

function openLetter(l) {
  const m = modal(`<div class="env-stage"><div class="env">
      <div class="env-back"></div><div class="env-paper"><span></span><span></span><span></span></div>
      <div class="env-front"></div><div class="env-flap"></div><div class="env-seal">${ic('heart')}</div>
    </div><p class="env-from">${esc(nameOf(l.author))}’dan</p></div>`, 'letter-modal');
  setTimeout(() => $('.env', m)?.classList.add('open'), 300);
  setTimeout(() => {
    const box = $('.modal', m);
    if (!box) return;
    box.classList.replace('letter-modal', 'paper-modal');
    box.innerHTML = `<button class="x" aria-label="Kapat">${ic('x')}</button>
      <div class="paper reveal"><h2>${esc(l.title)}</h2><div class="ltext"></div>
      <p class="sign" hidden>— ${esc(nameOf(l.author))}<br><span class="muted small">${fmtDateTime(l.created_at)}</span></p>
      <button class="link skip">Tamamını göster</button></div>`;
    const out = $('.ltext', box), sign = $('.sign', box), skip = $('.skip', box);
    const text = l.body; let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 380));
    const finish = () => { i = text.length; out.textContent = text; sign.hidden = false; skip.remove(); };
    skip.onclick = finish;
    const run = () => {
      if (!document.body.contains(out) || i >= text.length) return;
      i = Math.min(text.length, i + step);
      out.textContent = text.slice(0, i);
      if (i >= text.length) finish(); else setTimeout(run, 18);
    };
    run();
  }, 1900);
}

// ================================================================== galeri
let album = 'Tümü';
async function gallery(v) {
  const rows = cache('photos', await api.list('photos'));
  const albums = ['Tümü', ...new Set(rows.map(r => r.album))];
  if (!albums.includes(album)) album = 'Tümü';
  const shown = album === 'Tümü' ? rows : rows.filter(r => r.album === album);
  await loadUrls(shown.map(r => r.path));
  v.innerHTML = `
    ${head('Galerimiz', addBtn('up', 'Fotoğraf'))}
    <datalist id="albums">${albums.slice(1).map(a => `<option value="${esc(a)}">`).join('')}</datalist>
    ${rows.length ? `<div class="chips">${albums.map(a => `<button class="chip ${a === album ? 'on' : ''}" data-a="${esc(a)}">${esc(a)}</button>`).join('')}</div>
      <div class="gallery">${shown.map(r => `<button data-id="${r.id}">${img(r.path)}</button>`).join('')}</div>`
      : empty('image', 'İlk fotoğrafınızı ekleyin')}`;

  $$('[data-a]', v).forEach(b => b.onclick = () => { album = b.dataset.a; rerender(); });
  $$('[data-id]', v).forEach(b => b.onclick = () => {
    const r = rows.find(x => x.id === b.dataset.id);
    const meta = [r.album, r.taken_on && fmtDate(r.taken_on), `${nameOf(r.author)} ekledi`].filter(Boolean).join(' · ');
    lightbox(r.path, r.caption, meta, acts('photos', r));
  });
  $('#up').onclick = () => {
    const m = modal(`<h2>Fotoğraf ekle</h2>
      <form>
        <label class="file">${ic('camera')} Fotoğrafları seç<input type="file" accept="image/*" multiple required></label>
        <div class="previews fresh"></div>
        ${fieldsHTML(SCHEMA.photos.fields, { album: album === 'Tümü' ? 'Genel' : album, taken_on: todayISO() })}
        <p class="err"></p>
        <button class="btn">Yükle</button>
      </form>`);
    const form = $('form', m), input = $('input[type=file]', form);
    input.onchange = () => { $('.fresh', form).innerHTML = [...input.files].map(f => `<img src="${URL.createObjectURL(f)}" alt="">`).join(''); };
    form.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(form), b = $('button.btn', form); b.disabled = true;
      try {
        const paths = await uploadAll([...input.files], b);
        const alb = f.get('album').trim() || 'Genel';
        for (const path of paths) await api.insert('photos', { path, album: alb, caption: f.get('caption').trim() || null, taken_on: f.get('taken_on') || null });
        album = alb;
        m.close(); hearts(12); toast(`${paths.length} fotoğraf eklendi`); rerender();
      } catch (er) { $('.err', form).textContent = er.message; b.disabled = false; b.textContent = 'Yükle'; }
    };
  };
}

// ================================================================== dualar
let prayCat = 'nazar';
const counts = {};
const show = (() => { try { return JSON.parse(localStorage.getItem('pray-show')) || { ar: true, tr: true, mean: true }; } catch { return { ar: true, tr: true, mean: true }; } })();

async function prayers(v) {
  const all = cache('prayers', await api.list('prayers'));
  const list = all.filter(p => p.cat === prayCat);
  v.innerHTML = `
    ${head('Dualarımız', addBtn('addP', 'Dua'), esc(state.s.prayerBanner))}
    <div class="chips">${CATEGORIES.map(c => `<button class="chip ${c.key === prayCat ? 'on' : ''}" data-cat="${c.key}">${c.name}</button>`).join('')}</div>
    <div class="toggles">
      <label><input type="checkbox" data-s="ar" ${show.ar ? 'checked' : ''}> Arapça</label>
      <label><input type="checkbox" data-s="tr" ${show.tr ? 'checked' : ''}> Okunuş</label>
      <label><input type="checkbox" data-s="mean" ${show.mean ? 'checked' : ''}> Anlamı</label>
    </div>
    <div class="prayers ${['ar', 'tr', 'mean'].filter(k => !show[k]).map(k => 'hide-' + k).join(' ')}">
      ${list.map(p => `<details class="card prayer" data-id="${p.id}">
        <summary><span class="grow"><b>${esc(p.title)}</b><span class="muted small">${esc(p.note || (p.author ? `${nameOf(p.author)} yazdı` : ''))}</span></span>${ic('chevron', 'chev')}</summary>
        ${p.ar ? `<p class="ar" dir="rtl" lang="ar">${esc(p.ar)}</p>` : ''}
        ${p.tr ? `<p class="tr">${esc(p.tr)}</p>` : ''}
        ${p.body ? `<p class="mean">${esc(p.body)}</p>` : ''}
        <div class="tesbih">
          <button class="bead" data-bead aria-label="Say"><b>${counts[p.id] || 0}</b><small>/ ${p.target}</small></button>
          <div class="tes-actions">
            <button class="btn small" data-sent>${esc(partnerName())} için okudum</button>
            <span><button class="link" data-reset>sıfırla</button> ${acts('prayers', p)}</span>
          </div>
        </div>
      </details>`).join('') || empty('moon', 'Bu kategoride henüz dua yok. Kendi sözlerinle ilkini yaz.')}
    </div>`;

  $$('[data-cat]', v).forEach(b => b.onclick = () => { prayCat = b.dataset.cat; rerender(); });
  $$('[data-s]', v).forEach(c => c.onchange = () => {
    show[c.dataset.s] = c.checked;
    try { localStorage.setItem('pray-show', JSON.stringify(show)); } catch {}
    $('.prayers', v).classList.toggle('hide-' + c.dataset.s, !c.checked);
  });
  $$('.prayer', v).forEach(card => {
    const p = list.find(x => x.id === card.dataset.id), bead = $('[data-bead]', card), target = p.target || 1;
    bead.onclick = () => {
      counts[p.id] = (counts[p.id] || 0) + 1;
      $('b', bead).textContent = counts[p.id];
      bead.classList.remove('tap'); void bead.offsetWidth; bead.classList.add('tap');
      try { navigator.vibrate?.(counts[p.id] % target === 0 ? [40, 60, 40] : 15); } catch {}
      if (counts[p.id] % target === 0) { bead.classList.add('done'); hearts(10); }
    };
    $('[data-reset]', card).onclick = () => { counts[p.id] = 0; $('b', bead).textContent = 0; bead.classList.remove('done'); };
    $('[data-sent]', card).onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        await api.insert('prayer_logs', { prayer_title: p.title, count: Math.max(1, counts[p.id] || 0) });
        toast(`${partnerName()} senin için dua ettiğini görecek`); hearts(10);
      } catch (er) { toast(er.message); }
      setTimeout(() => { btn.disabled = false; }, 3000);
    };
  });
  $('#addP').onclick = () => editForm('prayers', null, { defaults: { cat: prayCat } });
}

// ================================================================== daha
async function more(v) {
  const groups = [
    ['Anılarımız', [['anilar', 'book', 'Anılarımız', 'Birlikte yazdığımız anı defteri']]],
    ['Her gün', [['gunun-sorusu', 'quiz', 'Günün sorusu', 'Cevaplar ikiniz de cevaplayınca açılır'], ['zor-gun', 'heart', 'Bugün biraz zor', 'Kötü gün modu · destek kartları'], ['fisilti', 'chat', 'Fısıltı', 'Sadece ikimizin sohbeti'], ['bahce', 'flower', 'Bahçemiz', 'Her gün bir çiçek'], ['selamlar', 'sun', 'Günaydın & iyi geceler', 'Saatine göre görünen notlar'], ['ruh-hali', 'smile', 'Ruh halimiz', 'Bugün nasılız']]],
    ['Yaratıcı', [['yildizlar', 'star', 'Yıldız haritamız', 'O anın gerçek gökyüzü'], ['cizim', 'brush', 'Çizim defterimiz', 'Birlikte, canlı çizim']]],
    ['Oyunlar', [['sampiyona', 'crown', 'Film & kitap şampiyonası', 'Testler, puanlar, taç'], ['bumuo', 'split', 'Bu mu, o mu?', 'Ne kadar uyumluyuz'], ['hafiza', 'cards', 'Hafıza oyunu', 'Fotoğraflarımızla, rekor kır'], ['test', 'quiz', 'Beni ne kadar tanıyorsun?', 'Birbirinize sorular']]],
    ['Sürprizler', [['surprizler', 'gift', 'Açılış sürprizi', 'Siteyi açınca karşısına çıkar'], ['kuponlar', 'ticket', 'Aşk kuponları', 'Kendi yazdığınız kuponlar']]],
    ['Birlikte', [['ozet', 'sparkle', 'Aylık özetimiz', 'Her ayın hikâyesi'], ['muzik', 'music', 'Müziğimiz', 'Ortak playlist ve şarkılarımız'], ['ozel-gunler', 'calendar', 'Özel günler', 'Geri sayımlar'], ['ilkler', 'flag', 'İlklerimiz', 'Unutulmayacak ilkler'], ['yapacaklar', 'check', 'Yapacaklarımız', 'Hayal listemiz'], ['harita', 'pin', 'Haritamız', 'Gittiğimiz yerler'], ['kavanoz', 'jar', 'Sebep kavanozu', 'Seni neden seviyorum']]],
    ...(state.admin ? [['Yönetim', [['admin', 'shield', 'Admin paneli', 'Ayarlar ve tüm içerik']]]] : []),
  ];
  v.innerHTML = `${head('Daha fazlası')}
    <a class="world-entry" href="#/dunya">
      <span class="we-sky"></span><span class="we-island"></span>
      <span class="we-text"><small>Yaşayan dünyamız</small><b>Dünyamız</b><span>Anılarımızdan büyüyen küçük adamız</span></span>
      ${ic('chevron', 'chev')}
    </a>
    ${groups.map(([g, items]) => `<h3 class="group">${g}</h3><div class="list card">${items.map(([h, i, t, s]) => `
      <a class="list-row" href="#/${h}"><span class="list-ic">${ic(i)}</span><span class="grow"><b>${t}</b><span class="muted small">${s}</span></span>${ic('chevron', 'chev')}</a>`).join('')}</div>`).join('')}`;
}

// ---------------------------------------------------------------- bahçe (takvim görünümü)
async function gardenCalendar(v) {
  const rows = cache('flowers', await api.list('flowers'));
  const t = todayISO();
  const startDay = localISO(START_D).slice(0, 10);
  const days = [];
  for (let d = new Date(t + 'T12:00'); localISO(d).slice(0, 10) >= startDay; d.setDate(d.getDate() - 1)) days.push(localISO(d).slice(0, 10));
  const by = {}; rows.forEach(f => { (by[f.day] ??= {})[isMine(f) ? 'me' : 'him'] = f; });
  let streak = 0;
  for (let i = by[t]?.me && by[t]?.him ? 0 : 1; i < days.length; i++) { const x = by[days[i]]; if (x?.me && x?.him) streak++; else break; }
  const mineToday = by[t]?.me;
  v.innerHTML = `${back()}${head('Bahçemiz', mineToday ? '' : addBtn('send', 'Çiçek'), 'Her gün birbirinize bir çiçek. Atlanan günler boş kalır.')}
    <div class="stats card">
      <div><b>${rows.length}</b><span>çiçek</span></div>
      <div><b>${streak}</b><span>gün üst üste</span></div>
      <div><b>${days.length}</b><span>gün</span></div>
    </div>
    <div class="garden">${days.map(d => {
      const x = by[d] ?? {};
      const slot = (f, who) => f ? `<button class="g-f" data-fl="${f.id}" aria-label="${esc(who)}">${flower(f.kind)}</button>` : '<span class="g-empty"></span>';
      return `<div class="g-day ${d === t ? 'today' : ''}"><div class="g-pair">${slot(x.me, 'Sen')}${slot(x.him, partnerName())}</div><span>${fmtShort(d)}</span></div>`;
    }).join('')}</div>
    <p class="muted small center">Her günün solunda senin, sağında ${esc(partnerName())}’nın çiçeği.</p>`;
  $('#send')?.addEventListener('click', flowerPicker);
  $$('[data-fl]', v).forEach(b => b.onclick = () => {
    const f = rows.find(x => x.id === b.dataset.fl), meta = FLOWERS.find(x => x[0] === f.kind);
    modal(`<div class="center">${flower(f.kind, 'big-flower')}<h2>${esc(meta?.[1] ?? '')}</h2>
      <p class="muted">${esc(meta?.[2] ?? '')} · ${esc(nameOf(f.author))} · ${fmtDate(f.day)}</p>
      ${f.note ? `<p class="lb-cap">“${esc(f.note)}”</p>` : ''}<p>${acts('flowers', f)}</p></div>`);
  });
}

// ---------------------------------------------------------------- günaydın / iyi geceler
async function greetings(v) {
  const rows = cache('greetings', await api.list('greetings'));
  const mine = k => rows.find(g => isMine(g) && g.kind === k);
  const his = k => rows.find(g => !isMine(g) && g.kind === k);
  const block = (k, title, icon, hint) => `<form class="card greet-form" data-k="${k}">
      ${sectionTitle(icon, title)}
      <p class="muted small">${hint}</p>
      <textarea name="text" rows="3" placeholder="${k === 'morning' ? 'Günaydın güzelim, bugün de…' : 'İyi geceler, rüyanda…'}">${esc(mine(k)?.text ?? '')}</textarea>
      <button class="btn small">Kaydet</button>
      ${his(k) ? `<p class="from-him"><span class="muted small">${esc(partnerName())}’nın sana notu</span><br>“${esc(his(k).text)}”</p>` : ''}
    </form>`;
  v.innerHTML = `${back()}${head('Günaydın & iyi geceler', '', `${esc(partnerName())} sabah açınca günaydın notunu, gece açınca iyi geceler notunu görür.`)}
    ${block('morning', 'Günaydın notu', 'sun', '05:00 – 12:00 arasında görünür')}
    ${block('night', 'İyi geceler notu', 'moon', '20:00 – 05:00 arasında görünür')}`;
  $$('.greet-form', v).forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const k = f.dataset.k, text = f.text.value.trim(), cur = mine(k);
    try {
      if (!text && cur) await api.remove('greetings', cur.id);
      else if (cur) await api.update('greetings', cur.id, { text });
      else if (text) await api.insert('greetings', { kind: k, text });
      toast('Kaydedildi'); rerender();
    } catch (er) { toast(er.message); }
  });
}

// ---------------------------------------------------------------- açılış sürprizleri
async function surprises(v) {
  const rows = cache('surprises', await api.list('surprises'));
  const sent = rows.filter(isMine), got = rows.filter(s => s.recipient === state.me.id && s.shown_at);
  v.innerHTML = `${back()}${head('Açılış sürprizi', state.partner ? addBtn('add', 'Yaz') : '', `${esc(partnerName())} siteyi bir sonraki açışında mesajın tam ekran karşısına çıkar. Bir kez gösterilir.`)}
    ${sectionTitle('gift', 'Gönderdiklerin')}
    ${sent.map(s => `<div class="card row-item"><span class="grow"><span class="quote">“${esc(s.message)}”</span><br>
      <span class="muted small">${s.shown_at ? `Gördü · ${ago(s.shown_at)}` : 'Bir sonraki açılışında görecek'}</span></span>${acts('surprises', s)}</div>`).join('') || '<p class="muted small pad">Henüz sürpriz göndermedin.</p>'}
    ${got.length ? `${sectionTitle('heart', 'Sana gelenler')}${got.map(s => `<div class="card"><span class="quote">“${esc(s.message)}”</span><p class="by">— ${esc(nameOf(s.author))} · ${fmtDate(s.created_at)}</p></div>`).join('')}` : ''}`;
  $('#add')?.addEventListener('click', () => editForm('surprises', null, { heading: `${esc(partnerName())}’ya sürpriz`, extra: { recipient: state.partner.id } }));
}

// ---------------------------------------------------------------- kuponlar
let couponTab = 'got';
async function coupons(v) {
  const rows = cache('coupons', await api.list('coupons'));
  const got = rows.filter(c => c.recipient === state.me.id), gave = rows.filter(isMine);
  const ticket = (c, mineSide) => `<div class="coupon ${c.used_at ? 'used' : ''}">
      <div class="c-main"><span class="c-kicker">${mineSide ? `${esc(partnerName())} için` : `${esc(nameOf(c.author))}’dan`}</span>
        <b>${esc(c.title)}</b>${c.description ? `<p>${esc(c.description)}</p>` : ''}</div>
      <div class="c-side">
        ${c.used_at ? `<span class="c-used">Kullanıldı<br>${fmtShort(c.used_at)}</span>`
          : mineSide ? '<span class="c-wait">Bekliyor</span>' : `<button class="btn small" data-use="${c.id}">Kullan</button>`}
        ${acts('coupons', c)}
      </div></div>`;
  v.innerHTML = `${back()}${head('Aşk kuponları', state.partner ? addBtn('add', 'Kupon') : '', 'Kuponları siz yazarsınız. Kullanılınca yazan kişi görür.')}
    <div class="seg"><button data-t="got" class="${couponTab === 'got' ? 'on' : ''}">Bana verilenler</button><button data-t="gave" class="${couponTab === 'gave' ? 'on' : ''}">Benim verdiklerim</button></div>
    ${couponTab === 'got' ? got.map(c => ticket(c, false)).join('') || empty('ticket', `${esc(partnerName())} henüz sana kupon yazmadı`)
      : gave.map(c => ticket(c, true)).join('') || empty('ticket', `${esc(partnerName())} için ilk kuponu yaz`)}`;
  $$('.seg button', v).forEach(b => b.onclick = () => { couponTab = b.dataset.t; rerender(); });
  $('#add')?.addEventListener('click', () => editForm('coupons', null, { heading: `${esc(partnerName())} için kupon`, extra: { recipient: state.partner.id }, after: () => { couponTab = 'gave'; rerender(); } }));
  $$('[data-use]', v).forEach(b => b.onclick = async () => {
    const c = rows.find(x => x.id === b.dataset.use);
    if (!confirm(`“${c.title}” kuponunu şimdi kullanmak istiyor musun?`)) return;
    try { await api.rpc('use_coupon', { cid: c.id }); hearts(30); toast(`${nameOf(c.author)} kuponu kullandığını görecek`); rerender(); }
    catch (er) { toast(er.message); }
  });
}

// ---------------------------------------------------------------- test
let quizTab = 'answer';
async function quiz(v) {
  if (quizTab === 'answer') {
    const qs = await api.rpc('quiz_for_me');
    const done = qs.filter(q => q.choice !== null), todo = qs.filter(q => q.choice === null);
    const score = done.filter(q => q.correct).length;
    const cur = todo[0];
    v.innerHTML = `${back()}${head('Beni ne kadar tanıyorsun?', '', `${esc(partnerName())}’nın sana hazırladığı sorular`)}
      ${quizSeg()}
      ${done.length ? `<div class="stats card"><div><b>${score}/${done.length}</b><span>doğru</span></div><div><b>${done.length ? Math.round(score / done.length * 100) : 0}%</b><span>tanıyorsun</span></div><div><b>${todo.length}</b><span>soru kaldı</span></div></div>` : ''}
      ${cur ? `<div class="card q-card" data-q="${cur.id}">
          <p class="muted small">Soru ${done.length + 1} / ${qs.length}</p>
          <h3 class="serif q-text">${esc(cur.question)}</h3>
          <div class="q-opts">${cur.options.map((o, i) => `<button data-pick="${i}">${esc(o)}</button>`).join('')}</div>
        </div>` : qs.length ? `<div class="card empty">${ic('check', 'xl')}<p>Tüm soruları cevapladın. ${esc(partnerName())} yeni sorular ekleyince burada görünür.</p></div>`
        : empty('quiz', `${esc(partnerName())} henüz soru hazırlamadı`)}
      ${done.length ? `${sectionTitle('check', 'Cevapladıkların')}${done.slice().reverse().map(q => `<div class="card q-done ${q.correct ? 'ok' : 'no'}">
          <b>${esc(q.question)}</b><p class="small">Senin cevabın: ${esc(q.options[q.choice])}${q.correct ? '' : ` · Doğrusu: <b>${esc(q.options[q.answer])}</b>`}</p></div>`).join('')}` : ''}`;
    bindQuizSeg(v);
    $$('[data-pick]', v).forEach(b => b.onclick = async () => {
      $$('[data-pick]', v).forEach(x => x.disabled = true);
      try {
        const r = await api.rpc('answer_quiz', { qid: cur.id, pick: +b.dataset.pick });
        $$('[data-pick]', v).forEach(x => { const i = +x.dataset.pick; if (i === r.answer) x.classList.add('right'); else if (i === r.choice) x.classList.add('wrong'); });
        if (r.correct) hearts(16);
        toast(r.correct ? 'Doğru! Onu çok iyi tanıyorsun' : 'Olmadı, ama artık biliyorsun');
        setTimeout(rerender, 1500);
      } catch (er) { toast(er.message); }
    });
  } else {
    const [qs, answers] = await Promise.all([api.list('quiz_questions'), api.list('quiz_answers')]);
    cache('quiz_questions', qs);
    const ans = id => answers.find(a => a.question_id === id && a.author !== state.me.id);
    const answered = qs.filter(q => ans(q.id)), right = answered.filter(q => ans(q.id).correct).length;
    v.innerHTML = `${back()}${head('Beni ne kadar tanıyorsun?', addBtn('add', 'Soru'), `${esc(partnerName())}’ya sorduğun sorular`)}
      ${quizSeg()}
      ${answered.length ? `<div class="stats card"><div><b>${right}/${answered.length}</b><span>${esc(partnerName())} bildi</span></div><div><b>${qs.length - answered.length}</b><span>cevap bekliyor</span></div></div>` : ''}
      ${qs.map(q => { const a = ans(q.id); return `<div class="card q-mine">
        <div class="row-top"><b class="grow">${esc(q.question)}</b>${acts('quiz_questions', q)}</div>
        <ol>${q.options.map((o, i) => `<li class="${i === q.answer ? 'right' : ''} ${a && a.choice === i && !a.correct ? 'wrong' : ''}">${esc(o)}</li>`).join('')}</ol>
        <p class="muted small">${a ? (a.correct ? `${esc(partnerName())} doğru bildi` : `${esc(partnerName())} yanıldı`) : 'Henüz cevaplamadı'}</p></div>`; }).join('') || empty('quiz', 'İlk sorunu yaz')}`;
    bindQuizSeg(v);
    $('#add').onclick = () => quizForm();
  }
}
const quizSeg = () => `<div class="seg"><button data-t="answer" class="${quizTab === 'answer' ? 'on' : ''}">Cevapla</button><button data-t="mine" class="${quizTab === 'mine' ? 'on' : ''}">Sorularım</button></div>`;
const bindQuizSeg = v => $$('.seg button', v).forEach(b => b.onclick = () => { quizTab = b.dataset.t; rerender(); });
function quizForm(row = null) {
  const opts = row?.options ?? ['', '', '', ''];
  while (opts.length < 4) opts.push('');
  const m = modal(`<h2>${row ? 'Soruyu düzenle' : `${esc(partnerName())}’ya soru`}</h2>
    <form><label>Soru<input name="question" value="${esc(row?.question ?? '')}" required placeholder="En sevdiğim yemek ne?"></label>
      <label>Şıklar <span class="muted small">(doğru olanı işaretle, en az 2 şık)</span></label>
      ${opts.map((o, i) => `<div class="opt-row"><input type="radio" name="answer" value="${i}" ${(row?.answer ?? 0) === i ? 'checked' : ''} aria-label="Doğru cevap"><input name="o${i}" value="${esc(o)}" placeholder="${i + 1}. şık"></div>`).join('')}
      <p class="err"></p><button class="btn">Kaydet</button></form>`);
  $('form', m).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, all = [0, 1, 2, 3].map(i => f[`o${i}`].value.trim());
    const ansIdx = +f.answer.value;
    if (!all[ansIdx]) { $('.err', m).textContent = 'Doğru cevap olarak işaretlenen şık boş olamaz'; return; }
    const options = all.filter(Boolean), answer = options.indexOf(all[ansIdx]);
    if (options.length < 2) { $('.err', m).textContent = 'En az iki şık yaz'; return; }
    try {
      const data = { question: f.question.value.trim(), options, answer };
      row ? await api.update('quiz_questions', row.id, data) : await api.insert('quiz_questions', data);
      m.close(); toast('Soru kaydedildi'); quizTab = 'mine'; rerender();
    } catch (er) { $('.err', m).textContent = er.message; }
  };
}

// ---------------------------------------------------------------- özel günler
async function specialDays(v) {
  const rows = cache('special_days', await api.list('special_days'));
  const list = upcomingDays(rows);
  const later = rows.filter(r => !r.yearly && nextOccurrence(r.day, false).left < 0);
  v.innerHTML = `${back()}${head('Özel günler', addBtn('add', 'Gün'), 'Doğum günleri, yıl dönümleri ve beklediğiniz günler')}
    ${list.map((r, i) => `<div class="card day-item ${i === 0 ? 'first' : ''}">
      <div class="day-count"><b>${r.left === 0 ? 'Bugün' : r.left}</b>${r.left === 0 ? '' : '<span>gün</span>'}</div>
      <div class="grow"><b>${esc(r.title)}</b><br><span class="muted small">${fmtDate(localISO(r.date).slice(0, 10))}${r.yearly && r.years > 0 && !r.auto ? ` · ${r.years}. yıl` : ''}${r.auto ? ' · otomatik' : ''}</span>
      ${r.note ? `<p class="small">${esc(r.note)}</p>` : ''}</div>
      ${r.auto ? '' : acts('special_days', r)}</div>`).join('')}
    ${later.length ? `${sectionTitle('calendar', 'Geçmiş')}${later.map(r => `<div class="card row-item"><span class="grow"><b>${esc(r.title)}</b><br><span class="muted small">${fmtDate(r.day)}</span></span>${acts('special_days', r)}</div>`).join('')}` : ''}`;
  $('#add').onclick = () => editForm('special_days');
}

// ---------------------------------------------------------------- diğer bölümler
async function moods(v) {
  const rows = cache('moods', await api.list('moods', 200));
  v.innerHTML = `${back()}${head('Ruh halimiz', addBtn())}
    ${rows.length ? rows.map(r => `<div class="card row-item">
      <span class="big">${r.emoji}</span>
      <span class="grow"><b>${esc(nameOf(r.author))}</b>${r.note ? ` · ${esc(r.note)}` : ''}<br><span class="muted small">${fmtDateTime(r.created_at)}</span></span>
      ${acts('moods', r)}</div>`).join('') : empty('smile', 'Ana sayfadan bugün nasıl olduğunu seç')}`;
  $('#add').onclick = () => editForm('moods');
}

async function firsts(v) {
  const rows = cache('firsts', await api.list('firsts'));
  v.innerHTML = `${back()}${head('İlklerimiz', addBtn('add', 'İlk'))}
    ${rows.length ? `<div class="firsts">${rows.map((r, i) => `<div class="card first">
      <span class="num">${i + 1}</span>
      <div class="grow"><b>${esc(r.title)}</b>${r.happened_on ? `<br><span class="muted small">${fmtDate(r.happened_on)}</span>` : ''}
      ${r.note ? `<p class="body">${esc(r.note)}</p>` : ''}
      <p class="by">${esc(nameOf(r.author))} ekledi ${acts('firsts', r)}</p></div></div>`).join('')}</div>`
      : empty('flag', 'İlk buluşma, ilk fotoğraf, ilk “seni seviyorum”…')}`;
  $('#add').onclick = () => editForm('firsts');
}

async function todos(v) {
  const rows = cache('todos', await api.list('todos'));
  const open = rows.filter(r => !r.done), done = rows.filter(r => r.done);
  const item = r => `<div class="card todo ${r.done ? 'is-done' : ''}">
    <button class="tick" data-tick="${r.id}" aria-label="Yaptık">${r.done ? ic('heart') : ''}</button>
    <span class="grow"><b>${esc(r.text)}</b>${r.note ? `<br><span class="muted small">${esc(r.note)}</span>` : ''}
      ${r.done && r.done_at ? `<br><span class="muted small">${fmtDate(r.done_at)}</span>` : ''}</span>
    ${acts('todos', r)}</div>`;
  v.innerHTML = `${back()}${head('Yapacaklarımız')}
    <form class="quick card" id="q"><input name="text" placeholder="Birlikte… (ör. denizde gün batımı)" required><button class="btn small">Ekle</button></form>
    ${rows.length ? `<p class="muted center small">${done.length}/${rows.length} hayalimizi gerçekleştirdik</p>
      <div class="progress"><span style="width:${done.length / rows.length * 100}%"></span></div>` : ''}
    ${open.map(item).join('')}
    ${done.length ? `${sectionTitle('check', 'Yaptıklarımız')}${done.map(item).join('')}` : ''}
    ${!rows.length ? empty('check', 'Birlikte yapmak istediklerinizi yazın') : ''}`;
  $('#q').onsubmit = async e => {
    e.preventDefault();
    await api.insert('todos', { text: e.target.text.value.trim() }); rerender();
  };
  $$('[data-tick]', v).forEach(b => b.onclick = async () => {
    const r = rows.find(x => x.id === b.dataset.tick), d = !r.done;
    await api.update('todos', r.id, { done: d, done_at: d ? new Date().toISOString() : null });
    if (d) hearts(20);
    rerender();
  });
}

function embed(url) {
  if (!url) return '';
  const sp = url.match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  if (sp) return `<iframe class="emb" src="https://open.spotify.com/embed/${sp[1]}/${sp[2]}" height="${sp[1] === 'track' ? 152 : 352}" loading="lazy" allow="encrypted-media; clipboard-write; fullscreen"></iframe>`;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  if (yt) return `<iframe class="emb yt" src="https://www.youtube-nocookie.com/embed/${yt[1]}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  return /^https?:\/\//.test(url) ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">Dinle</a>` : '';
}
async function songs(v) {
  const rows = cache('songs', await api.list('songs'));
  const pl = state.s.playlist;
  v.innerHTML = `${back()}${head('Müziğimiz', addBtn('add', 'Şarkı'))}
    <section class="card playlist">
      ${sectionTitle('music', 'Ortak playlistimiz', state.admin ? `<button class="link" id="plEdit">${pl ? 'Değiştir' : 'Ekle'}</button>` : '')}
      ${pl ? `${embed(pl)}<a class="link" href="${esc(pl)}" target="_blank" rel="noopener">Spotify’da aç</a>`
        : `<p class="muted small">Spotify’da birlikte şarkı eklediğiniz bir playlist burada çalar.</p>
           <ol class="small steps">
             <li>Spotify’da <b>yeni bir çalma listesi</b> oluştur (ör. “E ❤ R”).</li>
             <li>Listede <b>⋯ → Ortak çalışmaya davet et</b> (Invite collaborators) de ve linki ${esc(partnerName())}’ya gönder. Artık ikiniz de şarkı ekleyebilirsiniz.</li>
             <li><b>⋯ → Paylaş → Bağlantıyı kopyala</b> ile linki al${state.admin ? ', burada “Ekle”ye bas ve yapıştır.' : ' ve Emre’ye gönder.'}</li>
           </ol>`}
    </section>
    ${sectionTitle('heart', 'Hikâyesi olan şarkılarımız')}
    ${rows.length ? rows.map(r => `<div class="card song">
      <div class="row-top"><span class="grow"><b>${esc(r.title)}</b>${r.artist ? ` <span class="muted">· ${esc(r.artist)}</span>` : ''}</span>${acts('songs', r)}</div>
      ${r.note ? `<p class="body">${esc(r.note)}</p>` : ''}
      ${embed(r.url)}
      <p class="by">${esc(nameOf(r.author))} ekledi</p></div>`).join('')
      : empty('music', 'Bizim şarkılarımızı ekleyin. Spotify linki yapıştırırsanız burada çalar.')}`;
  $('#add').onclick = () => editForm('songs');
  $('#plEdit')?.addEventListener('click', () => {
    const m = modal(`<h2>Ortak playlist</h2><form><label>Spotify playlist linki<input name="url" type="url" value="${esc(pl ?? '')}" placeholder="https://open.spotify.com/playlist/…"></label>
      <p class="err"></p><button class="btn">Kaydet</button></form>`);
    $('form', m).onsubmit = async e => {
      e.preventDefault();
      const url = e.target.url.value.trim();
      if (url && !/open\.spotify\.com\/(intl-[\w-]+\/)?playlist\//.test(url)) { $('.err', m).textContent = 'Bu bir Spotify playlist linki gibi görünmüyor'; return; }
      try { await api.saveSettings({ ...state.s, playlist: url || null }); await loadSettings(); m.close(); toast('Kaydedildi'); rerender(); }
      catch (er) { $('.err', m).textContent = er.message; }
    };
  });
}

let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  leafletP ??= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.append(css);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = () => res(window.L); s.onerror = () => rej(new Error('Harita yüklenemedi'));
    document.head.append(s);
  });
  return leafletP;
}
async function map(v) {
  const [rows, L] = await Promise.all([api.list('places'), loadLeaflet()]);
  cache('places', rows);
  v.innerHTML = `${back()}${head('Haritamız', '', 'Yeni bir yer eklemek için haritada o noktaya dokun')}
    <div id="map" class="card"></div>
    ${rows.map(r => `<div class="card row-item">
      <span class="list-ic">${ic('pin')}</span>
      <button class="grow left" data-go="${r.id}"><b>${esc(r.name)}</b>${r.visited_on ? `<br><span class="muted small">${fmtDate(r.visited_on)}</span>` : ''}${r.note ? `<br><span class="small">${esc(r.note)}</span>` : ''}</button>
      ${acts('places', r)}</div>`).join('')}`;
  const m = L.map('map', { zoomControl: true }).setView([39, 35], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const pin = L.divIcon({ className: 'pin', html: `<svg viewBox="0 0 24 24"><path fill="#e07a9c" stroke="#fff" stroke-width="1.5" d="M12 20.5s-7.6-4.5-9.4-9.2C1.3 7.9 3.4 4.5 6.9 4.5c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.5 0 5.6 3.4 4.3 6.8-1.8 4.7-9.4 9.2-9.4 9.2z"/></svg>`, iconSize: [30, 30], iconAnchor: [15, 15] });
  const markers = {};
  rows.forEach(r => {
    markers[r.id] = L.marker([r.lat, r.lng], { icon: pin }).addTo(m)
      .bindPopup(`<b>${esc(r.name)}</b>${r.visited_on ? `<br>${fmtDate(r.visited_on)}` : ''}${r.note ? `<br>${esc(r.note)}` : ''}`);
  });
  if (rows.length) m.fitBounds(L.latLngBounds(rows.map(r => [r.lat, r.lng])).pad(0.3), { maxZoom: 13 });
  m.on('click', e => editForm('places', null, { defaults: { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) } }));
  $$('[data-go]', v).forEach(b => b.onclick = () => {
    const r = rows.find(x => x.id === b.dataset.go);
    m.setView([r.lat, r.lng], 14); markers[r.id].openPopup(); $('#map').scrollIntoView({ behavior: 'smooth' });
  });
  setTimeout(() => m.invalidateSize(), 200);
}

async function jar(v) {
  const rows = cache('reasons', await api.list('reasons'));
  v.innerHTML = `${back()}${head('Sebep kavanozu', addBtn('add', 'Sebep'), `${rows.length} sebep · ikinizin yazdıkları`)}
    ${rows.map(r => `<div class="card reason-item"><p>“${esc(r.text)}”</p><p class="by">— ${esc(nameOf(r.author))} · ${ago(r.created_at)} ${acts('reasons', r)}</p></div>`).join('') || empty('jar', 'Kavanoz boş')}`;
  $('#add').onclick = () => editForm('reasons');
}

// ================================================================== admin paneli
const ADMIN_TABLES = ['memories', 'letters', 'photos', 'reasons', 'prayers', 'prayer_logs', 'moods', 'firsts', 'todos', 'songs', 'places',
  'surprises', 'greetings', 'thoughts', 'flowers', 'coupons', 'special_days', 'messages', 'tot_questions', 'memory_scores',
  'star_maps', 'drawings', 'shared_media'];
const ADMIN_LABEL = {
  memories: 'Anılar', letters: 'Mektuplarım', photos: 'Fotoğraflar', reasons: 'Sebepler', prayers: 'Dualar', prayer_logs: 'Dua kayıtları',
  moods: 'Ruh halleri', firsts: 'İlkler', todos: 'Yapacaklar', songs: 'Şarkılar', places: 'Yerler', surprises: 'Sürprizlerim',
  greetings: 'Selamlar', thoughts: 'Düşünceler', flowers: 'Çiçekler', coupons: 'Kuponlar', special_days: 'Özel günler',
  messages: 'Mesajlar', tot_questions: 'Bu mu o mu soruları', memory_scores: 'Hafıza skorları',
  star_maps: 'Yıldız haritaları', drawings: 'Çizimler', shared_media: 'Film & kitaplar',
};
async function admin(v, [table]) {
  if (table && SCHEMA[table]) return adminTable(v, table);
  const lists = await Promise.all(ADMIN_TABLES.map(t => api.list(t)));
  const counts = Object.fromEntries(ADMIN_TABLES.map((t, i) => [t, lists[i].length]));
  const s = state.s;
  v.innerHTML = `${head('Admin paneli')}
    <form class="card" id="siteForm">
      ${sectionTitle('sparkle', 'Site ayarları')}
      <label>Site adı<input name="title" value="${esc(s.title)}" required></label>
      <label>İlk görüş anı (büyük sayaç buradan başlar)<input type="datetime-local" name="start" value="${toLocalInput(s.start)}" required></label>
      <label>Sevgili olduğumuz an (ay dönümleri buna göre)<input type="datetime-local" name="together" value="${toLocalInput(s.together)}" required></label>
      <label>Sayaç başlığı<input name="kicker" value="${esc(s.kicker)}"></label>
      <label>Sayaç altındaki cümle<input name="love" value="${esc(s.love)}"></label>
      <label>Kavanoz başlığı<input name="jarTitle" value="${esc(s.jarTitle)}"></label>
      <label>Dualar sayfasındaki cümle<input name="prayerBanner" value="${esc(s.prayerBanner)}"></label>
      <button class="btn">Ayarları kaydet</button>
      <button type="button" class="link" id="resetS">Varsayılanlara dön</button>
    </form>

    <form class="card" id="people">
      ${sectionTitle('user', 'İsimler ve yetkiler')}
      ${Object.values(state.people).map(p => `<div class="person">
        <label class="grow">${p.id === state.me.id ? 'Sen' : 'Sevgilin'}<input name="n-${p.id}" value="${esc(p.name)}" required></label>
        <label class="check"><input type="checkbox" name="a-${p.id}" ${p.is_admin ? 'checked' : ''} ${p.id === state.me.id ? 'disabled' : ''}> Admin</label>
      </div>`).join('')}
      <button class="btn small">Kaydet</button>
    </form>

    <div class="card">
      ${sectionTitle('grid', 'Tüm içerik')}
      <p class="muted small">Herhangi bir kaydı açıp düzenleyebilir ya da silebilirsin. Mektup, sürpriz ve test sorularında sadece kendi yazdıkların görünür; ${esc(partnerName())}’nın sana hazırladıklarını önceden kimse göremez.</p>
      <div class="admin-grid">${ADMIN_TABLES.map(t => `<a href="#/admin/${t}" class="admin-tile">${ic(SCHEMA[t].icon)}<b>${counts[t]}</b>${ADMIN_LABEL[t]}</a>`).join('')}</div>
    </div>`;

  $('#siteForm').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const next = { ...state.s };
    for (const k of ['title', 'kicker', 'love', 'jarTitle', 'prayerBanner']) next[k] = f.get(k).trim() || DEFAULTS[k];
    next.start = new Date(f.get('start')).toISOString();
    next.together = new Date(f.get('together')).toISOString();
    try { await api.saveSettings(next); await loadSettings(); shell(); rerender(); toast('Ayarlar kaydedildi'); }
    catch (er) { toast(er.message); }
  };
  $('#resetS').onclick = async () => {
    if (!confirm('Tüm site yazıları ve sayaç başlangıcı varsayılana dönsün mü?')) return;
    await api.saveSettings({}); await loadSettings(); shell(); rerender(); toast('Varsayılanlara dönüldü');
  };
  $('#people').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    try {
      for (const p of Object.values(state.people)) {
        const patch = { name: f[`n-${p.id}`].value.trim() };
        if (p.id !== state.me.id) patch.is_admin = f[`a-${p.id}`].checked;
        await api.updateProfile(p.id, patch);
        Object.assign(p, patch);
      }
      toast('Kaydedildi'); rerender();
    } catch (er) { toast(er.message); }
  };
}
async function adminTable(v, table) {
  const sc = SCHEMA[table];
  let rows = await api.list(table);
  if (PRIVATE.includes(table)) rows = rows.filter(isMine);
  cache(table, rows);
  if (table === 'photos') await loadUrls(rows.map(r => r.path));
  const canAdd = !['prayer_logs', 'photos', 'letters', 'surprises', 'coupons', 'thoughts', 'flowers', 'messages', 'memory_scores'].includes(table);
  v.innerHTML = `${back('#/admin', 'Admin')}${head(ADMIN_LABEL[table], canAdd ? addBtn('add', 'Yeni') : '', `${rows.length} kayıt`)}
    ${rows.map(r => `<div class="card row-item">
      ${table === 'photos' ? `<span class="thumb">${img(r.path)}</span>` : table === 'flowers' ? `<span class="thumb">${flower(r.kind)}</span>` : ''}
      <span class="grow"><b>${esc(sc.label(r) || '—')}</b><br>
        <span class="muted small">${esc(nameOf(r.author))} · ${fmtDate(r.happened_on || r.day || r.created_at)}${table === 'prayers' ? ` · ${esc(CATEGORIES.find(c => c.key === r.cat)?.name ?? r.cat)}` : ''}</span></span>
      ${acts(table, r)}</div>`).join('') || empty(sc.icon, 'Henüz kayıt yok')}`;
  $('#add')?.addEventListener('click', () => editForm(table));
}

// ================================================================== hesap
function settings() {
  const m = modal(`<h2>Hesabım</h2>
    <p>Giriş yapan: <b>${esc(nameOf(state.me.id))}</b>${state.admin ? ' <span class="badge-inline">Admin</span>' : ''}</p>
    ${state.admin ? `<a class="btn ghost" href="#/admin" id="toAdmin">${ic('shield')}Admin paneli</a>` : ''}
    <form id="pw" class="card soft">
      <label>Yeni şifre<input type="password" name="pw" minlength="6" autocomplete="new-password" required></label>
      <button class="btn small">${ic('key')}Şifreyi değiştir</button>
    </form>
    <div class="card soft">
      ${sectionTitle('sun', 'Görünüm')}
      <div class="theme-pick">${[['auto', 'phone', 'Otomatik'], ['light', 'sun', 'Açık'], ['dark', 'moon', 'Koyu']].map(([k, i, l]) =>
        `<button data-th="${k}" class="${myPrefs().appearance === k ? 'on' : ''}">${ic(i)}${l}</button>`).join('')}</div>
      <p class="muted small" style="margin:8px 0 14px">Otomatik: telefonun gece/gündüz ayarına uyar.</p>
      <p class="label-sm">Tema</p>
      <div class="pack-pick">${PACKS.map(([k, l]) => `<button data-pk="${k}" class="${myPrefs().pack === k ? 'on' : ''}"><span class="sw" style="background:${PACK_SW[k]}"></span>${l}</button>`).join('')}</div>
      <p class="muted small" style="margin:8px 0 12px">Takvime göre: Aralık–Şubat Kış Masalı, Mart–Mayıs İlkbahar; ay dönümlerinizde, 7 ve 15 Kasım’da ve 14 Şubat’ta Yıldönümü. Bugün: <b>${packName(autoPack())}</b></p>
      <label class="check"><input type="checkbox" id="motionChk" ${reduceMotion() ? 'checked' : ''}> Hareketi azalt <span class="muted small">(animasyonlar ve kalp yağmuru kapanır)</span></label>
      <p class="muted small" style="margin:6px 0 0">Bu ayarlar hesabına kayıtlı; telefon değişse de seninle gelir.</p>
    </div>
    <div class="card soft" id="lockBox"></div>
    <div class="card soft" id="pushBox">
      ${sectionTitle('bell', 'Telefon bildirimleri')}
      <p class="small" id="pushStatus">Kontrol ediliyor…</p>
      <div class="prompt-btns" id="pushBtns"></div>
      <div class="prefs">
        <p class="muted small">Hangi durumlarda bildirim gelsin?</p>
        ${NOTIFY_CATS.map(([k, l]) => `<label class="check"><input type="checkbox" data-pref="${k}" ${state.people[state.me.id]?.notify?.[k] === false ? '' : 'checked'}> ${l}</label>`).join('')}
      </div>
    </div>
    <div class="card soft">
      ${sectionTitle('phone', 'iPhone ana ekranına ekle')}
      <p class="muted small">Safari’de aç → alttaki <b>Paylaş</b> → <b>Ana Ekrana Ekle</b>. Ana ekrandan açınca bir kez daha giriş yapman gerekir.</p>
    </div>
    <button class="btn ghost danger" id="out">${ic('logout')}Çıkış yap</button>`);
  $('#toAdmin', m)?.addEventListener('click', () => m.close());

  // görünüm
  $$('[data-th]', m).forEach(b => b.onclick = () => {
    savePrefs({ appearance: b.dataset.th });
    $$('[data-th]', m).forEach(x => x.classList.toggle('on', x === b));
  });
  $$('[data-pk]', m).forEach(b => b.onclick = () => {
    savePrefs({ pack: b.dataset.pk });
    $$('[data-pk]', m).forEach(x => x.classList.toggle('on', x === b));
  });
  $('#motionChk', m).onchange = e => savePrefs({ motion: e.target.checked ? 'reduce' : 'auto' });
  // uygulama kilidi
  const renderLock = () => {
    const c = lockCfg(), box = $('#lockBox', m);
    box.innerHTML = `${sectionTitle('lock', 'Uygulama kilidi')}
      ${c ? `<p class="small" style="margin:0 0 10px">Açık · şifre sadece bu telefonda saklanır.</p>
        <label>Şifre ne zaman sorulsun?<select id="lkDelay">${LOCK_DELAYS.map(([s, l]) => `<option value="${s}" ${c.delay === s ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="prompt-btns"><button class="btn small ghost" id="lkChange">Şifreyi değiştir</button><button class="link danger" id="lkOff">Kilidi kapat</button></div>`
      : `<p class="muted small" style="margin:0 0 10px">Kapalı. Açarsan uygulamaya girerken 4 haneli şifre sorulur. İstediğin zaman kapatabilirsin.</p>
        <button class="btn small" id="lkOn">${ic('lock')}Kilidi aç</button>`}`;
    $('#lkOn', box)?.addEventListener('click', async () => { if (await setupLock()) { toast('Uygulama kilidi açıldı'); renderLock(); } });
    $('#lkOff', box)?.addEventListener('click', async () => { if (await verifyPin()) { saveLock(null); toast('Uygulama kilidi kapatıldı'); renderLock(); } });
    $('#lkChange', box)?.addEventListener('click', async () => { if (await verifyPin() && await setupLock()) { toast('Şifre değişti'); renderLock(); } });
    $('#lkDelay', box)?.addEventListener('change', e => { const cfg = lockCfg(); if (cfg) { cfg.delay = +e.target.value; saveLock(cfg); toast('Kaydedildi'); } });
  };
  renderLock();

  const renderPush = async () => {
    const st = await pushState().catch(() => 'unsupported');
    const txt = {
      on: 'Açık · bu cihaz bildirim alıyor.',
      off: 'Kapalı. Açınca sana bir şey gönderildiğinde telefonuna gelir.',
      denied: 'İzin reddedilmiş. iPhone’da Ayarlar → Bildirimler → E ❤ R’den izin verip tekrar dene.',
      'needs-home': 'Bildirim için önce Safari’de Paylaş → Ana Ekrana Ekle de, sonra uygulamayı ana ekrandaki simgeden aç.',
      unsupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
      unavailable: 'Demo modunda bildirimler kapalı.',
    }[st];
    $('#pushStatus', m).textContent = txt;
    $('#pushBtns', m).innerHTML = st === 'on'
      ? `<button class="btn small" id="pTest">Deneme bildirimi gönder</button><button class="link" id="pOff">Bu cihazda kapat</button>`
      : st === 'off' ? `<button class="btn small" id="pOn">${ic('bell')}Bildirimleri aç</button>` : '';
    // Hesapta birden fazla cihaz kayıtlıysa temizleme seçeneği
    if (st === 'on') {
      try {
        const subs = (await api.list('push_subscriptions')).filter(s => s.user_id === state.me.id);
        if (subs.length > 1) {
          const box = document.createElement('div');
          box.className = 'devices';
          box.innerHTML = `<p class="small">Bu hesapta <b>${subs.length} cihaz</b> kayıtlı.</p><button class="btn small ghost" id="pOnly">${ic('phone')}Sadece bu cihazda bildirim al</button>`;
          $('#pushBtns', m).after(box);
          $('#pOnly', m).onclick = async () => {
            if (!confirm('Bu cihaz dışındaki tüm eski bildirim kayıtların silinsin mi? Diğer cihazlarda bildirim almak istersen orada tekrar açman gerekir.')) return;
            try {
              const reg = await navigator.serviceWorker.getRegistration();
              const sub = await reg?.pushManager.getSubscription();
              if (!sub) throw new Error('Bu cihazın bildirim kaydı bulunamadı');
              await saveSub(sub);
              await api.keepOnlyPush(state.me.id, sub.endpoint);
              box.remove(); toast('Eski kayıtlar temizlendi, bildirimler sadece bu cihaza gelecek');
            } catch (er) { toast(er.message); }
          };
        }
      } catch {}
    }
    $('#pOn', m)?.addEventListener('click', async () => {
      try { await enablePush(); toast('Bildirimler açıldı'); renderPush(); } catch (er) { toast(er.message); }
    });
    $('#pOff', m)?.addEventListener('click', async () => {
      try { await disablePush(); toast('Bu cihazda bildirimler kapatıldı'); renderPush(); } catch (er) { toast(er.message); }
    });
    $('#pTest', m)?.addEventListener('click', async e => {
      e.target.disabled = true;
      try { await api.rpc('push_test'); toast('Gönderildi, birkaç saniye içinde gelir'); } catch (er) { toast(er.message); }
      setTimeout(() => { e.target.disabled = false; }, 4000);
    });
  };
  renderPush();
  $$('[data-pref]', m).forEach(c => c.onchange = async () => {
    const me = state.people[state.me.id];
    const prefs = { ...(me.notify ?? {}), [c.dataset.pref]: c.checked };
    try { await api.rpc('set_my_notify', { prefs }); me.notify = prefs; toast('Kaydedildi'); }
    catch (er) { toast(er.message); c.checked = !c.checked; }
  });
  $('#pw', m).onsubmit = async e => {
    e.preventDefault();
    try { await api.changePassword(new FormData(e.target).get('pw')); toast('Şifre değişti'); e.target.reset(); }
    catch (er) { toast(er.message); }
  };
  $('#out', m).onclick = async () => { await api.signOut(); location.hash = ''; location.reload(); };
}

// ================================================================== başlat
(async () => {
  try {
    const user = await api.init();
    user ? await enter(user) : showLogin();
  } catch (e) {
    document.body.innerHTML = `<div class="login"><div class="logo">${brand(DEFAULTS.title)}</div><div class="card"><p>Bağlantı kurulamadı.</p><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Tekrar dene</button></div></div>`;
  }
})();

if ('serviceWorker' in navigator && !DEMO) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const b = document.createElement('button');
          b.className = 'update'; b.textContent = 'Yeni sürüm hazır · güncelle';
          b.onclick = () => w.postMessage('skip');
          document.body.append(b);
        }
      });
    });
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
  // Bildirime dokununca açık uygulamayı ilgili sayfaya götür
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.nav) location.hash = e.data.nav; });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      try { navigator.clearAppBadge?.(); } catch {}
      if (state.me) { applyTheme(); refreshBell(); refreshChatBadge(); if (Date.now() - urlsAt > 5 * 3600e3) rerender(); }
    }
  });
}
