-- Correr DESPUÉS de que el front que pide el token con carousel_token() esté en
-- producción (PR "El resto de las tablas, sólo el equipo"). El front viejo lee
-- app_secrets directo y se quedaría sin carrusel.
-- Desde acá nadie con sesión lee app_secrets: sólo service_role y las funciones definer.

drop policy if exists app_secrets_equipo_select on public.app_secrets;
revoke all on public.app_secrets from anon, authenticated;
