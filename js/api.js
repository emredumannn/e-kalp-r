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
  messages: ['created_at', false],
  tot_questions: ['created_at', true],
  tot_answers: ['created_at', true],
  memory_scores: ['created_at', false],
  push_subscriptions: ['created_at', false],
  daily_answers: ['day', false],
  comfort_items: ['created_at', false],
  support_pings: ['created_at', false],
  star_maps: ['event_at', false],
  drawings: ['updated_at', false],
  shared_media: ['created_at', false],
  media_quizzes: ['created_at', false],
  media_quiz_attempts: ['created_at', false],
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
  // Bu kullanıcının, verilen cihaz dışındaki tüm bildirim kayıtlarını sil
  async keepOnlyPush(userId, endpoint) {
    const { error } = await sb.from('push_subscriptions').delete().eq('user_id', userId).neq('endpoint', endpoint);
    fail(error);
  },
  async upload(blob, ext = 'jpg', type = 'image/jpeg') {
    const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: '31536000' });
    fail(error); return path;
  },
  async getOne(table, id) { const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle(); fail(error); return data; },
  /**
   * Yayın kanalı (canlı çizim gibi). Önce sadece ikimize açık "özel kanal" dener;
   * olmazsa normal kanala düşer. handlers: { olayAdı: (payload) => {} }
   */
  channel(name, handlers) {
    let ch = null, closed = false;
    const open = priv => {
      ch = sb.channel(name, { config: { private: priv, broadcast: { self: false, ack: false } } });
      Object.entries(handlers).forEach(([event, fn]) => ch.on('broadcast', { event }, ({ payload }) => fn(payload)));
      ch.subscribe(status => {
        if (status === 'SUBSCRIBED') handlers._status?.('online');
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && priv && !closed) { sb.removeChannel(ch); open(false); }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') handlers._status?.('offline');
      });
    };
    open(true);
    return {
      send: (event, payload) => ch?.send({ type: 'broadcast', event, payload }).catch?.(() => {}),
      close: () => { closed = true; if (ch) sb.removeChannel(ch); },
    };
  },
  // Gerçek zamanlı: tablo değişince cb çağrılır; geri dönen fonksiyon dinlemeyi bırakır
  subscribe(table, cb) {
    const ch = sb.channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, p => cb(p))
      .subscribe();
    return () => sb.removeChannel(ch);
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
  messages: [
    { id: 'ms1', author: RABIA, body: 'Günaydın sevgilim, bugün aklımdan hiç çıkmadın', photo: null, audio: null, audio_secs: null, hearted: true, read_at: day(-0.9), created_at: day(-1) },
    { id: 'ms2', author: EMRE, body: 'Ben de seni çok düşündüm. Akşam görüşelim mi?', photo: null, audio: null, audio_secs: null, hearted: false, read_at: day(-0.8), created_at: day(-0.95) },
    { id: 'ms3', author: RABIA, body: 'Olur, dört gözle bekliyorum', photo: null, audio: null, audio_secs: null, hearted: false, read_at: null, created_at: day(-0.02) },
  ],
  tot_questions: [],
  push_subscriptions: [],
  daily_answers: [
    { id: 'da1', author: RABIA, day: localDay(0), qidx: 0, answer: 'Gülüşün. Kalabalığın içinde bile hemen fark ettim.', created_at: day(-0.1) },
    { id: 'da2', author: EMRE, day: localDay(-1), qidx: 0, answer: 'Gözlerindeki ışık.', created_at: day(-1) },
    { id: 'da3', author: RABIA, day: localDay(-1), qidx: 0, answer: 'Sesin ve o utangaç gülümsemen.', created_at: day(-1) },
  ],
  comfort_items: [
    { id: 'cf1', author: RABIA, mood: 'hepsi', kind: 'note', body: 'Ne olursa olsun yanındayım. Derin bir nefes al, bugün de geçecek ve ben hep burada olacağım.', media: null, audio_secs: null, ref_id: null, created_at: day(-2) },
    { id: 'cf2', author: RABIA, mood: 'ozledim', kind: 'memory', body: 'Bu günü hatırla', media: null, audio_secs: null, ref_id: 'm1', created_at: day(-2) },
    { id: 'cf3', author: RABIA, mood: 'konus', kind: 'call', body: '+90 500 000 00 00', media: null, audio_secs: null, ref_id: null, created_at: day(-2) },
  ],
  support_pings: [],
  star_maps: [{ id: 'st1', author: EMRE, title: 'Seni ilk gördüğüm an', event_at: '2026-11-07T16:00:00.000Z', tz: 'Europe/Istanbul', lat: 41.0082, lng: 28.9784, location_label: 'İstanbul', note: 'O akşam gökyüzü tam böyleydi.', image_path: null, map_type: 'accurate', created_at: day(-1) }],
  drawings: [],
  shared_media: [
    { id: 'sm1', author: RABIA, kind: 'film', title: 'Notebook', status: 'bitti', finished_on: localDay(-3), note: 'Çok ağladık', created_at: day(-5) },
    { id: 'sm2', author: EMRE, kind: 'kitap', title: 'Küçük Prens', status: 'devam', finished_on: null, note: '', created_at: day(-4) },
    { id: 'sm3', author: RABIA, kind: 'dizi', title: 'Friends', status: 'plan', finished_on: null, note: '', created_at: day(-2) },
  ],
  media_quizzes: [
    { id: 'mq1', author: RABIA, media_id: 'sm1', title: 'Notebook testi', questions: [{ q: 'Noah evi kimin için yeniden yaptı?', o: ['Allie', 'Annesi', 'Kendisi'] }, { q: 'Film hangi mevsimde başlar?', o: ['Yaz', 'Kış', 'İlkbahar'] }], answers: [0, 0], created_at: day(-2) },
  ],
  media_quiz_attempts: [],
  tot_answers: [
    { id: 'ta1', author: RABIA, qkey: 'b0', pick: 0, created_at: day(-1) },
    { id: 'ta2', author: RABIA, qkey: 'b1', pick: 1, created_at: day(-1) },
    { id: 'ta3', author: EMRE, qkey: 'b0', pick: 0, created_at: day(-1) },
  ],
  memory_scores: [{ id: 'mm1', author: RABIA, seconds: 48, moves: 14, pairs: 6, created_at: day(-1) }],
  special_days: [{ id: 'sd1', author: EMRE, title: 'Rabia’nın doğum günü', day: '2001-03-14', yearly: true, note: '', created_at: day(-3) }],
};
function localDay(n) { const d = new Date(Date.now() + n * 864e5); return new Date(+d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
const DEMO_RPC = {
  touch_seen: () => day(-1.5),
  media_quizzes_for_me: () => store.media_quizzes.filter(q => q.author !== EMRE).map(q => {
    const a = store.media_quiz_attempts.find(x => x.quiz_id === q.id && x.author === EMRE);
    const { answers, ...rest } = q;
    return { ...rest, attempted: !!a, score: a?.score ?? null, total: a?.total ?? null, picks: a?.picks ?? null, answers: a ? answers : null };
  }),
  media_quiz_submit: ({ qid, picks }) => {
    const q = store.media_quizzes.find(x => x.id === qid);
    if (store.media_quiz_attempts.some(a => a.quiz_id === qid && a.author === EMRE)) throw new Error('Bu testi zaten çözdün');
    const score = q.answers.filter((a, i) => picks[i] === a).length;
    store.media_quiz_attempts.push({ id: id(), quiz_id: qid, author: EMRE, picks, score, total: q.answers.length, created_at: new Date().toISOString() });
    return { score, total: q.answers.length, answers: q.answers };
  },
  set_my_prefs: ({ prefs }) => { store.profiles[0].prefs = prefs; },
  daily_for_me: ({ d }) => {
    const m = store.daily_answers.find(a => a.author === EMRE && a.day === d), t = store.daily_answers.find(a => a.author !== EMRE && a.day === d);
    return [{ mine: m?.answer ?? null, theirs: m ? t?.answer ?? null : null, they_answered: !!t }];
  },
  daily_history: () => store.daily_answers.filter(a => a.author === EMRE).map(m => {
    const t = store.daily_answers.find(a => a.author !== EMRE && a.day === m.day);
    return t ? { day: m.day, qidx: m.qidx, mine: m.answer, theirs: t.answer } : null;
  }).filter(Boolean),
  toggle_heart: ({ mid }) => { const m = store.messages.find(x => x.id === mid && x.author !== EMRE); if (m) m.hearted = !m.hearted; return m?.hearted ?? null; },
  mark_messages_read: () => { store.messages.forEach(m => { if (m.author !== EMRE && !m.read_at) m.read_at = new Date().toISOString(); }); },
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
    if (table === 'daily_answers') rows = rows.filter(a => a.author === EMRE);
    if (table === 'media_quizzes') rows = rows.filter(q => q.author === EMRE);
    const cmp = (a, b) => (typeof a[col] === 'number' ? a[col] - b[col] : String(a[col] ?? '').localeCompare(String(b[col] ?? '')));
    return rows.sort((a, b) => asc ? cmp(a, b) : cmp(b, a));
  },
  async insert(table, row) {
    if (table === 'flowers' && store.flowers.some(f => f.author === EMRE && f.day === row.day)) throw new Error('Bugünün çiçeğini zaten gönderdin');
    const r = { id: id(), author: EMRE, created_at: new Date().toISOString(), ...row };
    if (table === 'memories') r.photos ??= [];
    if (table === 'drawings') Object.assign(r, { strokes: [], image_path: null, updated_at: r.created_at, ...row });
    if (table === 'messages') Object.assign(r, { body: null, photo: null, audio: null, audio_secs: null, hearted: false, read_at: null, ...row });
    store[table].push(r); return r;
  },
  async update(table, rid, patch) { const r = store[table].find(x => x.id === rid); Object.assign(r, patch); return r; },
  async remove(table, rid) { store[table] = store[table].filter(r => r.id !== rid); },
  async rpc(name, args = {}) { return structuredClone(DEMO_RPC[name](args) ?? null); },
  async upsert(table, row) {
    if (table !== 'tot_answers') return;
    const ex = store.tot_answers.find(a => a.author === EMRE && a.qkey === row.qkey);
    ex ? (ex.pick = row.pick) : store.tot_answers.push({ id: id(), author: EMRE, created_at: new Date().toISOString(), ...row });
  },
  async removeWhere() {},
  async keepOnlyPush() {},
  async upload(blob) { const p = id(); blobs[p] = URL.createObjectURL(blob); return p; },
  subscribe() { return () => {}; },
  async getOne(table, rid) { return structuredClone(store[table].find(r => r.id === rid) ?? null); },
  channel(name, handlers) { setTimeout(() => handlers._status?.('online'), 100); return { send() {}, close() {} }; },
  async signedUrls(paths) { const m = {}; paths.forEach(p => { if (blobs[p]) m[p] = blobs[p]; }); return m; },
  async removeFiles() {},
};

export const api = DEMO ? demo : real;
