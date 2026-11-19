-- =====================================================================
--  E ❤ R · Faz 2: Yıldız haritası · Ortak çizim · Film & kitap şampiyonası
--  (Canlı bahçe ve Yaşayan Dünya mevcut verileri kullanır, yeni tablo gerektirmez.)
--  Supabase > SQL Editor > New query > yapıştır > Run   (tekrar çalıştırmak güvenli)
-- =====================================================================

-- ---------- Yıldız haritaları ----------
create table if not exists public.star_maps (
  id             uuid primary key default gen_random_uuid(),
  author         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title          text not null,
  event_at       timestamptz not null,
  tz             text not null default 'Europe/Istanbul',
  lat            double precision not null,
  lng            double precision not null,
  location_label text,
  note           text,
  image_path     text,
  map_type       text not null default 'accurate' check (map_type in ('accurate','illustrative')),
  created_at     timestamptz not null default now()
);

-- ---------- Ortak çizim defteri ----------
create table if not exists public.drawings (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title      text not null default 'Çizimimiz',
  strokes    jsonb not null default '[]',
  image_path text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- Film / dizi / kitap kütüphanesi ----------
create table if not exists public.shared_media (
  id          uuid primary key default gen_random_uuid(),
  author      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('film','dizi','kitap')),
  title       text not null,
  status      text not null default 'plan' check (status in ('plan','devam','bitti')),
  finished_on date,
  note        text,
  created_at  timestamptz not null default now()
);

-- Ortak kalıp: ikimiz okuruz/ekleriz; yazan ya da admin düzenler/siler
do $$
declare t text;
begin
  foreach t in array array['star_maps','drawings','shared_media'] loop
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
-- Çizime ikimiz de devam edebilelim; kütüphanede durumu ikimiz de güncelleyebilelim
drop policy if exists "drawings_update" on public.drawings;
create policy "drawings_update" on public.drawings for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "shared_media_update" on public.shared_media;
create policy "shared_media_update" on public.shared_media for update to authenticated using (public.is_member()) with check (public.is_member());

-- ---------- Şampiyona testleri ----------
-- Sorular ve cevap anahtarı SADECE testi yazana görünür. Çözen, soruları cevapsız alır;
-- puan sunucuda hesaplanır. Her test bir kez çözülür; çözülen test değiştirilemez/silinemez.
create table if not exists public.media_quizzes (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  media_id   uuid references public.shared_media(id) on delete set null,
  title      text not null,
  questions  jsonb not null,           -- [{ "q": "...", "o": ["a","b","c"] }]
  answers    int[] not null,           -- her sorunun doğru şıkkı (0'dan)
  created_at timestamptz not null default now()
);
create table if not exists public.media_quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  quiz_id    uuid not null references public.media_quizzes(id) on delete cascade,
  author     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  picks      int[] not null,
  score      int not null,
  total      int not null,
  created_at timestamptz not null default now(),
  unique (quiz_id, author)
);
alter table public.media_quizzes enable row level security;
alter table public.media_quiz_attempts enable row level security;
drop policy if exists "mq_read"   on public.media_quizzes;
drop policy if exists "mq_insert" on public.media_quizzes;
drop policy if exists "mq_delete" on public.media_quizzes;
create policy "mq_read"   on public.media_quizzes for select to authenticated using (author = auth.uid());
create policy "mq_insert" on public.media_quizzes for insert to authenticated with check (public.is_member() and author = auth.uid());
create policy "mq_delete" on public.media_quizzes for delete to authenticated
  using (author = auth.uid() and not exists (select 1 from public.media_quiz_attempts a where a.quiz_id = media_quizzes.id));
grant select, insert, delete on public.media_quizzes to authenticated;
drop policy if exists "mqa_read" on public.media_quiz_attempts;
create policy "mqa_read" on public.media_quiz_attempts for select to authenticated using (public.is_member());
grant select on public.media_quiz_attempts to authenticated;

-- Bana yazılmış testler (cevap anahtarı ancak çözdükten sonra gelir)
create or replace function public.media_quizzes_for_me()
returns table (id uuid, author uuid, media_id uuid, title text, questions jsonb, created_at timestamptz,
               attempted boolean, score int, total int, picks int[], answers int[])
language sql stable security definer set search_path = public as $$
  select q.id, q.author, q.media_id, q.title, q.questions, q.created_at,
         a.id is not null, a.score, a.total, a.picks,
         case when a.id is not null then q.answers end
  from public.media_quizzes q
  left join public.media_quiz_attempts a on a.quiz_id = q.id and a.author = auth.uid()
  where q.author <> auth.uid() and public.is_member()
  order by q.created_at desc;
$$;

-- Testi çöz: puanı sunucu hesaplar, tek deneme
create or replace function public.media_quiz_submit(qid uuid, picks int[])
returns json language plpgsql security definer set search_path = public as $$
declare q public.media_quizzes; s int := 0; i int; a public.media_quiz_attempts;
begin
  if not public.is_member() then raise exception 'Yetki yok'; end if;
  select * into q from public.media_quizzes where id = qid;
  if q.id is null then raise exception 'Test bulunamadı'; end if;
  if q.author = auth.uid() then raise exception 'Kendi testini çözemezsin'; end if;
  select * into a from public.media_quiz_attempts where quiz_id = qid and author = auth.uid();
  if a.id is not null then raise exception 'Bu testi zaten çözdün'; end if;
  for i in 1 .. coalesce(array_length(q.answers, 1), 0) loop
    if picks[i] is not null and picks[i] = q.answers[i] then s := s + 1; end if;
  end loop;
  insert into public.media_quiz_attempts (quiz_id, author, picks, score, total)
  values (qid, auth.uid(), picks, s, coalesce(array_length(q.answers, 1), 0));
  return json_build_object('score', s, 'total', coalesce(array_length(q.answers, 1), 0), 'answers', q.answers);
end;
$$;
grant execute on function public.media_quizzes_for_me()           to authenticated;
grant execute on function public.media_quiz_submit(uuid, int[])    to authenticated;

-- ---------- Canlı çizim kanalları: sadece ikimiz dinleyip yazabilelim ----------
do $$
begin
  execute 'drop policy if exists "ekalpr_rt_read" on realtime.messages';
  execute 'drop policy if exists "ekalpr_rt_write" on realtime.messages';
  execute 'create policy "ekalpr_rt_read"  on realtime.messages for select to authenticated using (public.is_member())';
  execute 'create policy "ekalpr_rt_write" on realtime.messages for insert to authenticated with check (public.is_member())';
exception when others then
  raise notice 'Realtime özel kanal politikası atlandı: %', sqlerrm;
end $$;

-- ---------- Bildirimler ----------
do $$
declare t text;
begin
  foreach t in array array['star_maps','drawings','shared_media','media_quizzes','media_quiz_attempts'] loop
    execute format('drop trigger if exists push_after_insert on public.%I', t);
    execute format('create trigger push_after_insert after insert on public.%I for each row execute function public.push_notify()', t);
  end loop;
end $$;
grant select on public.media_quizzes to service_role;
