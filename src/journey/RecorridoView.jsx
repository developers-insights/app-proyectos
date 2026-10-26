import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, Modal, stagger, rise } from '../ui.jsx'
import { I2 } from '../ui/icons2.jsx'
import {
  JOURNEY_LANES, THRESHOLD_FIELDS, DEFAULT_THRESHOLDS, normalizeThresholds, journeyBoard, alertLevel,
  laneMeta, upsellState, upsellLine, offerLabel, upsellStatusMeta, UPSELL_OFFERS, UPSELL_STATUS,
  addUpsellEntry, removeUpsellEntry, setUpsellObjections,
  upsellBadges, fase2Offered, capLane, LANE_CAP, standbyNote, setStandbyNote, STANDBY_NOTE_MAX,
} from '../lib/journey.js'
import { daysBetween } from '../lib/lifecycle.js'
import { planBoardSummary } from '../plan/planModel.js'
import { projectProgress } from '../lib/progress.js'
import { toDateInput, fromDateInput, fmtDay } from '../lib/stores.js'

const JR_CSS = `
.jr-wrap{container-type:inline-size}
.jr-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.jr-sum{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-right:auto}
.jr-bar .pj-search{flex:0 1 300px;min-width:220px;max-width:100%}
.jr-kpi{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;font-size:12.5px;font-weight:600;
  color:var(--text-dim);background:var(--card);box-shadow:inset 0 0 0 1px var(--border);
  transition:box-shadow .24s var(--e),color .24s var(--e),transform .18s var(--e)}
.jr-kpi b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:14px;color:var(--text);letter-spacing:-.02em}
button.jr-kpi:hover{color:var(--text);box-shadow:inset 0 0 0 1px var(--border-strong)}
button.jr-kpi:active{transform:scale(.97)}
.jr-kpi[data-tone="crit"] b{color:var(--red)}
.jr-kpi[data-tone="offer"] b{color:var(--accent)}
.jr-kpi .dt{width:6px;height:6px;border-radius:50%;align-self:center}

.jr-map{--jr-pad:10px;--jr-sh:38px;--jr-gap:56px;position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:14px;padding-left:30px}
.jr-fork{display:contents}
.jr-st{--lc:var(--accent);position:relative;z-index:1;padding:var(--jr-pad);border-radius:16px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.jr-sh{position:relative;display:flex;align-items:center;gap:10px;height:var(--jr-sh);padding:0 2px 0 0}
.jr-node{position:relative;z-index:2;width:11px;height:11px;border-radius:50%;flex:none;background:var(--card);
  box-shadow:inset 0 0 0 3px var(--lc),0 0 0 4px color-mix(in srgb,var(--lc) 14%,transparent)}
.jr-node::before{content:"";position:absolute;right:calc(100% + 5px);top:50%;margin-top:-4px;
  border-left:6px solid var(--border-strong);border-top:4px solid transparent;border-bottom:4px solid transparent}
.jr-map > .jr-st:first-child .jr-node::before{display:none}
.jr-st[data-n="0"] .jr-node{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--lc) 55%,transparent)}
.jr-sh .tx{flex:1;min-width:0}
.jr-sh .lb{font-size:13px;font-weight:650;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-sh .ct{flex:none;display:flex;align-items:center;line-height:1}
.jr-sh .ct b{font-variant-numeric:tabular-nums lining-nums;font-feature-settings:'tnum','lnum';font-size:24px;font-weight:700;letter-spacing:-.05em;background:linear-gradient(180deg,var(--text) 35%,color-mix(in oklab,var(--text) 52%,transparent));-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:2px}
.jr-st[data-n="0"] .jr-sh .ct b{background:none;color:var(--text-faint);opacity:.55}

.jr-st::after,.jr-sh::before,.jr-sh::after{content:"";position:absolute;background:var(--border-strong);pointer-events:none}
.jr-st::after{left:-24px;top:calc(var(--jr-pad) + var(--jr-sh) / 2);bottom:-14px;width:2px}
.jr-st:last-child::after,.jr-fork .jr-st:last-child::after{display:none}
.jr-sh::after{left:calc(-24px - var(--jr-pad));top:calc(var(--jr-sh) / 2 - 1px);width:calc(24px + var(--jr-pad));height:2px}
.jr-sh::before{display:none}
.jr-forkl{position:relative;display:flex;align-items:center;gap:8px;padding:2px 0 0;font-size:11.5px;font-weight:600;color:var(--text-faint)}
.jr-forkl::before{content:"";position:absolute;left:-24px;top:-14px;bottom:-14px;width:2px;background:var(--border-strong)}

.jr-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:2px;margin-top:4px}
.jr-pw{display:flex;flex-direction:column;min-width:0}
.jr-pw[data-in]{animation:jrIn .28s var(--e) both}
@keyframes jrIn{from{opacity:0;transform:translateY(-3px)}}
.jr-pt{position:relative;display:flex;align-items:center;gap:8px;width:100%;min-height:40px;padding:5px 7px 7px;border-radius:10px;text-align:left;
  transition:background .2s var(--e)}
.jr-pt:hover{background:var(--card-hover)}
.jr-pt:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.jr-pt:active .jr-mk{transform:scale(.94)}
.jr-mk{position:relative;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;flex:none;
  font-size:10px;font-weight:700;letter-spacing:.02em;color:var(--lc);
  background:color-mix(in srgb,var(--lc) 13%,var(--card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--lc) 30%,transparent);
  transition:transform .18s var(--e)}
.jr-mk[data-lv]::after{content:"";position:absolute;right:-2px;top:-2px;width:9px;height:9px;border-radius:50%;
  box-shadow:0 0 0 2px var(--card)}
.jr-mk[data-lv="crit"]::after{background:var(--red)}
.jr-mk[data-lv="warn"]::after{background:var(--yellow)}
.jr-pt .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.jr-pt .nm{display:flex;align-items:center;gap:5px;min-width:0;font-size:12px;font-weight:600;letter-spacing:-.012em}
.jr-pt .nm .t{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-chip{--cc:var(--accent);flex:none;display:inline-flex;align-items:center;height:16px;padding:0 6px;border-radius:999px;font-size:9.5px;font-weight:650;letter-spacing:.01em;
  color:var(--cc);background:color-mix(in srgb,var(--cc) 11%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc) 32%,transparent)}
.jr-chip[data-o="fase2"]{--cc:var(--violet)}
.jr-chip[data-o="plan"]{--cc:var(--green)}
.jr-chip[data-s="acepta"]{background:color-mix(in srgb,var(--cc) 20%,transparent)}
.jr-pt .jr-sub{font-size:10.5px;color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-pt .jr-sub[data-lv="crit"]{color:var(--red)}
.jr-pt .jr-sub[data-lv="warn"]{color:var(--yellow)}
.jr-pt .jr-sub[data-up]{color:var(--text-dim)}
.jr-d{display:flex;flex-direction:column;align-items:flex-end;flex:none;line-height:1}
.jr-d b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:13px;font-weight:600;letter-spacing:-.03em}
.jr-d b[data-lv="crit"]{color:var(--red)}
.jr-d b[data-lv="warn"]{color:var(--yellow)}
.jr-d span{margin-top:3px;font-size:9.5px;color:var(--text-faint)}
.jr-meter{position:absolute;left:41px;right:7px;bottom:2px;height:2px;border-radius:2px;background:var(--track);overflow:hidden}
.jr-meter i{position:absolute;inset:0;transform-origin:left center;background:var(--lc);opacity:.75;
  animation:jrGrow .9s var(--e) both}
.jr-meter i[data-lv="crit"]{background:var(--red);opacity:1}
.jr-meter i[data-lv="warn"]{background:var(--yellow);opacity:1}
@keyframes jrGrow{from{transform:scaleX(0)}}
.jr-empty{display:flex;align-items:center;justify-content:center;min-height:40px;margin-top:4px;border-radius:10px;font-size:11.5px;
  color:var(--text-faint);box-shadow:inset 0 0 0 1px var(--border);background:repeating-linear-gradient(-45deg,transparent 0 7px,var(--track) 7px 8px)}

.jr-why{display:flex;align-items:center;gap:4px;min-height:24px;margin:-3px 0 4px;padding:0 7px 0 41px;font-size:11px;color:var(--text-dim);line-height:1.35}
.jr-why .t{min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jr-why .t::before{content:"Motivo: ";color:var(--text-faint)}
.jr-why-b{flex:none;display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 6px;border-radius:7px;font-size:11px;font-weight:600;color:var(--text-faint);
  transition:color .18s var(--e),background .18s var(--e)}
.jr-why-b:hover{color:var(--text);background:var(--card-hover)}
.jr-why-b:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.jr-why input{flex:1;min-width:0;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-elevated);color:var(--text);font-size:12px}
.jr-why input:focus{outline:2px solid var(--yellow);outline-offset:0}

.jr-more{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;height:28px;margin-top:4px;border-radius:9px;font-size:11.5px;font-weight:600;color:var(--text-dim);
  box-shadow:inset 0 0 0 1px var(--border);transition:color .18s var(--e),box-shadow .18s var(--e),background .18s var(--e)}
.jr-more:hover{color:var(--text);background:var(--card-hover);box-shadow:inset 0 0 0 1px var(--border-strong)}
.jr-more:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.jr-more svg{transition:transform .22s var(--e)}
.jr-more[aria-expanded="true"] svg{transform:rotate(180deg)}

.jr-arc{position:absolute;left:0;top:0;z-index:0;overflow:visible;pointer-events:none;animation:jrFade .6s .25s var(--e) both}
@keyframes jrFade{from{opacity:0}}
.jr-arc path{fill:none;stroke:var(--violet);stroke-width:2;stroke-linecap:round;stroke-dasharray:0 7;opacity:.8}
.jr-arc circle{fill:var(--violet)}
.jr-arcw{position:absolute;z-index:5;transform:translate(-50%,-50%)}
.jr-f2b{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border-radius:999px;white-space:nowrap;font-size:12px;font-weight:600;color:var(--text);
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--violet-line),var(--shadow);transition:box-shadow .2s var(--e),transform .16s var(--e)}
.jr-f2b b{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums;font-size:13px;color:var(--violet)}
.jr-f2b:hover{box-shadow:inset 0 0 0 1.5px var(--violet),var(--shadow)}
.jr-f2b:active{transform:scale(.97)}
.jr-f2b:focus-visible{outline:2px solid var(--violet);outline-offset:2px}
.jr-f2b svg{color:var(--text-faint);transition:transform .22s var(--e)}
.jr-f2b[aria-expanded="true"] svg{transform:rotate(180deg)}
.jr-arcw .jr-pop{left:calc(50% - 170px);right:auto;width:340px;transform-origin:top center}
.jr-f2row{display:none;position:relative;margin:0 0 14px}
.jr-f2row .jr-f2b{width:100%;justify-content:flex-start;height:36px;border-radius:12px}
.jr-f2row .jr-f2b svg{margin-left:auto}
.jr-f2row .jr-pop{left:0;right:auto;transform-origin:top left}
.jr-f2l{display:flex;flex-direction:column;margin:0 -6px;max-height:min(360px,60vh);overflow:auto}
.jr-f2i{display:flex;align-items:center;gap:9px;padding:8px 6px;border-radius:10px;text-align:left;transition:background .18s var(--e)}
.jr-f2i:hover{background:var(--card-hover)}
.jr-f2i:focus-visible{outline:2px solid var(--violet);outline-offset:-2px}
.jr-f2i .tx{flex:1;min-width:0}
.jr-f2i .nm{font-size:13px;font-weight:600;letter-spacing:-.012em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-f2i .mt{margin-top:2px;font-size:11px;color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.jr-low{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;margin-top:22px}
.jr-panel{padding:16px 14px 10px;border-radius:18px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border),var(--shadow)}
.jr-ph{display:flex;align-items:baseline;gap:10px;padding:0 4px 10px}
.jr-ph h2{font-size:16px;letter-spacing:-.02em}
.jr-ph .n{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-faint)}
.jr-ph .sub{margin-left:auto;font-size:11.5px;color:var(--text-faint);text-align:right}
.jr-li{display:flex;align-items:center;gap:10px;padding:9px 6px;border-top:1px solid var(--border)}
.jr-li:first-of-type{border-top:none}
.jr-li[data-off="1"]{opacity:.62}
.jr-li .go{flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left;border-radius:10px;padding:2px}
.jr-li .go:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.jr-li .go:hover .nm{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--border-strong)}
.jr-li .tx{flex:1;min-width:0}
.jr-li .nm{font-size:13.5px;font-weight:600;letter-spacing:-.012em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jr-li .rs{margin-top:2px;font-size:12px;color:var(--text-dim);line-height:1.4}
.jr-li .up{margin-top:3px;font-size:11.5px;color:var(--text-faint);line-height:1.4}
.jr-li .up q{quotes:"“" "”";color:var(--text-dim)}
.jr-ln{display:inline-flex;align-items:center;gap:5px;flex:none;height:22px;padding:0 8px;border-radius:999px;font-size:11px;font-weight:600;
  color:var(--text-dim);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.jr-ln i{width:6px;height:6px;border-radius:50%;background:var(--lc)}
.jr-act{flex:none;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:10px;font-size:12.5px;font-weight:600;
  color:var(--text);background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);
  transition:box-shadow .2s var(--e),transform .16s var(--e)}
.jr-act:hover{box-shadow:inset 0 0 0 1px var(--accent-line)}
.jr-act:active{transform:scale(.96)}
.jr-act:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.jr-lv{width:8px;height:8px;border-radius:50%;flex:none}
.jr-none{padding:18px 6px 14px;font-size:12.5px;color:var(--text-faint);line-height:1.5}
.jr-out{margin-top:14px;font-size:12px;color:var(--text-faint);line-height:1.6}
.jr-out button{color:var(--text-dim);text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--border-strong)}
.jr-out button:hover{color:var(--text)}

.jr-pop{position:absolute;right:0;top:calc(100% + 8px);z-index:30;width:min(340px,calc(100vw - 32px));padding:14px;border-radius:16px;
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border-strong),var(--shadow-lift);transform-origin:top right}
.jr-pop h3{font-size:14px;letter-spacing:-.015em}
.jr-pop p{margin:4px 0 10px;font-size:11.5px;color:var(--text-faint);line-height:1.45}
.jr-th{display:grid;grid-template-columns:minmax(0,1fr) 84px;align-items:center;gap:4px 10px;padding:7px 0;border-top:1px solid var(--border)}
.jr-th label{font-size:12.5px;font-weight:600}
.jr-th small{grid-column:1;font-size:11px;color:var(--text-faint);line-height:1.35}
.jr-th .nf{grid-row:1 / span 2;grid-column:2;display:flex;align-items:center;gap:6px}
.jr-th input{width:58px;height:34px;padding:0 8px;border-radius:9px;border:1px solid var(--border);background:var(--card);color:var(--text);
  font-family:'JetBrains Mono',monospace;font-size:13px;text-align:right}
.jr-th input:focus{outline:2px solid var(--accent);outline-offset:1px}
.jr-th span{font-size:11px;color:var(--text-faint)}

.jr-skel{height:220px;border-radius:18px;background:var(--card);box-shadow:inset 0 0 0 1px var(--border);position:relative;overflow:hidden}
.jr-skel::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--card-hover),transparent);
  background-size:600px 100%;animation:shimmer 1.5s infinite linear}
.jr-err{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:22px;border-radius:18px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--border)}

@container (min-width: 900px){
  .jr-map{grid-template-columns:repeat(3,minmax(0,1fr)) minmax(0,1.22fr);column-gap:var(--jr-gap);row-gap:0;align-items:start;padding-left:0}
  .jr-map[data-arc]{padding-top:64px}
  .jr-fork{display:flex;flex-direction:column;gap:12px;padding-left:12px}
  .jr-forkl{display:none}
  .jr-st::after{display:none}
  .jr-sh::after{left:auto;right:calc(-2 * var(--jr-pad) - var(--jr-gap));width:calc(2 * var(--jr-pad) + var(--jr-gap))}
  .jr-map > .jr-st:nth-child(3) .jr-sh::after{right:calc(-1 * var(--jr-pad) - var(--jr-gap));width:calc(var(--jr-pad) + var(--jr-gap))}
  .jr-fork .jr-st .jr-sh::after{left:calc(-12px - var(--jr-pad));right:auto;width:calc(12px + var(--jr-pad))}
  .jr-fork .jr-st .jr-sh::before{display:block;left:calc(-12px - var(--jr-pad));top:-12px;height:calc(12px + var(--jr-sh) / 2);width:2px}
  .jr-fork .jr-st:not(:last-child)::after{display:block;left:-12px;bottom:-12px;width:2px}
  .jr-forkl + .jr-st .jr-sh::before{display:none}
  .jr-map > .jr-st:first-child .jr-sh::after{display:block}
  .jr-low{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
}
@container (max-width: 899px){
  .jr-map > .jr-st:first-child .jr-sh::after{display:none}
  .jr-f2row{display:block}
  .jr-arc,.jr-arcw{display:none}
}
@container (max-width: 520px){
  .jr-bar .pj-filt span{display:none}
  .jr-bar .pj-search{flex:1 1 0;min-width:0}
}
@container (max-width: 420px){
  .jr-map{padding-left:22px}
  .jr-st::after{left:-16px}
  .jr-sh::after{left:calc(-16px - var(--jr-pad));width:calc(16px + var(--jr-pad))}
  .jr-forkl::before{left:-16px}
  .jr-li{flex-wrap:wrap}
  .jr-li .jr-act{margin-left:40px}
}

.up-states{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.up-state{padding:12px 13px;border-radius:14px;background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border)}
.up-state .k{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.up-state .v{margin-top:6px;display:flex;align-items:center;gap:7px;font-size:14px;font-weight:650;letter-spacing:-.015em}
.up-state .v i{width:8px;height:8px;border-radius:50%}
.up-state .m{margin-top:4px;font-size:12px;color:var(--text-dim);line-height:1.45}
.up-seg{display:flex;flex-wrap:wrap;gap:6px}
.up-seg button{height:34px;padding:0 12px;border-radius:10px;font-size:12.5px;font-weight:600;color:var(--text-dim);
  background:var(--bg-elevated);box-shadow:inset 0 0 0 1px var(--border);transition:color .18s var(--e),box-shadow .18s var(--e),background .18s var(--e)}
.up-seg button:hover{color:var(--text)}
.up-seg button[aria-checked="true"]{color:var(--text);background:color-mix(in srgb,var(--sc,var(--accent)) 12%,var(--card));
  box-shadow:inset 0 0 0 1.5px var(--sc,var(--accent))}
.up-seg button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.up-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.up-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:4px 0 8px}
.up-h h4{font-size:13.5px;letter-spacing:-.01em}
.up-h span{font-size:11.5px;color:var(--text-faint)}
.up-hist{display:flex;flex-direction:column}
.up-row{display:flex;align-items:flex-start;gap:10px;padding:10px 2px;border-top:1px solid var(--border)}
.up-row:first-child{border-top:none}
.up-row .dt{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none}
.up-row .tx{flex:1;min-width:0;font-size:13px;line-height:1.45}
.up-row .mt{font-size:11.5px;color:var(--text-faint)}
.up-panel{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 16px;margin-bottom:26px;border-radius:16px;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--border)}
.up-panel .its{flex:1;min-width:0;display:flex;gap:18px;flex-wrap:wrap}
.up-panel .it{min-width:0}
.up-panel .it .k{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint)}
.up-panel .it .v{margin-top:3px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600}
.up-panel .it .v i{width:7px;height:7px;border-radius:50%}
.up-panel .ob{flex-basis:100%;font-size:12px;color:var(--text-dim);line-height:1.5}

@media (prefers-reduced-motion: reduce){
  .jr-meter i,.jr-skel::after,.jr-pw[data-in],.jr-arc{animation:none}
  .jr-more svg,.jr-f2b svg{transition:none}
  .jr-pt:active .jr-mk,.jr-act:active,button.jr-kpi:active,.jr-f2b:active{transform:none}
}
`

