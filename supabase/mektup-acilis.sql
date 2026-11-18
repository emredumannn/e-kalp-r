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
