import { useEffect, useState } from 'react'
import { useApp } from '../ui.jsx'
import { iniciales, logoDe, verLogo } from '../lib/logos.js'
import { urlFirmada, pedirFirma, escucharFirma, firmaFallida } from '../lib/logoImagen.js'

const CSS = `
.pav{position:relative}
.pav-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:inherit;background:#fff;
  outline:1px solid rgba(127,127,127,.2);outline-offset:-1px;opacity:0;pointer-events:none;user-select:none}
.pav-img[data-ok]{opacity:1}
.pav[data-logo]>.pav-ini{visibility:hidden}
`
if (typeof document !== 'undefined' && !document.getElementById('pav-css')) {
  const s = document.createElement('style'); s.id = 'pav-css'; s.textContent = CSS; document.head.appendChild(s)
}

const cargadas = new Set()

export function useLogoUrl(logo) {
  const { supabase } = useApp() || {}
  const [, tic] = useState(0)
  useEffect(() => {
    if (!logo) return undefined
    const off = escucharFirma(logo, () => tic((n) => n + 1))
    pedirFirma(supabase, logo)
    return off
  }, [logo, supabase])
  return logo ? urlFirmada(logo) : null
}

/**
 * El cuadrito del proyecto: el logo si hay, las iniciales si no hay o si la imagen no carga.
 * Tamaño, radio y colores son los de `className` en cada vista; las iniciales quedan
 * siempre debajo, así que nunca se ve un cuadro roto ni salta el layout.
 */
export default function ProyectoAvatar({ project, logo: logoProp, texto, ini, as: Tag = 'span', className = '', style, lazy = true, children }) {
  const logo = logoProp !== undefined ? logoProp : logoDe(project)
  const url = useLogoUrl(logo)
  const [fallo, setFallo] = useState(false)
  const [ok, setOk] = useState(() => !!url && cargadas.has(url))
  useEffect(() => { setFallo(false); setOk(!!url && cargadas.has(url)) }, [url])
  const ver = verLogo({ logo, url, fallo: fallo || firmaFallida(logo) })
  const listo = ver && ok
  return (
    <Tag className={`pav ${className}`.trim()} style={style} data-logo={listo ? '' : undefined} aria-hidden="true">
      <span className="pav-ini">{ini ?? iniciales(texto)}</span>
      {ver && (
        <img className="pav-img" src={url} alt="" draggable={false} decoding="async" loading={lazy ? 'lazy' : 'eager'}
          data-ok={listo ? '' : undefined}
          ref={(el) => { if (el && el.complete && el.naturalWidth && !ok) { cargadas.add(url); setOk(true) } }}
          onLoad={() => { cargadas.add(url); setOk(true) }}
          onError={() => setFallo(true)} />
      )}
      {children}
    </Tag>
  )
}
