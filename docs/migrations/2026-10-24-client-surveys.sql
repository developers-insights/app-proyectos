-- Encuesta a clientes (pedido de Fede, call 23/10). Aditiva: tabla nueva + 3 funciones.
--
-- La base es compartida con otras apps (MyJobs, Speed Funnels backup…) y auth.users
-- tiene gente que no es del equipo: por eso las políticas NO son `to authenticated
-- using (true)` como en las tablas viejas, sino `survey_is_team()` (mail del JWT contra
-- team_members aprobados, sin colaboradores externos).
-- El cliente no tiene cuenta: entra con un token de 24 caracteres y sólo toca su fila a
-- través de las dos RPC SECURITY DEFINER, que no exponen nada más que el nombre del
-- proyecto y el nombre de pila del contacto.

create table if not exists public.client_surveys (
  id           uuid primary key default gen_random_uuid(),
  project_id   text not null unique,
  token        text not null unique
               default translate(encode(gen_random_bytes(18), 'base64'), '+/', '-_'),
  lang         text not null default 'es' check (lang in ('es', 'en')),
  answers      jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  answered     int not null default 0,
  opened_at    timestamptz,
  completed_at timestamptz,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.client_surveys enable row level security;

create or replace function public.survey_is_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_members t
    where t.deleted_at is null
      and lower(t.data->>'email') = lower(coalesce(auth.jwt()->>'email', ''))
      and coalesce(t.data->>'status', 'approved') = 'approved'
      and coalesce(t.data->>'access', 'full') <> 'collab'
  )
$$;

revoke all on function public.survey_is_team() from public, anon;
grant execute on function public.survey_is_team() to authenticated;

drop policy if exists client_surveys_team_read on public.client_surveys;
drop policy if exists client_surveys_team_insert on public.client_surveys;
drop policy if exists client_surveys_team_update on public.client_surveys;
drop policy if exists client_surveys_team_delete on public.client_surveys;
create policy client_surveys_team_read   on public.client_surveys for select to authenticated using (public.survey_is_team());
create policy client_surveys_team_insert on public.client_surveys for insert to authenticated with check (public.survey_is_team());
create policy client_surveys_team_update on public.client_surveys for update to authenticated using (public.survey_is_team()) with check (public.survey_is_team());
create policy client_surveys_team_delete on public.client_surveys for delete to authenticated using (public.survey_is_team());

revoke all on public.client_surveys from anon;

-- Lo que ve el cliente al abrir el link. Sella opened_at la primera vez.
create or replace function public.survey_public_get(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.client_surveys;
  v_project text;
  v_contact text;
begin
  if p_token is null or length(p_token) <> 24 then
    return jsonb_build_object('ok', false);
  end if;
  select * into s from public.client_surveys where token = p_token;
  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if s.opened_at is null then
    update public.client_surveys set opened_at = now() where id = s.id;
  end if;

  select p.data->>'name', split_part(trim(coalesce(c.data->>'name', '')), ' ', 1)
    into v_project, v_contact
  from public.projects p
  left join public.clients c on c.id = p.data->>'clientId' and c.deleted_at is null
  where p.id = s.project_id;

  return jsonb_build_object(
    'ok', true,
    'lang', s.lang,
    'project', coalesce(v_project, ''),
    'contact', coalesce(v_contact, ''),
    'answers', case when s.completed_at is null then s.answers else '{}'::jsonb end,
    'completed', s.completed_at is not null
  );
end
$$;

-- Guardado parcial y envío final. Una vez completa, la fila queda cerrada: el cliente no
-- puede pisar lo que ya mandó (el equipo sí, por RLS, si hiciera falta reabrirla).
create or replace function public.survey_public_save(p_token text, p_answers jsonb, p_lang text, p_complete boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.client_surveys;
  v_clean jsonb;
  v_count int;
begin
  if p_token is null or length(p_token) <> 24 then
    return jsonb_build_object('ok', false, 'error', 'token');
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 24000 then
    return jsonb_build_object('ok', false, 'error', 'payload');
  end if;

  select * into s from public.client_surveys where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'token');
  end if;
  if s.completed_at is not null then
    return jsonb_build_object('ok', true, 'completed', true);
  end if;

  -- Sólo claves con forma de id de pregunta y valores escalares o listas cortas.
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb), count(*)
    into v_clean, v_count
  from jsonb_each(p_answers)
  where key ~ '^[a-z][a-z0-9_]{0,39}$'
    and jsonb_typeof(value) in ('string', 'number', 'array')
    and case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) <= 12 else true end
    and length(value::text) <= 4000;

  update public.client_surveys
     set answers = v_clean,
         answered = v_count,
         lang = case when p_lang in ('es', 'en') then p_lang else lang end,
         completed_at = case when p_complete then now() else null end,
         opened_at = coalesce(opened_at, now()),
         updated_at = now()
   where id = s.id;

  return jsonb_build_object('ok', true, 'completed', coalesce(p_complete, false));
end
$$;

revoke all on function public.survey_public_get(text) from public;
revoke all on function public.survey_public_save(text, jsonb, text, boolean) from public;
grant execute on function public.survey_public_get(text) to anon, authenticated;
grant execute on function public.survey_public_save(text, jsonb, text, boolean) to anon, authenticated;
