import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useApp } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import { journeyBoard, laneMeta, normalizeThresholds, DEFAULT_THRESHOLDS, upsellBadges, laneAverage } from '../lib/journey.js'
import { normalizeLifecycle } from '../lib/lifecycle.js'
import { projectStage, stageMeta } from '../lib/stages.js'
import { storesSummary, storeShortLine, fmtDay } from '../lib/stores.js'
import { visibleProjects } from '../lib/visibility.js'
import { planBoardSummary } from '../plan/planModel.js'
import { projectProgress } from '../lib/progress.js'
import { initials, dayCell, daysText, plural } from '../journey/parts.jsx'
import { ROOMS, ROOM, WALL, U, LINKS, LANE_PATH, SLOTS_PER_ROOM, iso, pts, corridor, isoBox, slotPos, sceneBounds, roomOf } from './iso.js'

const B = sceneBounds()
const MIN_SCALE = 0.62

/* Mismos umbrales que el Recorrido: los guarda esa pantalla en este navegador. */
function readThresholds() {
  try { return normalizeThresholds(JSON.parse(localStorage.getItem('ip.recorrido.umbrales') || 'null')) } catch { return { ...DEFAULT_THRESHOLDS } }
}

const OBRA = ['onboarding', 'mvp', 'fase2']
const MANT = ['prueba', 'plan', 'anual', 'partner']
const PRIO = { alta: { label: 'Alta', c: 'var(--red)' }, normal: { label: 'Normal', c: 'var(--yellow)' }, baja: { label: 'Baja', c: 'var(--blue)' } }

export const InsightsIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m12 2.8 8.5 4.9v8.6L12 21.2l-8.5-4.9V7.7z" /><path d="m3.5 7.7 8.5 4.9 8.5-4.9M12 12.6v8.6" />
  </svg>
)

