-- Aplicado el 28/11 en yzmtzyuncekspgtsetwk. El secreto se lee al correr, no queda escrito en cron.job.
select cron.schedule('portafolio-traducir', '30 12 * * *', $cron$
  select net.http_post(
    url := 'https://yzmtzyuncekspgtsetwk.supabase.co/functions/v1/portafolio-traducir',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-catalogo-secret', (select value::text from public.catalogo_web_config where key = 'secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$cron$);