const TH_KEY = 'ip.recorrido.umbrales'

function readThresholds() {
  try { return normalizeThresholds(JSON.parse(localStorage.getItem(TH_KEY) || 'null')) } catch { return { ...DEFAULT_THRESHOLDS } }
}

function useThresholds() {
  const [t, setT] = useState(readThresholds)
  const save = (next) => {
    const v = normalizeThresholds(next)
    setT(v)
    try { localStorage.setItem(TH_KEY, JSON.stringify(v)) } catch { /* sin storage queda en memoria */ }
  }
  return [t, save]
}

const initials = (s) => {
  const w = String(s || '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  if (!w.length) return '·'
  return (w.length === 1 ? w[0].slice(0, 2) : w[0][0] + w[1][0]).toUpperCase()
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function dayCell(entry) {
  if (entry.lane === 'prueba' && entry.remaining != null) {
    if (entry.remaining < 0) return { n: `+${-entry.remaining}`, cap: 'vencida', lv: 'crit' }
    return { n: entry.remaining, cap: entry.remaining === 1 ? 'queda' : 'quedan', lv: entry.remaining <= 3 ? 'warn' : null }
  }
  if (entry.days == null) return { n: '—', cap: 'sin fecha', lv: null }
  const devAlert = entry.alerts.find((a) => a.key === 'dev' || a.key === 'standby')
  return { n: entry.days, cap: entry.days === 1 ? 'día' : 'días', lv: devAlert ? devAlert.level : null }
}

function meterOf(entry) {
  if (entry.days == null || !entry.limit) return null
  return Math.max(0.04, Math.min(1, entry.days / entry.limit))
}

function ClientMark({ text, level, size = 30 }) {
  return (
    <span className="jr-mk" data-lv={level || undefined} style={size !== 30 ? { width: size, height: size } : undefined} aria-hidden="true">
      {initials(text)}
    </span>
  )
}

function Point({ item, client, onOpen }) {
  const { project: p, entry } = item
  const lv = alertLevel(entry.alerts)
  const up = upsellState(p)
  const badges = upsellBadges(p, entry.lane)
  const lastUp = [up.plan, up.fase2].filter(Boolean).sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0] || null
  const cell = dayCell(entry)
  const m = meterOf(entry)
  const company = client?.company || client?.name || ''
  const lastUpShown = lastUp && !badges.some((b) => b.offer === lastUp.offer)
  const sub = entry.alerts[0]
    ? { text: entry.alerts[0].short || entry.alerts[0].text, lv: entry.alerts[0].level }
    : lastUpShown ? { text: upsellLine(lastUp), up: true } : { text: company || laneMeta(entry.lane).label }
  const label = [
    p.name, company && `cliente ${company}`, laneMeta(entry.lane).label,
    entry.lane === 'prueba' && entry.remaining != null
      ? (entry.remaining < 0 ? `prueba vencida hace ${plural(-entry.remaining, 'día', 'días')}` : `quedan ${plural(entry.remaining, 'día', 'días')}`)
      : entry.days != null ? `${plural(entry.days, 'día', 'días')} en este tramo` : 'sin fecha de entrada',
    ...entry.alerts.map((a) => a.text),
    ...badges.map((b) => upsellLine(b.entry)),
    lastUpShown && upsellLine(lastUp),
  ].filter(Boolean).join('. ')
  return (
    <button className="jr-pt" onClick={() => onOpen(p.id)} aria-label={`${label}. Abrir proyecto`} title={label}>
      <ClientMark text={company || p.name} level={lv} />
      <span className="tx">
        <span className="nm">
          <span className="t">{p.name}</span>
          {badges.map((b) => <span key={b.offer} className="jr-chip" data-o={b.offer} data-s={b.status} aria-hidden="true">{b.label}</span>)}
        </span>
        <span className="jr-sub" data-lv={sub.lv || undefined} data-up={sub.up ? '1' : undefined}>{sub.text}</span>
      </span>
      <span className="jr-d">
        <b data-lv={cell.lv || undefined}>{cell.n}</b>
        <span>{cell.cap}</span>
      </span>
      {m != null && (
        <span className="jr-meter" aria-hidden="true">
          <i data-lv={cell.lv || undefined} style={{ transform: `scaleX(${m})` }} />
        </span>
      )}
    </button>
  )
}

function StandbyWhy({ project, onSave }) {
  const note = standbyNote(project)
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(note)
  const input = useRef(null)
  const btn = useRef(null)
  const done = useRef(false)
  const refocus = useRef(false)

  useEffect(() => {
    if (edit) { done.current = false; input.current?.focus() }
    else if (refocus.current) { refocus.current = false; btn.current?.focus() }
  }, [edit])

  // Enter y Escape desmontan el input y algunos navegadores disparan blur igual: sin el candado se guardaría dos veces o se guardaría lo cancelado.
  const close = (save, back) => {
    if (done.current) return
    done.current = true
    if (save && v.trim() !== note) onSave(project.id, v)
    refocus.current = back
    setEdit(false)
  }

  if (edit) {
    return (
      <div className="jr-why">
        <input ref={input} value={v} maxLength={STANDBY_NOTE_MAX} placeholder="Ej.: espera presupuesto para seguir"
          aria-label={`Por qué ${project.name} está en stand-by`}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => close(true, false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); close(true, true) }
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false, true) }
          }} />
      </div>
    )
  }
  return (
    <div className="jr-why">
      {note && <span className="t" title={note}>{note}</span>}
      <button ref={btn} type="button" className="jr-why-b" onClick={() => { setV(note); setEdit(true) }}
        aria-label={note ? `Cambiar el motivo del stand-by de ${project.name}` : `Anotar por qué ${project.name} está en stand-by`}>
        {note ? <I2.pencil width={12} height={12} /> : <><I2.plus width={12} height={12} /> Anotar motivo</>}
      </button>
    </div>
  )
}