const CSS = `
.io{padding:24px 30px 36px}
.io-head{display:flex;align-items:center;justify-content:space-between;gap:14px 18px;flex-wrap:wrap;margin-bottom:16px}
.io-title{display:flex;align-items:center;gap:12px}
.io-title h1{font-size:30px;line-height:1;letter-spacing:-.045em}
.io-live{display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--green);
  background:var(--green-soft);box-shadow:inset 0 0 0 1px var(--green-line)}
.io-live i{position:relative;width:6px;height:6px;border-radius:50%;background:var(--green)}
.io-live i::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid var(--green);animation:ioPing 2.2s cubic-bezier(.2,.7,.3,1) infinite}
@keyframes ioPing{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.9);opacity:0}}
.io-sub{margin-top:8px;font-size:13.5px;color:var(--text-dim)}
.io-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.io-kpi{display:inline-flex;align-items:baseline;gap:7px;height:36px;padding:0 13px;border-radius:12px;font-size:12px;font-weight:600;color:var(--text-dim);
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);align-items:center;transition:box-shadow .2s var(--e),color .2s var(--e),transform .16s var(--e)}
.io-kpi b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:15px;color:var(--text);letter-spacing:-.03em}
.io-kpi .dt{width:6px;height:6px;border-radius:50%}
button.io-kpi:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
button.io-kpi:active{transform:scale(.97)}
button.io-kpi[aria-pressed="true"]{color:var(--text);background:var(--red-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--red) 45%,transparent)}
.io-kpi[data-tone="crit"] b{color:var(--red)}
.io-search{position:relative;display:flex;align-items:center}
.io-search svg{position:absolute;left:11px;color:var(--text-faint);pointer-events:none}
.io-search input{height:36px;width:220px;max-width:60vw;padding:0 12px 0 33px;border-radius:12px;font-size:13px;color:var(--text);background:var(--card);
  border:none;box-shadow:inset 0 0 0 1px var(--border);outline:none;transition:box-shadow .2s var(--e)}
.io-search input:focus{box-shadow:inset 0 0 0 1px var(--accent-line),0 0 0 4px var(--accent-soft)}

.io-stage{position:relative;border-radius:26px;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;
  background:
    radial-gradient(60% 55% at 50% 42%,color-mix(in srgb,var(--accent) 8%,transparent),transparent 70%),
    radial-gradient(40% 40% at 85% 90%,color-mix(in srgb,var(--violet) 7%,transparent),transparent 70%),
    linear-gradient(180deg,var(--bg-elevated),var(--bg));
  box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.io-stage::before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
  background:radial-gradient(120% 90% at 50% 50%,transparent 55%,color-mix(in srgb,var(--bg) 70%,transparent));z-index:3}
.io-scaler{position:relative;margin:0 auto}
.io-scene{position:absolute;left:0;top:0;transform-origin:0 0}
.io-svg{position:absolute;left:0;top:0;overflow:visible}

.io-room{--lc:var(--accent);cursor:pointer;transition:opacity .35s var(--e)}
.io-scene[data-focus] .io-room:not([data-on]){opacity:.38}
.io-room:focus{outline:none}
.io-floor{fill:color-mix(in srgb,var(--lc) 6%,var(--card));stroke:color-mix(in srgb,var(--lc) 26%,var(--border));stroke-width:1;transition:fill .3s var(--e)}
.io-room:hover .io-floor,.io-room:focus-visible .io-floor,.io-room[data-on] .io-floor{fill:color-mix(in srgb,var(--lc) 12%,var(--card))}
.io-room:focus-visible .io-floor{stroke:var(--lc);stroke-width:2}
.io-grid{stroke:color-mix(in srgb,var(--lc) 11%,transparent);stroke-width:.7;fill:none}
.io-wb{fill:color-mix(in srgb,var(--lc) 7%,var(--card-hover))}
.io-wl{fill:color-mix(in srgb,var(--lc) 4%,var(--bg-elevated))}
.io-edge{fill:none;stroke:color-mix(in srgb,var(--lc) 55%,transparent);stroke-width:1.4;stroke-linecap:round}
.io-base{fill:none;stroke:color-mix(in srgb,var(--lc) 18%,transparent);stroke-width:1}
.io-scr{fill:color-mix(in srgb,var(--lc) 13%,var(--bg));stroke:color-mix(in srgb,var(--lc) 45%,transparent);stroke-width:1}
.io-scr-t{font-family:${"'JetBrains Mono',monospace"};font-size:10.5px;font-weight:500;letter-spacing:.14em;fill:color-mix(in srgb,var(--lc) 75%,var(--text))}
.io-scr-n{font-family:-apple-system,'SF Pro Display',Inter,system-ui,sans-serif;font-size:31px;font-weight:700;letter-spacing:-.05em;fill:var(--text)}
.io-scr-c{font-size:10.5px;font-weight:500;fill:var(--text-dim)}
.io-scan{fill:url(#ioScan);animation:ioScan 6.5s linear infinite}
@keyframes ioScan{0%{transform:translateX(-80px)}100%{transform:translateX(240px)}}
.io-wl-t{font-size:10px;font-weight:500;fill:var(--text-faint);letter-spacing:.02em}
.io-dt{fill:color-mix(in srgb,var(--lc) 9%,var(--card-hover))}
.io-dr{fill:color-mix(in srgb,var(--lc) 4%,var(--card))}
.io-df{fill:color-mix(in srgb,var(--lc) 2%,var(--bg-elevated))}
.io-mon{fill:var(--lc);opacity:.75}
.io-room[data-busy] .io-mon{animation:ioMon 3.4s ease-in-out infinite}
.io-room[data-busy] .io-mon:nth-of-type(2n){animation-delay:-1.7s}
@keyframes ioMon{0%,100%{opacity:.8}45%{opacity:.45}55%{opacity:.85}}
.io-plant-p{fill:color-mix(in srgb,var(--text) 10%,var(--card-hover))}
.io-plant-l{fill:color-mix(in srgb,var(--green) 70%,var(--bg))}
.io-beacon{fill:var(--red)}
.io-beacon-r{fill:none;stroke:var(--red);stroke-width:1.5;transform-box:fill-box;transform-origin:center;animation:ioBeacon 1.8s ease-out infinite}
@keyframes ioBeacon{0%{transform:scale(.5);opacity:1}100%{transform:scale(2.6);opacity:0}}

.io-cor{fill:color-mix(in srgb,var(--text) 3.5%,transparent);stroke:var(--border);stroke-width:1}
.io-flow{fill:none;stroke:var(--accent-line);stroke-width:1.6;stroke-dasharray:2 9;stroke-linecap:round;animation:ioFlow 1.6s linear infinite}
@keyframes ioFlow{to{stroke-dashoffset:-22}}

.io-tk{--lc:var(--accent);position:absolute;left:0;top:0;width:44px;height:64px;margin:-58px 0 0 -22px;padding:0;border:none;background:none;cursor:pointer;
  display:block;-webkit-tap-highlight-color:transparent;transition:opacity .35s var(--e),filter .35s var(--e)}
.io-tk:focus{outline:none}
.io-tk[data-dim]{opacity:.16;filter:saturate(.3)}
.io-ring{position:absolute;left:50%;bottom:0;width:30px;height:15px;margin-left:-15px;border-radius:50%;
  background:radial-gradient(closest-side,color-mix(in srgb,var(--lc) 45%,transparent),transparent);
  box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--lc) 70%,transparent);transition:transform .3s var(--e)}
.io-beam{position:absolute;left:50%;bottom:7px;width:2px;height:20px;margin-left:-1px;border-radius:2px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--lc) 85%,transparent),transparent)}
.io-bob{position:absolute;left:50%;top:4px;margin-left:-17px;animation:ioBob 4.2s ease-in-out infinite;animation-delay:var(--bd,0s)}
@keyframes ioBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3.5px)}}
.io-av{position:relative;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;font-size:11.5px;font-weight:700;letter-spacing:-.02em;color:#fff;
  background:radial-gradient(120% 120% at 30% 20%,color-mix(in srgb,var(--lc) 70%,#fff 30%),var(--lc) 45%,color-mix(in srgb,var(--lc) 55%,#000 45%));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -6px 12px rgba(0,0,0,.18),0 8px 18px -6px color-mix(in srgb,var(--lc) 60%,transparent),0 0 0 1.5px color-mix(in srgb,var(--lc) 35%,var(--bg));
  text-shadow:0 1px 1px rgba(0,0,0,.25);transition:transform .28s cubic-bezier(.3,1.5,.5,1),box-shadow .28s var(--e)}
.io-tk:hover .io-av,.io-tk:focus-visible .io-av,.io-tk[data-sel] .io-av{transform:translateY(-4px) scale(1.12)}
.io-tk:focus-visible .io-av{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--lc)}
.io-tk:hover .io-ring,.io-tk[data-sel] .io-ring{transform:scale(1.25)}
.io-tk[data-sel] .io-av::before{content:"";position:absolute;inset:-6px;border-radius:50%;border:1.5px solid var(--lc);animation:ioPing 1.8s cubic-bezier(.2,.7,.3,1) infinite}
.io-al{position:absolute;top:-1px;right:-2px;width:10px;height:10px;border-radius:50%;background:var(--yellow);box-shadow:0 0 0 2px var(--bg)}
.io-al[data-lv="crit"]{background:var(--red)}
.io-al[data-lv="crit"]::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:1.5px solid var(--red);animation:ioPing 1.6s ease-out infinite}
.io-more .io-av{background:var(--card);color:var(--text);font-family:'JetBrains Mono',monospace;font-size:11px;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--lc) 55%,transparent),0 8px 18px -8px rgba(0,0,0,.5)}
.io-nm{position:absolute;left:50%;bottom:calc(100% - 2px);transform:translate(-50%,4px);white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis;
  padding:5px 9px;border-radius:9px;font-size:11.5px;font-weight:600;color:var(--text);pointer-events:none;opacity:0;
  background:color-mix(in srgb,var(--bg-elevated) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  box-shadow:inset 0 0 0 1px var(--border-strong),0 10px 24px -12px rgba(0,0,0,.6);transition:opacity .18s var(--e),transform .24s cubic-bezier(.3,1.4,.5,1)}
.io-tk:hover .io-nm,.io-tk:focus-visible .io-nm,.io-tk[data-hit] .io-nm{opacity:1;transform:translate(-50%,-2px)}

.io-legend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--text-faint)}
.io-legend span{display:inline-flex;align-items:center;gap:6px}
.io-legend i{width:8px;height:8px;border-radius:50%}
.io-empty{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;color:var(--text-dim);z-index:4}

.io-scrim{position:fixed;inset:0;z-index:69;background:color-mix(in srgb,var(--bg) 35%,transparent)}
.io-sheet{--lc:var(--accent);position:fixed;z-index:70;top:14px;right:14px;bottom:14px;width:min(440px,calc(100vw - 28px));display:flex;flex-direction:column;
  padding:5px;border-radius:24px;background:color-mix(in srgb,var(--bg-elevated) 72%,var(--border));box-shadow:inset 0 0 0 1px var(--border-strong),var(--shadow-lift)}
.io-core{flex:1;min-height:0;display:flex;flex-direction:column;border-radius:19px;overflow:hidden;background:var(--bg-elevated);box-shadow:0 0 0 1px var(--border)}
.io-sh{position:relative;padding:18px 18px 18px;border-bottom:1px solid var(--border);overflow:hidden}
.io-sh::before{content:"";position:absolute;inset:0;background:radial-gradient(90% 120% at 15% 0%,color-mix(in srgb,var(--lc) 22%,transparent),transparent 70%);pointer-events:none}
.io-sh-top{position:relative;display:flex;align-items:center;gap:6px;margin-bottom:14px}
.io-sh-top .sp{flex:1}
.io-ib{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;color:var(--text-dim);background:color-mix(in srgb,var(--card) 70%,transparent);
  box-shadow:inset 0 0 0 1px var(--border);transition:color .16s var(--e),background .16s var(--e),transform .14s var(--e)}
.io-ib:hover:not(:disabled){color:var(--text);background:var(--card-hover)}
.io-ib:active:not(:disabled){transform:scale(.94)}
.io-ib:disabled{opacity:.35;cursor:default}
.io-ib:focus-visible,.io-row:focus-visible,.io-cta:focus-visible,.io-lk:focus-visible{outline:2px solid var(--lc);outline-offset:2px}
.io-pos{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--text-faint);padding:0 4px;font-variant-numeric:tabular-nums}
.io-id{position:relative;display:flex;align-items:center;gap:14px}
.io-id .io-av{width:56px;height:56px;font-size:18px;flex:none}
.io-id h2{font-size:21px;line-height:1.15;letter-spacing:-.035em;overflow-wrap:anywhere}
.io-id .cl{margin-top:4px;font-size:13px;color:var(--text-dim)}
.io-pills{position:relative;display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.io-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--text);
  background:color-mix(in srgb,var(--pc,var(--lc)) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--pc,var(--lc)) 36%,transparent)}
.io-pill i{width:6px;height:6px;border-radius:50%;background:var(--pc,var(--lc))}
.io-sb{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 18px 18px}
.io-sec{padding:16px 0;border-top:1px solid var(--border)}
.io-sec:first-child{border-top:none}
.io-k{margin-bottom:11px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--text-faint)}
.io-hero{display:grid;grid-template-columns:1fr auto;align-items:center;gap:16px}
.io-big{display:flex;align-items:baseline;gap:8px}
.io-big b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:44px;font-weight:600;letter-spacing:-.06em;line-height:1}
.io-big b[data-lv="crit"]{color:var(--red)}.io-big b[data-lv="warn"]{color:var(--yellow)}
.io-big span{font-size:13px;color:var(--text-dim)}
.io-hero .cap{margin-top:7px;font-size:12.5px;color:var(--text-dim);line-height:1.45}
.io-meter{margin-top:12px;height:5px;border-radius:5px;background:var(--track);overflow:hidden}
.io-meter i{display:block;height:100%;border-radius:5px;background:var(--lc);transform-origin:left}
.io-ringw{position:relative;width:76px;height:76px}
.io-ringw svg{transform:rotate(-90deg)}
.io-ringw .n{position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1}
.io-ringw .n b{font-family:'JetBrains Mono',monospace;font-size:17px;font-weight:600;letter-spacing:-.04em}
.io-ringw .n small{display:block;margin-top:3px;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.io-path{display:flex;align-items:flex-start}
.io-step{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center;font-size:11px;font-weight:600;color:var(--text-faint)}
.io-step::before{content:"";position:absolute;top:8px;right:50%;width:100%;height:2px;background:var(--track)}
.io-step:first-child::before{display:none}
.io-step[data-st="done"]::before,.io-step[data-st="now"]::before{background:color-mix(in srgb,var(--sc) 60%,transparent)}
.io-step .d{position:relative;z-index:1;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--card);box-shadow:inset 0 0 0 1.5px var(--border-strong)}
.io-step[data-st="done"] .d{background:color-mix(in srgb,var(--sc) 85%,var(--bg));box-shadow:none;color:var(--bg)}
.io-step[data-st="now"]{color:var(--text)}
.io-step[data-st="now"] .d{background:var(--sc);box-shadow:0 0 0 4px color-mix(in srgb,var(--sc) 22%,transparent),0 0 18px color-mix(in srgb,var(--sc) 60%,transparent)}
.io-alerts{display:flex;flex-direction:column;gap:7px}
.io-alert{display:flex;gap:10px;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.4;color:var(--text);
  background:color-mix(in srgb,var(--ac) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ac) 28%,transparent)}
.io-alert::before{content:"";flex:none;width:3px;border-radius:3px;background:var(--ac)}
.io-team{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.io-mem{display:flex;align-items:center;gap:10px;padding:10px;border-radius:14px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);min-width:0}
.io-mem .ph{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;font-size:12px;font-weight:700;color:#fff;background-size:cover;background-position:center}
.io-mem .ph[data-empty]{background:transparent;color:var(--text-faint);box-shadow:inset 0 0 0 1.5px var(--border-strong);border:none}
.io-mem .t{min-width:0}
.io-mem .t b{display:block;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.io-mem .t span{font-size:11.5px;color:var(--text-faint)}
.io-dl{display:grid;grid-template-columns:auto 1fr;gap:9px 16px;font-size:13px}
.io-dl dt{color:var(--text-faint)}
.io-dl dd{margin:0;color:var(--text);text-align:right;font-variant-numeric:tabular-nums}
.io-tags{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}
.io-tag{display:inline-flex;align-items:center;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:600}
.io-store{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;font-size:13px;border-top:1px dashed var(--border)}
.io-store:first-child{border-top:none;padding-top:0}
.io-store span{font-size:12px;color:var(--text-dim)}
.io-store span[data-st="tramite"]{color:var(--yellow)}.io-store span[data-st="publicada"]{color:var(--green)}
.io-links{display:flex;flex-wrap:wrap;gap:6px}
.io-lk{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:10px;font-size:12px;font-weight:600;color:var(--text-dim);
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border);text-decoration:none;transition:color .16s var(--e),box-shadow .16s var(--e)}
.io-lk:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
.io-desc{font-size:13px;line-height:1.55;color:var(--text-dim);white-space:pre-wrap}
.io-foot{padding:12px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--card) 50%,transparent)}
.io-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:42px;border-radius:13px;font-size:13.5px;font-weight:650;color:var(--text);
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border-strong);transition:background .16s var(--e),transform .14s var(--e)}
.io-cta:hover{background:var(--card-hover)}
.io-cta:active{transform:scale(.985)}
.io-rows{display:flex;flex-direction:column;gap:4px}
.io-row{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border-radius:13px;text-align:left;transition:background .16s var(--e)}
.io-row:hover{background:var(--card)}
.io-row .io-av{width:32px;height:32px;font-size:11px;flex:none}
.io-row .t{flex:1;min-width:0}
.io-row .t b{display:block;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.io-row .t span{font-size:12px;color:var(--text-faint)}
.io-row .n{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--text-dim)}
.io-row .n[data-lv="crit"]{color:var(--red)}.io-row .n[data-lv="warn"]{color:var(--yellow)}
.io-none{padding:22px 4px;font-size:13px;color:var(--text-dim);text-align:center}

@media (max-width:720px){
  .io{padding:20px 14px 40px}
  .io-title h1{font-size:28px}
  .io-sheet{top:auto;left:8px;right:8px;bottom:8px;width:auto;height:min(86vh,760px)}
  .io-team{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .io-bob,.io-scan,.io-flow,.io-mon,.io-beacon-r,.io-live i::after,.io-al::after,.io-tk[data-sel] .io-av::before{animation:none!important}
}
`

