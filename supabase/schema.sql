-- =====================================================================
--  E ❤ R — Supabase şeması
--  Supabase > SQL Editor > New query > bu dosyanın tamamını yapıştır > Run
--  (Tekrar çalıştırmak güvenlidir; var olan verilere dokunmaz.)
-- =====================================================================

-- ---------- Üyeler: sadece bu tabloda adı olanlar siteyi görebilir ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- ---------- Site ayarları (admin değiştirir) ----------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- Anılar ----------
create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  happened_on date not null default current_date,
  location    text,
  photos      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------- Mektuplar ----------
create table if not exists public.letters (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient  uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null,
  open_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Galeri ----------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  path       text not null,
  caption    text,
  album      text not null default 'Genel',
  taken_on   date,
  created_at timestamptz not null default now()
);

-- ---------- Kavanoz ----------
create table if not exists public.reasons (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);

-- ---------- Dualar (hazırlar + bizim yazdıklarımız) ----------
create table if not exists public.prayers (
  id         uuid primary key default gen_random_uuid(),
  author     uuid default auth.uid() references public.profiles(id) on delete set null,  -- null = hazır dua
  cat        text not null default 'bizim',
  title      text not null,
  note       text,
  ar         text,
  tr         text,
  body       text,
  target     int  not null default 1,
  sort       int  not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_logs (
  id           uuid primary key default gen_random_uuid(),
  author       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  prayer_title text not null,
  count        int  not null default 1,
  created_at   timestamptz not null default now()
);

-- ---------- Ruh hali ----------
create table if not exists public.moods (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- İlklerimiz ----------
create table if not exists public.firsts (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title       text not null,
  happened_on date,
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------- Birlikte yapacaklarımız ----------
create table if not exists public.todos (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  text       text not null,
  note       text,
  done       boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Şarkılarımız ----------
create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title      text not null,
  artist     text,
  url        text,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- Haritamız ----------
create table if not exists public.places (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  visited_on date,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- Açılış sürprizleri ----------
create table if not exists public.surprises (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient  uuid not null references public.profiles(id) on delete cascade,
  message    text not null,
  shown_at   timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Günaydın / İyi geceler notları ----------
create table if not exists public.greetings (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('morning','night')),
  text       text not null,
  created_at timestamptz not null default now(),
  unique (author, kind)
);

-- ---------- "Seni düşünüyorum" ----------
create table if not exists public.thoughts (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Bahçemiz: kişi başı günde bir çiçek ----------
create table if not exists public.flowers (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null,
  day        date not null,
  note       text,
  created_at timestamptz not null default now(),
  unique (author, day)
);

-- ---------- Aşk kuponları ----------
create table if not exists public.coupons (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- "Beni ne kadar tanıyorsun?" ----------
create table if not exists public.quiz_questions (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  question   text not null,
  options    text[] not null,
  answer     int  not null,            -- options içindeki doğru cevabın sırası (0'dan başlar)
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  choice      int not null,
  correct     boolean not null,
  created_at  timestamptz not null default now(),
  unique (question_id, author)
);

-- ---------- Özel günler ----------
create table if not exists public.special_days (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title      text not null,
  day        date not null,
  yearly     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);

-- ---------- Fısıltı (mesajlaşma) ----------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text,
  photo      text,
  audio      text,
  audio_secs int,
  hearted    boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  check (body is not null or photo is not null or audio is not null)
);

-- ---------- Bu mu, o mu? ----------
create table if not exists public.tot_questions (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  a          text not null,
  b          text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.tot_answers (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  qkey       text not null,           -- hazır sorular "b12", eklenenler "c<uuid>"
  pick       int  not null check (pick in (0, 1)),
  created_at timestamptz not null default now(),
  unique (author, qkey)
);

-- ---------- Fotoğraflarla hafıza oyunu ----------
create table if not exists public.memory_scores (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  seconds    int not null,
  moves      int not null,
  pairs      int not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
--  Güvenlik (RLS)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','site_settings','memories','letters','photos','reasons','prayers',
                           'prayer_logs','moods','firsts','todos','songs','places','surprises','greetings',
                           'thoughts','flowers','coupons','quiz_questions','quiz_answers','special_days',
                           'messages','tot_questions','tot_answers','memory_scores'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiller: ikimiz de görürüz; isimleri sadece admin değiştirir
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using (public.is_member());
create policy "profiles_update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Ayarlar: ikimiz okuruz, admin yazar
drop policy if exists "settings_read"  on public.site_settings;
drop policy if exists "settings_write" on public.site_settings;
create policy "settings_read"  on public.site_settings for select to authenticated using (public.is_member());
create policy "settings_write" on public.site_settings for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Ortak kalıp: ikimiz de okuruz ve ekleriz; yazan kişi ya da admin düzenler/siler
do $$
declare t text;
begin
  foreach t in array array['memories','photos','reasons','prayers','prayer_logs','moods','firsts','todos','songs','places',
                           'greetings','thoughts','flowers','coupons','special_days',
                           'messages','tot_questions','tot_answers','memory_scores'] loop
    execute format('drop policy if exists "%1$s_read"   on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_read"   on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.is_member() and author = auth.uid())', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (author = auth.uid() or public.is_admin()) with check (public.is_member())', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (author = auth.uid() or public.is_admin())', t);
  end loop;
end $$;

-- Yapacaklar listesinde ikimiz de "yaptık" işaretleyebilelim
drop policy if exists "todos_update" on public.todos;
create policy "todos_update" on public.todos for update to authenticated using (public.is_member()) with check (public.is_member());

-- Mektuplar: kişiseldir. Yazan görür/düzenler; alıcı sadece açılma zamanı gelince okur.
-- (Admin de dahil kimse kilitli mektubu önceden okuyamaz.)
drop policy if exists "letters_read"   on public.letters;
drop policy if exists "letters_insert" on public.letters;
drop policy if exists "letters_update" on public.letters;
drop policy if exists "letters_delete" on public.letters;
create policy "letters_read" on public.letters for select to authenticated
  using (author = auth.uid() or (recipient = auth.uid() and (open_at is null or open_at <= now())));
create policy "letters_insert" on public.letters for insert to authenticated
  with check (public.is_member() and author = auth.uid());
create policy "letters_update" on public.letters for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());
create policy "letters_delete" on public.letters for delete to authenticated
  using (author = auth.uid());

create or replace function public.locked_letters()
returns table (id uuid, author uuid, title text, open_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.author, l.title, l.open_at, l.created_at
  from public.letters l
  where l.recipient = auth.uid() and l.open_at is not null and l.open_at > now();
$$;

create or replace function public.mark_letter_read(letter_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.letters set read_at = now()
  where id = letter_id and recipient = auth.uid() and read_at is null
    and (open_at is null or open_at <= now());
$$;

grant execute on function public.locked_letters()       to authenticated;
grant execute on function public.mark_letter_read(uuid) to authenticated;

-- Sürprizler: sadece yazan ve alan görür (admin de başkasının sürprizini göremez)
drop policy if exists "surprises_read"   on public.surprises;
drop policy if exists "surprises_insert" on public.surprises;
drop policy if exists "surprises_update" on public.surprises;
drop policy if exists "surprises_delete" on public.surprises;
create policy "surprises_read"   on public.surprises for select to authenticated using (author = auth.uid() or recipient = auth.uid());
create policy "surprises_insert" on public.surprises for insert to authenticated with check (public.is_member() and author = auth.uid());
create policy "surprises_update" on public.surprises for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "surprises_delete" on public.surprises for delete to authenticated using (author = auth.uid());

create or replace function public.mark_surprise_shown(sid uuid)
returns void language sql security definer set search_path = public as $$
  update public.surprises set shown_at = now() where id = sid and recipient = auth.uid() and shown_at is null;
$$;

-- Kupon: sadece alan kişi "kullandım" diyebilir
create or replace function public.use_coupon(cid uuid)
returns void language sql security definer set search_path = public as $$
  update public.coupons set used_at = now() where id = cid and recipient = auth.uid() and used_at is null;
$$;

-- Test: sorular ve doğru cevaplar sadece soruyu yazana görünür;
-- cevaplayan kişi soruları cevapsız alır, doğru cevabı ancak cevapladıktan sonra görür.
drop policy if exists "quiz_q_read"   on public.quiz_questions;
drop policy if exists "quiz_q_insert" on public.quiz_questions;
drop policy if exists "quiz_q_update" on public.quiz_questions;
drop policy if exists "quiz_q_delete" on public.quiz_questions;
create policy "quiz_q_read"   on public.quiz_questions for select to authenticated using (author = auth.uid());
create policy "quiz_q_insert" on public.quiz_questions for insert to authenticated with check (public.is_member() and author = auth.uid());
create policy "quiz_q_update" on public.quiz_questions for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "quiz_q_delete" on public.quiz_questions for delete to authenticated using (author = auth.uid());

drop policy if exists "quiz_a_read" on public.quiz_answers;
create policy "quiz_a_read" on public.quiz_answers for select to authenticated using (public.is_member());

create or replace function public.quiz_for_me()
returns table (id uuid, author uuid, question text, options text[], created_at timestamptz, choice int, correct boolean, answer int)
language sql stable security definer set search_path = public as $$
  select q.id, q.author, q.question, q.options, q.created_at, a.choice, a.correct,
         case when a.id is not null then q.answer end
  from public.quiz_questions q
  left join public.quiz_answers a on a.question_id = q.id and a.author = auth.uid()
  where q.author <> auth.uid() and public.is_member()
  order by q.created_at;
$$;

create or replace function public.answer_quiz(qid uuid, pick int)
returns json language plpgsql security definer set search_path = public as $$
declare q public.quiz_questions; ok boolean; ch int;
begin
  if not public.is_member() then raise exception 'Yetki yok'; end if;
  select * into q from public.quiz_questions where id = qid;
  if q.id is null or q.author = auth.uid() then raise exception 'Soru bulunamadı'; end if;
  insert into public.quiz_answers (question_id, author, choice, correct)
  values (qid, auth.uid(), pick, pick = q.answer)
  on conflict (question_id, author) do nothing;
  select a.correct, a.choice into ok, ch from public.quiz_answers a where a.question_id = qid and a.author = auth.uid();
  return json_build_object('correct', ok, 'choice', ch, 'answer', q.answer);
end;
$$;

-- Fısıltı: karşıdakinin mesajına kalp bırak / okundu işaretle
create or replace function public.toggle_heart(mid uuid)
returns boolean language sql security definer set search_path = public as $$
  update public.messages set hearted = not hearted
  where id = mid and author <> auth.uid() and public.is_member()
  returning hearted;
$$;
create or replace function public.mark_messages_read()
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
  where author <> auth.uid() and read_at is null and public.is_member();
$$;
grant execute on function public.toggle_heart(uuid)      to authenticated;
grant execute on function public.mark_messages_read()    to authenticated;

-- Mesajların anında gelmesi için gerçek zamanlı yayın
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
          when undefined_object then null;
end $$;

grant execute on function public.mark_surprise_shown(uuid) to authenticated;
grant execute on function public.use_coupon(uuid)          to authenticated;
grant execute on function public.quiz_for_me()             to authenticated;
grant execute on function public.answer_quiz(uuid, int)    to authenticated;

-- =====================================================================
--  API erişim izinleri
--  (Proje kurulurken "Grant API access to new tables automatically" kapalıysa
--   tablolar API'ye kapalı olur; bu satırlar izni açıkça verir.
--   Sadece giriş yapmış kullanıcılara verilir; satır bazında yetkiyi yukarıdaki RLS kuralları belirler.)
-- =====================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.is_admin()  to authenticated;

-- =====================================================================
--  Fotoğraf deposu (gizli)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do update set public = false;

drop policy if exists "photos_obj_read"   on storage.objects;
drop policy if exists "photos_obj_insert" on storage.objects;
drop policy if exists "photos_obj_delete" on storage.objects;
create policy "photos_obj_read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member());
create policy "photos_obj_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.is_member());
create policy "photos_obj_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (owner = auth.uid() or public.is_admin()));

-- =====================================================================
--  "Senin için yeni": son giriş zamanı
-- =====================================================================
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists notify jsonb not null default '{}';

create or replace function public.touch_seen()
returns timestamptz language plpgsql security definer set search_path = public as $$
declare prev timestamptz;
begin
  select last_seen_at into prev from public.profiles where id = auth.uid();
  update public.profiles set last_seen_at = now() where id = auth.uid();
  return prev;
end;
$$;

-- Kişi kendi bildirim tercihlerini değiştirir (ör. {"thoughts": false})
create or replace function public.set_my_notify(prefs jsonb)
returns void language sql security definer set search_path = public as $$
  update public.profiles set notify = coalesce(prefs, '{}'::jsonb) where id = auth.uid();
$$;

grant execute on function public.touch_seen()          to authenticated;
grant execute on function public.set_my_notify(jsonb)  to authenticated;

-- =====================================================================
--  Telefon bildirimleri
-- =====================================================================
create extension if not exists pg_net;

-- Her telefonun bildirim adresi
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_sub_own" on public.push_subscriptions;
create policy "push_sub_own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Sunucu ayarları ve anahtarlar: SADECE sunucu okur (uygulamaya kapalı)
create table if not exists public.push_config (
  id             int primary key default 1 check (id = 1),
  function_url   text,
  site_url       text,
  webhook_secret text,
  vapid_public   text,
  vapid_private  text,
  vapid_subject  text
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- Aynı türden bildirimlerin üst üste gelmesini engellemek için kayıt
create table if not exists public.push_log (
  id        bigint generated always as identity primary key,
  recipient uuid not null,
  kind      text not null,
  sent_at   timestamptz not null default now()
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- Bir şey eklenince bildirim sunucusunu çağır
create or replace function public.push_notify()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare u text; s text; kind text := TG_TABLE_NAME;
begin
  if TG_OP = 'UPDATE' then
    if TG_TABLE_NAME = 'coupons' and old.used_at is null and new.used_at is not null then kind := 'coupons_used';
    else return new; end if;
  end if;
  select function_url, webhook_secret into u, s from public.push_config where id = 1;
  if u is null then return new; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('table', kind, 'record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new;   -- bildirim gitmese bile kayıt asla engellenmez
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['memories','letters','photos','reasons','prayer_logs','moods','firsts','todos','songs',
                           'places','thoughts','flowers','coupons','quiz_questions','special_days',
                           'messages','memory_scores'] loop
    execute format('drop trigger if exists push_after_insert on public.%I', t);
    execute format('create trigger push_after_insert after insert on public.%I for each row execute function public.push_notify()', t);
  end loop;
end $$;
drop trigger if exists push_after_update on public.coupons;
create trigger push_after_update after update on public.coupons for each row execute function public.push_notify();
-- Not: açılış sürprizleri bilerek bildirim göndermez (sürpriz bozulmasın).

-- "Kendime deneme bildirimi gönder"
create or replace function public.push_test()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u text; s text;
begin
  if not public.is_member() then raise exception 'Yetki yok'; end if;
  select function_url, webhook_secret into u, s from public.push_config where id = 1;
  if u is null then raise exception 'Bildirim sunucusu henüz kurulmadı'; end if;
  perform net.http_post(
    url := u,
    body := jsonb_build_object('table', 'test', 'record', jsonb_build_object('author', auth.uid())),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
    timeout_milliseconds := 5000);
end;
$$;
grant execute on function public.push_test() to authenticated;

-- Bildirim sunucusunun (service_role) okuyup yazabileceği tablolar
grant usage on schema public to service_role;
grant select on public.profiles, public.push_config to service_role;
grant select, insert, delete on public.push_subscriptions, public.push_log to service_role;
grant usage, select on all sequences in schema public to service_role;

-- =====================================================================
--  Hazır dualar (sadece ilk kurulumda eklenir; sonra Admin Paneli'nden düzenlenir)
-- =====================================================================
insert into public.prayers (cat, title, note, ar, tr, body, target, sort, author)
select v.cat, v.title, v.note, v.ar, v.tr, v.body, v.target, v.sort, null
from (values
  ($q$nazar$q$, $q$Âyetü’l-Kürsî$q$, $q$Bakara 255 · Nazara ve her türlü kötülüğe karşı$q$, $q$اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ$q$, $q$Allâhü lâ ilâhe illâ hüve’l-hayyü’l-kayyûm. Lâ te’huzühû sinetün ve lâ nevm. Lehû mâ fi’s-semâvâti ve mâ fi’l-ard. Men ze’llezî yeşfeu indehû illâ bi-iznih. Ya‘lemü mâ beyne eydîhim ve mâ halfehüm. Ve lâ yühîtûne bi-şey’in min ilmihî illâ bimâ şâ’. Vesia kürsiyyühü’s-semâvâti ve’l-ard. Ve lâ yeûdühû hıfzuhümâ. Ve hüve’l-aliyyü’l-azîm.$q$, $q$Allah’tan başka ilah yoktur; O diridir, her şeyi ayakta tutandır. Onu ne uyuklama ne de uyku tutar. Göklerde ve yerde ne varsa O’nundur. İzni olmadan O’nun katında kim şefaat edebilir? O, kulların önündekini ve arkasındakini bilir; onlar ise O’nun bilgisinden, dilediği kadarı dışında hiçbir şeyi kavrayamazlar. Kürsüsü gökleri ve yeri kaplamıştır; onları korumak O’na ağır gelmez. O yücedir, büyüktür.$q$, 1, 10),
  ($q$nazar$q$, $q$Felak Sûresi$q$, $q$Hasetçinin ve nazarın şerrinden sığınma$q$, $q$قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ$q$, $q$Kul eûzü bi-rabbi’l-felak. Min şerri mâ halak. Ve min şerri ğâsikın izâ vekab. Ve min şerri’n-neffâsâti fi’l-ukad. Ve min şerri hâsidin izâ hased.$q$, $q$De ki: Sabahın Rabbine sığınırım; yarattığı şeylerin şerrinden, karanlığı çöktüğünde gecenin şerrinden, düğümlere üfleyenlerin şerrinden ve haset ettiğinde hasetçinin şerrinden.$q$, 3, 20),
  ($q$nazar$q$, $q$Nâs Sûresi$q$, $q$Vesveseden ve kötülükten sığınma$q$, $q$قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ$q$, $q$Kul eûzü bi-rabbi’n-nâs. Meliki’n-nâs. İlâhi’n-nâs. Min şerri’l-vesvâsi’l-hannâs. Ellezî yüvesvisü fî sudûri’n-nâs. Mine’l-cinneti ve’n-nâs.$q$, $q$De ki: İnsanların Rabbine, insanların Melikine, insanların İlahına sığınırım; sinsi vesvesecinin şerrinden, o ki insanların göğüslerine vesvese verir; cinlerden de insanlardan da.$q$, 3, 30),
  ($q$nazar$q$, $q$İhlâs Sûresi$q$, $q$Felak ve Nâs ile birlikte okunur$q$, $q$قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ$q$, $q$Kul hüvallâhü ehad. Allâhü’s-samed. Lem yelid ve lem yûled. Ve lem yekün lehû küfüven ehad.$q$, $q$De ki: O Allah birdir. Allah her şeyden müstağnidir, her şey O’na muhtaçtır. Doğurmamış ve doğurulmamıştır. Hiçbir şey O’nun dengi değildir.$q$, 3, 40),
  ($q$nazar$q$, $q$Ve in yekâd$q$, $q$Kalem 51–52 · Nazar duası olarak bilinir$q$, $q$وَإِنْ يَكَادُ الَّذِينَ كَفَرُوا لَيُزْلِقُونَكَ بِأَبْصَارِهِمْ لَمَّا سَمِعُوا الذِّكْرَ وَيَقُولُونَ إِنَّهُ لَمَجْنُونٌ ۝ وَمَا هُوَ إِلَّا ذِكْرٌ لِلْعَالَمِينَ$q$, $q$Ve in yekâdüllezîne keferû le-yüzlikûneke bi-ebsârihim lemmâ semiu’z-zikra ve yekûlûne innehû le-mecnûn. Ve mâ hüve illâ zikrun li’l-âlemîn.$q$, $q$İnkâr edenler Zikr’i (Kur’an’ı) duydukları zaman neredeyse seni gözleriyle devirecekler ve “O bir delidir” diyorlar. Oysa o, âlemler için ancak bir öğüttür.$q$, 1, 50),
  ($q$nazar$q$, $q$Eûzü bi-kelimâtillâh$q$, $q$Akşam üç kere okunması tavsiye edilir$q$, $q$أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ$q$, $q$Eûzü bi-kelimâtillâhi’t-tâmmâti min şerri mâ halak.$q$, $q$Yarattığı şeylerin şerrinden Allah’ın eksiksiz kelimelerine sığınırım.$q$, 3, 60),
  ($q$nazar$q$, $q$Mâşâallah$q$, $q$Kehf 39 · Güzel bir şey görünce söylenir$q$, $q$مَا شَاءَ اللَّهُ لَا قُوَّةَ إِلَّا بِاللَّهِ$q$, $q$Mâşâallah, lâ kuvvete illâ billâh.$q$, $q$Allah ne dilerse o olur; güç ve kuvvet ancak Allah’ındır.$q$, 33, 70),
  ($q$biz$q$, $q$Gözümüzün nuru$q$, $q$Furkân 74 · Eşler için okunan dua$q$, $q$رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا$q$, $q$Rabbenâ heb lenâ min ezvâcinâ ve zürriyyâtinâ kurrate a‘yünin vec‘alnâ li’l-müttekîne imâmâ.$q$, $q$Rabbimiz! Eşlerimizi ve çocuklarımızı bize göz aydınlığı kıl ve bizi takva sahiplerine önder eyle.$q$, 1, 80),
  ($q$biz$q$, $q$Rabbenâ âtinâ$q$, $q$Bakara 201 · Dünya ve âhiret iyiliği$q$, $q$رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ$q$, $q$Rabbenâ âtinâ fi’d-dünyâ haseneten ve fi’l-âhirati haseneten ve kınâ azâbe’n-nâr.$q$, $q$Rabbimiz! Bize dünyada da iyilik ver, âhirette de iyilik ver ve bizi ateş azabından koru.$q$, 1, 90),
  ($q$biz$q$, $q$İkimiz için$q$, $q$Kendi sözlerimizle$q$, null, null, $q$Allah’ım, bizi birbirimize hayırlı eyle. Kalplerimizi birbirine ısındır, aramıza hiçbir kötü göz ve kötü söz girmesin. Birbirimizin huzuru, sığınağı ve dua arkadaşı olalım. Yolumuzu hep aynı yöne çevir, bizi dünyada da âhirette de bir eyle. Âmin.$q$, 1, 100),
  ($q$saglik$q$, $q$Allâhümme âfinî$q$, $q$Sabah ve akşam üçer kere$q$, $q$اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي$q$, $q$Allâhümme âfinî fî bedenî. Allâhümme âfinî fî sem‘î. Allâhümme âfinî fî basarî.$q$, $q$Allah’ım, bedenime afiyet ver. Allah’ım, kulağıma afiyet ver. Allah’ım, gözüme afiyet ver.$q$, 3, 110),
  ($q$saglik$q$, $q$Şifa ayeti$q$, $q$Şuarâ 80$q$, $q$وَإِذَا مَرِضْتُ فَهُوَ يَشْفِينِ$q$, $q$Ve izâ meridtü fe-hüve yeşfîn.$q$, $q$Hastalandığımda bana şifa veren O’dur.$q$, 7, 120),
  ($q$yol$q$, $q$Evden çıkarken$q$, $q$Yola çıkan için$q$, $q$بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ$q$, $q$Bismillâhi tevekkeltü alallâh, ve lâ havle ve lâ kuvvete illâ billâh.$q$, $q$Allah’ın adıyla; Allah’a tevekkül ettim. Güç ve kuvvet ancak Allah’ındır.$q$, 1, 130),
  ($q$yol$q$, $q$Yolculuk duası$q$, $q$Zuhruf 13–14 · Araca binerken$q$, $q$سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَٰذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ ۝ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنْقَلِبُونَ$q$, $q$Sübhânellezî sahhara lenâ hâzâ ve mâ künnâ lehû mukrinîn. Ve innâ ilâ rabbinâ le-munkalibûn.$q$, $q$Bunu bizim hizmetimize vereni tenzih ederiz; yoksa biz buna güç yetiremezdik. Şüphesiz biz Rabbimize döneceğiz.$q$, 1, 140)
) as v(cat, title, note, ar, tr, body, target, sort)
where not exists (select 1 from public.prayers where author is null);

-- =====================================================================
--  SON ADIM (kullanıcıları Authentication > Users'dan oluşturduktan sonra)
--  E-postaları kendinizinkiyle değiştirip SADECE bu iki satırı çalıştırın:
-- =====================================================================
-- insert into public.profiles (id, name, is_admin) select id, 'Emre',  true  from auth.users where email = 'EMRE_EPOSTA';
-- insert into public.profiles (id, name, is_admin) select id, 'Rabia', false from auth.users where email = 'RABIA_EPOSTA';

-- =====================================================================
--  E ❤ R · Mühürlü mektup açılınca bildirim
--  Supabase > SQL Editor > New query > yapıştır > Run   (tekrar çalıştırmak güvenli)
-- =====================================================================
create extension if not exists pg_cron;

alter table public.letters add column if not exists unlock_notified boolean not null default false;

-- Zaten açılmış eski mektuplar için bildirim gönderme
update public.letters set unlock_notified = true
where open_at is not null and open_at <= now() - interval '10 minutes' and not unlock_notified;

-- Yazan kişi açılma zamanını değiştirirse bildirim yeniden kurulsun
create or replace function public.letters_reset_unlock()
returns trigger language plpgsql as $$
begin
  if new.open_at is distinct from old.open_at then
    new.unlock_notified := false;
  end if;
  return new;
end;
$$;
drop trigger if exists letters_reset_unlock on public.letters;
create trigger letters_reset_unlock before update on public.letters
  for each row execute function public.letters_reset_unlock();

-- Açılma zamanı gelen mektupları bul, alıcıya bildirim gönder
create or replace function public.notify_unlocked_letters()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u text; s text; l record;
begin
  select function_url, webhook_secret into u, s from public.push_config where id = 1;
  for l in
    select * from public.letters
    where open_at is not null and open_at <= now() and not unlock_notified
  loop
    update public.letters set unlock_notified = true where id = l.id;
    -- bir günden eski kaçırılmış açılışlar için geç bildirim gönderme
    if u is not null and l.open_at > now() - interval '1 day' then
      perform net.http_post(
        url := u,
        body := jsonb_build_object('table', 'letters_open',
                  'record', jsonb_build_object('id', l.id, 'author', l.author, 'recipient', l.recipient, 'title', l.title, 'open_at', l.open_at)),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', s),
        timeout_milliseconds := 5000);
    end if;
  end loop;
end;
$$;
-- Bu fonksiyonu sadece zamanlayıcı çalıştırır, uygulamadan çağrılamaz
revoke execute on function public.notify_unlocked_letters() from public, anon, authenticated;

-- Dakikada bir kontrol et
do $$
begin
  perform cron.unschedule('ekalpr-mektup-acilis')
  where exists (select 1 from cron.job where jobname = 'ekalpr-mektup-acilis');
end $$;
select cron.schedule('ekalpr-mektup-acilis', '* * * * *', $$select public.notify_unlocked_letters()$$);

-- Kontrol: görev kuruldu mu?
select jobname, schedule, active from cron.job where jobname = 'ekalpr-mektup-acilis';

-- =====================================================================
--  E ❤ R · Faz 1: Günün sorusu · Kötü gün modu · Hesaba bağlı tercihler
--  Supabase > SQL Editor > New query > yapıştır > Run   (tekrar çalıştırmak güvenli)
-- =====================================================================

-- ---------- Hesaba bağlı tercihler (tema, görünüm, hareket) ----------
alter table public.profiles add column if not exists prefs jsonb not null default '{}';

create or replace function public.set_my_prefs(prefs jsonb)
returns void language sql security definer set search_path = public as $$
  update public.profiles set prefs = coalesce(prefs, '{}'::jsonb) where id = auth.uid();
$$;
grant execute on function public.set_my_prefs(jsonb) to authenticated;

-- ---------- Günün sorusu ----------
-- Herkes kendi cevabını görür; karşı tarafın cevabı ANCAK kendisi de cevaplayınca açılır.
create table if not exists public.daily_answers (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day        date not null,
  qidx       int  not null,
  answer     text not null,
  created_at timestamptz not null default now(),
  unique (author, day)
);
alter table public.daily_answers enable row level security;
drop policy if exists "daily_own_read"   on public.daily_answers;
drop policy if exists "daily_own_insert" on public.daily_answers;
drop policy if exists "daily_own_update" on public.daily_answers;
drop policy if exists "daily_own_delete" on public.daily_answers;
create policy "daily_own_read"   on public.daily_answers for select to authenticated using (author = auth.uid());
create policy "daily_own_insert" on public.daily_answers for insert to authenticated with check (public.is_member() and author = auth.uid());
create policy "daily_own_update" on public.daily_answers for update to authenticated using (author = auth.uid()) with check (author = auth.uid());
create policy "daily_own_delete" on public.daily_answers for delete to authenticated using (author = auth.uid());
grant select, insert, update, delete on public.daily_answers to authenticated;

-- Bugünün durumu: benim cevabım, karşı taraf cevapladı mı, cevabı (sadece ben de cevapladıysam)
create or replace function public.daily_for_me(d date)
returns table (mine text, theirs text, they_answered boolean)
language sql stable security definer set search_path = public as $$
  select m.answer,
         case when m.id is not null then t.answer end,
         t.id is not null
  from (select 1) x
  left join public.daily_answers m on m.author = auth.uid() and m.day = d
  left join public.daily_answers t on t.author <> auth.uid() and t.day = d
  where public.is_member();
$$;

-- Arşiv: sadece ikimizin de cevapladığı günler
create or replace function public.daily_history()
returns table (day date, qidx int, mine text, theirs text)
language sql stable security definer set search_path = public as $$
  select m.day, m.qidx, m.answer, t.answer
  from public.daily_answers m
  join public.daily_answers t on t.day = m.day and t.author <> m.author
  where m.author = auth.uid() and public.is_member()
  order by m.day desc;
$$;
grant execute on function public.daily_for_me(date) to authenticated;
grant execute on function public.daily_history()    to authenticated;

-- ---------- Kötü gün modu: önceden hazırlanan destek kartları ----------
create table if not exists public.comfort_items (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mood       text not null default 'hepsi',
  kind       text not null check (kind in ('note','photo','audio','memory','letter','call')),
  body       text,
  media      text,
  audio_secs int,
  ref_id     uuid,
  created_at timestamptz not null default now()
);
-- "Haber ver" isteği (isteğe bağlı, ruh hali sadece kullanıcı seçerse paylaşılır)
create table if not exists public.support_pings (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  mood       text,
  created_at timestamptz not null default now()
);
do $$
declare t text;
begin
  foreach t in array array['comfort_items','support_pings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_read"   on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_read"   on public.%1$I for select to authenticated using (public.is_member())', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.is_member() and author = auth.uid())', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (author = auth.uid() or public.is_admin()) with check (public.is_member())', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (author = auth.uid() or public.is_admin())', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------- Bildirim tetikleyicileri ----------
do $$
declare t text;
begin
  foreach t in array array['daily_answers','support_pings'] loop
    execute format('drop trigger if exists push_after_insert on public.%I', t);
    execute format('create trigger push_after_insert after insert on public.%I for each row execute function public.push_notify()', t);
  end loop;
end $$;
grant select on public.daily_answers to service_role;