function Station({ lane, items, clientOf, onOpen, onSaveNote, innerRef }) {
  const [expanded, setExpanded] = useState(false)
  const { visible, hidden, collapsible } = capLane(items, expanded)
  const rowsId = `jr-rows-${lane.key}`
  return (
    <motion.section ref={innerRef} variants={rise} className="jr-st" data-n={items.length} style={{ '--lc': `var(${lane.colorVar})` }} aria-label={`${lane.label}: ${plural(items.length, 'cliente', 'clientes')}`}>
      <div className="jr-sh">
        <span className="jr-node" aria-hidden="true" />
        <span className="tx">
          <div className="lb">{lane.label}</div>
        </span>
        <span className="ct" aria-hidden="true">
          <b>{items.length}</b>
        </span>
      </div>
      {items.length === 0
        ? <div className="jr-empty">Nadie en este tramo</div>
        : (
          <div className="jr-rows" id={rowsId}>
            {visible.map((it, i) => (
              <div key={it.project.id} className="jr-pw" data-in={expanded && i >= LANE_CAP ? '1' : undefined}>
                <Point item={it} client={clientOf(it.project.clientId)} onOpen={onOpen} />
                {lane.key === 'standby' && <StandbyWhy project={it.project} onSave={onSaveNote} />}
              </div>
            ))}
          </div>
        )}
      {(hidden > 0 || collapsible) && (
        <button type="button" className="jr-more" aria-expanded={expanded} aria-controls={rowsId}
          aria-label={expanded ? `Ver menos en ${lane.label}` : `Ver ${plural(hidden, 'proyecto más', 'proyectos más')} en ${lane.label}`}
          onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Ver menos' : `Ver ${hidden} más`}
          <I2.chevD width={13} height={13} />
        </button>
      )}
    </motion.section>
  )
}