/* ─── Escena ──────────────────────────────────────────────────────────────── */

function Room({ room, items, alertLv, focus, onOpen, onHover }) {
  const { ox, oy, meta } = room
  const n = items.length
  const avg = laneAverage(items)
  const floor = pts(iso(ox, oy), iso(ox + ROOM, oy), iso(ox + ROOM, oy + ROOM), iso(ox, oy + ROOM))
  const grid = []
  for (let i = 1; i < ROOM; i++) {
    grid.push(`M${iso(ox + i, oy).X},${iso(ox + i, oy).Y}L${iso(ox + i, oy + ROOM).X},${iso(ox + i, oy + ROOM).Y}`)
    grid.push(`M${iso(ox, oy + i).X},${iso(ox, oy + i).Y}L${iso(ox + ROOM, oy + i).X},${iso(ox + ROOM, oy + i).Y}`)
  }
  const wb = pts(iso(ox, oy), iso(ox + ROOM, oy), iso(ox + ROOM, oy, WALL), iso(ox, oy, WALL))
  const wl = pts(iso(ox, oy), iso(ox, oy + ROOM), iso(ox, oy + ROOM, WALL), iso(ox, oy, WALL))
  const top = [iso(ox, oy + ROOM, WALL), iso(ox, oy, WALL), iso(ox + ROOM, oy, WALL)]
  const scr = iso(ox + 0.75, oy, 2.05)
  const side = iso(ox, oy + ROOM - 0.7, 1.15)
  const desks = [0.85, 3.85].map((x) => ({ x, d: isoBox(ox + x, oy + 0.55, 0, 2.2, 0.85, 0.42), m: isoBox(ox + x + 0.75, oy + 0.62, 0.42, 0.7, 0.12, 0.42) }))
  const plant = { p: isoBox(ox + ROOM - 0.9, oy + 0.4, 0, 0.5, 0.5, 0.45), l: isoBox(ox + ROOM - 0.98, oy + 0.32, 0.45, 0.66, 0.66, 0.5) }
  const beacon = iso(ox + ROOM - 0.25, oy, WALL + 0.25)
  const label = `${meta.label}: ${plural(n, 'proyecto', 'proyectos')}`
  const busy = (room.lane === 'mvp' || room.lane === 'fase2') && n > 0
  return (
    <g className="io-room" style={{ '--lc': `var(${meta.colorVar})` }} data-on={focus === room.lane ? '' : undefined} data-busy={busy ? '' : undefined}
      role="button" tabIndex={0} aria-label={label}
      onClick={() => onOpen(room.lane)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(room.lane) } }}
      onMouseEnter={() => onHover(room.lane)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(room.lane)} onBlur={() => onHover(null)}>
      <polygon className="io-floor" points={floor} />
      <path className="io-grid" d={grid.join('')} />
      <polygon className="io-wl" points={wl} />
      <polygon className="io-wb" points={wb} />
      <polyline className="io-base" points={pts(iso(ox, oy + ROOM), iso(ox, oy), iso(ox + ROOM, oy))} />
      <polyline className="io-edge" points={pts(...top)} />
      <g transform={`matrix(${Math.cos(Math.PI / 6)},0.5,0,1,${scr.X},${scr.Y})`}>
        <rect className="io-scr" x="0" y="0" width={(ROOM - 1.5) * U} height={U * 1.32} rx="7" />
        <clipPath id={`ioc-${room.lane}`}><rect x="0" y="0" width={(ROOM - 1.5) * U} height={U * 1.32} rx="7" /></clipPath>
        <g clipPath={`url(#ioc-${room.lane})`}><rect className="io-scan" x="0" y="0" width="70" height={U * 1.32} /></g>
        <text className="io-scr-t" x="12" y="15">{meta.label.toUpperCase()}</text>
        <text className="io-scr-n" x="11" y="45">{n}</text>
        <text className="io-scr-c" x={n > 9 ? 52 : 36} y="44">{avg != null && n ? `prom. ${avg} d` : n ? '' : 'vacía'}</text>
      </g>
      <g transform={`matrix(${Math.cos(Math.PI / 6)},-0.5,0,1,${side.X},${side.Y})`}>
        <text className="io-wl-t" x="0" y="0">{(meta.hint || laneHint(room.lane))}</text>
      </g>
      {desks.map((k) => (
        <g key={k.x}>
          <polygon className="io-df" points={k.d.front} /><polygon className="io-dr" points={k.d.right} /><polygon className="io-dt" points={k.d.top} />
          <polygon className="io-df" points={k.m.right} /><polygon className="io-mon" points={k.m.front} /><polygon className="io-dt" points={k.m.top} />
        </g>
      ))}
      <polygon className="io-plant-p" points={plant.p.front} /><polygon className="io-plant-p" points={plant.p.right} /><polygon className="io-plant-p" points={plant.p.top} />
      <polygon className="io-plant-l" points={plant.l.front} style={{ opacity: 0.75 }} /><polygon className="io-plant-l" points={plant.l.right} style={{ opacity: 0.6 }} /><polygon className="io-plant-l" points={plant.l.top} />
      {alertLv === 'crit' && (
        <g>
          <circle className="io-beacon-r" cx={beacon.X} cy={beacon.Y} r="5" />
          <circle className="io-beacon" cx={beacon.X} cy={beacon.Y} r="3.2" />
        </g>
      )}
    </g>
  )
}

