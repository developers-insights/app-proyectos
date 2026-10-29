-- Vinculación automática grupo de WhatsApp ↔ proyecto (29/10, bot_fede `vincular-grupos`).
--
-- Antes: sólo se vinculaba por el link de invitación del proyecto (whatsappUrl) o a mano
-- en el panel. 16 grupos activos quedaron sin proyecto; Evoria entre ellos, y el aviso
-- de inactividad lo marcó "sin seguimiento" sin ver su etapa (pausado) ni el contacto
-- anotado en la app.
--
-- link_source dice quién decidió el vínculo:
-- * 'manual': elegido en el panel (también "Sin proyecto" a mano). El bot nunca lo toca.
-- * 'invitacion', 'telefono', 'nombre', 'telefono+nombre': lo puso el bot y lo puede
--   rehacer si el proyecto se borra.
-- Los vínculos que ya existían quedan como 'manual': no sabemos su origen y no se tocan.

alter table public.wa_groups
  add column if not exists link_source text,
  add column if not exists linked_at timestamptz;

alter table public.wa_groups drop constraint if exists wa_groups_link_source_check;
alter table public.wa_groups add constraint wa_groups_link_source_check
  check (link_source in ('manual', 'invitacion', 'telefono', 'nombre', 'telefono+nombre'));

update public.wa_groups
set link_source = 'manual', linked_at = coalesce(linked_at, updated_at)
where project_id is not null and link_source is null;
