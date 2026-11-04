import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CUENTAS, GITHUB_COLABORADORES, MAIL_SUPABASE } from '../src/lib/accesos.js'

const pagina = readFileSync(new URL('../src/Onboarding.jsx', import.meta.url), 'utf8')

test('se le piden tres cuentas: GitHub, Supabase y Vercel', () => {
  assert.deepEqual(CUENTAS.map((c) => c.id), ['github', 'supabase', 'vercel'])
  assert.deepEqual(CUENTAS.map((c) => c.nombre), ['GitHub', 'Supabase', 'Vercel'])
  for (const c of CUENTAS) {
    assert.match(c.alta, /^https:\/\//, `${c.id} sin link de alta`)
    assert.ok(c.para && c.compartir && c.cta, `${c.id} sin texto`)
  }
})

test('los dos colaboradores de GitHub, con guion, y el mail de Supabase', () => {
  assert.deepEqual(GITHUB_COLABORADORES, ['developers-insights', 'manu-180'])
  // `manu180` sin guion es otra cuenta de GitHub: un texto que la nombre no le da acceso a nadie.
  assert.doesNotMatch(JSON.stringify(CUENTAS), /manu180/)
  const github = CUENTAS.find((c) => c.id === 'github')
  for (const quien of GITHUB_COLABORADORES) assert.ok(github.compartir.includes(quien), github.compartir)
  assert.ok(CUENTAS.find((c) => c.id === 'supabase').compartir.includes(MAIL_SUPABASE))
  assert.match(MAIL_SUPABASE, /^[^@\s]+@[^@\s]+$/)
})

// El bug del 4/11: la página listaba dos cuentas y el mensaje de Clarity pedía otra cosa. Que la
// página dibuje la lista, y no su propia copia, es lo que no deja que vuelvan a separarse.
test('la página de gracias dibuja la lista, no una copia propia', () => {
  assert.ok(pagina.includes("from './lib/accesos'"), 'Onboarding.jsx no lee lib/accesos')
  assert.ok(pagina.includes('CUENTAS.map('), 'Onboarding.jsx no recorre CUENTAS')
  assert.ok(pagina.includes('estas tres cuentas'), 'el título sigue hablando de dos cuentas')
  // Ninguna cuenta ni usuario escrito a mano en la página: si aparece, es una copia que se va a desincronizar.
  const sinComentarios = pagina.replace(/\/\*[\s\S]*?\*\//g, ' ')
  for (const suelto of ['supabase.com/dashboard/sign-up', 'github.com/signup', 'developers-insights', MAIL_SUPABASE]) {
    assert.doesNotMatch(sinComentarios, new RegExp(suelto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${suelto} está escrito a mano en Onboarding.jsx`)
  }
})