const HINTS = {
  onboarding: 'todavía no arrancó', mvp: 'construyendo el MVP', prueba: 'probando gratis',
  plan: 'pagan US$97 por mes', fase2: 'segundo desarrollo', anual: 'un año de servicio',
  partner: 'a cambio de un porcentaje', standby: 'en pausa o terminados',
}
const laneHint = (k) => HINTS[k] || ''

function Token({ item, pos, order, booted, reduce, state, onOpen, label }) {
  const { project: p } = item
  const lc = `var(${laneMeta(item.entry.lane).colorVar})`
  const lv = item.level
  const delay = booted ? 0 : 0.35 + order * 0.035
  return (
    <motion.button type="button" className={`io-tk${item.more ? ' io-more' : ''}`}
      style={{ '--lc': lc, '--bd': `${-((order * 0.61) % 4.2).toFixed(2)}s`, zIndex: Math.round(pos.depth * 10) }}
      initial={reduce ? false : { x: pos.X, y: pos.Y - 70, opacity: 0 }}
      animate={{ x: pos.X, y: pos.Y, opacity: 1 }}
      transition={reduce ? { duration: 0 } : { x: { type: 'spring', stiffness: 46, damping: 13, delay }, y: { type: 'spring', stiffness: 60, damping: 11, delay }, opacity: { duration: 0.3, delay } }}
      data-dim={state.dim ? '' : undefined} data-sel={state.sel ? '' : undefined} data-hit={state.hit ? '' : undefined}
      aria-label={label} onClick={(e) => { e.stopPropagation(); onOpen() }}>
      <span className="io-ring" />
      <span className="io-beam" />
      <span className="io-bob">
        <span className="io-av">{item.more ? `+${item.more}` : item.mark}{!item.more && lv && <i className="io-al" data-lv={lv} />}</span>
      </span>
      {!item.more && <span className="io-nm">{p.name}</span>}
    </motion.button>
  )
}

