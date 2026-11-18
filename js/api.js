import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { PRAYERS } from './dualar.js';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY || new URLSearchParams(location.search).has('demo');
const BUCKET = 'photos';
let sb = null;

// tablo → [sıralama sütunu, artan mı]
export const ORDER = {
  memories: ['happened_on', false],
  letters: ['created_at', false],
  photos: ['created_at', false],
  reasons: ['created_at', false],
  prayers: ['sort', true],
  prayer_logs: ['created_at', false],
  moods: ['created_at', false],
  firsts: ['happened_on', true],
  todos: ['created_at', true],
  songs: ['created_at', false],
  places: ['created_at', false],
  surprises: ['created_at', false],
  greetings: ['created_at', false],
  thoughts: ['created_at', false],
  flowers: ['day', true],
  coupons: ['created_at', false],
  quiz_questions: ['created_at', true],
  quiz_answers: ['created_at', true],
  special_days: ['day', true],
};

function fail(error) {
  if (!error) return;
  if (error.code === 'PGRST116') throw new Error('Bunu değiştirme yetkin yok');
  if (error.code === '23505') throw new Error('Bu zaten kayıtlı');
  throw new Error(error.message || String(error));
}

// ===================================================================
//  Supabase
// ===================================================================
const real = {
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ekalpr-auth' },
    });
    const { data } = await sb.auth.getSession();
    return data.session?.user ?? null;
  },
  async signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-posta ya da şifre hatalı' : error.message);
    return data.user;
  },
  async signOut() { await sb.auth.signOut(); },
  async changePassword(password) { const { error } = await sb.auth.updateUser({ password }); fail(error); },
  async profiles() { const { data, error } = await sb.from('profiles').select('*'); fail(error); return data; },
  async updateProfile(id, patch) { const { error } = await sb.from('profiles').update(patch).eq('id', id); fail(error); },
  async settings() {
    const { data, error } = await sb.from('site_settings').select('value').eq('key', 'site').maybeSingle();
    fail(error); return data?.value ?? {};
  },
  async saveSettings(value) {
    const { error } = await sb.from('site_settings').upsert({ key: 'site', value, updated_at: new Date().toISOString() });
    fail(error);
  },
  async list(table, limit = 1000) {
    const [col, asc] = ORDER[table];
    let q = sb.from(table).select('*').order(col, { ascending: asc, nullsFirst: false });
    if (col !== 'created_at') q = q.order('created_at', { ascending: asc });
    const { data, error } = await q.limit(limit);
    fail(error); return data;
  },
  async insert(table, row) { const { data, error } = await sb.from(table).insert(row).select().single(); fail(error); return data; },
  async update(table, id, patch) { const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single(); fail(error); return data; },
  async remove(table, id) {
    const { data, error } = await sb.from(table).delete().eq('id', id).select('id');
    fail(error);
    if (!data?.length) throw new Error('Bunu silme yetkin yok');
  },
  async rpc(name, args = {}) { const { data, error } = await sb.rpc(name, args); fail(error); return data; },
  async upsert(table, row, onConflict) { const { error } = await sb.from(table).upsert(row, { onConflict }); fail(error); },
  async removeWhere(table, col, val) { const { error } = await sb.from(table).delete().eq(col, val); fail(error); },
  async upload(blob) {
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
    fail(error); return path;
  },
  async signedUrls(paths) {
    if (!paths.length) return {};
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
    fail(error);
    const map = {}; data.forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; }); return map;
  },
  async removeFiles(paths) { if (paths.length) await sb.storage.from(BUCKET).remove(paths); },
};

