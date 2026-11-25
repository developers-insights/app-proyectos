-- Mis claves: compartir una clave con otro admin. El valor se copia a la bóveda personal del otro en
-- Clarity (cifrada allá); esta tabla sólo recuerda quién se la pasó, para mostrarle "te la compartió X"
-- y para que "Deshacer" sólo pueda borrar lo que esa misma persona compartió. Nunca guarda valores.
-- La lee y escribe sólo la edge function `boveda` con service_role: sin políticas para nadie más.

create table if not exists public.vault_shares (
  de_email text not null,
  para_email text not null,
  nombre text not null,
  created_at timestamptz not null default now(),
  primary key (para_email, nombre, de_email)
);

-- copia_id + nueva: "Deshacer" borra sólo esa copia y sólo si el compartir la creó (no si pisó una suya).
alter table public.vault_shares add column if not exists copia_id text;
alter table public.vault_shares add column if not exists nueva boolean not null default false;

alter table public.vault_shares enable row level security;
revoke all on public.vault_shares from anon, authenticated;
grant select, insert, update, delete on public.vault_shares to service_role;