function useDismiss(open, close, wrap, trigger) {
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (wrap.current && !wrap.current.contains(e.target)) close(false) }
    const key = (e) => { if (e.key === 'Escape') { close(true); trigger.current?.focus() } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
}

function F2Popover({ items, clientOf, onOpen }) {
  const first = useRef(null)
  useEffect(() => { first.current?.focus() }, [])
  const now = new Date()
  return (
    <motion.div className="jr-pop" role="dialog" aria-labelledby="jr-f2-h"
      initial={{ opacity: 0, scale: 0.97, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <h3 id="jr-f2-h">Fase 2 ofrecida</h3>
      <p>Todavía están en otro tramo. Cuando acepten, pasalos a Fase 2.</p>
      <div className="jr-f2l">
        {items.map((x, i) => {
          const c = clientOf(x.project.clientId)
          const lm = laneMeta(x.lane)
          const d = x.entry.at ? daysBetween(x.entry.at, now) : null
          const when = d == null ? 'sin fecha' : d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`
          return (
            <button key={x.project.id} ref={i === 0 ? first : undefined} type="button" className="jr-f2i" style={{ '--lc': `var(${lm.colorVar})` }}
              onClick={() => onOpen(x.project.id)} aria-label={`Abrir ${x.project.name}. Está en ${lm.label}. Fase 2 ofrecida ${when}`}>
              <ClientMark text={c?.company || x.project.name} size={28} />
              <span className="tx">
                <div className="nm">{x.project.name}{c?.company && <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}> · {c.company}</span>}</div>
                <div className="mt">{lm.label} · ofrecida {when}{x.entry.note ? ` · ${x.entry.note}` : ''}</div>
              </span>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

function F2Trigger({ items, open, onToggle, btnRef }) {
  const n = items.length
  return (
    <button ref={btnRef} type="button" className="jr-f2b" aria-expanded={open} aria-haspopup="dialog" onClick={onToggle}
      aria-label={`${plural(n, 'proyecto', 'proyectos')} con la Fase 2 ofrecida. ${open ? 'Cerrar' : 'Ver'} la lista`}>
      <b>{n}</b> con Fase 2 ofrecida
      <I2.chevD width={13} height={13} />
    </button>
  )
}

/* El arco se mide con offsetLeft/offsetTop: no los mueve el transform de la entrada animada. */
function useArc(on, mapRef, fromRef, toRef, deps) {
  const [g, setG] = useState(null)
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!on || !map) { setG(null); return }
    const calc = () => {
      const a = fromRef.current, b = toRef.current
      if (!a || !b || b.offsetLeft < a.offsetLeft + a.offsetWidth) { setG(null); return }
      const x0 = a.offsetLeft + a.offsetWidth * 0.62, y0 = a.offsetTop
      const x2 = b.offsetLeft + b.offsetWidth * 0.3, y2 = b.offsetTop
      const apex = 22
      const cy = 2 * apex - (y0 + y2) / 2
      const cx = (x0 + x2) / 2
      setG({ w: map.clientWidth, h: map.clientHeight, d: `M${x0} ${y0} Q${cx} ${cy} ${x2} ${y2}`, x0, y0, x2, y2, mx: cx, my: apex })
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(map)
    return () => ro.disconnect()
  }, [on, ...deps])
  return g
}

function ThresholdsButton({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const btn = useRef(null)
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const changed = Object.keys(DEFAULT_THRESHOLDS).some((k) => value[k] !== DEFAULT_THRESHOLDS[k])
  return (
    <span ref={wrap} style={{ position: 'relative', display: 'inline-flex' }}>
      <button ref={btn} className="pj-filt" data-on={changed ? '1' : '0'} aria-label="Umbrales de las alertas" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
        <I2.gear width={15} height={15} />
        <span>Umbrales</span>
      </button>
      {open && (
        <motion.div className="jr-pop" role="dialog" aria-label="Umbrales de las alertas"
          initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
          <h3>Cuándo avisar</h3>
          <p>Se guarda en este navegador. Los valores de fábrica salen de la call del 23/10.</p>
          {THRESHOLD_FIELDS.map((f) => (
            <div key={f.key} className="jr-th">
              <label htmlFor={`th-${f.key}`}>{f.label}</label>
              <small>{f.hint}</small>
              <span className="nf">
                <input id={`th-${f.key}`} type="number" min="1" max="3650" inputMode="numeric" value={value[f.key]}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
                <span>{f.unit}</span>
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button className="pj-clear" onClick={() => onChange(DEFAULT_THRESHOLDS)} disabled={!changed} style={changed ? undefined : { opacity: 0.4, cursor: 'default' }}>Volver a los de fábrica</button>
            <button className="pj-clear" style={{ color: 'var(--text)' }} onClick={() => { setOpen(false); btn.current?.focus() }}>Listo</button>
          </div>
        </motion.div>
      )}
    </span>
  )
}

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.warn('Recorrido:', err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="jr-err" role="alert">
        <strong style={{ fontSize: 15 }}>No pudimos armar el recorrido</strong>
        <span style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5 }}>Algún proyecto tiene datos que no esperábamos. La grilla sigue funcionando mientras tanto.</span>
        <span style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn btn-sm" onClick={() => this.setState({ failed: false })}>Reintentar</button>
          {this.props.onBack && <button className="btn btn-sm btn-ghost" onClick={this.props.onBack}>Ir a la grilla</button>}
        </span>
      </div>
    )
  }
}

export default function RecorridoView(props) {
  return (
    <div className="jr-wrap">
      <style>{JR_CSS}</style>
      <Boundary onBack={props.onBack}><Recorrido {...props} /></Boundary>
    </div>
  )
}

function Recorrido({ onOpenProject, projects, loading }) {
  const { data, plans, projectStore } = useApp()
  const [thresholds, setThresholds] = useThresholds()
  const [search, setSearch] = useState('')
  const [upsellFor, setUpsellFor] = useState(null)
  const offersRef = useRef(null)
  const alertsRef = useRef(null)
  const now = useMemo(() => new Date(), [])

  const planById = useMemo(() => new Map((plans || []).map((pl) => [pl.id, pl])), [plans])
  const clientOf = (id) => (data.clients || []).find((c) => c.id === id)
  const q = search.trim().toLowerCase()
  const list = useMemo(() => (projects || []).filter((p) => {
    if (!q) return true
    const c = (data.clients || []).find((x) => x.id === p.clientId)
    return [p.name, c?.company, c?.name].filter(Boolean).join(' ').toLowerCase().includes(q)
  }), [projects, q, data.clients])

  const board = useMemo(() => {
    const planOf = (p) => (p.planId ? planById.get(p.planId) || null : null)
    const ctx = {
      planTotal: (p) => (p.planId && !planById.has(p.planId) ? undefined : planBoardSummary(planOf(p)).total),
      pct: (p) => projectProgress(p, planOf(p)),
    }
    return journeyBoard(list, ctx, now, thresholds)
  }, [list, planById, now, thresholds])

  const alerted = useMemo(() => {
    const m = new Map()
    for (const a of board.alerts) {
      if (!m.has(a.projectId)) m.set(a.projectId, { project: a.project, lane: a.lane, level: a.level, items: [] })
      m.get(a.projectId).items.push(a)
    }
    return [...m.values()]
  }, [board.alerts])
  const crit = alerted.filter((a) => a.level === 'crit').length
  const go = (ref) => ref.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const upsellProject = (data.projects || []).find((p) => p.id === upsellFor) || null
  const main = JOURNEY_LANES.filter((l) => !l.branch)
  // Fase 2 arriba de la bifurcación para que el arco desde MVP caiga en su borde superior y no cruce Plan mensual.
  const branches = JOURNEY_LANES.filter((l) => l.branch).sort((a, b) => (b.key === 'fase2') - (a.key === 'fase2'))

  const f2 = useMemo(() => fase2Offered(board), [board])
  const [f2Open, setF2Open] = useState(false)
  const mapRef = useRef(null)
  const mvpRef = useRef(null)
  const f2Ref = useRef(null)
  const arcWrap = useRef(null)
  const arcBtn = useRef(null)
  const rowWrap = useRef(null)
  const rowBtn = useRef(null)
  const laneSizes = JOURNEY_LANES.map((l) => board.lanes[l.key].length).join(',')
  const arc = useArc(f2.length > 0 && !loading, mapRef, mvpRef, f2Ref, [laneSizes, board.total])
  const closeF2 = () => setF2Open(false)
  useDismiss(f2Open, closeF2, arc ? arcWrap : rowWrap, arc ? arcBtn : rowBtn)
  useEffect(() => { if (!f2.length) setF2Open(false) }, [f2.length])
  const openFromF2 = (id) => { setF2Open(false); onOpenProject(id) }
  const saveNote = (id, text) => projectStore.patch(id, (p) => ({ ...p, ...setStandbyNote(p, text) }))
  const laneRef = (k) => (k === 'mvp' ? mvpRef : k === 'fase2' ? f2Ref : undefined)

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Cargando el recorrido">
        <div className="jr-map" aria-hidden="true" style={{ paddingLeft: 0 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="jr-skel" />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="jr-bar">
        <div className="jr-sum" aria-label="Resumen del recorrido">
          <span className="jr-kpi"><b>{board.total}</b> en el recorrido</span>
          {alerted.length > 0 && (
            <button className="jr-kpi" data-tone={crit ? 'crit' : undefined} onClick={() => go(alertsRef)}>
              <span className="dt" style={{ background: crit ? 'var(--red)' : 'var(--yellow)' }} aria-hidden="true" />
              <b>{alerted.length}</b> con alertas
            </button>
          )}
          {board.offers.length > 0 && (
            <button className="jr-kpi" data-tone="offer" onClick={() => go(offersRef)}>
              <b>{board.offers.length}</b> para ofrecer
            </button>
          )}
        </div>
        <ThresholdsButton value={thresholds} onChange={setThresholds} />
        <label className="pj-search">
          <I2.search width={15} height={15} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar cliente en el recorrido" placeholder="Buscar cliente o proyecto…" />
          {search && <button onClick={() => setSearch('')} aria-label="Limpiar búsqueda" style={{ display: 'flex', padding: 2, color: 'var(--text-faint)' }}><I2.x width={14} height={14} /></button>}
        </label>
      </div>

      {board.total === 0 && board.out.length === 0 ? (
        <div className="pj-empty">
          <span className="ic"><I2.circleDash width={22} height={22} /></span>
          <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-.02em' }}>{q ? 'Nadie coincide con la búsqueda' : 'Todavía no hay clientes en el recorrido'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-faint)', maxWidth: 380, lineHeight: 1.5 }}>
            {q ? 'Probá con otro nombre.' : 'Cada cliente aparece acá cuando se crea su proyecto desde el onboarding. Los internos de Insights no entran.'}
          </div>
          {q && <button className="btn btn-sm" style={{ marginTop: 14 }} onClick={() => setSearch('')}>Limpiar búsqueda</button>}
        </div>
      ) : (
        <>
          {f2.length > 0 && (
            <div className="jr-f2row" ref={rowWrap}>
              <F2Trigger items={f2} open={f2Open && !arc} onToggle={() => setF2Open((v) => !v)} btnRef={rowBtn} />
              {f2Open && !arc && <F2Popover items={f2} clientOf={clientOf} onOpen={openFromF2} />}
            </div>
          )}

          <motion.div ref={mapRef} className="jr-map" data-arc={f2.length > 0 ? '1' : undefined} variants={stagger} initial="hidden" animate="show">
            {main.map((l) => <Station key={l.key} innerRef={laneRef(l.key)} lane={l} items={board.lanes[l.key]} clientOf={clientOf} onOpen={onOpenProject} onSaveNote={saveNote} />)}
            <div className="jr-fork">
              <div className="jr-forkl">Después de la prueba sigue uno de estos caminos</div>
              {branches.map((l) => <Station key={l.key} innerRef={laneRef(l.key)} lane={l} items={board.lanes[l.key]} clientOf={clientOf} onOpen={onOpenProject} onSaveNote={saveNote} />)}
            </div>
            {arc && (
              <>
                <svg className="jr-arc" width={arc.w} height={arc.h} aria-hidden="true">
                  <path d={arc.d} />
                  <circle cx={arc.x0} cy={arc.y0} r="3" />
                  <circle cx={arc.x2} cy={arc.y2} r="3" />
                </svg>
                <div className="jr-arcw" ref={arcWrap} style={{ left: arc.mx, top: arc.my }}>
                  <F2Trigger items={f2} open={f2Open} onToggle={() => setF2Open((v) => !v)} btnRef={arcBtn} />
                  {f2Open && <F2Popover items={f2} clientOf={clientOf} onOpen={openFromF2} />}
                </div>
              </>
            )}
          </motion.div>

          <div className="jr-low">
            <section className="jr-panel" ref={offersRef} aria-labelledby="jr-offer-h" style={{ scrollMarginTop: 16 }}>
              <div className="jr-ph">
                <h2 id="jr-offer-h">Para ofrecer</h2>
                <span className="n">{board.offers.length}</span>
                <span className="sub">Plan mensual o Fase 2</span>
              </div>
              {board.offers.length === 0
                ? <div className="jr-none">Nadie está cerca del fin del MVP ni de los 30 días. Cuando falten {plural(thresholds.offerLeadDays, 'día', 'días')} de prueba, aparece acá.</div>
                : board.offers.map((o) => {
                  const p = (data.projects || []).find((x) => x.id === o.projectId)
                  const c = clientOf(o.clientId)
                  const last = [o.upsell.plan, o.upsell.fase2].filter(Boolean)
                  const lm = laneMeta(o.lane)
                  return (
                    <div key={o.projectId} className="jr-li" data-off={o.declined ? '1' : '0'} style={{ '--lc': `var(${lm.colorVar})` }}>
                      <button className="go" onClick={() => onOpenProject(o.projectId)} aria-label={`Abrir ${o.name}`}>
                        <ClientMark text={c?.company || o.name} size={32} />
                        <span className="tx">
                          <div className="nm">{o.name}{c?.company && <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}> · {c.company}</span>}</div>
                          <div className="rs">{o.reason}. Ofrecer {o.offers.map((k) => (k === 'plan' ? 'el plan mensual' : 'la Fase 2')).join(' o ')}.</div>
                          {last.length > 0 && <div className="up">{last.map((e) => upsellLine(e)).join(' · ')}{last.find((e) => e.note) && <> · <q>{last.find((e) => e.note).note}</q></>}</div>}
                          {!last.length && o.objections && <div className="up">Objeción del onboarding: <q>{o.objections}</q></div>}
                        </span>
                      </button>
                      <span className="jr-ln hide-mobile"><i />{lm.label}</span>
                      <button className="jr-act" onClick={() => setUpsellFor(p?.id || null)} aria-label={`Anotar oferta a ${o.name}`}>
                        <I2.pencil width={13} height={13} /> Anotar
                      </button>
                    </div>
                  )
                })}
            </section>

            <section className="jr-panel" ref={alertsRef} aria-labelledby="jr-alert-h" style={{ scrollMarginTop: 16 }}>
              <div className="jr-ph">
                <h2 id="jr-alert-h">Alertas</h2>
                <span className="n">{alerted.length}</span>
                <span className="sub">Rojo primero</span>
              </div>
              {alerted.length === 0
                ? <div className="jr-none">Nada pide atención. Desarrollo, tiendas, prueba y stand-by están dentro de los umbrales.</div>
                : alerted.map((a) => {
                  const lm = laneMeta(a.lane)
                  return (
                    <div key={a.project.id} className="jr-li">
                      <button className="go" onClick={() => onOpenProject(a.project.id)} aria-label={`Abrir ${a.project.name}: ${a.items.map((x) => x.text).join('. ')}`}>
                        <span className="jr-lv" style={{ background: a.level === 'crit' ? 'var(--red)' : 'var(--yellow)', alignSelf: 'flex-start', marginTop: 6 }} aria-hidden="true" />
                        <span className="tx">
                          <div className="nm">{a.project.name}</div>
                          {a.lane === 'standby' && standbyNote(a.project) && <div className="rs" style={{ color: 'var(--text-faint)' }}>Motivo: {standbyNote(a.project)}</div>}
                          {a.items.map((x) => (
                            <div key={x.key} className="rs" style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                              {a.items.length > 1 && <span aria-hidden="true" style={{ color: x.level === 'crit' ? 'var(--red)' : 'var(--yellow)' }}>•</span>}
                              {x.text}
                            </div>
                          ))}
                        </span>
                      </button>
                      <span className="jr-ln" style={{ '--lc': `var(${lm.colorVar})` }}><i />{lm.label}</span>
                    </div>
                  )
                })}
            </section>
          </div>

          {board.out.length > 0 && (
            <div className="jr-out">
              Fuera del recorrido (cancelados):{' '}
              {board.out.map((o, i) => (
                <React.Fragment key={o.project.id}>
                  {i > 0 && ', '}
                  <button onClick={() => onOpenProject(o.project.id)}>{o.project.name}</button>
                </React.Fragment>
              ))}
              .
            </div>
          )}
        </>
      )}

      <UpsellModal open={!!upsellProject} project={upsellProject} onClose={() => setUpsellFor(null)} />
    </>
  )
}

/* ─── Notas de upsell (modal compartido con el detalle del proyecto) ──────── */

export function UpsellModal({ open, project, onClose }) {
  const { data, myId, projectStore, logActivity } = useApp()
  const today = toDateInput(new Date().toISOString())
  const blank = () => ({ offer: 'plan', status: 'ofrecido', by: myId || '', at: today, payDay: '', note: '' })
  const [form, setForm] = useState(blank)
  const [obj, setObj] = useState('')
  const [saved, setSaved] = useState(false)
  const pid = project?.id

  useEffect(() => {
    if (!open || !project) return
    setForm(blank())
    setObj(upsellState(project).objections)
    setSaved(false)
  }, [open, pid])

  if (!project) return <Modal open={false} onClose={onClose} title="" />
  const st = upsellState(project)
  const team = data.team || []
  const who = (id) => team.find((u) => u.id === id)?.name || 'Alguien'
  const client = (data.clients || []).find((c) => c.id === project.clientId)
  const patch = (fn) => projectStore.patch(project.id, fn)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = (e) => {
    e.preventDefault()
    const entry = {
      offer: form.offer, status: form.status, by: form.by || null, note: form.note.trim(),
      at: fromDateInput(form.at) || new Date().toISOString(),
      payDay: form.status === 'paga' ? fromDateInput(form.payDay) : null,
    }
    patch((p) => ({ ...p, ...addUpsellEntry(p, entry) }))
    if (logActivity) logActivity({ type: 'upsell', text: `anotó en ${project.name}: ${offerLabel(entry.offer).toLowerCase()} ${upsellStatusMeta(entry.status).label.toLowerCase()}` })
    setForm((f) => ({ ...blank(), offer: f.offer }))
  }
  const saveObj = () => {
    if (obj === st.objections) return
    patch((p) => ({ ...p, ...setUpsellObjections(p, obj) }))
    setSaved(true)
  }
  const noteLabel = form.status === 'no_quiere' ? '¿Por qué no lo compró?' : 'Detalle'
  const notePh = form.status === 'no_quiere' ? 'Ej.: cree que la app está bien así y no necesita mantenimiento' : 'Monto, condiciones, próximo paso…'

  const StateCard = ({ k }) => {
    const e = st[k]
    const m = e ? upsellStatusMeta(e.status) : null
    return (
      <div className="up-state">
        <div className="k">{offerLabel(k)}</div>
        {e ? (
          <>
            <div className="v"><i style={{ background: `var(${m.colorVar})` }} />{m.label}</div>
            <div className="m">
              {e.at ? fmtDay(e.at) : 'sin fecha'} · {e.by ? who(e.by) : 'sin registrar quién'}
              {e.status === 'paga' && e.payDay && <> · paga el {fmtDay(e.payDay)}</>}
            </div>
            {e.note && <div className="m" style={{ color: 'var(--text)' }}>{e.note}</div>}
          </>
        ) : <div className="m">Todavía no se le ofreció.</div>}
      </div>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Upsell" sub={[project.name, client?.company].filter(Boolean).join(' · ')} width={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="up-states">
          <StateCard k="plan" />
          <StateCard k="fase2" />
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="up-h"><h4>Anotar una oferta</h4><span>Queda en el historial</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label" id="up-offer">Qué se ofreció</span>
            <div className="up-seg" role="radiogroup" aria-labelledby="up-offer">
              {UPSELL_OFFERS.map((o) => (
                <button type="button" key={o.key} role="radio" aria-checked={form.offer === o.key} onClick={() => set('offer', o.key)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label" id="up-status">Cómo quedó</span>
            <div className="up-seg" role="radiogroup" aria-labelledby="up-status">
              {UPSELL_STATUS.map((s) => (
                <button type="button" key={s.key} role="radio" aria-checked={form.status === s.key} style={{ '--sc': `var(${s.colorVar})` }} onClick={() => set('status', s.key)}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="up-grid">
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label">Quién</span>
              <select className="input" value={form.by} onChange={(e) => set('by', e.target.value)}>
                <option value="">Sin registrar</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="label">Cuándo</span>
              <input className="input" type="date" value={form.at} max={today} onChange={(e) => set('at', e.target.value)} />
            </label>
            {form.status === 'paga' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="label">Paga el día</span>
                <input className="input" type="date" value={form.payDay} onChange={(e) => set('payDay', e.target.value)} />
              </label>
            )}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="label">{noteLabel}</span>
            <textarea className="input" rows={2} value={form.note} placeholder={notePh} onChange={(e) => set('note', e.target.value)} style={{ resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-accent"><I2.check width={15} height={15} /> Guardar nota</button>
          </div>
        </form>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="up-h" style={{ margin: 0 }}>
            <h4>Objeciones del onboarding</h4>
            <span aria-live="polite">{saved ? 'Guardado' : 'Se guarda al salir del campo'}</span>
          </span>
          <textarea className="input" rows={2} value={obj} onChange={(e) => { setObj(e.target.value); setSaved(false) }} onBlur={saveObj}
            placeholder="Lo que puso en duda al arrancar: precio, tiempos, si lo necesita…" style={{ resize: 'vertical' }} />
        </label>

        <div>
          <div className="up-h"><h4>Historial</h4><span>{plural(st.entries.length, 'nota', 'notas')}</span></div>
          {st.entries.length === 0
            ? <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Sin notas todavía.</div>
            : (
              <div className="up-hist">
                {st.entries.map((e) => {
                  const m = upsellStatusMeta(e.status)
                  return (
                    <div key={e.id} className="up-row">
                      <span className="dt" style={{ background: `var(${m.colorVar})` }} aria-hidden="true" />
                      <div className="tx">
                        <div><b style={{ fontWeight: 650 }}>{offerLabel(e.offer)}</b> · {m.label.toLowerCase()}{e.status === 'paga' && e.payDay ? ` · paga el ${fmtDay(e.payDay)}` : ''}</div>
                        {e.note && <div style={{ color: 'var(--text-dim)' }}>{e.note}</div>}
                        <div className="mt">{e.at ? fmtDay(e.at) : 'sin fecha'} · {e.by ? who(e.by) : 'sin registrar quién'}</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => patch((p) => ({ ...p, ...removeUpsellEntry(p, e.id) }))}
                        aria-label={`Borrar la nota de ${offerLabel(e.offer)} del ${e.at ? fmtDay(e.at) : 'sin fecha'}`} style={{ padding: 4, color: 'var(--text-faint)' }}>
                        <I2.x width={13} height={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </div>
    </Modal>
  )
}

export function UpsellPanel({ project, onOpen }) {
  const st = upsellState(project)
  const item = (k) => {
    const e = st[k]
    const m = e ? upsellStatusMeta(e.status) : null
    return (
      <div className="it">
        <div className="k">{offerLabel(k)}</div>
        <div className="v">
          {e ? <><i style={{ background: `var(${m.colorVar})` }} />{m.label}<span style={{ fontWeight: 500, color: 'var(--text-faint)' }}>{e.at ? ` · ${fmtDay(e.at)}` : ''}</span></>
            : <span style={{ fontWeight: 500, color: 'var(--text-faint)' }}>Sin ofrecer</span>}
        </div>
      </div>
    )
  }
  const lastNote = st.entries.find((e) => e.note)
  return (
    <div className="up-panel">
      <style>{JR_CSS}</style>
      <span className="pd-eyebrow">Upsell</span>
      <div className="its">{item('plan')}{item('fase2')}</div>
      <button className="jr-act" onClick={onOpen}><I2.pencil width={13} height={13} /> {st.entries.length ? 'Ver y anotar' : 'Anotar oferta'}</button>
      {(lastNote || st.objections) && (
        <div className="ob">
          {lastNote && <>“{lastNote.note}”</>}
          {lastNote && st.objections && ' · '}
          {st.objections && <>Objeción del onboarding: {st.objections}</>}
        </div>
      )}
    </div>
  )
}
