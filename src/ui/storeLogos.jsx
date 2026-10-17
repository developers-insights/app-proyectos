import { useId } from 'react'

const NAMES = { play: 'Google Play', apple: 'App Store' }

function PlayGlyph() {
  return (
    <svg viewBox="0 0 28.99 31.99" aria-hidden="true" focusable="false">
      <path d="M13.54 15.28.12 29.34a3.66 3.66 0 0 0 5.33 2.16l15.1-8.6Z" fill="#ea4335" />
      <path d="m27.11 12.89-6.53-3.74-7.35 6.45 7.38 7.28 6.48-3.7a3.54 3.54 0 0 0 1.5-4.79 3.62 3.62 0 0 0-1.5-1.5z" fill="#fbbc04" />
      <path d="M.12 2.66a3.57 3.57 0 0 0-.12.92v24.84a3.57 3.57 0 0 0 .12.92L14 15.64Z" fill="#4285f4" />
      <path d="m13.64 16 6.94-6.85L5.5.51A3.73 3.73 0 0 0 3.63 0 3.64 3.64 0 0 0 .12 2.65Z" fill="#34a853" />
    </svg>
  )
}

function AppStoreGlyph() {
  // Un id por instancia: con un id fijo, la primera copia que quede en un contenedor
  // oculto se lleva el gradiente de todas las demás.
  const gid = 'asg' + useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 800 800" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="800" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#18BFFB" />
          <stop offset="1" stopColor="#2072F3" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M638.4,0H161.6C72.3,0,0,72.3,0,161.6v476.9C0,727.7,72.3,800,161.6,800h476.9c89.2,0,161.6-72.3,161.6-161.6V161.6C800,72.3,727.7,0,638.4,0z"
      />
      <path
        fill="#fff"
        d="M396.6,183.8l16.2-28c10-17.5,32.3-23.4,49.8-13.4s23.4,32.3,13.4,49.8L319.9,462.4h112.9c36.6,0,57.1,43,41.2,72.8H143c-20.2,0-36.4-16.2-36.4-36.4c0-20.2,16.2-36.4,36.4-36.4h92.8l118.8-205.9l-37.1-64.4c-10-17.5-4.1-39.6,13.4-49.8c17.5-10,39.6-4.1,49.8,13.4L396.6,183.8L396.6,183.8z M256.2,572.7l-35,60.7c-10,17.5-32.3,23.4-49.8,13.4S148,614.5,158,597l26-45C213.4,542.9,237.3,549.9,256.2,572.7L256.2,572.7z M557.6,462.6h94.7c20.2,0,36.4,16.2,36.4,36.4c0,20.2-16.2,36.4-36.4,36.4h-52.6l35.5,61.6c10,17.5,4.1,39.6-13.4,49.8c-17.5,10-39.6,4.1-49.8-13.4c-59.8-103.7-104.7-181.3-134.5-233c-30.5-52.6-8.7-105.4,12.8-123.3C474.2,318.1,509.9,380,557.6,462.6L557.6,462.6z"
      />
    </svg>
  )
}

export function StoreIcon({ store, size = 16, state, decorative = false }) {
  const label = decorative ? { 'aria-hidden': 'true' } : { role: 'img', 'aria-label': NAMES[store] }
  return (
    <span className="st-ic" style={{ '--sz': `${size}px`, '--bd': `${size >= 22 ? 11 : 9}px` }}>
      <span className="st-tile" data-store={store} {...label}>
        {store === 'play' ? <PlayGlyph /> : <AppStoreGlyph />}
      </span>
      {(state === 'tramite' || state === 'publicada') && (
        <i className="st-bd" data-s={state} aria-hidden="true">
          {state === 'publicada' && (
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.3 5.3 4.2 7.2 7.7 3" />
            </svg>
          )}
        </i>
      )}
    </span>
  )
}
