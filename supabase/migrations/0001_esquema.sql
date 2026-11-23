-- Compendio de Legislación Informática: esquema, RLS y funciones.
-- Los datos personales (lista, correos, códigos) se cargan aparte; aquí solo hay estructura.

create schema if not exists app;

-- ───────────────────────── Tablas ─────────────────────────

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  subject text not null default 'Legislación Informática',
  tagline text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations on delete cascade,
  full_name text not null,
  sort_name text,
  role text not null default 'student' check (role in ('student', 'teacher')),
  is_admin boolean not null default false,
  user_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (generation_id, user_id)
);
create index people_user_idx on public.people (user_id);

-- Lo que solo ven los admins (y cada quien lo suyo).
create table public.people_private (
  person_id uuid primary key references public.people on delete cascade,
  matricula text unique,
  email text
);

create table public.admin_emails (
  email text primary key,
  role text not null default 'student' check (role in ('student', 'teacher'))
);

create table public.invites (
  code text primary key,
  generation_id uuid not null references public.generations on delete cascade,
  grants text not null check (grants in ('member', 'admin')),
  active boolean not null default true
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations on delete cascade,
  position int not null default 0,
  title text not null,
  label text,
  kind text not null default 'documento' check (kind in ('documento', 'cartel', 'video', 'presentacion')),
  description text,
  created_at timestamptz not null default now()
);
create index activities_gen_idx on public.activities (generation_id);

-- Un trabajo = lo que un equipo hizo en una actividad.
create table public.works (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities on delete cascade,
  title text not null default 'Sin título',
  summary text,
  leader_id uuid references public.people on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index works_activity_idx on public.works (activity_id);
create index works_leader_idx on public.works (leader_id);

-- Una persona pertenece a un solo trabajo por actividad.
create table public.work_members (
  activity_id uuid not null references public.activities on delete cascade,
  person_id uuid not null references public.people on delete cascade,
  work_id uuid not null references public.works on delete cascade,
  contribution text,
  source text not null default 'upload',
  created_at timestamptz not null default now(),
  primary key (activity_id, person_id)
);
create index work_members_work_idx on public.work_members (work_id);
create index work_members_person_idx on public.work_members (person_id);

-- Las piezas de un trabajo: archivos, videos de YouTube o enlaces.
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  kind text not null check (kind in ('file', 'youtube', 'link')),
  sha256 text,
  storage_path text,
  thumb_path text,
  filename text,
  mime text,
  size bigint,
  pages int,
  text_sig int[],
  phash text,
  yt_id text,
  url text,
  label text,
  position int not null default 0,
  origin text not null default 'upload',
  uploaded_by uuid references public.people on delete set null,
  created_at timestamptz not null default now()
);
create index assets_work_idx on public.assets (work_id);
create index assets_activity_sha_idx on public.assets (activity_id, sha256);
create index assets_uploaded_by_idx on public.assets (uploaded_by);

-- ───────────────────────── Ayudantes (esquema app, no expuesto por la API) ─────────────────────────

create function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.people where user_id = (select auth.uid()) and is_admin)
$$;

