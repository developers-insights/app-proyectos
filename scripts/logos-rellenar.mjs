#!/usr/bin/env node
// Rellena data.logo de los proyectos que no tienen, desde la mejor fuente que encuentra:
// tienda (iTunes Lookup / Google Play) > sitio en producción (apple-touch-icon, manifest, ícono SVG o
// PNG grande) > repo de GitHub (ícono de la app). Nunca og:image ni favicons chicos o de plantilla.
//
//   envkit run -g --only SUPABASE_SERVICE_ROLE_KEY_PROYECTOS,SUPABASE_ACCESS_TOKEN -- node scripts/logos-rellenar.mjs --seco --salida <dir>
//   ... --aplicar --elegidos <dir>/elegidos.json
//
// --seco (default) baja los candidatos a <salida>/<id>/ y escribe <salida>/elegidos.json con la
// mejor opción de cada proyecto; ese archivo se revisa a ojo (mirar cada imagen) y se corrige a mano
// ({ "<id>": "<url | ruta local | gh:dueño/repo:ruta>" } o null = sin logo). --aplicar sube el webp y
// escribe sólo `logo` (subiendo `updatedAt`, para que un navegador abierto no lo pise). Idempotente:
// la ruta es por contenido y un proyecto que ya tiene ese logo no se toca. --pisar reemplaza logos
// que ya existen. Necesita `sharp` (npm i --no-save sharp).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  LADO_LOGO, LOGO_BUCKET, analizarPixeles, encuadre, fondoPara, rutaLogo, iconosDelHtml, iconosDelManifest, elegirIcono, logoDe,
} from '../src/lib/logos.js'

const REF = 'yzmtzyuncekspgtsetwk'
const CLARITY = 'rlausjxxgmtapvozrttw'
const URL_BASE = `https://${REF}.supabase.co`
const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const APLICAR = flag('--aplicar')
const PISAR = flag('--pisar')
const SALIDA = path.resolve(valor('--salida') || 'logos-candidatos')
const ELEGIDOS = valor('--elegidos')
const SOLO = valor('--solo')

const SR = process.env.SUPABASE_SERVICE_ROLE_KEY_PROYECTOS
const PAT = process.env.SUPABASE_ACCESS_TOKEN
if (!SR || !PAT) { console.error('Faltan SUPABASE_SERVICE_ROLE_KEY_PROYECTOS y SUPABASE_ACCESS_TOKEN (envkit run -g --only ...).'); process.exit(3) }

