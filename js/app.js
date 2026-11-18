import { api, DEMO } from './api.js';
import { START, TOGETHER, VAPID_PUBLIC_KEY } from './config.js';
import { CATEGORIES } from './dualar.js';
import { ic, flower, FLOWERS, nazar } from './icons.js';
import { TOT } from './oyunlar.js';

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
    const [msgs, phs, mems] = await Promise.all([api.list('messages', 1000), api.list('photos', 1000), api.list('memories', 1000)]);
    const used = new Set([...msgs.flatMap(m => [m.photo, m.audio]), ...phs.map(p => p.path), ...mems.flatMap(m => m.photos ?? [])]);
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
  try { const prev = await api.rpc('touch_seen'); state.since = prev ? new Date(prev) : null; } catch {}
  try { navigator.clearAppBadge?.(); } catch {}
  shell();
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
const TABS = [['', 'home', 'Biz'], ['anilar', 'book', 'Anılar'], ['mektuplar', 'mail', 'Mektup'], ['galeri', 'image', 'Galeri'], ['dualar', 'moon', 'Dualar'], ['daha', 'grid', 'Daha']];
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
}

const MORE = ['ruh-hali', 'ilkler', 'yapacaklar', 'sarkilar', 'muzik', 'harita', 'kavanoz', 'admin', 'bahce', 'kuponlar', 'test',
  'ozel-gunler', 'surprizler', 'selamlar', 'bumuo', 'hafiza'];