create function app.me(p_gen uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.people where user_id = (select auth.uid()) and generation_id = p_gen limit 1
$$;

create function app.in_gen(p_gen uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.people
    where user_id = (select auth.uid()) and (generation_id = p_gen or is_admin)
  )
$$;

create function app.in_gen_text(p_gen text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.people
    where user_id = (select auth.uid()) and (generation_id::text = p_gen or is_admin)
  )
$$;

create function app.can_see_activity(p_activity uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.in_gen((select generation_id from public.activities where id = p_activity))
$$;

create function app.is_member(p_work uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_members m join public.people p on p.id = m.person_id
    where m.work_id = p_work and p.user_id = (select auth.uid())
  )
$$;

create function app.can_edit_work(p_work uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin() or exists (
    select 1 from public.works w join public.people p on p.id = w.leader_id
    where w.id = p_work and p.user_id = (select auth.uid())
  )
$$;

-- Parecido entre dos firmas MinHash (fracción de posiciones iguales).
create function app.sig_sim(a int[], b int[]) returns real
language sql immutable set search_path = '' as $$
  select case
    when a is null or b is null or cardinality(a) = 0 or cardinality(a) <> cardinality(b) then 0
    else (select (count(*) filter (where a[i] = b[i]))::real / cardinality(a) from generate_subscripts(a, 1) i)
  end
$$;

-- Distancia de Hamming entre dos hashes perceptuales de 64 bits (hex).
create function app.phash_dist(a text, b text) returns int
language sql immutable set search_path = '' as $$
  select case
    when a is null or b is null or a !~ '^[0-9a-f]{16}$' or b !~ '^[0-9a-f]{16}$' then 64
    else bit_count(('x' || a)::bit(64) # ('x' || b)::bit(64))::int
  end
$$;

create function app.insert_asset(p_work uuid, p_piece jsonb, p_by uuid, p_origin text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_activity uuid;
  v_gen uuid;
  v_path text := nullif(p_piece->>'storage_path', '');
  v_thumb text := nullif(p_piece->>'thumb_path', '');
begin
  select w.activity_id, a.generation_id into v_activity, v_gen
  from public.works w join public.activities a on a.id = w.activity_id where w.id = p_work;
  if v_activity is null then raise exception 'El trabajo no existe'; end if;
  if (v_path is not null and v_path not like v_gen::text || '/%')
     or (v_thumb is not null and v_thumb not like v_gen::text || '/%') then
    raise exception 'Ruta de archivo fuera de la generación';
  end if;
  insert into public.assets (work_id, activity_id, kind, sha256, storage_path, thumb_path, filename, mime, size, pages,
                             text_sig, phash, yt_id, url, label, position, origin, uploaded_by)
  values (
    p_work, v_activity, p_piece->>'kind', nullif(p_piece->>'sha256', ''), v_path, v_thumb,
    nullif(p_piece->>'filename', ''), nullif(p_piece->>'mime', ''), (p_piece->>'size')::bigint, (p_piece->>'pages')::int,
    (select array_agg(x.v::int order by x.ord) from jsonb_array_elements_text(
       case when jsonb_typeof(p_piece->'text_sig') = 'array' then p_piece->'text_sig' else '[]'::jsonb end
     ) with ordinality x(v, ord)),
    nullif(p_piece->>'phash', ''), nullif(p_piece->>'yt_id', ''), nullif(p_piece->>'url', ''), nullif(p_piece->>'label', ''),
    coalesce((select max(position) + 1 from public.assets where work_id = p_work), 0), p_origin, p_by
  ) returning id into v_id;
  return v_id;
end $$;

-- Un trabajo que se quedó sin integrantes se borra, salvo que traiga piezas importadas.
create function app.cleanup_work(p_work uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_work is null then return; end if;
  if not exists (select 1 from public.work_members where work_id = p_work)
     and not exists (select 1 from public.assets where work_id = p_work and origin = 'moodle') then
    delete from public.works where id = p_work;
  end if;
end $$;

-- ───────────────────────── Disparadores ─────────────────────────

create function app.tg_member_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_gen uuid;
begin
  select w.activity_id, a.generation_id into new.activity_id, v_gen
  from public.works w join public.activities a on a.id = w.activity_id where w.id = new.work_id;
  if not exists (select 1 from public.people where id = new.person_id and generation_id = v_gen) then
    raise exception 'La persona no pertenece a esta generación';
  end if;
  return new;
end $$;
create trigger member_fill before insert or update of work_id, person_id on public.work_members
for each row execute function app.tg_member_fill();

-- Si quien sale era líder, el liderazgo pasa al integrante más antiguo.
create function app.tg_member_left() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.work_id = old.work_id then return null; end if;
  update public.works w set leader_id = (
    select m.person_id from public.work_members m join public.people p on p.id = m.person_id
    where m.work_id = w.id order by (p.user_id is null), m.created_at limit 1
  ) where w.id = old.work_id and w.leader_id = old.person_id;
  return null;
end $$;
create trigger member_left after delete or update of work_id on public.work_members
for each row execute function app.tg_member_left();

-- Quien entra primero a un equipo sin líder queda como líder.
create function app.tg_person_claimed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and old.user_id is null then
    update public.works w set leader_id = new.id
    where w.leader_id is null
      and exists (select 1 from public.work_members m where m.work_id = w.id and m.person_id = new.id);
  end if;
  return null;
end $$;
create trigger person_claimed after update of user_id on public.people
for each row execute function app.tg_person_claimed();

create function app.tg_asset_fill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select activity_id into new.activity_id from public.works where id = new.work_id;
  return new;
end $$;
create trigger asset_fill before insert or update of work_id on public.assets
for each row execute function app.tg_asset_fill();

-- ───────────────────────── Funciones para la app ─────────────────────────

-- ¿Este archivo/enlace ya existe (o se parece a algo) en la actividad?
create function public.find_matches(p_activity uuid, p_sha text, p_yt text, p_sig int[], p_phash text)
returns table (work_id uuid, reason text, score real)
language sql stable security definer set search_path = '' as $$
  select distinct on (c.work_id) c.work_id, c.reason, c.score
  from (
    select a.work_id,
      case when a.sha256 = p_sha then 'hash'
           when a.yt_id = p_yt then 'youtube'
           when app.sig_sim(a.text_sig, p_sig) >= 0.5 then 'texto'
           else 'imagen' end as reason,
      case when a.sha256 = p_sha or a.yt_id = p_yt then 1
           when app.sig_sim(a.text_sig, p_sig) >= 0.5 then app.sig_sim(a.text_sig, p_sig)
           else 1 - app.phash_dist(a.phash, p_phash) / 64.0 end::real as score
    from public.assets a
    where a.activity_id = p_activity
      and app.can_see_activity(p_activity)
      and (a.sha256 = p_sha or a.yt_id = p_yt
           or app.sig_sim(a.text_sig, p_sig) >= 0.5
           or (p_sig is null and a.text_sig is null and app.phash_dist(a.phash, p_phash) <= 6))
  ) c
  order by c.work_id, c.score desc
$$;

-- Agrega una pieza a mi trabajo de la actividad (lo crea si aún no tengo) o a un trabajo dado.
create function public.add_piece(p_activity uuid, p_piece jsonb, p_work uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_gen uuid;
  v_me uuid;
  v_work uuid := p_work;
begin
  select generation_id into v_gen from public.activities where id = p_activity;
  v_me := app.me(v_gen);
  if v_work is not null then
    if not exists (select 1 from public.works where id = v_work and activity_id = p_activity) then
      raise exception 'El trabajo no pertenece a esta actividad';
    end if;
    if not (app.can_edit_work(v_work) or app.is_member(v_work)) then
      raise exception 'No puedes agregar piezas a este trabajo';
    end if;
  else
    if v_me is null then raise exception 'No perteneces a esta generación'; end if;
    select work_id into v_work from public.work_members where activity_id = p_activity and person_id = v_me;
    if v_work is null then
      insert into public.works (activity_id, title, leader_id)
      values (p_activity, coalesce(nullif(p_piece->>'title', ''), 'Sin título'), v_me) returning id into v_work;
      insert into public.work_members (activity_id, person_id, work_id, source) values (p_activity, v_me, v_work, 'upload');
    end if;
  end if;
  perform app.insert_asset(v_work, p_piece, v_me, 'upload');
  return v_work;
end $$;

-- «Este es el mío»: me uno a un trabajo (y dejo el que tenía en esa actividad).
create function public.join_work(p_work uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_activity uuid;
  v_gen uuid;
  v_me uuid;
  v_old uuid;
begin
  select w.activity_id, a.generation_id into v_activity, v_gen
  from public.works w join public.activities a on a.id = w.activity_id where w.id = p_work;
  v_me := app.me(v_gen);
  if v_me is null then raise exception 'No perteneces a esta generación'; end if;
  select work_id into v_old from public.work_members where activity_id = v_activity and person_id = v_me;
  if v_old = p_work then return; end if;
  insert into public.work_members (activity_id, person_id, work_id, source) values (v_activity, v_me, p_work, 'claim')
  on conflict (activity_id, person_id) do update set work_id = excluded.work_id, source = 'claim', contribution = null;
  update public.works set leader_id = v_me where id = p_work and leader_id is null;
  perform app.cleanup_work(v_old);
end $$;

create function public.leave_work(p_work uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_person uuid;
begin
  select m.person_id into v_person from public.work_members m join public.people p on p.id = m.person_id
  where m.work_id = p_work and p.user_id = (select auth.uid());
  if v_person is null then return; end if;
  delete from public.work_members where work_id = p_work and person_id = v_person;
  perform app.cleanup_work(p_work);
end $$;

-- Cambia de líder: lo hace un admin, el líder actual, o un integrante si no hay líder.
create function public.set_leader(p_work uuid, p_person uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_leader uuid;
begin
  select leader_id into v_leader from public.works where id = p_work;
  if not (app.can_edit_work(p_work) or (v_leader is null and app.is_member(p_work))) then
    raise exception 'No puedes cambiar al líder de este trabajo';
  end if;
  if p_person is not null and not exists (select 1 from public.work_members where work_id = p_work and person_id = p_person) then
    raise exception 'El líder debe ser integrante del trabajo';
  end if;
  update public.works set leader_id = p_person where id = p_work;
end $$;

create function public.set_contribution(p_work uuid, p_text text) returns void
language sql security definer set search_path = '' as $$
  update public.work_members m set contribution = nullif(trim(p_text), '')
  from public.people p
  where p.id = m.person_id and m.work_id = p_work and p.user_id = (select auth.uid())
$$;

-- Importación de Moodle (solo admins). Recibe los equipos ya agrupados por el navegador.
create function public.admin_import(p_activity uuid, p_clusters jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  x jsonb;
  v_work uuid;
  v_works int := 0;
  v_assets int := 0;
  v_members int := 0;
  v_n int;
begin
  if not app.is_admin() then raise exception 'Solo administradores'; end if;
  for c in select * from jsonb_array_elements(p_clusters) loop
    select a.work_id into v_work from public.assets a
    where a.activity_id = p_activity and (
      a.sha256 in (select y->>'sha256' from jsonb_array_elements(c->'assets') y where nullif(y->>'sha256', '') is not null)
      or a.yt_id in (select y->>'yt_id' from jsonb_array_elements(c->'assets') y where nullif(y->>'yt_id', '') is not null)
    ) limit 1;
    if v_work is null then
      insert into public.works (activity_id, title) values (p_activity, coalesce(nullif(c->>'title', ''), 'Sin título'))
      returning id into v_work;
      v_works := v_works + 1;
    end if;
    for x in select * from jsonb_array_elements(c->'assets') loop
      if not exists (
        select 1 from public.assets a where a.work_id = v_work
          and ((nullif(x->>'sha256', '') is not null and a.sha256 = x->>'sha256')
            or (nullif(x->>'yt_id', '') is not null and a.yt_id = x->>'yt_id'))
      ) then
        perform app.insert_asset(v_work, x, null, 'moodle');
        v_assets := v_assets + 1;
      end if;
    end loop;
    insert into public.work_members (activity_id, person_id, work_id, source)
    select p_activity, (m.v)::uuid, v_work, 'moodle' from jsonb_array_elements_text(c->'members') m(v)
    on conflict (activity_id, person_id) do nothing;
    get diagnostics v_n = row_count;
    v_members := v_members + v_n;
    update public.works w set leader_id = (
      select m.person_id from public.work_members m join public.people p on p.id = m.person_id
      where m.work_id = w.id and p.user_id is not null order by m.created_at limit 1
    ) where w.id = v_work and w.leader_id is null;
  end loop;
  return jsonb_build_object('works', v_works, 'assets', v_assets, 'members', v_members);
end $$;

-- ───────────────────────── Permisos ─────────────────────────

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on public.generations, public.people, public.people_private, public.admin_emails,
  public.invites, public.activities, public.work_members, public.assets to authenticated;
grant select, insert, delete on public.works to authenticated;
grant update (title, summary, position) on public.works to authenticated;

revoke all on function public.find_matches(uuid, text, text, int[], text), public.add_piece(uuid, jsonb, uuid),
  public.join_work(uuid), public.leave_work(uuid), public.set_leader(uuid, uuid), public.set_contribution(uuid, text),
  public.admin_import(uuid, jsonb) from public, anon;
grant execute on function public.find_matches(uuid, text, text, int[], text), public.add_piece(uuid, jsonb, uuid),
  public.join_work(uuid), public.leave_work(uuid), public.set_leader(uuid, uuid), public.set_contribution(uuid, text),
  public.admin_import(uuid, jsonb) to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.generations enable row level security;
alter table public.people enable row level security;
alter table public.people_private enable row level security;
alter table public.admin_emails enable row level security;
alter table public.invites enable row level security;
alter table public.activities enable row level security;
alter table public.works enable row level security;
alter table public.work_members enable row level security;
alter table public.assets enable row level security;

create policy gen_read on public.generations for select to authenticated using (app.in_gen(id));
create policy gen_admin_ins on public.generations for insert to authenticated with check (app.is_admin());
create policy gen_admin_upd on public.generations for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy gen_admin_del on public.generations for delete to authenticated using (app.is_admin());

create policy people_read on public.people for select to authenticated using (app.in_gen(generation_id));
create policy people_admin_ins on public.people for insert to authenticated with check (app.is_admin());
create policy people_admin_upd on public.people for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy people_admin_del on public.people for delete to authenticated using (app.is_admin());

create policy private_read on public.people_private for select to authenticated using (
  app.is_admin() or exists (select 1 from public.people p where p.id = person_id and p.user_id = (select auth.uid()))
);
create policy private_admin_ins on public.people_private for insert to authenticated with check (app.is_admin());
create policy private_admin_upd on public.people_private for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy private_admin_del on public.people_private for delete to authenticated using (app.is_admin());

create policy admin_emails_admin on public.admin_emails for all to authenticated using (app.is_admin()) with check (app.is_admin());
create policy invites_admin on public.invites for all to authenticated using (app.is_admin()) with check (app.is_admin());

create policy act_read on public.activities for select to authenticated using (app.in_gen(generation_id));
create policy act_admin_ins on public.activities for insert to authenticated with check (app.is_admin());
create policy act_admin_upd on public.activities for update to authenticated using (app.is_admin()) with check (app.is_admin());
create policy act_admin_del on public.activities for delete to authenticated using (app.is_admin());

create policy works_read on public.works for select to authenticated using (app.can_see_activity(activity_id));
create policy works_admin_ins on public.works for insert to authenticated with check (app.is_admin());
create policy works_edit on public.works for update to authenticated using (app.can_edit_work(id)) with check (app.can_edit_work(id));
create policy works_admin_del on public.works for delete to authenticated using (app.is_admin());

create policy members_read on public.work_members for select to authenticated using (app.can_see_activity(activity_id));
create policy members_ins on public.work_members for insert to authenticated with check (app.can_edit_work(work_id));
create policy members_upd on public.work_members for update to authenticated using (app.can_edit_work(work_id)) with check (app.can_edit_work(work_id));
create policy members_del on public.work_members for delete to authenticated using (app.can_edit_work(work_id));

create policy assets_read on public.assets for select to authenticated using (app.can_see_activity(activity_id));
create policy assets_ins on public.assets for insert to authenticated with check (app.can_edit_work(work_id));
create policy assets_upd on public.assets for update to authenticated using (app.can_edit_work(work_id)) with check (app.can_edit_work(work_id));
create policy assets_del on public.assets for delete to authenticated using (app.can_edit_work(work_id));

-- ───────────────────────── Almacenamiento ─────────────────────────
-- Bucket privado. Las rutas empiezan con el id de la generación: <generación>/<sha256>.<ext>

insert into storage.buckets (id, name, public, file_size_limit)
values ('obras', 'obras', false, 52428800)
on conflict (id) do nothing;

create policy obras_read on storage.objects for select to authenticated
  using (bucket_id = 'obras' and app.in_gen_text((storage.foldername(name))[1]));
create policy obras_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'obras' and app.in_gen_text((storage.foldername(name))[1]));
create policy obras_update on storage.objects for update to authenticated
  using (bucket_id = 'obras' and app.in_gen_text((storage.foldername(name))[1]))
  with check (bucket_id = 'obras' and app.in_gen_text((storage.foldername(name))[1]));
create policy obras_delete on storage.objects for delete to authenticated
  using (bucket_id = 'obras' and app.is_admin());