// ===================================================================
//  Demo (bellekte, sayfa yenilenince sıfırlanır)
// ===================================================================
const EMRE = 'demo-emre', RABIA = 'demo-rabia';
const day = n => new Date(Date.now() + n * 864e5).toISOString();
const id = () => crypto.randomUUID();
let demoSettings = {};
const store = {
  profiles: [{ id: EMRE, name: 'Emre', is_admin: true }, { id: RABIA, name: 'Rabia', is_admin: false }],
  memories: [
    { id: 'm1', author: EMRE, title: 'Seni ilk gördüğüm an', body: 'Saat yediye geliyordu. Bir an göz göze geldik ve o an her şey değişti.', happened_on: '2026-11-07', location: '', photos: [], created_at: day(-8) },
  ],
  letters: [
    { id: 'l1', author: RABIA, recipient: EMRE, title: 'Sana ilk mektubum', body: 'Sevgili Emre,\n\nBu demo mektubudur. Gerçek mektuplar burada görünecek.', open_at: null, read_at: null, created_at: day(-1) },
    { id: 'l2', author: RABIA, recipient: EMRE, title: '1. ayımıza', body: 'gizli', open_at: '2026-12-07T19:00:00+03:00', read_at: null, created_at: day(0) },
  ],
  photos: [],
  reasons: [
    { id: 'r1', author: EMRE, text: 'Gülünce gözlerinin de gülmesi', created_at: day(-2) },
    { id: 'r2', author: RABIA, text: 'Bana her zaman iyi geliyorsun', created_at: day(-1) },
  ],
  prayers: PRAYERS.map((p, i) => ({ id: id(), author: null, cat: p.cat, title: p.title, note: p.note, ar: p.ar, tr: p.tr, body: p.mean, target: p.target, sort: (i + 1) * 10, created_at: day(-9) })),
  prayer_logs: [{ id: 'p1', author: RABIA, prayer_title: 'Âyetü’l-Kürsî', count: 1, created_at: day(-0.1) }],
  moods: [{ id: 'mo1', author: RABIA, emoji: '🥰', note: 'Seni düşünüyorum', created_at: day(-0.2) }],
  firsts: [{ id: 'f1', author: EMRE, title: 'İlk göz göze gelişimiz', happened_on: '2026-11-07', note: '', created_at: day(-8) }],
  todos: [
    { id: 't1', author: RABIA, text: 'Birlikte gün doğumu izlemek', note: '', done: false, done_at: null, created_at: day(-3) },
    { id: 't2', author: EMRE, text: 'İlk kahvemizi içmek', note: '', done: true, done_at: day(-5), created_at: day(-6) },
  ],
  songs: [{ id: 'so1', author: RABIA, title: 'Bizim şarkımız', artist: 'Demo', url: null, note: 'İlk duyduğumuzda aklıma sen geldin', created_at: day(-4) }],
  places: [{ id: 'pl1', author: EMRE, name: 'İlk gördüğüm yer', lat: 41.0082, lng: 28.9784, visited_on: '2026-11-07', note: '', created_at: day(-8) }],
  surprises: [{ id: 's1', author: RABIA, recipient: EMRE, message: 'Bugün aklımdan hiç çıkmadın. İyi ki varsın.', shown_at: null, created_at: day(-0.05) }],
  greetings: [
    { id: 'g1', author: RABIA, kind: 'morning', text: 'Günaydın sevgilim, bugün de en güzel günün olsun.', created_at: day(-1) },
    { id: 'g2', author: RABIA, kind: 'night', text: 'İyi geceler, rüyalarında ben olayım.', created_at: day(-1) },
  ],
  thoughts: [0.01, 0.05, 0.1].map((n, i) => ({ id: 'th' + i, author: RABIA, created_at: day(-n) })),
  flowers: [
    { id: 'fl1', author: EMRE, kind: 'gul', day: localDay(-2), note: '', created_at: day(-2) },
    { id: 'fl2', author: RABIA, kind: 'lale', day: localDay(-2), note: '', created_at: day(-2) },
    { id: 'fl3', author: RABIA, kind: 'papatya', day: localDay(-1), note: '', created_at: day(-1) },
    { id: 'fl4', author: RABIA, kind: 'sakayik', day: localDay(0), note: 'Bugünkü çiçeğin', created_at: day(0) },
  ],
  coupons: [
    { id: 'c1', author: RABIA, recipient: EMRE, title: 'Film gecesi', description: 'Filmi sen seçersin, patlamış mısır benden.', used_at: null, created_at: day(-2) },
    { id: 'c2', author: EMRE, recipient: RABIA, title: 'Sınırsız sarılma', description: 'Ne zaman istersen.', used_at: day(-0.3), created_at: day(-3) },
  ],
  quiz_questions: [
    { id: 'q1', author: EMRE, question: 'İlk buluşmamızda ne içtim?', options: ['Türk kahvesi', 'Latte', 'Çay', 'Limonata'], answer: 2, created_at: day(-3) },
    { id: 'q2', author: RABIA, question: 'En sevdiğim renk hangisi?', options: ['Pembe', 'Lila', 'Krem', 'Mavi'], answer: 1, created_at: day(-2) },
    { id: 'q3', author: RABIA, question: 'Hangi şehirde yaşamak isterim?', options: ['İstanbul', 'İzmir', 'Paris', 'Roma'], answer: 3, created_at: day(-1) },
  ],
  quiz_answers: [{ id: 'qa1', question_id: 'q1', author: RABIA, choice: 2, correct: true, created_at: day(-1) }],
  special_days: [{ id: 'sd1', author: EMRE, title: 'Rabia’nın doğum günü', day: '2001-03-14', yearly: true, note: '', created_at: day(-3) }],
};
function localDay(n) { const d = new Date(Date.now() + n * 864e5); return new Date(+d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
const DEMO_RPC = {
  touch_seen: () => day(-1.5),
  set_my_notify: ({ prefs }) => { store.profiles[0].notify = prefs; },
  push_test: () => { throw new Error('Demo modunda bildirim gönderilmez'); },
  locked_letters: () => store.letters.filter(l => l.recipient === EMRE && l.open_at && new Date(l.open_at) > new Date()).map(({ body, ...l }) => l),
  mark_letter_read: ({ letter_id }) => { const l = store.letters.find(x => x.id === letter_id); if (l && !l.read_at) l.read_at = new Date().toISOString(); },
  mark_surprise_shown: ({ sid }) => { const s = store.surprises.find(x => x.id === sid); if (s) s.shown_at = new Date().toISOString(); },
  use_coupon: ({ cid }) => { const c = store.coupons.find(x => x.id === cid && x.recipient === EMRE); if (c && !c.used_at) c.used_at = new Date().toISOString(); },
  quiz_for_me: () => store.quiz_questions.filter(q => q.author !== EMRE).map(q => {
    const a = store.quiz_answers.find(x => x.question_id === q.id && x.author === EMRE);
    return { ...q, choice: a?.choice ?? null, correct: a?.correct ?? null, answer: a ? q.answer : null };
  }),
  answer_quiz: ({ qid, pick }) => {
    const q = store.quiz_questions.find(x => x.id === qid);
    let a = store.quiz_answers.find(x => x.question_id === qid && x.author === EMRE);
    if (!a) { a = { id: id(), question_id: qid, author: EMRE, choice: pick, correct: pick === q.answer, created_at: new Date().toISOString() }; store.quiz_answers.push(a); }
    return { correct: a.correct, choice: a.choice, answer: q.answer };
  },
};
const blobs = {};
const demo = {
  async init() { return { id: EMRE, email: 'demo' }; },
  async signIn() { return { id: EMRE }; },
  async signOut() {},
  async changePassword() {},
  async profiles() { return store.profiles; },
  async updateProfile(pid, patch) { Object.assign(store.profiles.find(p => p.id === pid), patch); },
  async settings() { return { ...demoSettings }; },
  async saveSettings(v) { demoSettings = { ...v }; },
  async list(table) {
    const [col, asc] = ORDER[table];
    let rows = [...store[table]];
    if (table === 'letters') rows = rows.filter(l => l.author === EMRE || !l.open_at || new Date(l.open_at) <= new Date());
    if (table === 'quiz_questions') rows = rows.filter(q => q.author === EMRE);
    if (table === 'surprises') rows = rows.filter(s => s.author === EMRE || s.recipient === EMRE);
    const cmp = (a, b) => (typeof a[col] === 'number' ? a[col] - b[col] : String(a[col] ?? '').localeCompare(String(b[col] ?? '')));
    return rows.sort((a, b) => asc ? cmp(a, b) : cmp(b, a));
  },
  async insert(table, row) {
    if (table === 'flowers' && store.flowers.some(f => f.author === EMRE && f.day === row.day)) throw new Error('Bugünün çiçeğini zaten gönderdin');
    const r = { id: id(), author: EMRE, created_at: new Date().toISOString(), ...row };
    if (table === 'memories') r.photos ??= [];
    store[table].push(r); return r;
  },
  async update(table, rid, patch) { const r = store[table].find(x => x.id === rid); Object.assign(r, patch); return r; },
  async remove(table, rid) { store[table] = store[table].filter(r => r.id !== rid); },
  async rpc(name, args = {}) { return structuredClone(DEMO_RPC[name](args) ?? null); },
  async upsert() {},
  async removeWhere() {},
  async upload(blob) { const p = id(); blobs[p] = URL.createObjectURL(blob); return p; },
  async signedUrls(paths) { const m = {}; paths.forEach(p => { if (blobs[p]) m[p] = blobs[p]; }); return m; },
  async removeFiles() {},
};

export const api = DEMO ? demo : real;