/* ─── Ficha ───────────────────────────────────────────────────────────────── */

function Ring({ pct, reduce }) {
  const r = 32
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, pct || 0))
  return (
    <div className="io-ringw" aria-label={`Avance ${v}%`}>
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--track)" strokeWidth="6" />
        <motion.circle cx="38" cy="38" r={r} fill="none" stroke="var(--lc)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v / 100) }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }} />
      </svg>
      <div className="n"><div><b>{v}%</b><small>avance</small></div></div>
    </div>
  )
}

function Member({ user, role }) {
  if (!user) {
    return (
      <div className="io-mem"><span className="ph" data-empty=""><I2.plus width={14} height={14} /></span><div className="t"><b style={{ color: 'var(--text-faint)' }}>Sin asignar</b><span>{role}</span></div></div>
    )
  }
  const bg = user.photo ? { backgroundImage: `url(${user.photo})` } : { background: user.color || 'var(--accent)' }
  return (
    <div className="io-mem"><span className="ph" style={bg}>{!user.photo && (user.initials || initials(user.name))}</span><div className="t"><b>{user.name}</b><span>{role}</span></div></div>
  )
}

function ProjectSheet({ item, client, team, list, onNav, onBack, onOpenFull, reduce }) {
  const { project: p, entry } = item
  const lane = laneMeta(entry.lane)
  const stage = stageMeta(projectStage(p))
  const cell = dayCell(entry)
  const lc = normalizeLifecycle(p)
  const stores = storesSummary(p)
  const badges = upsellBadges(p, entry.lane)
  const pmU = p.assignments?.pm ? team.find((u) => u.id === p.assignments.pm.userId) : null
  const devU = p.assignments?.dev ? team.find((u) => u.id === p.assignments.dev.userId) : null
  const path = LANE_PATH[entry.lane] || [entry.lane]
  const idx = list.findIndex((it) => it.project.id === p.id)
  const prio = PRIO[p.priority || 'normal'] || PRIO.normal
  const meter = entry.limit && entry.days != null ? Math.max(0.03, Math.min(1, (entry.remaining != null ? entry.limit - entry.remaining : entry.days) / entry.limit)) : null
  const links = [
    p.productionUrl && { href: p.productionUrl, label: 'Producción', Ico: I2.globe },
    p.testingUrl && p.testingUrl !== p.productionUrl && { href: p.testingUrl, label: 'Testing', Ico: I2.ext },
    p.whatsappUrl && { href: p.whatsappUrl, label: 'WhatsApp', Ico: I2.whatsapp },
  ].filter(Boolean)
  const desc = String(p.description || p.summary || '').trim()

  return (
    <>
      <div className="io-sh">
        <div className="io-sh-top">
          {onBack && <button type="button" className="io-ib" onClick={onBack} aria-label="Volver a la sala"><I2.chevR width={15} height={15} style={{ transform: 'rotate(180deg)' }} /></button>}
          <span className="sp" />
          {list.length > 1 && <>
            <span className="io-pos">{idx + 1}/{list.length}</span>
            <button type="button" className="io-ib" onClick={() => onNav(-1)} disabled={idx <= 0} aria-label="Proyecto anterior de la sala"><I2.chevR width={15} height={15} style={{ transform: 'rotate(180deg)' }} /></button>
            <button type="button" className="io-ib" onClick={() => onNav(1)} disabled={idx >= list.length - 1} aria-label="Proyecto siguiente de la sala"><I2.chevR width={15} height={15} /></button>
          </>}
          <button type="button" className="io-ib" data-close="" onClick={() => onNav(0)} aria-label="Cerrar ficha"><I2.x width={15} height={15} /></button>
        </div>
        <div className="io-id">
          <span className="io-av">{initials(client?.company || p.name)}</span>
          <div style={{ minWidth: 0 }}>
            <h2>{p.name}</h2>
            <div className="cl">{client ? [client.company, client.name].filter(Boolean).join(' · ') : 'Sin cliente cargado'}</div>
          </div>
        </div>
        <div className="io-pills">
          <span className="io-pill"><i />{lane.label}</span>
          {stage.label !== lane.label && <span className="io-pill" style={{ '--pc': `var(${stage.colorVar})` }}><i />{stage.label}</span>}
          {stores.phase !== 'none' && <span className="io-pill" style={{ '--pc': stores.phase === 'tramite' ? 'var(--yellow)' : 'var(--green)' }}><i />{stores.phase === 'tramite' ? 'En tiendas' : 'Publicada'}</span>}
          {badges.map((b) => <span key={b.offer} className="io-pill" style={{ '--pc': b.status === 'acepta' ? 'var(--green)' : 'var(--violet)' }}><i />{b.label}</span>)}
        </div>
      </div>

      <div className="io-sb">
        <div className="io-sec">
          <div className="io-hero">
            <div>
              <div className="io-big"><b data-lv={cell.lv || undefined}>{cell.n}</b><span>{cell.cap}</span></div>
              <div className="cap">{daysText(entry)}{entry.since ? `, desde el ${fmtDay(entry.since)}` : ''}</div>
              {meter != null && <div className="io-meter"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: meter }} transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }} /></div>}
            </div>
            <Ring pct={entry.pct ?? 0} reduce={reduce} />
          </div>
        </div>

        <div className="io-sec">
          <div className="io-k">Recorrido</div>
          <div className="io-path">
            {path.map((k, i) => {
              const m = laneMeta(k)
              const st = i < path.length - 1 ? 'done' : 'now'
              return (
                <div key={k} className="io-step" data-st={st} style={{ '--sc': `var(${m.colorVar})` }}>
                  <span className="d">{st === 'done' && <I2.check width={10} height={10} />}</span>
                  {m.label}
                </div>
              )
            })}
          </div>
        </div>

        {entry.alerts.length > 0 && (
          <div className="io-sec">
            <div className="io-k">Para mirar</div>
            <div className="io-alerts">
              {entry.alerts.map((a) => <div key={a.key} className="io-alert" style={{ '--ac': a.level === 'crit' ? 'var(--red)' : 'var(--yellow)' }}>{a.text}</div>)}
            </div>
          </div>
        )}

        {desc && (
          <div className="io-sec"><div className="io-k">De qué se trata</div><div className="io-desc">{desc.length > 420 ? `${desc.slice(0, 420)}…` : desc}</div></div>
        )}

        <div className="io-sec">
          <div className="io-k">Equipo</div>
          <div className="io-team">
            <Member user={pmU} role={p.assignments?.pm?.roleLabel || 'Project Manager'} />
            <Member user={devU} role={p.assignments?.dev?.roleLabel || 'Developer'} />
          </div>
        </div>

        {stores.any && (
          <div className="io-sec">
            <div className="io-k">Tiendas</div>
            {stores.active.map((s) => <div key={s.key} className="io-store"><b style={{ fontWeight: 600 }}>{s.label}</b><span data-st={s.status}>{storeShortLine(s)}</span></div>)}
          </div>
        )}

        <div className="io-sec">
          <div className="io-k">Datos</div>
          <dl className="io-dl">
            <dt>Arrancó</dt><dd>{lc.startedAt && projectStage(p) !== 'onboarding' ? fmtDay(lc.startedAt) : '—'}</dd>
            <dt>Etapa</dt><dd>{stage.label}</dd>
            <dt>Prioridad</dt><dd><span style={{ color: prio.c, fontWeight: 600 }}>{prio.label}</span></dd>
            {(p.tags || []).length > 0 && <>
              <dt>Etiquetas</dt>
              <dd><div className="io-tags">{p.tags.map((t) => <span key={t.id || t.text} className="io-tag" style={{ color: t.color, background: `${t.color}22` }}>{t.text}</span>)}</div></dd>
            </>}
          </dl>
        </div>

        {links.length > 0 && (
          <div className="io-sec">
            <div className="io-k">Accesos</div>
            <div className="io-links">
              {links.map((l) => <a key={l.label} className="io-lk" href={l.href} target="_blank" rel="noreferrer"><l.Ico width={14} height={14} />{l.label}</a>)}
            </div>
          </div>
        )}
      </div>

      <div className="io-foot">
        <button type="button" className="io-cta" onClick={onOpenFull}>Abrir el proyecto completo<I2.chevR width={14} height={14} /></button>
      </div>
    </>
  )
}