const ROUTES = {
  '': home, anilar: memories, mektuplar: letters, galeri: gallery, dualar: prayers, daha: more,
  'ruh-hali': moods, ilkler: firsts, yapacaklar: todos, sarkilar: songs, muzik: songs, harita: map, kavanoz: jar, admin,
  bahce: garden, kuponlar: coupons, test: quiz, 'ozel-gunler': specialDays, surprizler: surprises, selamlar: greetings,
  fisilti: chat, bumuo: thisOrThat, hafiza: memoryGame,
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
  const [logs, letterRows, locked, reasons, mems, moodRows, greets, thoughts, flowers, coupons, days, photos, prayersAll, songRows] = await Promise.all([
    api.list('prayer_logs', 30), api.list('letters'), api.rpc('locked_letters'), api.list('reasons'), api.list('memories'), api.list('moods', 50),
    api.list('greetings'), api.list('thoughts', 500), api.list('flowers'), api.list('coupons'), api.list('special_days'), api.list('photos'),
    api.list('prayers'), api.list('songs'),
  ]);
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

  const notes = [
    ...forMe.map(l => `<p>${ic('moon')}<span><b>${esc(partnerName())}</b> senin için ${esc(l.prayer_title)} okudu${l.count > 1 ? ` · ${l.count} kez` : ''} <span class="muted">${ago(l.created_at)}</span></span></p>`),
    ...(unread.length ? [`<a href="#/mektuplar">${ic('mail')}<span><b>${esc(partnerName())}</b>’dan okunmamış ${unread.length} mektubun var</span></a>`] : []),
    ...locked.map(l => `<a href="#/mektuplar">${ic('lock')}<span>Bir mektup ${fmtDateTime(l.open_at)}’da açılacak</span></a>`),
    ...used.map(c => `<a href="#/kuponlar">${ic('ticket')}<span><b>${esc(partnerName())}</b> “${esc(c.title)}” kuponunu kullandı <span class="muted">${ago(c.used_at)}</span></span></a>`),
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

    <section class="nazar-wrap">
      <button class="nazar" id="nazar" aria-label="Nazar duası oku">${nazar()}</button>
      <div class="nazar-read" id="nazarRead"><p class="nazar-hint">Dokun, bir nazar duası oku</p></div>
    </section>

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
  const [mems, letterRows, locked, photos, reasons, logs, moods, firsts, todos, songs, places, thoughts, flowers, coupons, quizQ, days, totA, mScores] = await Promise.all([
    api.list('memories', lim), api.list('letters', lim), api.rpc('locked_letters'), api.list('photos', 200), api.list('reasons', lim),
    api.list('prayer_logs', lim), api.list('moods', lim), api.list('firsts', lim), api.list('todos', lim), api.list('songs', lim),
    api.list('places', lim), api.list('thoughts', 300), api.list('flowers', 200), api.list('coupons', lim), api.rpc('quiz_for_me'), api.list('special_days', lim),
    api.list('tot_answers', 300), api.list('memory_scores', lim),
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
  ['messages', 'Fısıltı mesajları'], ['letters', 'Mektuplar'], ['prayers', 'Senin için edilen dualar'], ['thoughts', 'Seni düşünüyorum (en fazla 3 saatte bir)'],
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
    ['Her gün', [['fisilti', 'chat', 'Fısıltı', 'Sadece ikimizin sohbeti'], ['bahce', 'flower', 'Bahçemiz', 'Her gün bir çiçek'], ['selamlar', 'sun', 'Günaydın & iyi geceler', 'Saatine göre görünen notlar'], ['ruh-hali', 'smile', 'Ruh halimiz', 'Bugün nasılız']]],
    ['Oyunlar', [['bumuo', 'split', 'Bu mu, o mu?', 'Ne kadar uyumluyuz'], ['hafiza', 'cards', 'Hafıza oyunu', 'Fotoğraflarımızla, rekor kır'], ['test', 'quiz', 'Beni ne kadar tanıyorsun?', 'Birbirinize sorular']]],
    ['Sürprizler', [['surprizler', 'gift', 'Açılış sürprizi', 'Siteyi açınca karşısına çıkar'], ['kuponlar', 'ticket', 'Aşk kuponları', 'Kendi yazdığınız kuponlar']]],
    ['Birlikte', [['muzik', 'music', 'Müziğimiz', 'Ortak playlist ve şarkılarımız'], ['ozel-gunler', 'calendar', 'Özel günler', 'Geri sayımlar'], ['ilkler', 'flag', 'İlklerimiz', 'Unutulmayacak ilkler'], ['yapacaklar', 'check', 'Yapacaklarımız', 'Hayal listemiz'], ['harita', 'pin', 'Haritamız', 'Gittiğimiz yerler'], ['kavanoz', 'jar', 'Sebep kavanozu', 'Seni neden seviyorum']]],
    ...(state.admin ? [['Yönetim', [['admin', 'shield', 'Admin paneli', 'Ayarlar ve tüm içerik']]]] : []),
  ];
  v.innerHTML = `${head('Daha fazlası')}
    ${groups.map(([g, items]) => `<h3 class="group">${g}</h3><div class="list card">${items.map(([h, i, t, s]) => `
      <a class="list-row" href="#/${h}"><span class="list-ic">${ic(i)}</span><span class="grow"><b>${t}</b><span class="muted small">${s}</span></span>${ic('chevron', 'chev')}</a>`).join('')}</div>`).join('')}`;
}

// ---------------------------------------------------------------- bahçe
async function garden(v) {
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
  'surprises', 'greetings', 'thoughts', 'flowers', 'coupons', 'special_days', 'messages', 'tot_questions', 'memory_scores'];
const ADMIN_LABEL = {
  memories: 'Anılar', letters: 'Mektuplarım', photos: 'Fotoğraflar', reasons: 'Sebepler', prayers: 'Dualar', prayer_logs: 'Dua kayıtları',
  moods: 'Ruh halleri', firsts: 'İlkler', todos: 'Yapacaklar', songs: 'Şarkılar', places: 'Yerler', surprises: 'Sürprizlerim',
  greetings: 'Selamlar', thoughts: 'Düşünceler', flowers: 'Çiçekler', coupons: 'Kuponlar', special_days: 'Özel günler',
  messages: 'Mesajlar', tot_questions: 'Bu mu o mu soruları', memory_scores: 'Hafıza skorları',
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
      if (state.me) { refreshBell(); refreshChatBadge(); if (Date.now() - urlsAt > 5 * 3600e3) rerender(); }
    }
  });
}
