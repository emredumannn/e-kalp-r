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