function RoomSheet({ lane, items, onPick, onClose }) {
  const meta = laneMeta(lane)
  const avg = laneAverage(items)
  return (
    <>
      <div className="io-sh">
        <div className="io-sh-top"><span className="sp" /><button type="button" className="io-ib" data-close="" onClick={onClose} aria-label="Cerrar"><I2.x width={15} height={15} /></button></div>
        <div className="io-id" style={{ display: 'block' }}>
          <div className="io-k" style={{ marginBottom: 6 }}>Sala</div>
          <h2>{meta.label}</h2>
          <div className="cl">{plural(items.length, 'proyecto', 'proyectos')}{avg != null && items.length ? ` · ${avg} días en promedio` : ''}</div>
        </div>
      </div>
      <div className="io-sb">
        {items.length === 0 ? <div className="io-none">No hay ningún proyecto en esta sala ahora.</div> : (
          <div className="io-rows" style={{ paddingTop: 10 }}>
            {items.map((it) => {
              const cell = dayCell(it.entry)
              return (
                <button key={it.project.id} type="button" className="io-row" onClick={() => onPick(it.project.id)}>
                  <span className="io-av">{it.mark}{it.level && <i className="io-al" data-lv={it.level} />}</span>
                  <span className="t"><b>{it.project.name}</b><span>{it.client?.company || 'Sin cliente'}</span></span>
                  <span className="n" data-lv={cell.lv || undefined}>{cell.n} <small style={{ fontSize: 10.5, fontWeight: 500 }}>{cell.cap}</small></span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function Sheet({ open, lane, children, onClose }) {
  const reduce = useReducedMotion()
  const ref = useRef(null)
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width:720px)').matches
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const t = setTimeout(() => ref.current?.querySelector('[data-close]')?.focus({ preventScroll: true }), 60)
    return () => { clearTimeout(t); if (prev && prev.focus) prev.focus({ preventScroll: true }) }
  }, [open])
  return createPortal(
    <AnimatePresence>
      {open && <>
        <motion.div key="scrim" className="io-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
        <motion.aside key="sheet" ref={ref} className="io-sheet" role="dialog" aria-modal="true" style={{ '--lc': `var(${laneMeta(lane).colorVar})` }}
          initial={reduce ? { opacity: 0 } : narrow ? { opacity: 0, y: 60 } : { opacity: 0, x: 40, scale: 0.98 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : narrow ? { opacity: 0, y: 50 } : { opacity: 0, x: 30, scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
          <div className="io-core">{children}</div>
        </motion.aside>
      </>}
    </AnimatePresence>,
    document.body,
  )
}

/* ─── Vista ───────────────────────────────────────────────────────────────── */

export default function InsightsView({ onOpenProject }) {
  const { data, plans, myId } = useApp()
  const reduce = useReducedMotion()
  const [search, setSearch] = useState('')
  const [hover, setHover] = useState(null)
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [booted, setBooted] = useState(false)
  const [scale, setScale] = useState(1)
  const stageRef = useRef(null)
  const now = useMemo(() => new Date(), [])
  const thresholds = useMemo(readThresholds, [])

  useEffect(() => { const t = setTimeout(() => setBooted(true), 1800); return () => clearTimeout(t) }, [])
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => {
      const availH = Math.max(440, window.innerHeight - el.getBoundingClientRect().top - 56)
      setScale(Math.max(MIN_SCALE, Math.min(1.18, (el.clientWidth - 8) / B.w, availH / B.h)))
    }
    fit()
    requestAnimationFrame(() => { if (el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) * 0.42 })
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [])

  const me = useMemo(() => (data.team || []).find((u) => u.id === myId) || null, [data.team, myId])
  const universe = useMemo(() => visibleProjects(data.projects || [], me), [data.projects, me])
  const clientMap = useMemo(() => new Map((data.clients || []).map((c) => [c.id, c])), [data.clients])
  const planById = useMemo(() => new Map((plans || []).map((pl) => [pl.id, pl])), [plans])
  const ctx = useMemo(() => {
    const planOf = (p) => (p.planId ? planById.get(p.planId) || null : null)
    return {
      planTotal: (p) => (p.planId && !planById.has(p.planId) ? undefined : planBoardSummary(planOf(p)).total),
      pct: (p) => projectProgress(p, planOf(p)),
    }
  }, [planById])
  const board = useMemo(() => journeyBoard(universe, ctx, now, thresholds), [universe, ctx, now, thresholds])

  const lanes = useMemo(() => {
    const out = {}
    for (const r of ROOMS) {
      out[r.lane] = (board.lanes[r.lane] || []).map((it) => {
        const client = clientMap.get(it.project.clientId) || null
        const lv = it.entry.alerts.some((a) => a.level === 'crit') ? 'crit' : it.entry.alerts.length ? 'warn' : null
        return { ...it, client, level: lv, mark: initials(client?.company || it.project.name) }
      })
    }
    return out
  }, [board, clientMap])
  const byId = useMemo(() => {
    const m = new Map()
    for (const k of Object.keys(lanes)) for (const it of lanes[k]) m.set(it.project.id, it)
    return m
  }, [lanes])

  const q = search.trim().toLowerCase()
  const hits = useMemo(() => {
    if (!q && !onlyAlerts) return null
    const s = new Set()
    for (const it of byId.values()) {
      const hay = [it.project.name, it.client?.company, it.client?.name].filter(Boolean).join(' ').toLowerCase()
      if ((!q || hay.includes(q)) && (!onlyAlerts || it.level)) s.add(it.project.id)
    }
    return s
  }, [q, onlyAlerts, byId])

  const tokens = useMemo(() => {
    const out = []
    let order = 0
    for (const r of ROOMS) {
      let list = lanes[r.lane]
      if (hits) list = [...list].sort((a, b) => Number(hits.has(b.project.id)) - Number(hits.has(a.project.id)))
      const over = list.length > SLOTS_PER_ROOM
      const shown = over ? list.slice(0, SLOTS_PER_ROOM - 1) : list
      shown.forEach((it, i) => out.push({ key: it.project.id, item: it, pos: slotPos(r, i), order: order++, lane: r.lane }))
      if (over) out.push({ key: `more-${r.lane}`, item: { project: { id: `more-${r.lane}`, name: '' }, entry: { lane: r.lane, alerts: [] }, more: list.length - shown.length }, pos: slotPos(r, SLOTS_PER_ROOM - 1), order: order++, lane: r.lane })
    }
    return out
  }, [lanes, hits])

  const count = (keys) => keys.reduce((n, k) => n + (lanes[k]?.length || 0), 0)
  const critCount = useMemo(() => [...byId.values()].filter((it) => it.level).length, [byId])
  const roomAlert = (lane) => (lanes[lane].some((it) => it.level === 'crit') ? 'crit' : lanes[lane].some((it) => it.level) ? 'warn' : null)

  const selItem = sheet?.kind === 'project' ? byId.get(sheet.id) : null
  const sheetLane = sheet?.kind === 'room' ? sheet.lane : selItem?.entry.lane
  const close = useCallback(() => setSheet(null), [])
  const openProject = useCallback((id) => setSheet((s) => ({ kind: 'project', id, from: s?.kind === 'room' ? s.lane : s?.from || null })), [])
  const nav = useCallback((d) => {
    if (d === 0) { setSheet(null); return }
    setSheet((s) => {
      const it = s && byId.get(s.id)
      if (!it) return s
      const list = lanes[it.entry.lane]
      const i = list.findIndex((x) => x.project.id === s.id) + d
      return list[i] ? { ...s, id: list[i].project.id } : s
    })
  }, [byId, lanes])

  useEffect(() => {
    if (!sheet) return
    const h = (e) => {
      if (e.key === 'Escape') setSheet(null)
      else if (sheet.kind === 'project' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/input|textarea/i.test(e.target.tagName)) nav(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [sheet, nav])

  useEffect(() => { if (sheet?.kind === 'project' && !byId.has(sheet.id)) setSheet(null) }, [sheet, byId])

  const focusLane = hover || sheetLane || null
  const empty = board.total === 0

  return (
    <div className="io">
      <style>{CSS}</style>
      <div className="io-head">
        <div className="io-title"><h1>INSIGHTS</h1><span className="io-live"><i />En vivo</span></div>
        <div className="io-tools">
          <span className="io-kpi"><b>{board.total}</b>proyectos</span>
          <span className="io-kpi"><span className="dt" style={{ background: 'var(--accent)' }} /><b>{count(OBRA)}</b>en obra</span>
          <span className="io-kpi"><span className="dt" style={{ background: 'var(--green)' }} /><b>{count(MANT)}</b>en mantenimiento</span>
          <button type="button" className="io-kpi" data-tone={critCount ? 'crit' : undefined} aria-pressed={onlyAlerts} onClick={() => setOnlyAlerts((v) => !v)} disabled={!critCount && !onlyAlerts}
            title={onlyAlerts ? 'Mostrar todos' : 'Resaltar los que piden atención'}>
            <b>{critCount}</b>{critCount === 1 ? 'pide atención' : 'piden atención'}
          </button>
          <label className="io-search">
            <I2.search width={15} height={15} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar proyecto o cliente" aria-label="Buscar proyecto o cliente" />
          </label>
        </div>
      </div>

      <div className="io-stage" ref={stageRef}>
        <div className="io-scaler" style={{ width: B.w * scale, height: B.h * scale }}>
          <div className="io-scene" style={{ width: B.w, height: B.h, transform: `scale(${scale})` }} data-focus={focusLane ? '' : undefined}>
            <svg className="io-svg" width={B.w} height={B.h} viewBox={`${-B.dx} ${-B.dy} ${B.w} ${B.h}`} aria-hidden={false}>
              <defs>
                <linearGradient id="ioScan" x1="0" x2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".07" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g>
                {LINKS.map(([a, b]) => {
                  const c = corridor(a, b)
                  return (
                    <g key={`${a}-${b}`}>
                      <polygon className="io-cor" points={c.floor} />
                      <line className="io-flow" x1={c.from.X} y1={c.from.Y} x2={c.to.X} y2={c.to.Y} />
                    </g>
                  )
                })}
              </g>
              {ROOMS.map((r, i) => (
                <motion.g key={r.lane} initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 + i * 0.06 }}>
                  <Room room={r} items={lanes[r.lane]} alertLv={roomAlert(r.lane)} focus={focusLane}
                    onOpen={(lane) => setSheet({ kind: 'room', lane })} onHover={setHover} />
                </motion.g>
              ))}
            </svg>
            <div style={{ position: 'absolute', left: B.dx, top: B.dy }}>
              {tokens.map((t) => {
                const it = t.item
                const label = it.more ? `Ver los ${it.more} proyectos más de ${laneMeta(t.lane).label}` : `${it.project.name}${it.client?.company ? `, de ${it.client.company}` : ''}. ${laneMeta(t.lane).label}, ${daysText(it.entry)}${it.level ? '. Pide atención' : ''}`
                const dim = (hits && !it.more && !hits.has(it.project.id)) || (!hits && focusLane && focusLane !== t.lane && !(sheet?.kind === 'project'))
                return (
                  <Token key={t.key} item={it} pos={t.pos} order={t.order} booted={booted} reduce={reduce} label={label}
                    state={{ dim, sel: sheet?.kind === 'project' && sheet.id === it.project.id, hit: !!(hits && q && hits.has(it.project.id)) }}
                    onOpen={() => (it.more ? setSheet({ kind: 'room', lane: t.lane }) : openProject(it.project.id))} />
                )
              })}
            </div>
          </div>
        </div>
        {empty && <div className="io-empty">Todavía no hay proyectos de clientes para mostrar.</div>}
      </div>

      <div className="io-legend">
        <span><i style={{ background: 'var(--red)' }} />Pasó un límite</span>
        <span><i style={{ background: 'var(--yellow)' }} />Conviene mirarlo</span>
        <span>Cada sala es un tramo del recorrido: cuando un proyecto cambia de etapa, camina solo a la sala nueva. Tocá uno para ver su ficha, o una sala para ver quiénes están.</span>
      </div>

      <Sheet open={!!sheet && (sheet.kind === 'room' || !!selItem)} lane={sheetLane || 'mvp'} onClose={close}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={sheet ? `${sheet.kind}-${sheet.id || sheet.lane}` : 'none'} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            {sheet?.kind === 'room' && <RoomSheet lane={sheet.lane} items={lanes[sheet.lane] || []} onPick={openProject} onClose={close} />}
            {selItem && (
              <ProjectSheet item={selItem} client={selItem.client} team={data.team || []} list={lanes[selItem.entry.lane]} reduce={reduce}
                onNav={nav} onBack={sheet.from ? () => setSheet({ kind: 'room', lane: sheet.from }) : null}
                onOpenFull={() => { setSheet(null); onOpenProject(selItem.project.id) }} />
            )}
          </motion.div>
        </AnimatePresence>
      </Sheet>
    </div>
  )
}
