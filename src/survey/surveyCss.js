/* Página pública: no hereda el tema del panel (THEMES se aplica en <html> para el equipo).
   Claro por defecto porque la leen dueños de negocio desde el celular; oscuro si el sistema
   lo pide. Las sombras son neutras a propósito: nada teñido con el azul de marca. */
export const SURVEY_CSS = `
.sv{
  --bg:#F4F1EB; --ink:#16171A; --ink-2:#4D5057; --ink-3:#686B72;
  --card:rgba(255,255,255,.78); --card-solid:#FFFFFF; --line:rgba(22,23,26,.11); --line-2:rgba(22,23,26,.2);
  --accent:#0A76AD; --accent-ink:#FFFFFF; --accent-soft:rgba(10,118,173,.08); --accent-ring:rgba(10,118,173,.28);
  --wash-a:rgba(255,183,140,.42); --wash-b:rgba(120,205,245,.38); --wash-c:rgba(255,255,255,.7);
  --shadow:0 1px 2px rgba(0,0,0,.05),0 14px 34px -18px rgba(0,0,0,.22);
  --serif:'Fraunces',Georgia,'Times New Roman',serif;
  --sans:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  position:relative;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--ink);
  font-family:var(--sans);font-size:17px;line-height:1.5;-webkit-font-smoothing:antialiased;
  display:flex;flex-direction:column;overflow-x:hidden;color-scheme:light;
}
@media (prefers-color-scheme:dark){
  .sv{
    --bg:#0D0E10; --ink:#F3F2EF; --ink-2:#B0B2B8; --ink-3:#8F9198;
    --card:rgba(24,25,28,.74); --card-solid:#18191C; --line:rgba(255,255,255,.1); --line-2:rgba(255,255,255,.2);
    --accent:#5AC8FA; --accent-ink:#06121A; --accent-soft:rgba(90,200,250,.11); --accent-ring:rgba(90,200,250,.32);
    --wash-a:rgba(255,150,100,.13); --wash-b:rgba(90,200,250,.14); --wash-c:rgba(255,255,255,.03);
    --shadow:0 1px 0 rgba(255,255,255,.04),0 18px 40px -20px rgba(0,0,0,.8);
    color-scheme:dark;
  }
}
.sv *,.sv *::before,.sv *::after{box-sizing:border-box}
.sv :where(button){font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sv-wash{position:fixed;inset:-20% -10% auto -10%;height:90vh;pointer-events:none;z-index:0;
  background:
    radial-gradient(42% 52% at 12% 18%,var(--wash-a),transparent 70%),
    radial-gradient(46% 56% at 92% 8%,var(--wash-b),transparent 72%),
    radial-gradient(60% 40% at 50% 0%,var(--wash-c),transparent 70%)}
.sv-grain{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.06;mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
@media (prefers-color-scheme:dark){.sv-grain{mix-blend-mode:screen;opacity:.035}}
.sv-top,.sv-progress,.sv-main,.sv-center,.sv-nav{position:relative;z-index:1}

.sv-top{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:max(16px,env(safe-area-inset-top)) 20px 8px;max-width:760px;width:100%;margin:0 auto}
.sv-mark{font-weight:750;font-size:19px;letter-spacing:-.04em}
.sv-mark i{font-style:normal;color:var(--accent)}
.sv-top-r{display:flex;align-items:center;gap:10px;min-width:0}
.sv-save{font-size:12.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:46vw}
.sv-save[data-s="offline"]{color:#B4540A}
@media (prefers-color-scheme:dark){.sv-save[data-s="offline"]{color:#FBBF77}}
.sv-lang{height:44px;padding:0 16px;border-radius:999px;font-size:13.5px;font-weight:600;color:var(--ink-2);
  box-shadow:inset 0 0 0 1px var(--line);background:var(--card);transition:box-shadow .2s,color .2s}
.sv-lang:hover{color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)}

.sv :focus-visible{outline:none;box-shadow:0 0 0 3px var(--bg),0 0 0 5px var(--accent-ring)!important}
.sv-qt:focus,.sv-qt:focus-visible{outline:none;box-shadow:none!important}
.sv-input:focus-visible{box-shadow:inset 0 0 0 2px var(--accent)!important}

.sv-center{flex:1;display:grid;place-items:center;padding:24px 20px 48px}
.sv-intro,.sv-msg{width:100%;max-width:560px}
.sv-msg{text-align:center;display:flex;flex-direction:column;align-items:center}
.sv-eyebrow{margin:0 0 14px;font-size:15px;font-weight:600;color:var(--accent)}
.sv-h1{margin:0;font-family:var(--serif);font-weight:600;font-size:clamp(34px,8.4vw,52px);line-height:1.06;letter-spacing:-.01em;
  font-variation-settings:'opsz' 96;text-wrap:balance}
.sv-lead{margin:18px 0 0;font-size:clamp(17px,2.4vw,19px);line-height:1.6;color:var(--ink-2);text-wrap:pretty}
.sv-facts{list-style:none;margin:26px 0 32px;padding:16px 18px;border-radius:18px;background:var(--card);
  box-shadow:inset 0 0 0 1px var(--line);display:flex;flex-direction:column;gap:8px;font-size:15px;color:var(--ink-2);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.sv-facts li{display:flex;gap:10px;align-items:baseline}
.sv-facts li::before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:var(--accent);transform:translateY(-2px)}
.sv-foot{margin:22px 0 0;font-size:14.5px;color:var(--ink-3)}
.sv-seal{display:grid;place-items:center;width:68px;height:68px;border-radius:50%;margin-bottom:26px;
  color:var(--accent-ink);background:var(--accent);box-shadow:0 0 0 8px var(--accent-soft)}

.sv-cta{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:58px;padding:0 30px;border-radius:999px;
  font-size:17px;font-weight:650;color:var(--accent-ink);background:var(--accent);box-shadow:var(--shadow);
  transition:transform .25s cubic-bezier(.22,1,.36,1),filter .2s,opacity .2s}
.sv-cta:hover{filter:brightness(1.06);transform:translateY(-1px)}
.sv-cta:active{transform:scale(.97)}
.sv-cta:disabled{opacity:.38;cursor:not-allowed;transform:none;filter:none;box-shadow:none}
.sv-cta svg{transition:transform .25s cubic-bezier(.22,1,.36,1)}
.sv-cta:not(:disabled):hover svg{transform:translateX(3px)}
.sv-intro .sv-cta{width:100%}
@media (min-width:600px){.sv-intro .sv-cta{width:auto;min-width:240px}}
.sv-cta-sm{height:52px;padding:0 24px;font-size:16px}

.sv-progress{max-width:760px;width:100%;margin:0 auto;padding:6px 20px 0}
.sv-bars{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.sv-bar{height:4px;border-radius:99px;background:var(--line);overflow:hidden}
.sv-bar i{display:block;height:100%;background:var(--accent);transform-origin:left center;border-radius:inherit}
.sv-progress-meta{display:flex;justify-content:space-between;gap:12px;margin-top:10px;font-size:13.5px;color:var(--ink-3)}
.sv-progress-meta span:first-child{font-weight:600;color:var(--ink-2)}

.sv-main{flex:1;width:100%;max-width:760px;margin:0 auto;padding:clamp(22px,5vh,48px) 20px 140px}
.sv-q{max-width:620px}
.sv-qt{margin:0;font-family:var(--serif);font-weight:600;font-size:clamp(26px,6.2vw,36px);line-height:1.16;letter-spacing:-.008em;
  font-variation-settings:'opsz' 72;text-wrap:balance}
.sv-hint{margin:12px 0 0;font-size:16px;color:var(--ink-2);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sv-tag{font-size:12px;font-weight:650;letter-spacing:.02em;padding:3px 9px;border-radius:999px;color:var(--ink-2);
  box-shadow:inset 0 0 0 1px var(--line-2)}

.sv-opts{display:flex;flex-direction:column;gap:10px;margin-top:26px}
.sv-opt{display:flex;align-items:center;gap:14px;width:100%;min-height:58px;padding:14px 18px;border-radius:16px;text-align:left;
  font-size:17px;line-height:1.35;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  transition:box-shadow .2s,background .2s,transform .18s cubic-bezier(.22,1,.36,1)}
.sv-opt:hover{box-shadow:inset 0 0 0 1px var(--line-2)}
.sv-opt:active{transform:scale(.985)}
.sv-opt[data-on="1"]{background:var(--accent-soft);box-shadow:inset 0 0 0 2px var(--accent)}
.sv-tick{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;color:transparent;
  box-shadow:inset 0 0 0 1.5px var(--line-2);transition:background .2s,color .2s,box-shadow .2s}
.sv-opt[data-multi="1"] .sv-tick{border-radius:7px}
.sv-opt[data-on="1"] .sv-tick{background:var(--accent);color:var(--accent-ink);box-shadow:none}
.sv-warn{min-height:20px;margin:10px 2px 0;font-size:14px;color:var(--ink-2)}

.sv-input{width:100%;font:inherit;font-size:17px;color:var(--ink);background:var(--card-solid);border:0;border-radius:16px;
  padding:16px 18px;box-shadow:inset 0 0 0 1px var(--line-2);outline:none;transition:box-shadow .2s}
.sv-input::placeholder{color:var(--ink-3)}
.sv-input:focus{box-shadow:inset 0 0 0 2px var(--accent)}
.sv-other{margin-top:10px}
.sv-text{margin-top:26px;min-height:140px;resize:none;line-height:1.55}

.sv-scale-wrap{margin-top:30px}
.sv-scale{display:grid;gap:8px;grid-template-columns:repeat(5,1fr)}
.sv-scale[data-n="11"]{grid-template-columns:repeat(6,1fr)}
@media (min-width:560px){.sv-scale[data-n="11"]{grid-template-columns:repeat(11,1fr)}}
.sv-step{height:58px;border-radius:14px;font-size:18px;font-weight:650;font-variant-numeric:tabular-nums;
  background:var(--card);box-shadow:inset 0 0 0 1px var(--line);transition:box-shadow .2s,background .2s,color .2s,transform .18s}
.sv-step:hover{box-shadow:inset 0 0 0 1px var(--line-2)}
.sv-step:active{transform:scale(.95)}
.sv-step[data-on="1"]{background:var(--accent);color:var(--accent-ink);box-shadow:none}
.sv-scale-ends{display:flex;justify-content:space-between;gap:16px;margin-top:12px;font-size:14px;color:var(--ink-3)}

.sv-nav{position:fixed;left:0;right:0;bottom:0;z-index:2;padding:14px 20px max(14px,env(safe-area-inset-bottom));
  background:linear-gradient(to top,var(--bg) 62%,transparent)}
.sv-nav-in{max-width:720px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px}
.sv-back{display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 16px 0 10px;border-radius:999px;font-size:16px;
  font-weight:600;color:var(--ink-2);transition:color .2s,background .2s}
.sv-back:hover{color:var(--ink);background:var(--accent-soft)}
.sv-err{flex:1;font-size:13.5px;color:#B42318;text-align:center}
@media (prefers-color-scheme:dark){.sv-err{color:#F87171}}

.sv-loader{width:36px;height:36px;border-radius:50%;box-shadow:inset 0 0 0 3px var(--line);position:relative}
.sv-loader::after{content:'';position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:var(--accent);
  animation:sv-spin .8s linear infinite}
@keyframes sv-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.sv *{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`
