// E ❤ R · telefon bildirimi gönderen Supabase Edge Function
// Supabase > Edge Functions > Deploy a new function > Via Editor
// Fonksiyon adı: push   ·   "Verify JWT" / "Enforce JWT verification": KAPALI
// (Güvenlik, veritabanındaki gizli anahtarla sağlanır.)
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

// ------------------------------------------------------------------ yardımcılar
const enc = new TextEncoder();
const b64uEnc = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ''; for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64uDec = (str: string) => {
  let s = str.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

type Cfg = { site_url: string; webhook_secret: string; vapid_public: string; vapid_private: string; vapid_subject: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

// VAPID imzası (RFC 8292)
async function vapidHeader(endpoint: string, cfg: Cfg) {
  const head = b64uEnc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64uEnc(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: cfg.vapid_subject,
  })));
  const pub = b64uDec(cfg.vapid_public);
  const key = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', d: cfg.vapid_private, x: b64uEnc(pub.slice(1, 33)), y: b64uEnc(pub.slice(33, 65)), ext: true,
  }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64uEnc(sig)}, k=${cfg.vapid_public}`;
}

// İçerik şifreleme (RFC 8291, aes128gcm)
async function encrypt(sub: Sub, text: string) {
  const uaPub = b64uDec(sub.p256dh), authSecret = b64uDec(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info'), new Uint8Array([0]), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  return concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

// ------------------------------------------------------------------ mesajlar
const FLOWERS: Record<string, string> = { gul: 'gül', lale: 'lale', papatya: 'papatya', lavanta: 'lavanta', sakayik: 'şakayık', ortanca: 'ortanca' };
// Bildirim kategorisi (uygulamadaki ayarlarla aynı anahtarlar)
const CATEGORY: Record<string, string> = {
  letters: 'letters', prayer_logs: 'prayers', thoughts: 'thoughts', flowers: 'flowers',
  coupons: 'fun', coupons_used: 'fun', quiz_questions: 'fun',
  memories: 'shares', photos: 'shares', reasons: 'shares', moods: 'shares', firsts: 'shares',
  todos: 'shares', songs: 'shares', places: 'shares', special_days: 'shares',
  messages: 'messages', memory_scores: 'fun', letters_open: 'letters',
  daily_answers: 'daily', support_pings: 'support',
  star_maps: 'shares', drawings: 'shares', shared_media: 'fun', media_quizzes: 'fun', media_quiz_attempts: 'fun',
};
// Aynı türden bildirimler arasında en az bu kadar saniye
const THROTTLE: Record<string, number> = { photos: 120, thoughts: 3 * 3600, moods: 1800, prayer_logs: 300, messages: 8, memory_scores: 600, support_pings: 600 };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const short = (s: string | null | undefined, n = 90) => !s ? '' : s.length > n ? s.slice(0, n - 1) + '…' : s;
const fmtDate = (d: string) => new Date(d).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });

function message(kind: string, r: Record<string, any>, name: (id: string) => string) {
  const who = name(r.author);
  switch (kind) {
    case 'memories': return { title: `${who} yeni bir anı ekledi`, body: short(r.title), url: '#/anilar' };
    case 'letters': return {
      to: r.recipient, title: `${who} sana bir mektup yazdı`, url: '#/mektuplar',
      body: r.open_at && new Date(r.open_at) > new Date() ? `Mühürlü · ${fmtDate(r.open_at)}’da açılacak` : short(r.title),
    };
    case 'letters_open': return { to: r.recipient, title: 'Mühürlü mektubun açıldı', body: `${who}’dan: ${short(r.title)}`, url: '#/mektuplar' };
    case 'photos': return { title: `${who} yeni fotoğraf ekledi`, body: short(r.caption || r.album), url: '#/galeri' };
    case 'reasons': return { title: `${who} kavanoza yeni bir sebep attı`, body: short(r.text), url: '#/kavanoz' };
    case 'prayer_logs': return { title: `${who} senin için dua etti`, body: `${r.prayer_title}${r.count > 1 ? ` · ${r.count} kez` : ''}`, url: '#/' };
    case 'moods': return { title: `${who} bugün ${r.emoji}`, body: short(r.note), url: '#/' };
    case 'firsts': return { title: `${who} yeni bir ilk ekledi`, body: short(r.title), url: '#/ilkler' };
    case 'todos': return { title: `${who} hayal listenize ekledi`, body: short(r.text), url: '#/yapacaklar' };
    case 'songs': return { title: `${who} bir şarkı ekledi`, body: short(`${r.title}${r.artist ? ' · ' + r.artist : ''}`), url: '#/muzik' };
    case 'places': return { title: `${who} haritaya bir yer ekledi`, body: short(r.name), url: '#/harita' };
    case 'thoughts': return { title: `${who} şu an seni düşünüyor`, body: 'Sen de ona bir kalp gönder', url: '#/' };
    case 'flowers': return { title: `${who} sana bir ${FLOWERS[r.kind] ?? 'çiçek'} gönderdi`, body: short(r.note) || 'Bahçeniz büyüyor', url: '#/bahce' };
    case 'coupons': return { to: r.recipient, title: `${who} sana bir kupon yazdı`, body: short(r.title), url: '#/kuponlar' };
    case 'coupons_used': return { to: r.author, actor: r.recipient, title: `${name(r.recipient)} kuponunu kullandı`, body: short(r.title), url: '#/kuponlar' };
    case 'quiz_questions': return { title: `${who} sana yeni bir soru sordu`, body: 'Onu ne kadar tanıyorsun?', url: '#/test' };
    case 'special_days': return { title: `${who} bir özel gün ekledi`, body: short(r.title), url: '#/ozel-gunler' };
    case 'messages': return { title: who, body: r.body ? short(r.body, 140) : r.photo ? 'Bir fotoğraf gönderdi' : 'Sesli mesaj gönderdi', url: '#/fisilti' };
    case 'memory_scores': return { title: `${who} hafıza oyununu ${mmss(r.seconds)}’de bitirdi`, body: 'Rekoru kırabilir misin?', url: '#/hafiza' };
    // Cevabın kendisi asla bildirimde görünmez
    case 'star_maps': return { title: `${who} bir yıldız haritası oluşturdu`, body: short(r.title), url: '#/yildizlar' };
    case 'drawings': return { title: `${who} yeni bir çizim başlattı`, body: 'Gel, birlikte çizelim', url: '#/cizim' };
    case 'shared_media': return { title: `${who} listemize ${r.kind === 'kitap' ? 'bir kitap' : r.kind === 'dizi' ? 'bir dizi' : 'bir film'} ekledi`, body: short(r.title), url: '#/sampiyona' };
    case 'media_quizzes': return { title: `${who} sana bir test hazırladı`, body: short(r.title), url: '#/sampiyona' };
    case 'media_quiz_attempts': return { title: `${who} testini çözdü`, body: `${r.score}/${r.total} doğru`, url: '#/sampiyona' };
    case 'daily_answers': return { title: `${who} günün sorusunu cevapladı`, body: 'Sen de cevapla; ikiniz de cevaplayınca cevaplar açılır', url: '#/' };
    // Hassas ayrıntı yok: ruh hali bildirimde yazılmaz
    case 'support_pings': return { title: `${who} bugün biraz zor bir gün geçiriyor`, body: 'Ona bir fısıltı gönder ya da ara', url: '#/fisilti' };
    case 'test': return { to: r.author, title: 'Bildirimler çalışıyor', body: 'Artık birbirinizden haber alacaksınız.', url: '#/' };
  }
  return null;
}

// ------------------------------------------------------------------ istek
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  const { data: cfg } = await db.from('push_config').select('*').eq('id', 1).maybeSingle();
  if (!cfg || !cfg.webhook_secret || req.headers.get('x-push-secret') !== cfg.webhook_secret) return json({ error: 'forbidden' }, 403);

  const { table, record } = await req.json();
  const { data: people } = await db.from('profiles').select('id, name, notify');
  const name = (id: string) => people?.find(p => p.id === id)?.name ?? 'Sevgilin';
  const msg = message(table, record ?? {}, name);
  if (!msg) return json({ skipped: 'unknown table' });

  const actor = msg.actor ?? record.author;
  const to = msg.to ?? people?.find(p => p.id !== actor)?.id;
  if (!to || (table !== 'test' && to === actor)) return json({ skipped: 'no recipient' });

  // Test çözüldü: bildirim testi yazana gider
  if (table === 'media_quiz_attempts') {
    const { data: q } = await db.from('media_quizzes').select('author, title').eq('id', record.quiz_id).maybeSingle();
    if (!q || q.author === actor) return json({ skipped: 'no quiz owner' });
    msg.body = `“${short(q.title, 60)}” · ${record.score}/${record.total} doğru`;
  }
  // Günün sorusu: karşı taraf zaten cevapladıysa "cevaplarınız açıldı" de
  if (table === 'daily_answers') {
    const { count } = await db.from('daily_answers').select('id', { count: 'exact', head: true }).eq('author', to).eq('day', record.day);
    if (count) msg.body = 'Cevaplarınız açıldı, birbirinizinkini görün';
  }
  const target = people?.find(p => p.id === to);
  if (table !== 'test' && target?.notify?.[CATEGORY[table]] === false) return json({ skipped: 'muted' });

  const wait = THROTTLE[table];
  if (wait) {
    const since = new Date(Date.now() - wait * 1000).toISOString();
    const { count } = await db.from('push_log').select('id', { count: 'exact', head: true })
      .eq('recipient', to).eq('kind', table).gte('sent_at', since);
    if (count) return json({ skipped: 'throttled' });
  }

  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', to);
  if (!subs?.length) return json({ skipped: 'no subscription' });

  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: cfg.site_url + msg.url, tag: table });
  const results = await Promise.all(subs.map(async (s: Sub) => {
    try {
      const res = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
          TTL: '86400', Urgency: 'high', Authorization: await vapidHeader(s.endpoint, cfg),
        },
        body: await encrypt(s, payload),
      });
      if (res.status === 404 || res.status === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      return { status: res.status, text: res.ok ? '' : (await res.text()).slice(0, 200) };
    } catch (e) {
      return { error: String(e) };
    }
  }));
  await db.from('push_log').insert({ recipient: to, kind: table });
  return json({ sent: results });
});
