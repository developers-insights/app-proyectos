-- Logo de cada proyecto (pedido de Manuel, 16/11): bucket privado `project-logos`.
-- Aplicada en yzmtzyuncekspgtsetwk por Management API; ensayo revertido en `.ensayo.sql`.
--
-- El proyecto guarda la ruta en data.logo (`<projectId>/<hash>.webp`, sin columna nueva). La app
-- lo achica en el navegador a un webp de 192 px (el SVG se rasteriza, nunca se sube), así que el
-- bucket sólo acepta raster y hasta 1 MB. Se ve con URL firmada: el equipo y los lectores leen
-- (pm_puede_ver), sólo el equipo sube o cambia (is_team), anon nada. Idempotente.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-logos', 'project-logos', false, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists project_logos_select on storage.objects;
create policy project_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'project-logos' and (select public.pm_puede_ver()));

drop policy if exists project_logos_insert on storage.objects;
create policy project_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-logos' and (select public.is_team()));

drop policy if exists project_logos_update on storage.objects;
create policy project_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'project-logos' and (select public.is_team()))
  with check (bucket_id = 'project-logos' and (select public.is_team()));

drop policy if exists project_logos_delete on storage.objects;
create policy project_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-logos' and (select public.is_team()));