let sharp
try { sharp = (await import('sharp')).default } catch { console.error('Falta sharp: npm i --no-save sharp'); process.exit(3) }

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
const traer = async (url, ms = 12000) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { return await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: ctl.signal }) } finally { clearTimeout(t) }
}
const sql = async (query, ref = REF) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { authorization: `Bearer ${PAT}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }),
  })
  if (!r.ok) throw new Error(`SQL ${ref}: ${r.status} ${await r.text()}`)
  return r.json()
}
const rest = (p, init = {}) => fetch(`${URL_BASE}${p}`, { ...init, headers: { apikey: SR, authorization: `Bearer ${SR}`, ...(init.headers || {}) } })
const conProtocolo = (u) => (!u ? null : /^https?:\/\//i.test(u) ? u : `https://${u}`)
const dominiosMail = (e) => [...new Set([...String(e || '').toLowerCase().matchAll(/@([a-z0-9.-]+\.[a-z]{2,})/g)].map((m) => m[1]))]
  .filter((d) => !/gmail|hotmail|yahoo|outlook|icloud|live\.|insightsapps/.test(d)).map((d) => `https://${d}`)

/* ---------- fuentes ---------- */

async function deTienda(p) {
  const out = []
  const apple = p.portafolio?.tiendasUrl?.apple
  const id = apple && String(apple).match(/id(\d{6,})/)?.[1]
  if (id) {
    try {
      const j = await (await traer(`https://itunes.apple.com/lookup?id=${id}`)).json()
      const a = j.results?.[0]?.artworkUrl512
      if (a) out.push({ url: a, origen: 'tienda', lado: 512, de: `App Store ${id}` })
    } catch { /* sin red o sin app */ }
  }
  const play = p.portafolio?.tiendasUrl?.play || p.portafolio?.tiendasUrl?.google
  if (play) {
    try {
      const html = await (await traer(play)).text()
      const og = iconosDelHtml(html, play).og
      if (og && /googleusercontent/.test(og)) out.push({ url: og.replace(/=[^=]*$/, '=s512'), origen: 'tienda', lado: 512, de: 'Google Play' })
    } catch { /* ignore */ }
  }
  return out
}

async function deSitio(url, de) {
  if (!url) return []
  try {
    const r = await traer(url)
    if (!r.ok) return []
    const html = await r.text()
    const base = r.url || url
    const { iconos, manifest } = iconosDelHtml(html, base)
    const flutter = /flutter|main\.dart\.js/i.test(html)
    let todos = iconos
    if (manifest) {
      try { todos = todos.concat(iconosDelManifest(await (await traer(manifest)).json(), manifest)) } catch { /* manifest roto */ }
    }
    todos.push({ url: new URL('/apple-touch-icon.png', base).href, origen: 'apple', lado: 180, adivinado: true })
    return todos.map((c) => ({ ...c, de, flutter }))
  } catch { return [] }
}

const RUTAS_REPO = [
  /(^|\/)app\/(apple-)?icon\.(png|svg)$/i,
  /(^|\/)public\/apple-touch-icon\.png$/i,
  /(^|\/)public\/(icon|icons\/icon)[-_]?(512|192)?(x512|x192)?\.png$/i,
  /(^|\/)(public|assets|src\/assets)\/(images\/)?logo[^/]*\.(png|svg|webp)$/i,
  /(^|\/)public\/brand\/[^/]*(icono|icon)[^/]*\.(png|svg|webp)$/i,
  /(^|\/)assets\/(images\/)?(app[-_]?)?icon\.png$/i,
  /android\/app\/src\/main\/res\/mipmap-xxxhdpi\/ic_launcher\.png$/i,
  /AppIcon\.appiconset\/[^/]*1024[^/]*\.png$/i,
]

function gh(argv) {
  for (const cuenta of [null, 'developers-insights', 'manu-180']) {
    try {
      if (cuenta) execFileSync('gh', ['auth', 'switch', '-u', cuenta], { stdio: 'ignore' })
      return execFileSync('gh', argv, { maxBuffer: 64 * 1024 * 1024 })
    } catch { /* otra cuenta */ }
  }
  return null
}

function deRepo(repo) {
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return []
  const raw = gh(['api', `repos/${repo}/git/trees/HEAD?recursive=1`])
  if (!raw) return []
  let tree = []
  try { tree = JSON.parse(raw.toString()).tree || [] } catch { return [] }
  return tree.filter((t) => t.type === 'blob' && !/node_modules|\/build\/|\.next\//.test(t.path) && RUTAS_REPO.some((re) => re.test(t.path)))
    .map((t) => ({ url: `gh:${repo}:${t.path}`, origen: 'repo', lado: /1024|512|xxxhdpi/.test(t.path) ? 512 : /\.svg$/.test(t.path) ? 512 : 192, de: `repo ${repo}` }))
}

async function bajar(ref) {
  if (ref.startsWith('gh:')) {
    const [, repo, ...resto] = ref.split(':')
    const buf = gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/${repo}/contents/${resto.join(':')}`])
    return buf && buf.length ? buf : null
  }
  if (/^https?:/.test(ref)) {
    try { const r = await traer(ref); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length > 200 ? b : null } catch { return null }
  }
  return fs.existsSync(ref) ? fs.readFileSync(ref) : null
}

/* ---------- del archivo al webp que guarda la app (mismo criterio que src/lib/logoImagen.js) ---------- */

async function procesar(buf) {
  const meta = await sharp(buf, { density: 300 }).metadata()
  if (!meta.width || !meta.height) throw new Error('no es una imagen')
  const k = Math.min(1, 1024 / Math.max(meta.width, meta.height))
  const W = Math.max(1, Math.round(meta.width * k))
  const H = Math.max(1, Math.round(meta.height * k))
  const { data } = await sharp(buf, { density: 300 }).resize(W, H, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const an = analizarPixeles(data, W, H)
  const r = encuadre({ w: W, h: H, opaco: an.opaco, caja: an.caja })
  const recorte = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: Math.round(r.sx), top: Math.round(r.sy), width: Math.round(r.sw), height: Math.round(r.sh) })
    .resize(Math.max(1, Math.round(r.dw)), Math.max(1, Math.round(r.dh)), { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const webp = await sharp({ create: { width: LADO_LOGO, height: LADO_LOGO, channels: 4, background: fondoPara(an) } })
    .composite([{ input: recorte, left: Math.round(r.dx), top: Math.round(r.dy) }]).flatten({ background: fondoPara(an) }).webp({ quality: 90 }).toBuffer()
  return { webp, hash: crypto.createHash('sha256').update(webp).digest('hex'), lado: Math.min(meta.width, meta.height), formato: meta.format }
}

/* ---------- main ---------- */

const [{ json_agg: proyectos }] = await sql(`select json_agg(x) from (select p.id, p.data, (select c.data from public.clients c where c.id = p.data->>'clientId') cliente from public.projects p where p.deleted_at is null) x`)
let clarity = []
try { [{ json_agg: clarity }] = await sql('select json_agg(x) from (select source_id, production_url, repo from public.cb_projects) x', CLARITY) } catch (e) { console.error('Clarity no respondió:', e.message) }
const cb = new Map((clarity || []).map((c) => [c.source_id, c]))
const elegidos = ELEGIDOS ? JSON.parse(fs.readFileSync(ELEGIDOS, 'utf8')) : null
const lista = proyectos.filter((x) => !SOLO || SOLO.split(',').includes(x.id)).sort((a, b) => (a.data.name || '').localeCompare(b.data.name || ''))

const resumen = []
const plan = {}
fs.mkdirSync(SALIDA, { recursive: true })

for (const { id, data: p, cliente } of lista) {
  const fila = { id, nombre: p.name }
  if (logoDe(p) && !PISAR) {
    resumen.push({ ...fila, estado: 'ya tiene logo' }); plan[id] = elegidos?.[id] ?? null; continue
  }
  let fuente = elegidos ? elegidos[id] : undefined
  if (fuente === undefined) {
    const c = cb.get(id) || {}
    const cand = [
      ...(await deTienda(p)),
      ...(await deSitio(conProtocolo(p.productionUrl), 'producción')),
      ...(c.production_url && c.production_url !== conProtocolo(p.productionUrl) ? await deSitio(c.production_url, 'producción (Clarity)') : []),
      ...deRepo(p.githubRepo), ...(c.repo && c.repo !== p.githubRepo ? deRepo(c.repo) : []),
      ...(await Promise.all(dominiosMail(cliente?.email).map((u) => deSitio(u, `sitio del cliente ${u}`)))).flat(),
    ]
    const orden = elegirIcono(cand, { flutter: cand.some((x) => x.flutter) })
    const dir = path.join(SALIDA, id)
    fs.mkdirSync(dir, { recursive: true })
    const vistos = []
    for (const [i, c] of orden.entries()) {
      if (vistos.length >= 4) break
      const buf = await bajar(c.url)
      if (!buf) continue
      try {
        const pr = await procesar(buf)
        if (pr.lado < 96 && c.origen !== 'svg') continue
        if (vistos.some((v) => v.hash === pr.hash)) continue
        const f = path.join(dir, `${String(i).padStart(2, '0')}-${c.origen}.webp`)
        fs.writeFileSync(f, pr.webp)
        vistos.push({ ...c, hash: pr.hash, archivo: f, lado: pr.lado })
      } catch { /* no era imagen */ }
    }
    fs.writeFileSync(path.join(dir, 'candidatos.json'), JSON.stringify(vistos, null, 2))
    fuente = vistos[0]?.url ?? null
    fila.candidatos = vistos.length
  }
  plan[id] = fuente
  if (!fuente) { resumen.push({ ...fila, estado: 'sin logo' }); continue }
  if (!APLICAR) { resumen.push({ ...fila, estado: 'propuesto', fuente }); continue }

  const buf = await bajar(fuente)
  if (!buf) { resumen.push({ ...fila, estado: 'no se pudo bajar', fuente }); continue }
  const pr = await procesar(buf)
  const ruta = rutaLogo(id, pr.hash)
  if (p.logo === ruta) { resumen.push({ ...fila, estado: 'igual', ruta }); continue }
  const up = await rest(`/storage/v1/object/${LOGO_BUCKET}/${ruta}`, {
    method: 'POST', headers: { 'content-type': 'image/webp', 'cache-control': 'max-age=31536000', 'x-upsert': 'false' }, body: pr.webp,
  })
  if (!up.ok && up.status !== 409 && !/exist|Duplicate/i.test(await up.clone().text())) { resumen.push({ ...fila, estado: `storage ${up.status}` }); continue }

  let escrito = false
  for (let intento = 0; intento < 3 && !escrito; intento++) {
    const [row] = await (await rest(`/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=data,updated_at`)).json()
    const prev = Date.parse(row.data.updatedAt || row.updated_at || 0) || 0
    const t = new Date(Math.max(Date.now(), prev + 1)).toISOString()
    const r = await rest(`/rest/v1/projects?id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(row.updated_at)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', prefer: 'return=representation' },
      body: JSON.stringify({ data: { ...row.data, logo: ruta, updatedAt: t }, updated_at: t }),
    })
    escrito = r.ok && (await r.json()).length === 1
  }
  resumen.push({ ...fila, estado: escrito ? 'escrito' : 'no se pudo escribir (cambió mientras tanto)', ruta, fuente })
}

if (!APLICAR) fs.writeFileSync(path.join(SALIDA, 'elegidos.json'), JSON.stringify(plan, null, 2))
console.table(resumen.map((r) => ({ id: r.id, proyecto: r.nombre, estado: r.estado, fuente: (r.fuente || '').slice(0, 90) })))
if (!APLICAR) console.log(`\nSeco: candidatos en ${SALIDA}. Revisá ${path.join(SALIDA, 'elegidos.json')} y corré con --aplicar --elegidos.`)
