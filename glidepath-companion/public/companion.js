/*
 * Glidepath Companion - training companion UI for X-Plane 12 (live) or a built-in demo flight.
 *
 *   import { mountCompanion } from './companion.js';
 *   const app = mountCompanion(el, { mode: 'live' | 'demo', eventsUrl: '/events', apiBase: '/api' });
 *   app.destroy();
 *
 * Live mode reads Server-Sent Events from bridge.mjs (event "sample" and "status") and sends
 * instructor actions with POST {apiBase}/failure and {apiBase}/command.
 * Demo mode needs no network at all: it flies a deterministic scripted C172 (demo-flight.js).
 *
 * All CSS is injected once and scoped under .gpc. Colours and fonts come from the host page's
 * custom properties (--paper, --surface, --ink, ... --f-mono) with light-theme fallbacks.
 */
import { createDemoFlight, TIME_SCALE, STEP } from './demo-flight.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI, M_PER_DEG = 111320, NM = 1852;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap180 = a => ((((a % 360) + 540) % 360) - 180);
const norm360 = a => ((a % 360) + 360) % 360;
const val = (v, c) => (typeof v === 'function' ? v(c) : v);
const fin = v => typeof v === 'number' && Number.isFinite(v);
const n0 = v => (fin(v) ? Math.round(v).toLocaleString('en-GB') : '-');
const kt = v => `${n0(v)} kt`;
const ft = v => `${n0(v)} ft`;
const fpm = v => (fin(v) ? `${n0(Math.abs(v))} fpm ${v < -20 ? 'down' : v > 20 ? 'up' : ''}`.trim() : '-');
const deg = v => `${n0(v)}°`;
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±');
const mmss = t => { t = Math.max(0, t || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ======================================================================= CSS */

const STYLE_ID = 'gpc-style-1';
const CSS = `
.gpc{--g-paper:var(--paper,#f1f5f6);--g-surface:var(--surface,#fff);--g-sunk:var(--sunk,#e7eef1);--g-ink:var(--ink,#12202a);--g-muted:var(--muted,#546670);--g-line:var(--line,#d2dce1);--g-magenta:var(--magenta,#a1246e);--g-cyan:var(--cyan,#0b6f8c);--g-amber:var(--amber,#8f6200);--g-green:var(--green,#1d7550);--g-red:var(--red,#b3261e);--g-fd:var(--f-display,"Barlow Condensed","Arial Narrow","Roboto Condensed",sans-serif);--g-fb:var(--f-body,"Source Sans 3","Segoe UI",system-ui,-apple-system,sans-serif);--g-fm:var(--f-mono,"JetBrains Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace);--g-r:10px;--g-tc:color-mix(in srgb,var(--g-cyan) 12%,var(--g-surface));--g-ta:color-mix(in srgb,var(--g-amber) 13%,var(--g-surface));--g-tg:color-mix(in srgb,var(--g-green) 12%,var(--g-surface));--g-tr:color-mix(in srgb,var(--g-red) 12%,var(--g-surface));--g-tm:color-mix(in srgb,var(--g-magenta) 10%,var(--g-surface));container:gpc/inline-size;color:var(--g-ink);font:400 15px/1.45 var(--g-fb);text-align:left;-webkit-text-size-adjust:100%}
.gpc *,.gpc *::before,.gpc *::after{box-sizing:border-box}
.gpc :where(h3,h4,p,ol,ul,li,figure,figcaption,dl,dd){margin:0;padding:0}
.gpc :where(ol,ul){list-style:none}
.gpc [hidden]{display:none!important}
.gpc button,.gpc input,.gpc textarea{font:inherit;color:inherit}
.gpc :focus-visible{outline:2px solid var(--g-cyan);outline-offset:2px}
.gpc .gpc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gpc-shell{display:grid;gap:14px;min-width:0}
.gpc-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:10px 16px}
.gpc-head>div:first-child{min-width:0;flex:1 1 320px}
.gpc-eyebrow{font:700 11.5px/1.3 var(--g-fm);letter-spacing:.12em;text-transform:uppercase;color:var(--g-magenta)}
.gpc-title{font:600 28px/1.05 var(--g-fd);margin-top:5px;letter-spacing:.005em}
.gpc-sub{color:var(--g-muted);font-size:14.5px;margin-top:5px;max-width:72ch}
.gpc-status{display:inline-flex;align-items:center;gap:8px;font:600 12.5px/1.2 var(--g-fm);padding:8px 12px;border-radius:999px;background:var(--g-surface);border:1px solid var(--g-line);color:var(--g-ink);max-width:100%}
.gpc-status i{flex:none;width:9px;height:9px;border-radius:50%;background:var(--g-muted)}
.gpc-status[data-state=demo] i{background:var(--g-cyan)}
.gpc-status[data-state=connected] i{background:var(--g-green)}
.gpc-status[data-state=connecting] i,.gpc-status[data-state=paused] i{background:var(--g-amber);animation:gpc-pulse 1.2s ease-in-out infinite}
.gpc-status[data-state=not_found] i,.gpc-status[data-state=offline] i{background:var(--g-red)}
@keyframes gpc-pulse{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.gpc *{animation:none!important;transition:none!important}}
.gpc-exs{display:flex;flex-wrap:wrap;gap:6px}
.gpc-exb{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:7px 13px;border-radius:999px;border:1px solid var(--g-line);background:var(--g-surface);font:600 14px/1.1 var(--g-fb);cursor:pointer;color:var(--g-ink)}
.gpc-exb:hover{background:var(--g-sunk)}
.gpc-exb[aria-pressed=true]{background:var(--g-ink);border-color:var(--g-ink);color:var(--g-surface)}
.gpc-hint{border:1px solid color-mix(in srgb,var(--g-amber) 45%,var(--g-line));background:var(--g-ta);border-radius:var(--g-r);padding:12px 14px;display:grid;gap:6px;font-size:14.5px}
.gpc-hint b{font-weight:700}
.gpc-hint ol{list-style:decimal;padding-left:20px;display:grid;gap:2px}
.gpc-hint code,.gpc code{font:600 13px var(--g-fm);background:color-mix(in srgb,var(--g-ink) 8%,transparent);padding:1px 5px;border-radius:4px}
.gpc-strip{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:1px;background:var(--g-line);border:1px solid var(--g-line);border-radius:var(--g-r);overflow:hidden}
.gpc-tile{background:var(--g-surface);padding:9px 12px 10px;min-width:0;display:grid;gap:3px;align-content:start}
.gpc-tile .gpc-tk{font:700 11px/1.2 var(--g-fm);letter-spacing:.08em;text-transform:uppercase;color:var(--g-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gpc-tile .gpc-tv{font:600 27px/1 var(--g-fd);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gpc-tile .gpc-tv small{font:500 12px var(--g-fm);color:var(--g-muted);margin-left:3px;letter-spacing:0}
.gpc-tile .gpc-tv.gpc-txt{font-size:21px;line-height:27px}
.gpc-tile .gpc-ku{display:none;color:var(--g-muted);font-weight:500;letter-spacing:0;text-transform:none;margin-left:4px}
.gpc-tile.gpc-bad{background:var(--g-ta)}
.gpc-tile.gpc-bad .gpc-tk{color:var(--g-amber)}
.gpc-annun{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.gpc-ann{font:700 11px/1 var(--g-fm);letter-spacing:.07em;padding:6px 8px;border-radius:4px;border:1px solid var(--g-line);color:var(--g-muted);background:var(--g-surface)}
.gpc-ann.gpc-on{background:var(--g-amber);border-color:var(--g-amber);color:var(--g-surface)}
.gpc-ann.gpc-on.gpc-crit{background:var(--g-red);border-color:var(--g-red)}
.gpc-phase{margin-left:auto;font:500 12.5px/1.3 var(--g-fm);color:var(--g-muted)}
.gpc-phase b{color:var(--g-ink);font-weight:700}
.gpc-main{display:grid;gap:14px;grid-template-columns:minmax(0,1fr)}
.gpc-col{display:grid;gap:14px;align-content:start;min-width:0}
@container gpc (min-width:760px){.gpc-main{grid-template-columns:minmax(0,1fr) minmax(300px,350px)}.gpc .gpc-tr{height:360px}}
@container gpc (max-width:759.98px){.gpc-col{display:contents}.gpc-o1{order:1}.gpc-o2{order:2}.gpc-o3{order:3}.gpc-o4{order:4}.gpc-o5{order:5}.gpc-o6{order:6}.gpc-strip{grid-template-columns:repeat(4,minmax(0,1fr))}.gpc-tile{padding:8px 9px 9px}.gpc-tile .gpc-tv{font-size:23px}.gpc-tile .gpc-tv small{display:none}.gpc-tile .gpc-ku{display:inline}.gpc-map{aspect-ratio:1/1}.gpc-bar .gpc-prog{order:-1;flex-basis:100%}.gpc-bar [data-b=restart] span,.gpc-bar [data-b=skip] .gpc-long{display:none}.gpc-seg button{min-width:36px}.gpc-tile .gpc-tv.gpc-txt{font-size:17px;line-height:23px}.gpc-title{font-size:24px}.gpc-phase{margin-left:0;flex-basis:100%}}
.gpc-panel{background:var(--g-surface);border:1px solid var(--g-line);border-radius:var(--g-r);padding:14px;min-width:0}
.gpc-ph{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:4px 10px;margin-bottom:10px}
.gpc-ph h4{font:600 19px/1.1 var(--g-fd);letter-spacing:.01em}
.gpc-k{font:700 11px/1.2 var(--g-fm);letter-spacing:.09em;text-transform:uppercase;color:var(--g-muted)}
.gpc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:7px 13px;border-radius:8px;border:1px solid var(--g-line);background:var(--g-surface);color:var(--g-ink);font:600 14px/1.1 var(--g-fb);cursor:pointer;white-space:nowrap}
.gpc-btn:hover{background:var(--g-sunk)}
.gpc-btn.primary{background:var(--g-cyan);border-color:var(--g-cyan);color:var(--g-surface)}
.gpc-btn.primary:hover{background:color-mix(in srgb,var(--g-cyan) 86%,var(--g-ink))}
.gpc-btn:disabled{opacity:.5;cursor:default}
.gpc-btn svg{width:14px;height:14px;flex:none}
.gpc-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}
.gpc-prog{flex:1 1 140px;min-width:100px;display:grid;gap:4px}
.gpc-prog .gpc-trk{height:6px;background:var(--g-sunk);border-radius:3px;overflow:hidden}
.gpc-prog .gpc-trk span{display:block;height:100%;width:0;background:var(--g-cyan);border-radius:3px}
.gpc-prog .gpc-lbl{display:flex;justify-content:space-between;gap:8px;font:500 12px/1.2 var(--g-fm);color:var(--g-muted);font-variant-numeric:tabular-nums;min-width:0}
.gpc-prog .gpc-lbl span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gpc-prog .gpc-lbl span:last-child{white-space:nowrap}
.gpc-seg{display:inline-flex;border:1px solid var(--g-line);border-radius:8px;overflow:hidden;background:var(--g-surface)}
.gpc-seg button{border:0;border-left:1px solid var(--g-line);background:transparent;min-height:34px;min-width:40px;padding:6px 9px;font:600 13px/1 var(--g-fm);cursor:pointer;color:var(--g-ink)}
.gpc-seg button:first-child{border-left:0}
.gpc-seg button:hover{background:var(--g-sunk)}
.gpc-seg button[aria-pressed=true]{background:var(--g-ink);color:var(--g-surface)}
.gpc-map{position:relative;aspect-ratio:4/3;background:var(--g-sunk);border-radius:8px;overflow:hidden}
.gpc-map canvas,.gpc-tr canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.gpc-legend{display:flex;flex-wrap:wrap;gap:4px 16px;margin-top:10px;font-size:13px;color:var(--g-muted)}
.gpc-legend span{display:inline-flex;align-items:center;gap:7px}
.gpc-legend i{display:inline-block;width:22px;height:0;border-top:2.5px solid var(--g-cyan)}
.gpc-legend i.gpc-li-plan{border-top:2px dashed var(--g-magenta)}
.gpc-legend i.gpc-li-band{height:10px;border:0;background:color-mix(in srgb,var(--g-green) 22%,transparent);border-top:1px dashed var(--g-green);border-bottom:1px dashed var(--g-green)}
.gpc-legend i.gpc-li-exc{border-top-color:var(--g-red)}
.gpc-tr{position:relative;height:300px}
.gpc-pop{position:absolute;top:0;left:0;pointer-events:none;background:var(--g-ink);color:var(--g-surface);font:600 12px/1.35 var(--g-fm);padding:6px 9px;border-radius:6px;white-space:nowrap;z-index:2}
.gpc-scrub{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px 10px;align-items:center}
.gpc-scrub input[type=range]{width:100%;margin:0;accent-color:var(--g-cyan);min-height:28px}
.gpc-scrub output{grid-column:1/-1;font:500 13px/1.4 var(--g-fm);color:var(--g-muted)}
.gpc-scrub output b{color:var(--g-ink)}
.gpc-score{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-bottom:8px}
.gpc-score b{font:700 44px/0.9 var(--g-fd);font-variant-numeric:tabular-nums}
.gpc-score b small{font:600 16px var(--g-fd);color:var(--g-muted);margin-left:2px}
.gpc-score span{font-size:13px;color:var(--g-muted);text-align:right}
.gpc-meter{height:6px;background:var(--g-sunk);border-radius:3px;overflow:hidden;display:flex;gap:2px}
.gpc-meter span{display:block;height:100%}
.gpc-meter .gpc-mp{background:var(--g-green)}.gpc-meter .gpc-mf{background:var(--g-amber)}.gpc-meter .gpc-mm{background:var(--g-muted)}
.gpc-coach{margin:12px 0 4px;padding:9px 11px;border-radius:8px;background:var(--g-tc);font-size:14px;line-height:1.35}
.gpc-coach b{color:var(--g-cyan);font:700 11px/1 var(--g-fm);letter-spacing:.08em;text-transform:uppercase;margin-right:6px}
.gpc-list{display:grid;margin-top:6px}
.gpc-chk{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:3px 10px;align-items:start;padding:9px 0;border-top:1px solid var(--g-line)}
.gpc-chk:first-child{border-top:0}
.gpc-ico{width:20px;height:20px;border-radius:50%;border:2px solid var(--g-line);display:grid;place-items:center;font:800 11px/1 var(--g-fm);margin-top:1px;color:var(--g-surface)}
.gpc-chk[data-st=active] .gpc-ico{border-color:var(--g-cyan);box-shadow:0 0 0 3px var(--g-tc)}
.gpc-chk[data-st=warn] .gpc-ico{border-color:var(--g-amber);box-shadow:0 0 0 3px var(--g-ta)}
.gpc-chk[data-st=pass] .gpc-ico{background:var(--g-green);border-color:var(--g-green)}
.gpc-chk[data-st=flag] .gpc-ico{background:var(--g-amber);border-color:var(--g-amber)}
.gpc-chk[data-st=missed] .gpc-ico,.gpc-chk[data-st=na] .gpc-ico{border-style:dashed;color:var(--g-muted)}
.gpc-chk-l{font-weight:600;font-size:14.5px;line-height:1.3}
.gpc-chk-n{grid-column:2;color:var(--g-muted);font-size:13.5px;line-height:1.35}
.gpc-chk-s{font:700 11px/1.3 var(--g-fm);letter-spacing:.04em;text-transform:uppercase;color:var(--g-muted);text-align:right;white-space:nowrap;padding-top:2px}
.gpc-chk[data-st=active] .gpc-chk-s{color:var(--g-cyan)}
.gpc-chk[data-st=warn] .gpc-chk-s,.gpc-chk[data-st=flag] .gpc-chk-s{color:var(--g-amber)}
.gpc-chk[data-st=pass] .gpc-chk-s{color:var(--g-green)}
.gpc-time{font:600 12px/1 var(--g-fm);padding:5px 8px;min-height:28px;border-radius:6px;border:1px solid var(--g-line);background:var(--g-surface);cursor:pointer;color:var(--g-ink);font-variant-numeric:tabular-nums}
.gpc-time:hover{background:var(--g-sunk)}
.gpc-time[aria-current=true]{border-color:var(--g-cyan);background:var(--g-tc)}
.gpc-tipx{grid-column:2/-1;font-size:13.5px;line-height:1.4;background:var(--g-ta);border-radius:6px;padding:6px 9px;margin-top:4px}
.gpc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.gpc-grade{font-size:14.5px;margin:2px 0 10px}
.gpc-csv{width:100%;min-height:120px;margin-top:10px;font:500 11.5px/1.4 var(--g-fm);border:1px solid var(--g-line);border-radius:8px;background:var(--g-sunk);padding:8px;resize:vertical}
.gpc-msg{font-size:13.5px;color:var(--g-muted);margin-top:8px}
.gpc-msg.ok{color:var(--g-green)}.gpc-msg.err{color:var(--g-red)}
.gpc-fail{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;padding:9px 0;border-top:1px solid var(--g-line)}
.gpc-fail:first-child{border-top:0}
.gpc-fail label,.gpc-fail .gpc-nm{font-weight:600;font-size:14.5px;cursor:pointer}
.gpc-fail p{grid-column:1;color:var(--g-muted);font-size:13px;line-height:1.35}
.gpc-fail .gpc-ontxt{color:var(--g-red);font:700 11px var(--g-fm);letter-spacing:.06em;text-transform:uppercase;margin-left:6px}
.gpc-switch{grid-row:1/span 2;grid-column:2;position:relative;width:48px;height:28px;border-radius:14px;border:1px solid var(--g-line);background:var(--g-sunk);cursor:pointer;padding:0;transition:background .15s}
.gpc-switch::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--g-muted);transition:transform .15s,background .15s}
.gpc-switch[aria-checked=true]::after{background:var(--g-surface)}
.gpc-switch[aria-checked=true]{background:var(--g-red);border-color:var(--g-red)}
.gpc-switch[aria-checked=true]::after{transform:translateX(20px)}
.gpc-switch[data-busy=true]{opacity:.6}
.gpc-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 11px;margin-bottom:10px;border-radius:8px;background:var(--g-tm);font-size:14px;line-height:1.35;cursor:pointer}
.gpc-opt input{width:18px;height:18px;margin:1px 0 0;accent-color:var(--g-magenta);flex:none}
.gpc-note{font-size:13px;color:var(--g-muted);margin-top:10px;line-height:1.4}
`;

function injectCss(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = STYLE_ID; st.textContent = CSS;
  (doc.head || doc.documentElement).appendChild(st);
}

const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
  restart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M2.2 2.2v4.3h4.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  skip: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3v10l7-5zM10 3v10l4-5z" fill="currentColor"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h6.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.5 7.5 8 11l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

/* ================================================================ checks */

/**
 * A "hold" check: while when(c) is true the value must stay inside [lo, hi].
 * Flagged if out of tolerance continuously for longer than `grace` seconds.
 */
function hold(o) {
  return () => ({
    kind: 'hold', id: o.id, label: o.label, target: o.target, tip: o.tip, chan: o.chan, band: o.band !== false,
    grace: o.grace ?? 5, status: 'pending', inT: 0, totT: 0, run: 0, worst: null, exc: null, t: null, note: '', cur: null,
    bands: [], seen: false, done: false, points: 0,
    fmt: o.fmt || (v => n0(v)),
    update(c, dt) {
      if (this.done) return;
      const on = !!o.when(c);
      if (on) {
        const v = o.val ? o.val(c) : c.s[o.chan];
        if (!fin(v)) return;
        const lo = val(o.lo, c), hi = val(o.hi, c);
        if (!this.seen) { this.seen = true; this.status = 'active'; this.t0 = c.t; }
        this.cur = v; this.lo = lo; this.hi = hi; this.totT += dt;
        const b = this.bands[this.bands.length - 1];
        if (b && b.open) { b.t1 = c.t; b.lo = lo; b.hi = hi; } else this.bands.push({ t0: c.t, t1: c.t, lo, hi, open: true });
        if (v >= lo && v <= hi) { this.inT += dt; this.run = 0; this.out = false; }
        else {
          this.run += dt; this.out = true;
          const dev = v < lo ? v - lo : v - hi;
          if (!this.worst || Math.abs(dev) > Math.abs(this.worst.dev)) this.worst = { dev, v, t: c.t };
          if (this.run >= this.grace && !this.exc) this.exc = { t: c.t - this.run, v, dev };
        }
      } else if (this.seen) {
        const b = this.bands[this.bands.length - 1]; if (b) b.open = false;
        this.out = false;
      }
      if (this.seen && (o.until ? o.until(c) : !on)) this.finish(c);
    },
    finish() {
      if (this.done) return;
      this.done = true;
      this.bands.forEach(b => { b.open = false; });
      if (!this.seen) { this.status = o.optional ? 'na' : 'missed'; this.note = o.optional ? 'Not applicable on this flight' : 'Not flown'; return; }
      const pct = Math.round(100 * (this.totT ? this.inT / this.totT : 1));
      if (!this.exc) {
        this.status = 'pass'; this.points = 1; this.t = this.t0;
        this.note = o.passNote ? o.passNote(this) : pct >= 100 ? 'Within tolerance throughout' : `In tolerance ${pct}% of the time (no long excursions)`;
      } else {
        this.status = 'flag'; this.points = pct >= 75 ? 0.5 : 0; this.t = this.exc.t;
        const w = this.worst;
        this.note = (o.flagNote ? o.flagNote(this, w) : `Reached ${this.fmt(w.v)}, ${this.fmt(Math.abs(w.dev))} ${w.dev > 0 ? 'above' : 'below'} the limit`) + ` · in tolerance ${pct}% of the time`;
      }
    },
    live() {
      if (this.status !== 'active') return null;
      return this.fmt(this.cur);
    },
  });
}

/** An "event" check: judged once, the first time trigger(c) is true. */
function event(o) {
  return () => ({
    kind: 'event', id: o.id, label: o.label, target: o.target, tip: o.tip, status: 'pending', t: null, note: '', done: false, points: 0, bands: [],
    update(c) {
      if (this.done || !o.trigger(c)) return;
      const r = o.judge(c);
      this.done = true; this.t = c.t; this.note = r.note || '';
      this.status = r.na ? 'na' : r.ok ? 'pass' : 'flag';
      this.points = r.na ? 0 : r.ok ? 1 : r.partial || 0;
    },
    finish() {
      if (this.done) return;
      this.done = true; this.status = o.optional ? 'na' : 'missed'; this.note = o.optional ? 'Not applicable on this flight' : 'Not flown';
    },
    live() { return null; },
  });
}

const absBank = c => Math.abs(c.s.bank);
const PHASE_NAMES = {
  ready: 'Ready', takeoff: 'Take-off roll', climbout: 'Climb-out', crosswind: 'Crosswind', downwind: 'Downwind', base: 'Base leg', final: 'Final approach',
  landing: 'Landing roll', done: 'Complete', entry: 'Entry', turn1: 'First turn', between: 'Reversal', turn2: 'Second turn', slowing: 'Slowing to the stall',
  recovering: 'Stall recovery', climb: 'Climbing away', failed: 'Engine failure', glide: 'Glide', intercept: 'Intercept', approach: 'ILS approach', short: 'Below 500 ft',
};

/** Shared take-off phase logic. Returns true if it handled the sample. */
function takeoffPhases(c) {
  const s = c.s, V = c.vars;
  if (c.phase === 'ready') {
    if (s.ground && s.ias > 30) c.phase = 'takeoff';
    return true;
  }
  if (c.phase === 'takeoff') {
    if (!s.ground && s.agl > 15) { c.phase = 'climbout'; c.ev.liftoff = true; V.liftoff = { t: c.t, ias: s.ias }; }
    else if (s.ground && s.ias < 8) c.phase = 'ready'; // rejected take-off
    return true;
  }
  return false;
}
function touchdown(c) { return { vs: c.prev ? c.prev.vs : c.s.vs, bank: c.prev ? c.prev.bank : c.s.bank, u: c.u, v: c.v }; }
function stopped(c, next = 'done') {
  if (c.s.gs < 12 || c.s.ias < 15) { c.vars.stopT ??= c.t; if (c.t - c.vars.stopT > 2) c.phase = next; } else c.vars.stopT = null;
}
const rotateCheck = event({
  id: 'rotate', label: 'Rotate at Vr 55 kt', target: 'Rotate between 50 and 60 kt',
  tip: 'Call out the speeds on the roll ("airspeed alive... 55, rotate") and raise the nose smoothly to the climb attitude.',
  trigger: c => (c.phase === 'takeoff' && c.s.ground && c.s.pitch > 3 && c.s.ias > 35) || c.ev.liftoff,
  judge: c => ({ ok: c.s.ias >= 50 && c.s.ias <= 60, note: `${c.ev.liftoff ? 'Lifted off' : 'Rotated'} at ${kt(c.s.ias)}` }),
});
const vyCheck = (when, extra = '') => hold({
  id: 'vy', label: 'Climb at Vy 74 kt', target: `74 kt ±5${extra}`, chan: 'ias', lo: 69, hi: 79, fmt: kt,
  tip: 'Set the climb attitude, let the speed settle, then trim. Small pitch changes fix speed in the climb.',
  when,
});
const gentleTd = (id = 'td', label = 'Gentle touchdown', extraTarget = '') => event({
  id, label, target: `Under 400 fpm, wings level${extraTarget}`,
  tip: 'Look to the far end of the runway in the flare and hold the aircraft off as it slows. Keep the wings level with aileron.',
  trigger: c => !!c.ev.touchdown,
  judge: c => {
    const T = c.ev.touchdown, bits = [];
    if (T.vs < -400) bits.push(`firm, ${n0(-T.vs)} fpm`);
    if (Math.abs(T.bank) > 5) bits.push(`${n0(Math.abs(T.bank))}° bank`);
    let off = '';
    if (id === 'td' && c.rwy && fin(T.v)) { off = Math.abs(T.v) < 1.5 ? ' · on the centreline' : ` · ${n0(Math.abs(T.v))} m ${T.v > 0 ? 'right' : 'left'} of the centreline`; if (Math.abs(T.v) > 8) bits.push('off the centreline'); }
    return { ok: !bits.length, note: bits.length ? `Touchdown ${bits.join(', ')}${off}` : `Touched down at ${n0(-T.vs)} fpm${off}` };
  },
});

/* ============================================================= exercises */

const EXERCISES = {
  circuit: {
    title: 'Normal circuit', short: 'Normal circuit',
    sub: 'Left-hand circuit at 1,000 ft AGL: rotate 55 kt, climb at Vy 74 kt, downwind 90 kt, base 70 kt, final 65 kt with full flap.',
    altChan: 'agl', plan: 'circuit', readyHint: 'Line up on the runway and start the take-off roll. The runway and circuit are set from your take-off.',
    update(c) {
      const s = c.s, V = c.vars, d = c.d;
      if (takeoffPhases(c)) return;
      switch (c.phase) {
        case 'climbout': if (Math.abs(d) > 20 && s.agl > 100) { c.phase = 'crosswind'; V.dir = Math.sign(d) || -1; } break;
        case 'crosswind': if (Math.abs(d) > 135) c.phase = 'downwind'; break;
        case 'downwind': if (Math.abs(d) < 125 && c.phaseT > 20) c.phase = 'base'; break;
        case 'base': if (Math.abs(d) < 25) c.phase = 'final'; break;
        case 'final': if (s.ground) { c.phase = 'landing'; c.ev.touchdown = touchdown(c); } break;
        case 'landing': stopped(c); break;
      }
    },
    checks: [
      rotateCheck,
      vyCheck(c => c.phase === 'climbout' && c.s.agl >= 300, ' from 300 ft AGL'),
      event({
        id: 'xwind', label: 'Turn crosswind at 500 ft AGL', target: 'Start the turn between 450 and 750 ft AGL',
        tip: 'Glance at the altimeter as you pass 400 ft and look out to the left before turning at 500 ft.',
        trigger: c => c.phase === 'crosswind' && c.phaseT === 0,
        judge: c => ({ ok: c.s.agl >= 450 && c.s.agl <= 750, note: `Turned at ${ft(c.s.agl)} AGL${c.s.agl < 450 ? ' (too low)' : c.s.agl > 750 ? ' (late, the circuit gets wide)' : ''}` }),
      }),
      hold({
        id: 'cct', label: 'Circuit height 1,000 ft AGL', target: '±100 ft on downwind', chan: 'agl', lo: 900, hi: 1100, fmt: ft,
        tip: 'After levelling off, set cruise power, trim, and check the altimeter every few seconds between lookouts and the downwind checks.',
        when: c => c.phase === 'downwind' && c.phaseT > 12,
      }),
      hold({
        id: 'bank', label: 'Bank angle 30° or less', target: 'In every circuit turn', chan: 'bank', val: absBank, lo: 0, hi: 30, grace: 2, band: false, fmt: deg,
        tip: 'Circuit turns are medium turns: about 20–30° of bank. Steeper turns at low speed raise the stall speed.',
        when: c => ['crosswind', 'downwind', 'base', 'final'].includes(c.phase) && c.s.agl > 50,
        passNote: k => `Never more than ${deg(Math.max(k.cur || 0, k.maxSeen || 0))} needed` ,
      }),
      hold({
        id: 'base', label: 'Base leg at 70 kt', target: '70 kt ±5 with flap 10–20°', chan: 'ias', lo: 65, hi: 75, fmt: kt,
        tip: 'Reduce power abeam the threshold, hold the nose up as the speed drops into the white arc, set flap, then trim for 70 kt before the base turn.',
        when: c => c.phase === 'base' && c.phaseT > 8,
      }),
      hold({
        id: 'final', label: 'Final approach at 65 kt', target: '65 kt ±5 with full flap, down to 50 ft', chan: 'ias', lo: 60, hi: 70, fmt: kt,
        tip: 'Attitude controls speed, power controls the descent. Re-trim each time you change flap.',
        when: c => c.phase === 'final' && c.phaseT > 8 && c.s.agl > 50,
      }),
      event({
        id: 'stable', label: 'Stable by 300 ft AGL', target: 'Full flap, 60–70 kt, descending 200–1,000 fpm',
        tip: 'If you are not stable by 300 ft, go around. Being configured early on final makes this easy.',
        trigger: c => c.phase === 'final' && c.s.agl < 300,
        judge: c => {
          const s = c.s, bad = [];
          if (s.flaps < 25) bad.push(`flap ${n0(s.flaps)}°`);
          if (s.ias < 60 || s.ias > 70) bad.push(kt(s.ias));
          if (s.vs > -200 || s.vs < -1000) bad.push(fpm(s.vs));
          return { ok: !bad.length, note: bad.length ? `Not stable: ${bad.join(', ')}` : `Stable: ${kt(s.ias)}, full flap, ${fpm(s.vs)}` };
        },
      }),
      gentleTd('td', 'Gentle touchdown on the centreline', ', within 8 m of the centreline'),
    ],
    isDone: c => c.phase === 'done',
  },

  steep: {
    title: 'Steep turns', short: 'Steep turns',
    sub: 'Two 360° turns at 45° of bank, left then right. Hold altitude ±100 ft and airspeed ±10 kt; roll out on the entry heading.',
    altChan: 'alt', plan: null, readyHint: 'Fly straight and level at a safe height, then roll into the first turn. Entry altitude, speed and heading are taken as you roll in.',
    update(c) {
      const s = c.s, V = c.vars, b = Math.abs(s.bank);
      const accum = () => { V.turned += Math.abs(wrap180(s.hdg - V.lastH)); V.lastH = s.hdg; c.established = V.turned > 40 && V.turned < 320 && b > 30; };
      c.established = false;
      if (s.ground) return;
      switch (c.phase) {
        case 'ready': case 'entry':
          c.phase = 'entry';
          if (b < 10) V.ref = { alt: s.alt, ias: s.ias, hdg: s.hdg };
          if (b > 20 && V.ref) { c.phase = 'turn1'; V.dir1 = Math.sign(s.bank); V.turned = 0; V.lastH = s.hdg; V.entry = { ...V.ref }; }
          break;
        case 'turn1':
          accum();
          if (b < 12 && V.turned > 300) { c.phase = 'between'; c.ev.rollout1 = true; }
          else if (b < 12 && c.phaseT > 4 && V.turned < 300) c.phase = 'entry';
          break;
        case 'between':
          if (b > 20) { c.phase = 'turn2'; V.dir2 = Math.sign(s.bank); V.turned = 0; V.lastH = s.hdg; c.ev.turn2 = true; V.gap = c.phaseT; }
          else if (c.phaseT > 40) c.phase = 'done';
          break;
        case 'turn2':
          accum();
          if (b < 12 && V.turned > 300) { c.phase = 'roll'; c.ev.rollout2 = true; }
          break;
        case 'roll': if (c.phaseT > 6) c.phase = 'done'; break;
      }
    },
    checks: [
      hold({
        id: 'bank45', label: 'Bank 45°', target: '45° ±5 once established', chan: 'bank', val: absBank, lo: 40, hi: 50, grace: 3, band: false, fmt: deg,
        tip: 'Pick a point on the cowling against the horizon for 45° and keep it there; cross-check the attitude indicator.',
        when: c => c.established, until: c => c.phase === 'done',
      }),
      hold({
        id: 'alt', label: 'Hold altitude', target: '±100 ft of the entry altitude', chan: 'alt', lo: c => c.vars.entry.alt - 100, hi: c => c.vars.entry.alt + 100, fmt: ft,
        tip: 'Add back pressure as you pass 30° of bank and relax it as you roll out. In the second turn the change of direction often causes a climb.',
        when: c => c.phase === 'turn1' || c.phase === 'turn2', until: c => c.phase === 'done',
        flagNote: (k, w) => `Reached ${ft(w.v)}, ${n0(Math.abs(w.dev) + 100)} ft ${w.dev > 0 ? 'above' : 'below'} the entry altitude`,
      }),
      hold({
        id: 'spd', label: 'Hold airspeed', target: '±10 kt of the entry speed', chan: 'ias', lo: c => c.vars.entry.ias - 10, hi: c => c.vars.entry.ias + 10, fmt: kt,
        tip: 'Add about 100–200 rpm as you roll in to hold the speed against the extra drag.',
        when: c => c.phase === 'turn1' || c.phase === 'turn2', until: c => c.phase === 'done',
      }),
      event({
        id: 'ro1', label: 'Roll out on the entry heading', target: 'First turn, within 10°',
        tip: 'Start rolling out about 20° before the entry heading (half the bank angle).',
        trigger: c => !!c.ev.rollout1,
        judge: c => { const e = wrap180(c.s.hdg - c.vars.entry.hdg); return { ok: Math.abs(e) <= 10, note: `Rolled out ${n0(Math.abs(e))}° ${Math.abs(e) < 1 ? 'off (on heading)' : e > 0 ? 'right of' : 'left of'} the entry heading` }; },
      }),
      event({
        id: 'rev', label: 'Reverse into the second turn', target: 'Opposite direction, without a long pause',
        tip: 'Roll straight through wings level into the opposite turn, keeping the lookout going.',
        trigger: c => !!c.ev.turn2,
        judge: c => { const V = c.vars, ok = V.dir2 === -V.dir1; return { ok: ok && V.gap < 20, note: ok ? `Reversed ${V.dir2 > 0 ? 'right' : 'left'} after ${n0(V.gap)} s wings level` : 'Second turn in the same direction' }; },
      }),
      event({
        id: 'ro2', label: 'Second roll-out on heading', target: 'Within 10° of the entry heading',
        tip: 'Lead the roll-out by about 20° and relax the back pressure as the wings come level.',
        trigger: c => !!c.ev.rollout2,
        judge: c => { const e = wrap180(c.s.hdg - c.vars.entry.hdg); return { ok: Math.abs(e) <= 10, note: `Rolled out ${n0(Math.abs(e))}° from the entry heading` }; },
      }),
    ],
    isDone: c => c.phase === 'done',
  },

  stall: {
    title: 'Power-off stall and recovery', short: 'Power-off stall',
    sub: 'Power to idle, hold altitude as the speed decays to the stall (about 48 kt clean), then recover: nose down, full power, wings level, climb at Vy.',
    altChan: 'alt', plan: null, readyHint: 'Climb to a safe height and do your HASEL checks, then close the throttle and hold altitude.',
    update(c) {
      const s = c.s, V = c.vars;
      if (s.ground) return;
      switch (c.phase) {
        case 'ready': case 'entry':
          c.phase = 'entry';
          if (s.rpm < 1300 || (fin(s.thr) && s.thr < 0.08)) { c.phase = 'slowing'; V.alt0 = s.alt; V.agl0 = s.agl; V.minIas = s.ias; c.ev.powerOff = true; }
          break;
        case 'slowing':
          V.minIas = Math.min(V.minIas, s.ias);
          if (s.ias < 56 && s.vs < -400) { c.phase = 'recovering'; V.stall = { t: c.t, ias: V.minIas, bank: s.bank, rpm: s.rpm, alt: s.alt }; V.minAlt = s.alt; c.ev.stall = true; }
          else if (s.rpm > 1900 && c.phaseT > 5) c.phase = 'entry';
          break;
        case 'recovering':
          V.minAlt = Math.min(V.minAlt, s.alt);
          if (!V.fullT && s.rpm > 2100) V.fullT = c.t;
          if (s.ias > 62 && s.vs > 100) { c.phase = 'climb'; c.ev.recovered = true; V.loss = V.stall.alt - V.minAlt; }
          break;
        case 'climb':
          if (s.ias < 54 && s.vs < -300) V.secondary = true;
          if (c.phaseT > 20) c.phase = 'done';
          break;
      }
    },
    checks: [
      event({
        id: 'safe', label: 'Entry at a safe height', target: 'At least 2,000 ft AGL (or your school minimum)',
        tip: 'Plan to complete the recovery well above your school\'s minimum height. HASEL: Height, Airframe, Security, Engine, Location, Lookout.',
        trigger: c => !!c.ev.powerOff, judge: c => ({ ok: c.s.agl >= 2000, note: `Power reduced at ${ft(c.s.agl)} AGL` }),
      }),
      hold({
        id: 'althold', label: 'Hold altitude while slowing', target: '±100 ft as the speed decays', chan: 'alt', lo: c => c.vars.alt0 - 100, hi: c => c.vars.alt0 + 100, fmt: ft,
        tip: 'Raise the nose progressively as the speed drops to hold the altitude.',
        when: c => c.phase === 'slowing', until: c => c.phase !== 'slowing',
      }),
      event({
        id: 'idle', label: 'Power at idle at the stall', target: 'Engine below 1,300 rpm',
        tip: 'Close the throttle fully for a power-off stall (carb heat on first in the C172).',
        trigger: c => !!c.ev.stall, judge: c => ({ ok: c.vars.stall.rpm < 1300, note: `${n0(c.vars.stall.rpm)} rpm, stalled at ${kt(c.vars.stall.ias)}` }),
      }),
      event({
        id: 'wings', label: 'Wings level at the stall', target: 'Within 10° of level',
        tip: 'Keep the ball centred with rudder as you slow down; at the stall use rudder, not aileron, to stop a wing drop.',
        trigger: c => !!c.ev.stall, judge: c => ({ ok: Math.abs(c.vars.stall.bank) <= 10, note: `${n0(Math.abs(c.vars.stall.bank))}° of ${c.vars.stall.bank < 0 ? 'left' : 'right'} bank at the stall` }),
      }),
      event({
        id: 'power', label: 'Full power promptly', target: 'Within 3 s of the stall',
        tip: 'Lower the nose first to unstall the wing, then full power straight away.',
        trigger: c => !!c.ev.recovered,
        judge: c => { const V = c.vars, dt = V.fullT ? V.fullT - V.stall.t : null; return { ok: dt != null && dt <= 3, note: dt != null ? `Full power ${dt.toFixed(1)} s after the stall` : 'Full power not applied' }; },
      }),
      event({
        id: 'loss', label: 'Minimum height loss', target: '300 ft or less',
        tip: 'Lower the nose only enough to unstall the wing, then ease out of the dive as soon as the speed passes about 60 kt.',
        trigger: c => !!c.ev.recovered, judge: c => ({ ok: c.vars.loss <= 300, note: `Lost ${ft(c.vars.loss)}` }),
      }),
      vyCheck(c => c.phase === 'climb' && c.phaseT > 5, ' after the recovery'),
      event({
        id: 'second', label: 'No secondary stall', target: 'Speed stays above 54 kt after recovery',
        tip: 'Do not pull too hard when recovering from the dive. Let the speed build first.',
        trigger: c => c.phase === 'done', judge: c => ({ ok: !c.vars.secondary, note: c.vars.secondary ? 'Stalled again during the pull-out' : 'Clean recovery' }),
      }),
    ],
    isDone: c => c.phase === 'done',
  },

  efato: {
    title: 'Engine failure after take-off', short: 'EFATO',
    sub: 'Engine fails in the climb-out. Lower the nose at once, hold best glide 68 kt, land ahead within 30° of the runway heading. No turnback.',
    altChan: 'agl', plan: 'ahead', autoFail: true, readyHint: 'Line up and take off. With the option on, the engine fails at 400 ft AGL.',
    update(c) {
      const s = c.s, V = c.vars;
      if (takeoffPhases(c)) return;
      switch (c.phase) {
        case 'climbout':
          if (c.opts.autoFail && !V.req && s.agl >= 400) { V.req = true; c.act.fail('engine'); }
          if ((s.fail && s.fail.engine) || (s.rpm < 1400 && s.agl > 50)) { c.phase = 'failed'; V.failT = c.t; c.ev.failed = true; }
          break;
        case 'failed': if (s.ground) { c.phase = 'landing'; c.ev.touchdown = touchdown(c); } else if (c.phaseT > 8) c.phase = 'glide'; break;
        case 'glide': if (s.ground) { c.phase = 'landing'; c.ev.touchdown = touchdown(c); } break;
        case 'landing': stopped(c); break;
      }
    },
    checks: [
      vyCheck(c => c.phase === 'climbout' && c.s.agl >= 200, ' before the failure'),
      hold({
        id: 'nose', label: 'Lower the nose at once', target: 'Airspeed stays at or above 60 kt', chan: 'ias', lo: 60, hi: 400, grace: 1, fmt: kt,
        tip: 'With no thrust the speed falls fast in the climb attitude. Push to the glide attitude immediately, before anything else.',
        when: c => (c.phase === 'failed' || c.phase === 'glide') && c.s.agl > 50,
        flagNote: (k, w) => `Speed fell to ${kt(w.v)}`,
      }),
      hold({
        id: 'glide', label: 'Best glide 68 kt', target: '68 kt ±5 once established', chan: 'ias', lo: 63, hi: 73, grace: 4, fmt: kt,
        tip: 'Hold the glide attitude and trim. Every knot away from 68 costs distance.',
        when: c => c.phase === 'glide' && c.s.agl > 100,
      }),
      hold({
        id: 'ahead', label: 'Land ahead, no turnback', target: 'Within 30° of the runway heading', chan: 'd', val: c => Math.abs(c.d), lo: 0, hi: 30, grace: 2, band: false, fmt: deg,
        tip: 'Choose a field within 30° either side of the nose. Turning back at low height is the classic fatal mistake.',
        when: c => (c.phase === 'failed' || c.phase === 'glide') && !c.s.ground,
        passNote: () => 'Stayed within 30° of the runway heading',
      }),
      gentleTd('tdx', 'Touchdown under control'),
    ],
    isDone: c => c.phase === 'done',
  },

  ils: {
    title: 'ILS approach', short: 'ILS approach',
    sub: 'Straight-in ILS to runway 36. Stay within one dot on localiser and glideslope and be stable by 500 ft AGL: landing flap, 60–75 kt, under 1,000 fpm.',
    altChan: 'agl', plan: 'ils', readyHint: 'Tune and identify the ILS on NAV1, then intercept the localiser and glideslope.',
    update(c) {
      const s = c.s;
      switch (c.phase) {
        case 'ready': case 'intercept':
          if (s.ground) { c.phase = 'ready'; break; }
          c.phase = 'intercept';
          if (fin(s.loc) && fin(s.gsd) && Math.abs(s.loc) < 1 && Math.abs(s.gsd) < 1 && s.vs < -250) c.phase = 'approach';
          break;
        case 'approach': if (s.agl < 500) { c.phase = 'short'; c.ev.gate = true; } break;
        case 'short': if (s.ground) { c.phase = 'landing'; c.ev.touchdown = touchdown(c); } break;
        case 'landing': stopped(c); break;
      }
    },
    checks: [
      hold({
        id: 'loc', label: 'Localiser within 1 dot', target: 'From glideslope capture to 200 ft AGL', chan: 'loc', val: c => Math.abs(c.s.loc), lo: 0, hi: 1, grace: 4, band: false, fmt: v => `${v.toFixed(1)} dot`,
        tip: 'Make small heading changes (2–5°) and wait for the needle to respond; the localiser gets more sensitive as you get closer.',
        when: c => (c.phase === 'approach' || c.phase === 'short') && c.s.agl > 200 && fin(c.s.loc),
      }),
      hold({
        id: 'gs', label: 'Glideslope within 1 dot', target: 'From capture to 200 ft AGL', chan: 'gsd', val: c => Math.abs(c.s.gsd), lo: 0, hi: 1, grace: 4, band: false, fmt: v => `${v.toFixed(1)} dot`,
        tip: 'Power sets the rate of descent (about 350–400 fpm at 65–70 kt); small pitch changes keep you on the glideslope.',
        when: c => (c.phase === 'approach' || c.phase === 'short') && c.s.agl > 200 && fin(c.s.gsd),
        flagNote: (k, w) => `Up to ${w.v.toFixed(1)} dot ${k.lastSign > 0 ? 'high' : 'low'}`,
      }),
      event({
        id: 'gate', label: 'Stable by 500 ft AGL', target: 'Landing flap, 60–75 kt, under 1,000 fpm, within 1 dot',
        tip: 'Fly the approach so that everything is set by 1,000 ft. If you are not stable at 500 ft, go around.',
        trigger: c => !!c.ev.gate,
        judge: c => {
          const s = c.s, bad = [];
          if (s.flaps < 20) bad.push(`flap ${n0(s.flaps)}°`);
          if (s.ias < 60 || s.ias > 75) bad.push(kt(s.ias));
          if (s.vs < -1000) bad.push(fpm(s.vs));
          if (fin(s.loc) && Math.abs(s.loc) > 1) bad.push(`localiser ${Math.abs(s.loc).toFixed(1)} dot`);
          if (fin(s.gsd) && Math.abs(s.gsd) > 1) bad.push(`glideslope ${Math.abs(s.gsd).toFixed(1)} dot`);
          return { ok: !bad.length, note: bad.length ? `Not stable: ${bad.join(', ')}` : `Stable: ${kt(s.ias)}, flap ${n0(s.flaps)}°, ${fpm(s.vs)}` };
        },
      }),
      hold({
        id: 'short', label: 'Speed 60–75 kt below 500 ft', target: 'Down to 50 ft AGL', chan: 'ias', lo: 60, hi: 75, fmt: kt,
        tip: 'Keep the trimmed attitude; small power changes only.',
        when: c => c.phase === 'short' && c.s.agl > 50,
      }),
      gentleTd('tdx', 'Gentle touchdown'),
      event({
        id: 'tdz', label: 'Touchdown in the touchdown zone', target: '150–600 m past the threshold', optional: true,
        tip: 'Aim at the aiming-point markings and do not float: close the throttle in the flare.',
        trigger: c => !!c.ev.touchdown,
        judge: c => { const T = c.ev.touchdown; if (!c.rwyKnown || !fin(T.u)) return { na: true, note: 'Runway position not known in live mode' }; return { ok: T.u >= 150 && T.u <= 600, note: `Touched down ${n0(T.u)} m past the threshold` }; },
      }),
    ],
    isDone: c => c.phase === 'done',
  },
};
const EX_ORDER = ['circuit', 'steep', 'stall', 'efato', 'ils'];

const FAILURES = [
  { id: 'engine', label: 'Engine failure', demo: 'The prop windmills; the demo pilot glides at 68 kt and lands.', live: 'The engine stops.' },
  { id: 'alternator', label: 'Alternator failure', demo: 'Battery only: bus volts fall, LOW VOLTS comes on.', live: 'Battery only; LOW VOLTS comes on.' },
  { id: 'vacuum', label: 'Vacuum pump failure', demo: 'LOW VACUUM; the attitude and heading indicators drift.', live: 'Attitude and heading indicators slowly drift.' },
  { id: 'pitot', label: 'Pitot tube blocked', demo: 'Airspeed acts like an altimeter: high in a climb, low in a descent.', live: 'Airspeed indicator acts like an altimeter.' },
  { id: 'static', label: 'Static port blocked', demo: 'Altimeter and VSI freeze; airspeed misreads as height changes.', live: 'Altimeter and VSI freeze; airspeed misreads.' },
];

/* ======================================================= colours, canvas */

function readColors(el) {
  const cs = getComputedStyle(el), g = n => cs.getPropertyValue(n).trim();
  return { paper: g('--g-paper'), surface: g('--g-surface'), sunk: g('--g-sunk'), ink: g('--g-ink'), muted: g('--g-muted'), line: g('--g-line'), magenta: g('--g-magenta'), cyan: g('--g-cyan'), amber: g('--g-amber'), green: g('--g-green'), red: g('--g-red'), fm: g('--g-fm'), fb: g('--g-fb') };
}
function rgba(col, a) {
  let r = 0, g = 0, b = 0;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(col);
  if (m) {
    let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const n = (col.match(/[\d.]+/g) || [0, 0, 0]).map(Number); [r, g, b] = n;
  }
  return `rgba(${r},${g},${b},${a})`;
}
function fitCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, Math.round(cv.clientWidth)), h = Math.max(1, Math.round(cv.clientHeight));
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}
function niceStep(range, target) {
  const raw = range / Math.max(1, target), p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}

