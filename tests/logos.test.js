import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  logoDe, rutaLogo, iniciales, verLogo, encuadre, fondoPara, iconosDelHtml, iconosDelManifest,
  elegirIcono, esIconoPorDefecto, firmaVigente, LADO_LOGO,
} from '../src/lib/logos.js'

test('logoDe acepta sólo rutas del bucket o data: de imagen; lo demás es "sin logo"', () => {
  assert.equal(logoDe({ logo: 'p1/0123456789abcdef.webp' }), 'p1/0123456789abcdef.webp')
  assert.equal(logoDe({ logo: 'data:image/webp;base64,AAAA' }), 'data:image/webp;base64,AAAA')
  assert.equal(logoDe({ logo: 'https://cliente.com/logo.png' }), null)
  assert.equal(logoDe({ logo: '../otro/0123456789abcdef.webp' }), null)
  assert.equal(logoDe({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' }), null)
  assert.equal(logoDe({ logo: '' }), null)
  assert.equal(logoDe({}), null)
  assert.equal(logoDe(null), null)
})

test('rutaLogo arma una ruta por contenido: mismo archivo, misma ruta', () => {
  assert.equal(rutaLogo('p-7', 'ABCDEF0123456789ffff'), 'p-7/abcdef0123456789.webp')
  assert.equal(logoDe({ logo: rutaLogo('p-7', 'abcdef0123456789') }), 'p-7/abcdef0123456789.webp')
  assert.throws(() => rutaLogo('a/b', 'abcdef0123456789'))
})

test('iniciales: dos palabras, una palabra, símbolos y vacío', () => {
  assert.equal(iniciales('Mi cupón Arg'), 'MC')
  assert.equal(iniciales('Cyberfalu academy'), 'CA')
  assert.equal(iniciales('Psycho'), 'PS')
  assert.equal(iniciales('  ¡Hola!  mundo '), 'HM')
  assert.equal(iniciales(''), '·')
})

test('verLogo: logo sólo con ruta válida, URL resuelta y sin falla de carga', () => {
  assert.equal(verLogo({ logo: 'p1/0123456789abcdef.webp', url: 'https://x/y', fallo: false }), true)
  assert.equal(verLogo({ logo: 'p1/0123456789abcdef.webp', url: null, fallo: false }), false)
  assert.equal(verLogo({ logo: 'p1/0123456789abcdef.webp', url: 'https://x/y', fallo: true }), false)
  assert.equal(verLogo({ logo: null, url: 'https://x/y', fallo: false }), false)
})

test('encuadre: un ícono de app opaco y cuadrado ocupa todo el lienzo', () => {
  const r = encuadre({ w: 512, h: 512, opaco: true, caja: { x: 0, y: 0, w: 512, h: 512 } })
  assert.deepEqual(r, { sx: 0, sy: 0, sw: 512, sh: 512, dx: 0, dy: 0, dw: LADO_LOGO, dh: LADO_LOGO })
})

test('encuadre: un logo apaisado con transparencia se recorta a su caja y se centra con margen', () => {
  const r = encuadre({ w: 800, h: 400, opaco: false, caja: { x: 100, y: 100, w: 600, h: 200 } })
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [100, 100, 600, 200])
  assert.ok(r.dw <= LADO_LOGO * 0.76 + 1 && r.dw >= LADO_LOGO * 0.7)
  assert.equal(Math.round(r.dw / r.dh), 3)
  assert.equal(Math.round(r.dx * 2 + r.dw), LADO_LOGO)
  assert.equal(Math.round(r.dy * 2 + r.dh), LADO_LOGO)
})

test('encuadre: uno opaco pero apaisado (captura, banner) no se estira', () => {
  const r = encuadre({ w: 1200, h: 600, opaco: true, caja: { x: 0, y: 0, w: 1200, h: 600 } })
  assert.equal(Math.round(r.dw / r.dh), 2)
})

test('fondoPara: tinta oscura sobre blanco, tinta clara sobre oscuro, opaco sin fondo propio', () => {
  assert.equal(fondoPara({ opaco: false, luzTinta: 0.1 }), '#ffffff')
  assert.equal(fondoPara({ opaco: false, luzTinta: 0.92 }), '#15171c')
  assert.equal(fondoPara({ opaco: true, luzTinta: 0.95 }), '#ffffff')
})

const HTML = `<!doctype html><html><head>
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:image" content="https://cdn.x.com/og.png">
</head></html>`

test('iconosDelHtml levanta los link de ícono con URL absoluta, el manifest y el og:image', () => {
  const r = iconosDelHtml(HTML, 'https://cliente.com/app/')
  assert.deepEqual(r.iconos.map((i) => [i.url, i.origen, i.lado]), [
    ['https://cliente.com/favicon.ico', 'icon', 32],
    ['https://cliente.com/icon.svg', 'svg', 0],
    ['https://cliente.com/apple-touch-icon.png', 'apple', 180],
  ])
  assert.equal(r.manifest, 'https://cliente.com/site.webmanifest')
  assert.equal(r.og, 'https://cdn.x.com/og.png')
})

test('iconosDelManifest toma el lado mayor de "sizes" y resuelve contra el manifest', () => {
  const r = iconosDelManifest({ icons: [{ src: 'i/192.png', sizes: '192x192' }, { src: '/512.png', sizes: '256x256 512x512', purpose: 'any maskable' }] }, 'https://c.com/m/site.webmanifest')
  assert.deepEqual(r.map((i) => [i.url, i.lado, i.origen]), [['https://c.com/m/i/192.png', 192, 'manifest'], ['https://c.com/512.png', 512, 'manifest']])
})

test('esIconoPorDefecto reconoce los de plantilla (Vite, Next, Vercel, Flutter)', () => {
  assert.equal(esIconoPorDefecto('https://x.com/vite.svg'), true)
  assert.equal(esIconoPorDefecto('https://x.com/next.svg'), true)
  assert.equal(esIconoPorDefecto('https://x.com/vercel.svg'), true)
  assert.equal(esIconoPorDefecto('https://x.com/icons/Icon-192.png', { flutter: true }), true)
  assert.equal(esIconoPorDefecto('https://x.com/apple-touch-icon.png'), false)
})

test('elegirIcono: tienda > apple-touch > manifest grande > svg > png grande; nunca chico, por defecto ni og', () => {
  const c = [
    { url: 'https://c.com/favicon.ico', origen: 'icon', lado: 32 },
    { url: 'https://c.com/vite.svg', origen: 'svg', lado: 0 },
    { url: 'https://c.com/m512.png', origen: 'manifest', lado: 512 },
    { url: 'https://c.com/apple.png', origen: 'apple', lado: 180 },
    { url: 'https://c.com/og.png', origen: 'og', lado: 1200 },
  ]
  assert.equal(elegirIcono(c)[0].url, 'https://c.com/apple.png')
  assert.equal(elegirIcono([...c, { url: 'https://is1.mzstatic.com/a.png', origen: 'tienda', lado: 512 }])[0].origen, 'tienda')
  const sinApple = c.filter((x) => x.origen !== 'apple')
  assert.equal(elegirIcono(sinApple)[0].url, 'https://c.com/m512.png')
  assert.deepEqual(elegirIcono([c[0], c[1], c[4]]), [])
  assert.equal(elegirIcono([{ url: 'https://c.com/i.svg', origen: 'svg', lado: 0 }, { url: 'https://c.com/i.png', origen: 'icon', lado: 96 }])[0].origen, 'svg')
})

test('firmaVigente: se reusa la URL firmada mientras le queden más de 3 días', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  assert.equal(firmaVigente({ url: 'u', vence: now + 10 * 864e5 }, now), true)
  assert.equal(firmaVigente({ url: 'u', vence: now + 2 * 864e5 }, now), false)
  assert.equal(firmaVigente(null, now), false)
})
