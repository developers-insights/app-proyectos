-- ============================================================================
-- Fathom integration — corré esto en Supabase → SQL Editor → New query → Run
-- ============================================================================

-- 1) Cuentas de Fathom (varias: vendedor, asesores, socios...).
--    El api_key NUNCA se lee desde el navegador: solo la Edge Function (service role) lo usa.
create table if not exists public.fathom_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  email text,
  api_key text not null,
  created_at timestamptz not null default now(),
  last_synced timestamptz
);
alter table public.fathom_accounts enable row level security;
-- Sin policies para authenticated/anon => nadie desde el cliente puede leer/escribir los tokens.
-- La Edge Function usa el service_role key y saltea RLS.

-- 2) Calls traídas de Fathom (solo metadata; transcript y resumen quedan en Fathom, linkeados por share_url).
create table if not exists public.fathom_calls (
  id text primary key,                 -- recording_id de Fathom
  account_id uuid references public.fathom_accounts(id) on delete set null,
  title text,
  asesor text,                         -- quien HOSTEÓ la call (recorded_by.name)
  asesor_email text,
  type text,                           -- onboarding | soporte | entrega | team
  is_team boolean not null default false,
  client_id text,                      -- se asigna en la app (editable)
  project_id text,                     -- se asigna en la app (editable)
  external_participants jsonb not null default '[]'::jsonb,
  call_date timestamptz,
  share_url text,
  testimonial boolean,                 -- solo entrega: se grabó testimonio?
  upsell boolean,                      -- solo entrega: se ofreció mantenimiento/upsell?
  synced_at timestamptz not null default now()
);
alter table public.fathom_calls enable row level security;
create policy "auth read calls"   on public.fathom_calls for select to authenticated using (true);
create policy "auth update calls" on public.fathom_calls for update to authenticated using (true) with check (true);
-- insert/delete solo via Edge Function (service role).

alter publication supabase_realtime add table public.fathom_calls;