/* ================================================================= mount */

export function mountCompanion(root, opts = {}) {
  if (!root) throw new Error('mountCompanion: no root element');
  const doc = root.ownerDocument;
  injectCss(doc);
  const mode = opts.mode === 'demo' ? 'demo' : 'live';
  const eventsUrl = opts.eventsUrl || '/events';
  const apiBase = (opts.apiBase || '/api').replace(/\/$/, '');
  const makeDemo = opts.demo || createDemoFlight;
  const uid = 'gpc' + Math.random().toString(36).slice(2, 8);

  root.innerHTML = '';
  const el = doc.createElement('div');
  el.className = 'gpc';
  el.dataset.mode = mode;
  root.appendChild(el);

  el.innerHTML = `
  <div class="gpc-shell">
    <header class="gpc-head">
      <div>
        <p class="gpc-eyebrow">Glidepath Companion · C172S</p>
        <h3 class="gpc-title" data-r="title">Normal circuit</h3>
        <p class="gpc-sub" data-r="sub"></p>
      </div>
      <div class="gpc-status" role="status" aria-live="polite" data-r="status" data-state="${mode === 'demo' ? 'demo' : 'connecting'}"><i></i><span data-r="statusTxt">${mode === 'demo' ? 'Demo flight (simulated)' : 'Connecting…'}</span></div>
    </header>
    <div class="gpc-exs" role="group" aria-label="Exercise" data-r="exs">
      ${EX_ORDER.map(id => `<button type="button" class="gpc-exb" data-ex="${id}" aria-pressed="false">${esc(EXERCISES[id].short)}</button>`).join('')}
    </div>
    <div class="gpc-hint" data-r="hint" hidden></div>
    <div class="gpc-strip" role="group" aria-label="Live flight data" data-r="strip"></div>
    <div class="gpc-annun" data-r="annun">
      <span class="gpc-ann" data-a="stall">STALL</span><span class="gpc-ann" data-a="volts">LOW VOLTS</span><span class="gpc-ann" data-a="vac">LOW VACUUM</span><span class="gpc-ann" data-a="eng">ENGINE FAILED</span>
      <span class="gpc-phase" data-r="phase">Phase: <b>-</b></span>
    </div>
    <div class="gpc-main">
      <div class="gpc-col">
        <div class="gpc-bar gpc-o1" data-r="bar"></div>
        <figure class="gpc-panel gpc-o2">
          <div class="gpc-ph"><h4>Ground track</h4><span class="gpc-k" data-r="mapK">North up</span></div>
          <div class="gpc-map"><canvas data-r="map" role="img" aria-label="Ground track map with the runway, planned pattern and flown track"></canvas></div>
          <figcaption class="gpc-legend"><span><i class="gpc-li-plan"></i><span data-r="planLbl">Planned circuit</span></span><span><i></i>Flown track</span><span><svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true"><path d="M0-7 1.2-2 7 .5 7 2 1.2 1 .8 5 2.6 6.5 2.6 7.5 0 6.8-2.6 7.5-2.6 6.5-.8 5-1.2 1-7 2-7 .5-1.2-2Z" fill="currentColor"/></svg>Aircraft</span></figcaption>
          <div class="gpc-scrub" data-r="scrub" hidden style="margin-top:12px">
            <button type="button" class="gpc-btn" data-r="rplay">${ICON.play}<span>Replay</span></button>
            <input type="range" min="0" max="0" value="0" step="1" data-r="range" aria-label="Replay position">
            <output data-r="rout" for="${uid}r"></output>
          </div>
        </figure>
        <figure class="gpc-panel gpc-o4">
          <div class="gpc-ph"><h4>Height and airspeed</h4><span class="gpc-k" data-r="trK">Flight time</span></div>
          <div class="gpc-tr"><canvas data-r="tr" role="img" aria-label="Height and airspeed traces against time, with tolerance bands"></canvas><div class="gpc-pop" data-r="pop" hidden></div></div>
          <figcaption class="gpc-legend"><span><i></i>Flown</span><span><i class="gpc-li-band"></i>Tolerance while a check is active</span><span><i class="gpc-li-exc"></i>Outside tolerance</span></figcaption>
        </figure>
      </div>
      <div class="gpc-col">
        <section class="gpc-panel gpc-o3" data-r="checksP" aria-labelledby="${uid}ch">
          <div class="gpc-ph"><h4 id="${uid}ch">Checks</h4><span class="gpc-k">Running score</span></div>
          <div class="gpc-score"><b data-r="score">-</b><span data-r="scoreTxt">No checks scored yet</span></div>
          <div class="gpc-meter" data-r="meter" aria-hidden="true"></div>
          <p class="gpc-coach" data-r="coach"></p>
          <ol class="gpc-list" data-r="list"></ol>
        </section>
        <section class="gpc-panel gpc-o3" data-r="debrief" hidden aria-labelledby="${uid}db"></section>
        <section class="gpc-panel gpc-o5" aria-labelledby="${uid}in">
          <div class="gpc-ph"><h4 id="${uid}in">Instructor</h4><span class="gpc-k">Failures</span></div>
          <label class="gpc-opt" data-r="autoOpt" hidden><input type="checkbox" data-r="auto" checked><span>Fail the engine automatically at 400 ft AGL after take-off</span></label>
          <div data-r="fails"></div>
          <div class="gpc-actions"><button type="button" class="gpc-btn" data-r="fixAll">Clear all failures</button></div>
          <p class="gpc-msg" data-r="instMsg" aria-live="polite"></p>
          <p class="gpc-note" data-r="instNote"></p>
        </section>
      </div>
    </div>
  </div>`;

  const R = {};
  el.querySelectorAll('[data-r]').forEach(n => { R[n.dataset.r] = n; });

  /* ---------------------------------------------------------- strip */
  const TILES = [
    ['ias', 'IAS', 'kt'], ['alt', 'ALT', 'ft'], ['agl', 'AGL', 'ft'], ['vs', 'VS', 'fpm'],
    ['hdg', 'HDG', '°M'], ['rpm', 'RPM', ''], ['flaps', 'Flaps', ''], ['gnd', 'Status', ''],
  ];
  R.strip.innerHTML = TILES.map(([k, l, u]) => `<div class="gpc-tile" data-t="${k}"><span class="gpc-tk">${l}${u ? `<span class="gpc-ku">${u}</span>` : ''}</span><span class="gpc-tv${k === 'gnd' || k === 'flaps' ? ' gpc-txt' : ''}"><span data-v>-</span>${u ? `<small>${u}</small>` : ''}</span></div>`).join('');
  const tileV = {}, tileEl = {};
  R.strip.querySelectorAll('[data-t]').forEach(n => { tileEl[n.dataset.t] = n; tileV[n.dataset.t] = n.querySelector('[data-v]'); });

  /* ---------------------------------------------------------- state */
  const st = {
    exId: EXERCISES[opts.exercise] ? opts.exercise : 'circuit',
    s: null, prev: null, t: 0, rec: [], lastRecT: -1, frame: null, rwy: null, rwyKnown: false,
    tracker: null, ended: false, replayI: -1, replayPlaying: false, hoverT: null,
    fails: { engine: false, alternator: false, vacuum: false, pitot: false, static: false }, busy: {},
    autoFail: true, speed: 1, playing: true, visible: true, sim: null, acc: 0,
    bounds: null, dirty: true, lastPaint: 0, lastWall: 0, statusState: mode === 'demo' ? 'demo' : 'connecting', destroyed: false,
    roll: null, maxBank: 0,
  };

  /* ---------------------------------------------------------- local frame */
  function setFrame(lat, lon) { st.frame = { lat, lon, k: Math.cos(lat * D2R) }; }
  function toXY(lat, lon) { return { x: (lon - st.frame.lon) * M_PER_DEG * st.frame.k, y: (lat - st.frame.lat) * M_PER_DEG }; }
  function rwyUV(x, y) {
    const r = st.rwy; if (!r) return { u: null, v: null };
    const dx = x - r.x, dy = y - r.y, h = r.hdg * D2R;
    return { u: dx * Math.sin(h) + dy * Math.cos(h), v: dx * Math.cos(h) - dy * Math.sin(h) };
  }
  function uvToXY(u, v) {
    const r = st.rwy, h = r.hdg * D2R;
    return { x: r.x + u * Math.sin(h) + v * Math.cos(h), y: r.y + u * Math.cos(h) - v * Math.sin(h) };
  }

  /* ---------------------------------------------------------- tracker */
  function newTracker() {
    const def = EXERCISES[st.exId];
    const checks = def.checks.map(f => f());
    const c = { phase: 'ready', phaseT: 0, ev: {}, vars: {}, s: null, prev: null, t: 0, d: 0, u: null, v: null, rwy: null, rwyKnown: false, established: false,
      opts: { get autoFail() { return st.autoFail; } }, act: { fail: name => setFailure(name, true, true) } };
    return { def, checks, c };
  }

  function resetSession() {
    st.s = null; st.prev = null; st.t = 0; st.rec = []; st.lastRecT = -1; st.bounds = null; st.ended = false; st.replayI = -1; st.replayPlaying = false; st.hoverT = null;
    st.roll = null; st.maxBank = 0;
    if (mode === 'demo') {
      st.sim = makeDemo(st.exId);
      const r = st.sim.runway;
      setFrame(r.lat, r.lon);
      st.rwy = { x: 0, y: 0, hdg: r.hdg, len: r.lengthM, wid: r.widthM, ident: r.ident, recip: r.recip };
      st.rwyKnown = true;
      st.acc = 0;
      st.fails = st.sim.failures;
    } else {
      st.frame = null; st.rwy = null; st.rwyKnown = false;
    }
    st.tracker = newTracker();
    R.debrief.hidden = true; R.checksP.hidden = false; R.scrub.hidden = true;
    renderHeader(); renderChecksSkeleton(); renderBar(); renderFails();
    st.dirty = true;
  }

  /* ---------------------------------------------------------- ingest */
  function ingest(raw, dt) {
    if (st.ended || !raw) return;
    if (!fin(raw.lat) || !fin(raw.lon)) return;
    if (!st.frame) setFrame(raw.lat, raw.lon);
    st.t += dt;
    const p = toXY(raw.lat, raw.lon);
    const prev = st.s;
    const s = { ...raw, t: st.t, x: p.x, y: p.y };
    if (!fin(s.trk)) s.trk = s.hdg;
    if (!fin(s.gs)) s.gs = s.ias;
    if (!fin(s.agl)) s.agl = 0;
    if (s.fail) Object.keys(st.fails).forEach(k => { if (!st.busy[k] && k in s.fail) st.fails[k] = !!s.fail[k]; });

    // Live mode: take the runway from the take-off roll.
    if (!st.rwyKnown) {
      if (s.ground && s.ias < 8) st.roll = { x: s.x, y: s.y };
      if (s.ground && s.ias > 30 && st.roll && !st.rwy) st.rwy = { x: st.roll.x, y: st.roll.y, hdg: norm360(s.trk), len: 900, wid: 23, ident: rwyIdent(s.trk), recip: rwyIdent(s.trk + 180), synthetic: true };
      if (st.rwy && st.rwy.synthetic && !st.rwy.locked && prev && prev.ground && !s.ground) {
        const dx = s.x - st.rwy.x, dy = s.y - st.rwy.y;
        if (Math.hypot(dx, dy) > 150) st.rwy.hdg = norm360(Math.atan2(dx, dy) * R2D);
        st.rwy.ident = rwyIdent(st.rwy.hdg); st.rwy.recip = rwyIdent(st.rwy.hdg + 180); st.rwy.locked = true;
      }
      if (!st.rwy && st.exId === 'ils' && prev && !prev.ground && s.ground) {
        const h = norm360(s.trk) * D2R;
        st.rwy = { x: s.x - 300 * Math.sin(h), y: s.y - 300 * Math.cos(h), hdg: norm360(s.trk), len: 900, wid: 23, ident: rwyIdent(s.trk), recip: rwyIdent(s.trk + 180), synthetic: true, locked: true };
      }
    }

    const T = st.tracker, c = T.c;
    c.s = s; c.prev = prev; c.t = st.t; c.dt = dt; c.ev = {}; c.rwy = st.rwy; c.rwyKnown = st.rwyKnown;
    c.d = st.rwy ? wrap180(s.trk - st.rwy.hdg) : 0;
    const uv = rwyUV(s.x, s.y); c.u = uv.u; c.v = uv.v;
    const before = c.phase;
    T.def.update(c);
    if (c.phase !== before) c.phaseT = 0; else c.phaseT += dt;
    for (const k of T.checks) {
      k.update(c, dt);
      if (k.id === 'bank' && k.status === 'active') k.maxSeen = Math.max(k.maxSeen || 0, Math.abs(s.bank));
    }
    // ILS glideslope sign for the debrief wording
    const gsK = T.checks.find(k => k.id === 'gs'); if (gsK && gsK.status === 'active' && fin(s.gsd) && Math.abs(s.gsd) > 1) gsK.lastSign = Math.sign(s.gsd);

    s.phase = c.phase;
    st.prev = prev; st.s = s;
    if (st.t - st.lastRecT >= 0.5 || st.lastRecT < 0) { st.rec.push(s); st.lastRecT = st.t; }
    st.dirty = true;
    if (T.def.isDone(c)) endExercise();
  }

  function rwyIdent(h) { let n = Math.round(norm360(h) / 10); if (n === 0) n = 36; return String(n).padStart(2, '0'); }

  /* ---------------------------------------------------------- failures */
  async function setFailure(name, on, auto = false) {
    if (mode === 'demo') {
      st.sim.setFailure(name, on);
      st.fails = st.sim.failures;
      msg(auto ? `Engine failure given automatically at ${ft(st.s ? st.s.agl : 400)} AGL.` : '', '');
      renderFails(); st.dirty = true;
      return;
    }
    st.busy[name] = true; st.fails[name] = on; renderFails();
    try {
      const r = await fetch(`${apiBase}/failure`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, on }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
      msg(auto ? 'Engine failure sent to X-Plane at 400 ft AGL.' : `${FAILURES.find(f => f.id === name).label} ${on ? 'given' : 'cleared'}.`, 'ok');
    } catch (err) {
      st.fails[name] = !on;
      msg(`X-Plane did not accept that: ${err.message}`, 'err');
    } finally { delete st.busy[name]; renderFails(); }
  }
  async function clearAll() {
    if (mode === 'demo') { FAILURES.forEach(f => st.sim.setFailure(f.id, false)); st.fails = st.sim.failures; renderFails(); msg('All failures cleared.', 'ok'); return; }
    try {
      const r = await fetch(`${apiBase}/command`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'fix_all' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
      FAILURES.forEach(f => { st.fails[f.id] = false; }); renderFails(); msg('All failures cleared in X-Plane.', 'ok');
    } catch (err) { msg(`Could not clear failures: ${err.message}`, 'err'); }
  }
  function msg(text, kind) { R.instMsg.textContent = text; R.instMsg.className = 'gpc-msg' + (kind ? ' ' + kind : ''); }

  function renderFails() {
    const html = FAILURES.map(f => {
      const on = !!st.fails[f.id];
      return `<div class="gpc-fail"><span class="gpc-nm" id="${uid}f${f.id}">${esc(f.label)}${on ? '<span class="gpc-ontxt">Failed</span>' : ''}</span>
        <button type="button" class="gpc-switch" role="switch" aria-checked="${on}" aria-labelledby="${uid}f${f.id}" data-fail="${f.id}" ${st.busy[f.id] ? 'data-busy="true"' : ''}></button>
        <p>${esc(mode === 'demo' ? f.demo : f.live)}</p></div>`;
    }).join('');
    if (R.fails._html !== html) {
      const focused = doc.activeElement && doc.activeElement.dataset ? doc.activeElement.dataset.fail : null;
      R.fails.innerHTML = html; R.fails._html = html;
      if (focused) { const b = R.fails.querySelector(`[data-fail="${focused}"]`); if (b) b.focus(); }
    }
    const def = EXERCISES[st.exId];
    R.autoOpt.hidden = !def.autoFail;
    R.auto.checked = st.autoFail;
    let note = mode === 'demo'
      ? 'Try a failure: the demo flight reacts. Checks use the aircraft\'s real flight path, so instrument failures do not change the score.'
      : 'Failures are sent to X-Plane straight away. Checks use the aircraft\'s real flight path, so instrument failures do not change the score.';
    if (mode === 'demo' && st.sim && st.sim.committed) note = 'The demo pilot is committed to a forced landing. Restart to fly again.';
    if (R.instNote.textContent !== note) R.instNote.textContent = note;
  }

  /* ---------------------------------------------------------- header, bar */
  function renderHeader() {
    const def = EXERCISES[st.exId];
    R.title.textContent = def.title;
    R.sub.textContent = def.sub;
    R.exs.querySelectorAll('[data-ex]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ex === st.exId)));
    R.planLbl.textContent = def.plan === 'circuit' ? 'Planned circuit' : def.plan === 'ahead' ? 'Land-ahead sector (±30°)' : def.plan === 'ils' ? 'Localiser course' : 'Entry point';
    R.trK.textContent = 'Against flight time';
  }

  function renderBar() {
    if (mode === 'demo') {
      R.bar.innerHTML = `
        <button type="button" class="gpc-btn" data-b="play" aria-label="Pause">${ICON.pause}<span>Pause</span></button>
        <div class="gpc-prog"><div class="gpc-trk"><span data-b="fill"></span></div><div class="gpc-lbl"><span data-b="leg">-</span><span data-b="clock">0:00</span></div></div>
        <div class="gpc-seg" role="group" aria-label="Playback speed">${[1, 4, 8].map(x => `<button type="button" data-speed="${x}" aria-pressed="${st.speed === x}">${x}×</button>`).join('')}</div>
        <button type="button" class="gpc-btn" data-b="restart" aria-label="Restart the demo flight">${ICON.restart}<span>Restart</span></button>
        <button type="button" class="gpc-btn" data-b="skip" aria-label="Skip to debrief" title="Fly the rest instantly and open the debrief">${ICON.skip}<span class="gpc-long">Skip to debrief</span></button>`;
    } else {
      R.bar.innerHTML = `
        <div class="gpc-prog"><div class="gpc-lbl"><span data-b="leg">Tracking starts when data arrives</span><span data-b="clock">0:00</span></div></div>
        <button type="button" class="gpc-btn" data-b="restart">${ICON.restart}<span>Restart exercise</span></button>
        <button type="button" class="gpc-btn primary" data-b="end">End and debrief</button>`;
    }
    R.bar._fill = R.bar.querySelector('[data-b=fill]'); R.bar._leg = R.bar.querySelector('[data-b=leg]'); R.bar._clock = R.bar.querySelector('[data-b=clock]'); R.bar._play = R.bar.querySelector('[data-b=play]');
    syncPlay();
  }
  function syncPlay() {
    const b = R.bar._play; if (!b) return;
    const playing = st.playing && !st.ended;
    b.innerHTML = `${playing ? ICON.pause : ICON.play}<span>${playing ? 'Pause' : 'Play'}</span>`;
    b.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    b.disabled = st.ended;
    const sk = R.bar.querySelector('[data-b=skip]'); if (sk) sk.disabled = st.ended;
  }

  /* ---------------------------------------------------------- checks UI */
  const STATE_TXT = { pending: 'Not yet', active: 'Watching', warn: 'Watching', pass: 'Good', flag: 'Needs work', missed: 'Not flown', na: 'n/a' };
  const STATE_ICO = { pending: '', active: '', warn: '', pass: '✓', flag: '!', missed: '–', na: '–' };
  function viewState(k) { return k.status === 'active' && (k.exc || k.out) ? 'warn' : k.status; }

  function renderChecksSkeleton() {
    R.list.innerHTML = st.tracker.checks.map(k => `<li class="gpc-chk" data-id="${k.id}" data-st="pending"><span class="gpc-ico" aria-hidden="true"></span><span class="gpc-chk-l">${esc(k.label)}</span><span class="gpc-chk-s">Not yet</span><span class="gpc-chk-n">${esc(k.target)}</span></li>`).join('');
    R.list._rows = {};
    R.list.querySelectorAll('[data-id]').forEach(li => { R.list._rows[li.dataset.id] = { li, ico: li.querySelector('.gpc-ico'), s: li.querySelector('.gpc-chk-s'), n: li.querySelector('.gpc-chk-n'), key: '' }; });
  }

  function scoreOf(checks) {
    let pts = 0, n = 0, p = 0, f = 0, m = 0;
    for (const k of checks) {
      if (k.status === 'pass') { pts += 1; n++; p++; } else if (k.status === 'flag') { pts += k.points; n++; f++; } else if (k.status === 'missed') { n++; m++; }
    }
    return { score: n ? Math.round(100 * pts / n) : null, n, p, f, m, total: checks.filter(k => k.status !== 'na').length };
  }

  function renderChecks() {
    const T = st.tracker, rows = R.list._rows;
    for (const k of T.checks) {
      const row = rows[k.id]; if (!row) continue;
      const vs = viewState(k);
      let note = k.target;
      if (k.status === 'active') { const l = k.live(); note = `${k.target} · now ${l}`; if (k.exc) note += ' · out of tolerance earlier'; }
      else if (k.status !== 'pending') note = k.note;
      const key = vs + '|' + note;
      if (row.key === key) continue;
      row.key = key;
      row.li.dataset.st = vs;
      row.ico.textContent = STATE_ICO[vs];
      row.s.textContent = STATE_TXT[vs];
      row.n.textContent = note;
    }
    const sc = scoreOf(T.checks);
    R.score.innerHTML = sc.score == null ? '-' : `${sc.score}<small>%</small>`;
    R.scoreTxt.textContent = sc.n ? `${sc.n} of ${sc.total} checks scored` : 'No checks scored yet';
    const tot = Math.max(1, sc.total);
    R.meter.innerHTML = `<span class="gpc-mp" style="width:${100 * sc.p / tot}%"></span><span class="gpc-mf" style="width:${100 * sc.f / tot}%"></span><span class="gpc-mm" style="width:${100 * sc.m / tot}%"></span>`;
    // coach line
    const c = T.c, def = T.def;
    let coach;
    const act = T.checks.find(k => k.status === 'active' && k.id !== 'bank') || T.checks.find(k => k.status === 'active');
    const next = T.checks.find(k => k.status === 'pending');
    if (!st.s) coach = mode === 'demo' ? 'Starting the demo flight…' : 'Waiting for flight data from X-Plane.';
    else if (c.phase === 'ready' || (st.exId === 'steep' && c.phase === 'entry') || (st.exId === 'stall' && c.phase === 'entry') || (st.exId === 'ils' && c.phase === 'intercept')) coach = `<b>Brief</b>${esc(def.readyHint)}`;
    else if (act) coach = `<b>Now</b>${esc(act.label)}: ${esc(act.live())}${act.out ? ' (outside tolerance)' : ''}`;
    else if (next) coach = `<b>Next</b>${esc(next.label)} (${esc(next.target)})`;
    else coach = '<b>Done</b>All checks scored. Finishing the exercise…';
    if (R.coach._h !== coach) { R.coach.innerHTML = coach; R.coach._h = coach; }
  }

  /* ---------------------------------------------------------- strip UI */
  function setTile(k, txt, bad = false, title = '') {
    if (tileV[k].textContent !== txt) tileV[k].textContent = txt;
    tileEl[k].classList.toggle('gpc-bad', bad);
    if (title) tileEl[k].title = title; else tileEl[k].removeAttribute('title');
  }
  function renderStrip(s) {
    if (!s) { TILES.forEach(([k]) => setTile(k, '-')); return; }
    const f = st.fails;
    const iasI = fin(s.iasInd) ? s.iasInd : s.ias, altI = fin(s.altInd) ? s.altInd : s.alt, vsI = fin(s.vsInd) ? s.vsInd : s.vs;
    setTile('ias', n0(iasI), f.pitot || f.static, f.pitot || f.static ? `Instrument reading. Actual ${kt(s.ias)}` : '');
    setTile('alt', n0(Math.round(altI / 10) * 10), f.static, f.static ? `Instrument reading. Actual ${ft(s.alt)}` : '');
    setTile('agl', n0(s.agl < 50 ? s.agl : Math.round(s.agl / 10) * 10));
    setTile('vs', (vsI > 20 ? '+' : '') + n0(Math.round(vsI / 10) * 10), f.static, f.static ? `Instrument reading. Actual ${fpm(s.vs)}` : '');
    setTile('hdg', fin(s.hdg) ? String(Math.round(norm360(s.hdg)) % 360 || 360).padStart(3, '0') : '-');
    setTile('rpm', fin(s.rpm) ? n0(Math.round(s.rpm / 10) * 10) : '-', f.engine);
    const fl = s.flaps; setTile('flaps', !fin(fl) ? '-' : fl < 2 ? 'Up' : fl > 27 ? 'Full' : `${n0(fl)}°`);
    setTile('gnd', s.ground ? 'On ground' : 'Airborne');
    const ann = (a, on) => R.annun.querySelector(`[data-a=${a}]`).classList.toggle('gpc-on', !!on);
    ann('stall', s.stall); R.annun.querySelector('[data-a=stall]').classList.add('gpc-crit');
    ann('volts', fin(s.volts) ? s.volts < 24.5 : f.alternator);
    ann('vac', fin(s.suction) ? s.suction < 3.0 : f.vacuum);
    ann('eng', f.engine); R.annun.querySelector('[data-a=eng]').classList.add('gpc-crit');
  }

  /* ---------------------------------------------------------- map */
  function planGeometry() {
    const def = EXERCISES[st.exId], out = { lines: [], labels: [], marks: [] };
    if (!st.rwy) {
      if (!def.plan && st.rec.length) { const e = entryRec(); if (e) out.marks.push({ x: e.x, y: e.y, label: 'Entry' }); }
      return out;
    }
    const P = (u, v) => uvToXY(u, v);
    if (def.plan === 'circuit') {
      const side = (st.tracker.c.vars.dir || -1) < 0 ? -1 : 1, off = 1900 * side;
      const pts = [P(0, 0), P(2300, 0), P(2300, off), P(-3300, off), P(-3300, 0), P(0, 0)];
      out.lines.push(pts);
      out.labels.push({ ...P(1750, 0), t: 'Upwind', side: -side }, { ...P(2300, off / 2), t: 'Crosswind', side: 1 }, { ...P(-500, off), t: 'Downwind', side }, { ...P(-3300, off / 2), t: 'Base', side: 1 }, { ...P(-1700, 0), t: 'Final', side: -side });
    } else if (def.plan === 'ahead') {
      const o = P(st.rwy.len * 0.5, 0);
      const far = 4200, l = { x: o.x + far * Math.sin((st.rwy.hdg - 30) * D2R), y: o.y + far * Math.cos((st.rwy.hdg - 30) * D2R) }, r = { x: o.x + far * Math.sin((st.rwy.hdg + 30) * D2R), y: o.y + far * Math.cos((st.rwy.hdg + 30) * D2R) };
      out.lines.push([l, o, r]);
      out.labels.push({ ...P(3600, 0), t: 'Land ahead', side: 0 });
    } else if (def.plan === 'ils') {
      out.lines.push([P(-11500, 0), P(0, 0)]);
      out.labels.push({ ...P(-7000, 0), t: 'Localiser 36', side: 1 });
    } else if (st.rec.length) {
      const e = entryRec(); if (e) out.marks.push({ x: e.x, y: e.y, label: 'Entry' });
    }
    return out;
  }
  function entryRec() {
    const c = st.tracker.c;
    return st.rec.find(r => r.phase && r.phase !== 'ready' && r.phase !== 'entry') || null;
  }

  function drawPlane(g, x, y, hdg, col, ring, size = 1) {
    g.save(); g.translate(x, y); g.rotate(hdg * D2R); g.scale(size, size);
    g.beginPath();
    g.moveTo(0, -11); g.lineTo(1.8, -3); g.lineTo(11, 0.8); g.lineTo(11, 3); g.lineTo(1.8, 1.6); g.lineTo(1.2, 7.6); g.lineTo(4, 9.6); g.lineTo(4, 11); g.lineTo(0, 10.1);
    g.lineTo(-4, 11); g.lineTo(-4, 9.6); g.lineTo(-1.2, 7.6); g.lineTo(-1.8, 1.6); g.lineTo(-11, 3); g.lineTo(-11, 0.8); g.lineTo(-1.8, -3); g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = ring; g.stroke(); g.fillStyle = col; g.fill();
    g.restore();
  }

  function drawMap(C) {
    const { g, w, h } = fitCanvas(R.map);
    g.clearRect(0, 0, w, h);
    g.fillStyle = C.sunk; g.fillRect(0, 0, w, h);
    const plan = planGeometry();
    const pts = [];
    plan.lines.forEach(l => pts.push(...l));
    plan.marks.forEach(m => pts.push(m));
    if (st.rwy) { pts.push(uvToXY(-200, -200), uvToXY(st.rwy.len + 200, 200)); }
    const step = Math.max(1, Math.floor(st.rec.length / 400));
    for (let i = 0; i < st.rec.length; i += step) pts.push(st.rec[i]);
    if (st.s) pts.push(st.s);
    if (!pts.length) {
      g.fillStyle = C.muted; g.font = `500 13px ${C.fb}`; g.textAlign = 'center';
      g.fillText(mode === 'demo' ? 'Loading demo flight…' : 'The track appears when flight data arrives.', w / 2, h / 2);
      return;
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    const minSpan = 2500;
    if (x1 - x0 < minSpan) { const m = (x0 + x1) / 2; x0 = m - minSpan / 2; x1 = m + minSpan / 2; }
    if (y1 - y0 < minSpan) { const m = (y0 + y1) / 2; y0 = m - minSpan / 2; y1 = m + minSpan / 2; }
    const B = st.bounds;
    st.bounds = B ? { x0: Math.min(B.x0, x0), x1: Math.max(B.x1, x1), y0: Math.min(B.y0, y0), y1: Math.max(B.y1, y1) } : { x0, x1, y0, y1 };
    ({ x0, x1, y0, y1 } = st.bounds);
    const pad = 34;
    const sc = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const X = x => w / 2 + (x - mx) * sc, Y = y => h / 2 - (y - my) * sc;

    // grid every nautical mile
    g.strokeStyle = rgba(C.ink, 0.07); g.lineWidth = 1;
    const gx0 = Math.floor((mx - w / 2 / sc) / NM) * NM, gy0 = Math.floor((my - h / 2 / sc) / NM) * NM;
    g.beginPath();
    for (let gx = gx0; X(gx) < w; gx += NM) { g.moveTo(Math.round(X(gx)) + 0.5, 0); g.lineTo(Math.round(X(gx)) + 0.5, h); }
    for (let gy = gy0; Y(gy) > 0; gy += NM) { g.moveTo(0, Math.round(Y(gy)) + 0.5); g.lineTo(w, Math.round(Y(gy)) + 0.5); }
    g.stroke();

    // plan
    g.strokeStyle = C.magenta; g.lineWidth = 1.8; g.setLineDash([7, 6]);
    for (const l of plan.lines) { g.beginPath(); l.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.stroke(); }
    g.setLineDash([]);
    // flown track
    const cut = st.ended && st.replayI >= 0 ? st.replayI : st.rec.length - 1;
    const path = (a, b) => { g.beginPath(); for (let i = a; i <= b; i++) { const p = st.rec[i]; i === a ? g.moveTo(X(p.x), Y(p.y)) : g.lineTo(X(p.x), Y(p.y)); } };
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (st.rec.length > 1) {
      if (cut < st.rec.length - 1) { path(cut, st.rec.length - 1); g.strokeStyle = rgba(C.cyan, 0.3); g.lineWidth = 2; g.stroke(); }
      path(0, Math.max(0, cut)); if (!st.ended && st.s) g.lineTo(X(st.s.x), Y(st.s.y));
      g.strokeStyle = C.surface; g.lineWidth = 5; g.stroke();
      g.strokeStyle = C.cyan; g.lineWidth = 2.5; g.stroke();
    }
    // runway
    if (st.rwy) {
      const r = st.rwy, hw = Math.max(r.wid / 2, 3.5 / sc);
      const c4 = [uvToXY(0, -hw), uvToXY(r.len, -hw), uvToXY(r.len, hw), uvToXY(0, hw)];
      g.beginPath(); c4.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y)))); g.closePath();
      g.lineWidth = 2; g.strokeStyle = C.sunk; g.stroke(); g.fillStyle = C.ink; g.globalAlpha = r.synthetic ? 0.55 : 0.85; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = C.surface; g.setLineDash([4, 4]); g.lineWidth = 1;
      const a = uvToXY(60, 0), b = uvToXY(r.len - 60, 0);
      if (r.len * sc > 50) { g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(b.x), Y(b.y)); g.stroke(); }
      g.setLineDash([]);
      g.font = `700 11px ${C.fm}`; g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lo = 16 / sc, n1 = uvToXY(0, lo), n2 = uvToXY(r.len, lo);
      g.textAlign = 'left';
      g.lineWidth = 4; g.strokeStyle = C.sunk; g.strokeText(r.ident, X(n1.x), Y(n1.y)); g.strokeText(r.recip, X(n2.x), Y(n2.y));
      g.fillText(r.ident, X(n1.x), Y(n1.y)); g.fillText(r.recip, X(n2.x), Y(n2.y));
    }

    // check moments in debrief
    if (st.ended) {
      for (const k of st.tracker.checks) {
        if (k.status !== 'flag' || k.t == null) continue;
        const r = recAt(k.t); if (!r) continue;
        g.beginPath(); g.arc(X(r.x), Y(r.y), 5, 0, Math.PI * 2); g.fillStyle = C.amber; g.fill(); g.lineWidth = 2; g.strokeStyle = C.surface; g.stroke();
      }
    }
    g.font = `600 11.5px ${C.fm}`; g.textBaseline = 'middle';
    for (const L of plan.labels) {
      const px = X(L.x), py = Y(L.y);
      g.textAlign = L.side < 0 ? 'right' : L.side > 0 ? 'left' : 'center';
      const dx = L.side < 0 ? -9 : L.side > 0 ? 9 : 0;
      g.lineWidth = 4; g.strokeStyle = C.sunk; g.strokeText(L.t, px + dx, py); g.fillStyle = C.magenta; g.fillText(L.t, px + dx, py);
    }
    for (const m of plan.marks) {
      g.beginPath(); g.arc(X(m.x), Y(m.y), 4.5, 0, Math.PI * 2); g.fillStyle = C.magenta; g.fill();
      g.textAlign = 'left'; g.fillText(m.label, X(m.x) + 9, Y(m.y));
    }

    // aircraft
    const cur = st.ended && st.replayI >= 0 ? st.rec[st.replayI] : st.s;
    if (cur) drawPlane(g, X(cur.x), Y(cur.y), cur.hdg, C.ink, C.surface, 1.2);

    // north arrow + scale bar
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = C.muted; g.font = `700 11px ${C.fm}`;
    g.beginPath(); g.moveTo(w - 22, 14); g.lineTo(w - 27, 27); g.lineTo(w - 22, 24); g.lineTo(w - 17, 27); g.closePath(); g.fill();
    g.fillText('N', w - 22, 40);
    let barM = NM; if (NM * sc > w * 0.35) barM = NM / 2; if (NM * sc < 40) barM = NM * 2;
    const bl = barM * sc, bx = 14, by = h - 14;
    g.strokeStyle = C.muted; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by - 5); g.lineTo(bx, by); g.lineTo(bx + bl, by); g.lineTo(bx + bl, by - 5); g.stroke();
    g.textAlign = 'left'; g.fillText(`${barM / NM} NM`, bx + bl + 7, by + 1);
  }

  function recAt(t) {
    const a = st.rec; if (!a.length) return null;
    let lo = 0, hi = a.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].t < t) lo = m + 1; else hi = m; }
    if (lo > 0 && Math.abs(a[lo - 1].t - t) < Math.abs(a[lo].t - t)) lo--;
    return a[lo];
  }
  function recIndexAt(t) { const r = recAt(t); return r ? st.rec.indexOf(r) : -1; }

  /* ---------------------------------------------------------- traces */
  let trLayout = null;
  function drawTraces(C) {
    const { g, w, h } = fitCanvas(R.tr);
    g.clearRect(0, 0, w, h);
    const def = EXERCISES[st.exId];
    const tMax = st.ended ? Math.max(30, st.t) : mode === 'demo' && st.sim ? Math.max(st.sim.duration, st.t) : Math.max(120, st.t * 1.08);
    const left = 50, right = 12, top = 24, gap = 44, bottom = 24;
    const ph = (h - top - bottom - gap) / 2;
    const panels = [
      { key: def.altChan, label: def.altChan === 'agl' ? 'Height above field (ft)' : 'Altitude (ft)', y0: top, unit: 'ft', min: def.altChan === 'agl' ? 0 : null, minSpan: 400 },
      { key: 'ias', label: 'Indicated airspeed (kt)', y0: top + ph + gap, unit: 'kt', min: null, minSpan: 40 },
    ];
    const X = t => left + (t / tMax) * (w - left - right);
    trLayout = { left, right, w, tMax, X };
    const allBands = st.tracker.checks.filter(k => k.band && k.chan).flatMap(k => k.bands.map(b => ({ ...b, chan: k.chan })));
    const cut = st.ended && st.replayI >= 0 ? st.rec[st.replayI].t : null;

    for (const P of panels) {
      const vals = st.rec.map(r => r[P.key]).filter(fin);
      if (st.s && fin(st.s[P.key])) vals.push(st.s[P.key]);
      const bandsP = allBands.filter(b => b.chan === P.key);
      bandsP.forEach(b => { vals.push(b.lo, b.hi); });
      let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : P.minSpan;
      if (P.key === 'ias') { lo = Math.min(lo, 40); hi = Math.max(hi, 100); bandsP.forEach(b => { lo = Math.min(lo, b.lo - 5); hi = Math.max(hi, b.hi + 5); }); lo = Math.max(0, lo); }
      if (hi - lo < P.minSpan) { const m = (hi + lo) / 2; lo = m - P.minSpan / 2; hi = m + P.minSpan / 2; }
      if (P.min != null) lo = Math.min(P.min, lo);
      const stepV = niceStep(hi - lo, 4);
      lo = Math.floor(lo / stepV) * stepV; hi = Math.ceil(hi / stepV) * stepV;
      if (P.min != null && lo < P.min) lo = P.min;
      const Y = v => P.y0 + ph - ((v - lo) / (hi - lo)) * ph;
      P.Y = Y; P.lo = lo; P.hi = hi;

      // grid + labels
      g.font = `500 11px ${C.fm}`; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let v = lo; v <= hi + 1e-6; v += stepV) {
        const y = Math.round(Y(v)) + 0.5;
        g.strokeStyle = rgba(C.ink, v === lo ? 0.22 : 0.08); g.lineWidth = 1;
        g.beginPath(); g.moveTo(left, y); g.lineTo(w - right, y); g.stroke();
        g.fillStyle = C.muted; g.fillText(n0(v), left - 7, y);
      }
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = `600 11.5px ${C.fb}`; g.fillStyle = C.muted;
      g.fillText(P.label, left, P.y0 - 11);

      // tolerance bands
      for (const b of bandsP) {
        const xa = X(b.t0), xb = Math.max(X(b.t1), xa + 1), ya = Y(b.hi), yb = Y(b.lo);
        g.fillStyle = rgba(C.green, 0.16); g.fillRect(xa, ya, xb - xa, yb - ya);
        g.strokeStyle = rgba(C.green, 0.7); g.lineWidth = 1; g.setLineDash([3, 3]);
        g.beginPath(); g.moveTo(xa, ya + 0.5); g.lineTo(xb, ya + 0.5); g.moveTo(xa, yb - 0.5); g.lineTo(xb, yb - 0.5); g.stroke(); g.setLineDash([]);
      }

      // line
      const pts = st.rec.slice(); if (!st.ended && st.s && st.rec[st.rec.length - 1] !== st.s) pts.push(st.s);
      if (pts.length > 1) {
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.beginPath(); pts.forEach((r, i) => { const x = X(r.t), y = Y(r[P.key]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.strokeStyle = C.cyan; g.lineWidth = 2; g.stroke();
        // excursions
        g.strokeStyle = C.red; g.lineWidth = 2.6;
        for (let i = 1; i < pts.length; i++) {
          const r = pts[i], v = r[P.key];
          const b = bandsP.find(bb => r.t >= bb.t0 - 0.01 && r.t <= bb.t1 + 0.01);
          if (b && (v < b.lo || v > b.hi)) { g.beginPath(); g.moveTo(X(pts[i - 1].t), Y(pts[i - 1][P.key])); g.lineTo(X(r.t), Y(v)); g.stroke(); }
        }
      }
    }
    // time axis
    g.fillStyle = C.muted; g.font = `500 11px ${C.fm}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const ts = niceStep(tMax, w < 500 ? 4 : 7);
    const tStep = ts < 30 ? 30 : ts < 60 ? 60 : Math.ceil(ts / 60) * 60;
    for (let t = 0; t <= tMax + 0.1; t += tStep) g.fillText(mmss(t), clamp(X(t), left + 12, w - right - 14), h - 6);

    // cursor (replay or hover)
    const ct = st.hoverT != null ? st.hoverT : cut;
    if (ct != null) {
      const x = Math.round(X(ct)) + 0.5;
      g.strokeStyle = rgba(C.ink, 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, h - bottom + 2); g.stroke();
      const r = recAt(ct);
      if (r) for (const P of panels) if (fin(r[P.key])) { g.beginPath(); g.arc(X(r.t), P.Y(r[P.key]), 4, 0, Math.PI * 2); g.fillStyle = C.ink; g.fill(); g.lineWidth = 2; g.strokeStyle = C.surface; g.stroke(); }
    }
  }

  function readoutText(r) {
    const def = EXERCISES[st.exId];
    const h = def.altChan === 'agl' ? `${ft(r.agl)} AGL` : ft(r.alt);
    return `<b>${mmss(r.t)}</b> · ${esc(PHASE_NAMES[r.phase] || r.phase || '')} · ${h} · ${kt(r.ias)} · ${deg(Math.abs(r.bank))} bank`;
  }

  R.tr.addEventListener('pointermove', e => {
    if (!trLayout || !st.rec.length) return;
    const bb = R.tr.getBoundingClientRect(), x = e.clientX - bb.left;
    if (x < trLayout.left || x > trLayout.w - trLayout.right) { R.pop.hidden = true; st.hoverT = null; st.dirty = true; return; }
    const t = (x - trLayout.left) / (trLayout.w - trLayout.left - trLayout.right) * trLayout.tMax;
    const r = recAt(t); if (!r || t > st.t + 1) { R.pop.hidden = true; st.hoverT = null; st.dirty = true; return; }
    st.hoverT = r.t; st.dirty = true;
    const def = EXERCISES[st.exId];
    R.pop.innerHTML = `${mmss(r.t)} · ${n0(def.altChan === 'agl' ? r.agl : r.alt)} ft · ${n0(r.ias)} kt<br>${esc(PHASE_NAMES[r.phase] || '')}`;
    R.pop.hidden = false;
    const pw = R.pop.offsetWidth, px = clamp(trLayout.X(r.t) - pw / 2, 0, bb.width - pw);
    R.pop.style.transform = `translate(${px}px, ${Math.max(0, e.clientY - bb.top - 58)}px)`;
  });
  R.tr.addEventListener('pointerleave', () => { R.pop.hidden = true; st.hoverT = null; st.dirty = true; });
  R.tr.addEventListener('click', e => {
    if (!st.ended || !trLayout) return;
    const bb = R.tr.getBoundingClientRect();
    const t = (e.clientX - bb.left - trLayout.left) / (trLayout.w - trLayout.left - trLayout.right) * trLayout.tMax;
    seek(recIndexAt(t));
  });

  /* ---------------------------------------------------------- debrief */
  function endExercise() {
    if (st.ended) return;
    const T = st.tracker;
    T.checks.forEach(k => k.finish(T.c));
    st.ended = true; st.playing = false; syncPlay();
    if (st.s && st.rec[st.rec.length - 1] !== st.s) st.rec.push(st.s);
    st.replayI = st.rec.length - 1;
    renderDebrief();
    R.checksP.hidden = true; R.debrief.hidden = false;
    R.scrub.hidden = !st.rec.length;
    R.range.max = String(Math.max(0, st.rec.length - 1)); R.range.value = String(st.replayI);
    updateReadout();
    st.dirty = false; st.lastPaint = performance.now(); paint();
  }

  function gradeLine(sc, flags) {
    if (sc == null) return 'No checks were flown. Pick an exercise and fly it again.';
    if (sc >= 90) return flags ? 'Excellent flying, with one point to polish.' : 'Excellent flying: every check within tolerance.';
    if (sc >= 75) return `Good flying. ${flags} ${flags === 1 ? 'point' : 'points'} to work on below.`;
    if (sc >= 50) return 'Getting there. Review the flagged checks with your instructor before flying it again.';
    return 'Fly this one again with your instructor, one check at a time.';
  }

  function renderDebrief() {
    const T = st.tracker, sc = scoreOf(T.checks);
    const order = { flag: 0, missed: 1, pass: 2, na: 3 };
    const rows = T.checks.slice().sort((a, b) => (order[a.status] - order[b.status]) || ((a.t ?? 1e9) - (b.t ?? 1e9)));
    R.debrief.innerHTML = `
      <div class="gpc-ph"><h4 id="${uid}db">Debrief</h4><span class="gpc-k">${esc(EXERCISES[st.exId].title)} · ${mmss(st.t)}</span></div>
      <div class="gpc-score"><b>${sc.score == null ? '-' : sc.score}<small>/100</small></b><span>${sc.p} good · ${sc.f} to work on${sc.m ? ` · ${sc.m} not flown` : ''}</span></div>
      <div class="gpc-meter" aria-hidden="true"><span class="gpc-mp" style="width:${100 * sc.p / Math.max(1, sc.total)}%"></span><span class="gpc-mf" style="width:${100 * sc.f / Math.max(1, sc.total)}%"></span><span class="gpc-mm" style="width:${100 * sc.m / Math.max(1, sc.total)}%"></span></div>
      <p class="gpc-grade" style="margin-top:10px">${esc(gradeLine(sc.score, sc.f))} Select a time to replay that moment.</p>
      <ol class="gpc-list">${rows.map(k => `
        <li class="gpc-chk" data-st="${k.status}">
          <span class="gpc-ico" aria-hidden="true">${STATE_ICO[k.status]}</span>
          <span class="gpc-chk-l">${esc(k.label)}<span class="gpc-sr"> - ${STATE_TXT[k.status]}</span></span>
          ${k.t != null ? `<button type="button" class="gpc-time" data-t="${k.t}" aria-label="Replay ${esc(k.label)} at ${mmss(k.t)}">${mmss(k.t)}</button>` : `<span class="gpc-chk-s">${STATE_TXT[k.status]}</span>`}
          <span class="gpc-chk-n">${esc(k.note)}</span>
          ${k.status === 'flag' && k.tip ? `<span class="gpc-tipx">${esc(k.tip)}</span>` : ''}
        </li>`).join('')}</ol>
      <div class="gpc-actions">
        <button type="button" class="gpc-btn" data-d="copy">${ICON.copy}<span>Copy CSV</span></button>
        ${mode === 'live' ? `<button type="button" class="gpc-btn" data-d="export">${ICON.down}<span>Export CSV</span></button>` : ''}
        <button type="button" class="gpc-btn primary" data-d="again">${ICON.restart}<span>Fly again</span></button>
      </div>
      <p class="gpc-msg" data-d="msg" aria-live="polite"></p>
      <textarea class="gpc-csv" data-d="csv" readonly hidden aria-label="Flight data as CSV"></textarea>`;
  }

  function csv() {
    const head = ['time_s', 'phase', 'ias_kt', 'ias_indicated_kt', 'alt_ft', 'alt_indicated_ft', 'agl_ft', 'vs_fpm', 'hdg_deg_mag', 'pitch_deg', 'bank_deg', 'lat', 'lon', 'gs_kt', 'rpm', 'flaps_deg', 'on_ground', 'failures'];
    const f1 = v => (fin(v) ? (Math.round(v * 10) / 10).toString() : '');
    const lines = st.rec.map(r => [f1(r.t), r.phase, f1(r.ias), f1(r.iasInd), f1(r.alt), f1(r.altInd), f1(r.agl), f1(r.vs), f1(r.hdg), f1(r.pitch), f1(r.bank), fin(r.lat) ? r.lat.toFixed(6) : '', fin(r.lon) ? r.lon.toFixed(6) : '', f1(r.gs), f1(r.rpm), f1(r.flaps), r.ground ? 1 : 0, r.fail ? Object.keys(r.fail).filter(k => r.fail[k]).join('+') : ''].join(','));
    return [head.join(','), ...lines].join('\n');
  }

  R.debrief.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t != null) { seek(recIndexAt(+b.dataset.t)); R.debrief.querySelectorAll('.gpc-time').forEach(x => x.setAttribute('aria-current', String(x === b))); return; }
    const m = R.debrief.querySelector('[data-d=msg]'), ta = R.debrief.querySelector('[data-d=csv]');
    if (b.dataset.d === 'again') { resetSession(); st.playing = true; syncPlay(); return; }
    if (b.dataset.d === 'copy') {
      const text = csv();
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no clipboard');
        await navigator.clipboard.writeText(text);
        m.className = 'gpc-msg ok'; m.textContent = `Copied ${st.rec.length} rows. Paste into a spreadsheet.`; ta.hidden = true;
      } catch {
        ta.hidden = false; ta.value = text; ta.focus(); ta.select();
        m.className = 'gpc-msg'; m.textContent = 'Copying is blocked here. The data is selected below: press Ctrl+C (⌘C on a Mac) to copy it.';
      }
    }
    if (b.dataset.d === 'export') {
      const url = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' }));
      const a = doc.createElement('a'); a.href = url; a.download = `glidepath-${st.exId}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`;
      doc.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  });

  function seek(i) {
    if (i < 0 || !st.rec.length) return;
    st.replayI = clamp(i, 0, st.rec.length - 1); R.range.value = String(st.replayI); updateReadout(); st.dirty = true;
  }
  function updateReadout() { const r = st.rec[st.replayI]; R.rout.innerHTML = r ? readoutText(r) : ''; }
  R.range.addEventListener('input', () => { st.replayPlaying = false; syncReplayBtn(); seek(+R.range.value); });
  R.rplay.addEventListener('click', () => {
    if (!st.rec.length) return;
    if (!st.replayPlaying && st.replayI >= st.rec.length - 1) st.replayI = 0;
    st.replayPlaying = !st.replayPlaying; syncReplayBtn();
  });
  function syncReplayBtn() { R.rplay.innerHTML = `${st.replayPlaying ? ICON.pause : ICON.play}<span>${st.replayPlaying ? 'Pause' : 'Replay'}</span>`; }

  /* ---------------------------------------------------------- controls */
  R.exs.addEventListener('click', e => {
    const b = e.target.closest('[data-ex]'); if (!b || b.dataset.ex === st.exId) return;
    st.exId = b.dataset.ex; st.autoFail = true;
    if (mode === 'live') msg('', '');
    resetSession(); st.playing = true; syncPlay();
  });
  R.bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.speed) { st.speed = +b.dataset.speed; R.bar.querySelectorAll('[data-speed]').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.speed === st.speed))); return; }
    const k = b.dataset.b;
    if (k === 'play') { st.playing = !st.playing; syncPlay(); }
    if (k === 'restart') { resetSession(); st.playing = true; syncPlay(); msg('', ''); }
    if (k === 'skip' && mode === 'demo') {
      let n = 0;
      while (!st.ended && n < 40000) { st.sim.step(STEP); ingest(st.sim.sample(), STEP); n++; if (st.sim.done) endExercise(); }
      endExercise();
    }
    if (k === 'end') endExercise();
  });
  R.fails.addEventListener('click', e => {
    const b = e.target.closest('[data-fail]'); if (!b || st.busy[b.dataset.fail]) return;
    setFailure(b.dataset.fail, !st.fails[b.dataset.fail]);
  });
  R.fixAll.addEventListener('click', clearAll);
  R.auto.addEventListener('change', () => { st.autoFail = R.auto.checked; });

  /* ---------------------------------------------------------- status */
  function setStatus(state, text, hint) {
    st.statusState = state;
    R.status.dataset.state = state;
    if (R.statusTxt.textContent !== text) R.statusTxt.textContent = text;
    if (hint) { R.hint.innerHTML = hint; R.hint.hidden = false; } else R.hint.hidden = true;
  }
  const SETUP_HINT = (what) => `<p><b>${what}</b></p><ol>
    <li>Start X-Plane 12.1.1 or later.</li>
    <li>In X-Plane, open <b>Settings → Network</b> and allow incoming connections to the web API (port 8086).</li>
    <li>On the same computer, run <code>node bridge.mjs</code> in the glidepath-companion folder, then open <code>http://localhost:8787</code>.</li>
  </ol>`;

  /* ---------------------------------------------------------- live source */
  let es = null;
  function startLive() {
    setStatus('connecting', 'Connecting…');
    try { es = new EventSource(eventsUrl); } catch (err) { setStatus('offline', 'Connector not running', SETUP_HINT('The Glidepath connector is not running.')); return; }
    es.addEventListener('status', e => {
      let j; try { j = JSON.parse(e.data); } catch { return; }
      if (j.state === 'connected') setStatus(j.paused ? 'paused' : 'connected', `Connected · X-Plane ${j.version || ''}${j.paused ? ' · paused' : ''}`.trim());
      else if (j.state === 'connecting') setStatus('connecting', 'Connecting to X-Plane…');
      else setStatus('not_found', 'X-Plane not found', SETUP_HINT(esc(j.hint || 'X-Plane is not answering.')));
    });
    es.addEventListener('sample', e => {
      let s; try { s = JSON.parse(e.data); } catch { return; }
      const now = performance.now() / 1000;
      const dt = st.lastWall ? clamp(now - st.lastWall, 0, 0.5) : 0.1;
      st.lastWall = now;
      if (s.paused) { if (st.statusState === 'connected') setStatus('paused', R.statusTxt.textContent.replace(/ · paused$/, '') + ' · paused'); return; }
      if (st.statusState === 'paused') setStatus('connected', R.statusTxt.textContent.replace(/ · paused$/, ''));
      ingest(s, dt);
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED || st.statusState !== 'not_found') setStatus('offline', 'Connector not running', SETUP_HINT('The page cannot reach the Glidepath connector. It may have stopped.'));
    };
  }

  /* ---------------------------------------------------------- loop */
  let raf = 0, lastNow = 0;
  function frame(now) {
    if (st.destroyed) return;
    raf = requestAnimationFrame(frame);
    const dtReal = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0; lastNow = now;
    if (mode === 'demo' && st.sim && st.playing && !st.ended && st.visible) {
      st.acc += dtReal * TIME_SCALE * st.speed;
      let n = 0;
      while (st.acc >= STEP && n < 1200 && !st.ended) {
        st.sim.step(STEP); ingest(st.sim.sample(), STEP); st.acc -= STEP; n++;
        if (st.sim.done) { endExercise(); break; }
      }
      if (n >= 1200) st.acc = 0;
    }
    if (st.ended && st.replayPlaying) {
      st.replayAcc = (st.replayAcc || 0) + dtReal * 20; // 10 s of flight per real second
      while (st.replayAcc >= 0.5) { st.replayAcc -= 0.5; if (st.replayI < st.rec.length - 1) st.replayI++; else { st.replayPlaying = false; syncReplayBtn(); break; } }
      R.range.value = String(st.replayI); updateReadout(); st.dirty = true;
    }
    if (st.dirty && now - st.lastPaint > 66) { st.lastPaint = now; st.dirty = false; paint(); }
  }
  function paint() {
    const C = readColors(el);
    renderStrip(st.ended && st.replayI >= 0 ? st.rec[st.replayI] : st.s);
    if (!st.ended) renderChecks();
    const c = st.tracker.c;
    const pr = st.ended && st.replayI >= 0 ? st.rec[st.replayI] : null;
    R.phase.innerHTML = `${st.ended ? 'Replay' : 'Phase'}: <b>${esc(PHASE_NAMES[pr ? pr.phase : c.phase] || '-')}</b>`;
    if (R.bar._clock) R.bar._clock.textContent = mode === 'demo' && st.sim && !st.ended ? `${mmss(st.t)} / ${mmss(st.sim.duration)}` : mmss(st.t);
    if (R.bar._fill && st.sim) R.bar._fill.style.width = `${st.ended ? 100 : clamp(100 * st.t / st.sim.duration, 0, 100)}%`;
    if (R.bar._leg) {
      const s = st.s;
      const txt = st.ended ? 'Exercise complete' : mode === 'demo' ? (s ? s.demoPhase : 'Starting') : s ? 'Tracking your flight' : 'Tracking starts when data arrives';
      if (R.bar._leg.textContent !== txt) R.bar._leg.textContent = txt;
    }
    renderFails();
    drawMap(C);
    drawTraces(C);
  }

  // Theme or size changes -> repaint.
  const ro = new ResizeObserver(() => { st.dirty = true; });
  ro.observe(R.map); ro.observe(R.tr);
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const onMq = () => { st.dirty = true; };
  mq && mq.addEventListener && mq.addEventListener('change', onMq);
  const mo = new MutationObserver(onMq);
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  let io = null;
  if (mode === 'demo' && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(es2 => { for (const e of es2) st.visible = e.isIntersecting; }, { rootMargin: '200px 0px' });
    io.observe(el);
  }

  resetSession();
  if (mode === 'live') startLive();
  raf = requestAnimationFrame(frame);

  return {
    el,
    get state() { return { exercise: st.exId, phase: st.tracker.c.phase, t: st.t, ended: st.ended, score: scoreOf(st.tracker.checks).score }; },
    setExercise(id) { if (EXERCISES[id]) { st.exId = id; resetSession(); st.playing = true; syncPlay(); } },
    destroy() {
      st.destroyed = true; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); io && io.disconnect();
      mq && mq.removeEventListener && mq.removeEventListener('change', onMq);
      if (es) es.close();
      root.innerHTML = '';
    },
  };
}

export { EXERCISES, FAILURES };
