/* Immersive overlay UI inside the stage: glass panels over the 3D flight deck.
   Top-left mode/scenario pill + menu, top-centre camera pills, top-right timer/score chip,
   bottom-centre current-step card with progress ring, right checklist dock with phase timeline,
   in-world callout (label card + leader line), edge arrow, alert banner, debrief card.
   Collapses to a bottom sheet on narrow stages (container queries). */
import { PHASES } from './flows.js';
import { fmtT } from './systems.js';

const CSS = `
.jhud{position:absolute;inset:0;z-index:4;pointer-events:none;container-type:size;container-name:jhud;color:#eef4f6;font:500 13px/1.35 var(--f-body,system-ui);-webkit-font-smoothing:antialiased}
.jhud *{box-sizing:border-box}
.jhud .g{pointer-events:auto;background:linear-gradient(180deg,rgba(22,32,40,.62),rgba(10,16,22,.70));-webkit-backdrop-filter:blur(18px) saturate(1.35);backdrop-filter:blur(18px) saturate(1.35);border:1px solid rgba(255,255,255,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 12px 34px rgba(0,0,0,.38);border-radius:16px}
.jhud button{font:600 12.5px/1 var(--f-body,system-ui);color:#eef4f6;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 11px;cursor:pointer;transition:background .2s,border-color .2s}
.jhud button:hover{background:rgba(255,255,255,.14)}
.jhud button:focus-visible{outline:2px solid #4fc2dd;outline-offset:2px}
.jhud button.on,.jhud button[aria-pressed="true"]{background:#eef4f6;color:#0c1820;border-color:#eef4f6}
.jhud button.pri{background:#e77ec2;border-color:#e77ec2;color:#1a0714}
.jhud .mono{font-family:var(--f-mono,monospace)}
.jhud .k{font:700 10.5px/1 var(--f-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:#93a9b3}
/* top row */
.jh-tl{position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 8px;border-radius:999px}
.jh-mode{font:700 11px/1 var(--f-mono,monospace);letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border-radius:999px;background:rgba(231,126,194,.18);color:#ff9fd6;border:1px solid rgba(231,126,194,.45)}
.jh-scn{font:600 15px/1.1 var(--f-display,sans-serif);letter-spacing:.01em;white-space:nowrap;max-width:34cqw;overflow:hidden;text-overflow:ellipsis}
.jh-menuB{width:30px;height:30px;padding:0!important;display:grid;place-items:center;font-size:15px!important}
.jh-menu{position:absolute;left:12px;top:58px;width:min(330px,calc(100cqw - 24px));padding:12px;display:none;gap:10px;max-height:calc(100cqh - 76px);overflow:auto}
.jh-menu.open{display:grid}
.jh-menu .row{display:flex;flex-wrap:wrap;gap:5px}
.jh-views{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;gap:3px;padding:4px;border-radius:999px}
.jh-views button{border-color:transparent;background:transparent}
.jh-tr{position:absolute;right:12px;top:12px;display:flex;align-items:center;gap:12px;padding:7px 8px 7px 14px;border-radius:999px}
.jh-tr .v{font:700 15px/1 var(--f-mono,monospace);font-variant-numeric:tabular-nums}
.jh-tr .v small{font-size:10px;color:#93a9b3;margin-left:3px}
/* alert banner */
.jh-alert{position:absolute;left:50%;top:60px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:8px 14px;border-radius:12px;background:rgba(120,14,10,.62);border-color:rgba(255,90,70,.55);font:700 16px/1 var(--f-display,sans-serif);letter-spacing:.04em;color:#ffd9d4}
.jh-alert.show{display:flex;animation:jhpulse 1s ease-in-out infinite}
.jh-alert.caut{background:rgba(110,70,0,.6);border-color:rgba(255,190,60,.55);color:#ffe7b0;animation:none}
@keyframes jhpulse{50%{box-shadow:0 0 0 1px rgba(255,80,60,.6),0 0 28px rgba(255,60,40,.55)}}
/* step card */
.jh-step{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:min(540px,calc(100cqw - 24px - var(--dockw,0px)));display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 14px;padding:11px 14px 11px 12px;border-left:3px solid #e77ec2}
.jh-ring{grid-row:1/4;width:58px;height:58px;position:relative}
.jh-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.jh-ring b{position:absolute;inset:0;display:grid;place-items:center;font:700 13px/1 var(--f-mono,monospace)}
.jh-ph{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.jh-ph .p{color:#4fc2dd}
.jh-act{font:600 clamp(17px,2.3cqw,26px)/1.08 var(--f-display,sans-serif);letter-spacing:.005em;text-wrap:balance}
.jh-why{color:#b9c9cf;font-size:13px}
.jh-why b{color:#eef4f6;font-weight:600}
.jh-btns{grid-column:2;display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;align-items:center}
.jh-fb{font-size:12.5px;font-weight:600;margin-left:4px}
.jh-fb.ok{color:#62d3a1}.jh-fb.wrong{color:#ff8a80}.jh-fb.early,.jh-fb.partial,.jh-fb.hint{color:#e6b347}
/* dock */
.jh-dock{position:absolute;right:12px;top:60px;bottom:14px;width:min(290px,34cqw);display:flex;flex-direction:column;padding:10px 6px 8px 12px;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .3s}
.jh-dock.closed{transform:translateX(calc(100% + 20px));opacity:0;pointer-events:none}
.jh-tl2{display:flex;gap:3px;margin:6px 6px 8px 0}
.jh-tl2 i{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.12);position:relative;overflow:hidden}
.jh-tl2 i span{position:absolute;inset:0 auto 0 0;background:#62d3a1;border-radius:3px}
.jh-tl2 i.cur span{background:#e77ec2}
.jh-list{list-style:none;margin:0;padding:0 6px 0 0;overflow:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}
.jh-list .h{font:700 10px/1 var(--f-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:#93a9b3;padding:9px 0 4px;display:flex;justify-content:space-between}
.jh-list .s{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;padding:4px 6px;border-radius:8px;font-size:12.5px;color:#9db0b8}
.jh-list .s i{font-style:normal;font:700 11px/1.4 var(--f-mono,monospace);text-align:center}
.jh-list .s.current{background:rgba(231,126,194,.16);color:#fff;font-weight:600}.jh-list .s.current i{color:#ff9fd6}
.jh-list .s.done{color:#dbe6ea}.jh-list .s.done i{color:#62d3a1}
.jh-list .s.late{color:#dbe6ea}.jh-list .s.late i{color:#e6b347}
.jh-list .s.missed{color:#ff8a80}.jh-list .s.na{opacity:.5;text-decoration:line-through}
.jh-list.hide .s{filter:blur(4px);opacity:.35}
/* callout */
.jh-svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.jh-call{position:absolute;left:0;top:0;padding:7px 11px 8px;border-radius:12px;display:none;white-space:nowrap;border-color:rgba(231,126,194,.6);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 30px rgba(0,0,0,.4),0 0 24px rgba(231,126,194,.28)}
.jh-call .t{font:600 16px/1.05 var(--f-display,sans-serif);letter-spacing:.02em}
.jh-call .a{font:700 10.5px/1 var(--f-mono,monospace);color:#ff9fd6;letter-spacing:.08em;text-transform:uppercase;margin-top:3px}
.jh-edge{position:absolute;left:0;top:0;display:none;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border-color:rgba(231,126,194,.6);font-weight:600;cursor:pointer}
.jh-edge b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#e77ec2;color:#1a0714;font-size:12px}
/* tooltip */
.jh-tip{position:absolute;left:0;top:0;display:none;max-width:260px;padding:7px 10px;border-radius:10px;font-size:12.5px;pointer-events:none!important}
.jh-tip small{color:#93a9b3}
/* debrief */
.jh-deb{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100cqw - 28px));max-height:calc(100cqh - 90px);overflow:auto;padding:18px 20px;display:none;gap:12px}
.jh-deb.show{display:grid;animation:jhin .5s cubic-bezier(.2,.8,.2,1)}
@keyframes jhin{from{opacity:0;transform:translate(-50%,-46%)}}
.jh-deb .top{display:flex;gap:18px;align-items:center}
.jh-deb .big{width:96px;height:96px;position:relative;flex:none}
.jh-deb .big svg{width:100%;height:100%;transform:rotate(-90deg)}
.jh-deb .big b{position:absolute;inset:0;display:grid;place-items:center;font:600 38px/1 var(--f-display,sans-serif)}
.jh-deb h4{margin:0;font:600 24px/1.05 var(--f-display,sans-serif)}
.jh-deb .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.jh-deb .stats div{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px}
.jh-deb .stats b{display:block;font:600 22px/1 var(--f-display,sans-serif)}
.jh-deb ul{margin:0;padding-left:18px;display:grid;gap:3px;font-size:13px;color:#cfdbe0}
.jh-deb ul small{color:#93a9b3}
.jh-hint{position:absolute;left:12px;bottom:14px;padding:6px 10px;border-radius:999px;font-size:11.5px;color:#b9c9cf;pointer-events:none!important}
.jhud.hero .jh-hint,.jhud.hero .jh-menu{display:none!important}
@container jhud (max-width: 1000px){ .jh-hint{display:none} .jh-views{left:12px;top:58px;transform:none} .jh-alert{top:104px} .jh-ring{width:48px;height:48px} .jh-why{font-size:12.5px} .jh-step{padding:9px 12px 9px 10px} }
@container jhud (max-width: 760px){
  .jh-dock{width:min(300px,62cqw);top:58px;bottom:auto;max-height:calc(100cqh - 70px)}
  .jh-step{--dockw:0px!important}
  .jh-views button{padding:6px 8px;font-size:11.5px}
}
@container jhud (max-width: 600px){
  .jh-tl{left:8px;top:8px;padding:4px}.jh-scn,.jh-mode{display:none}
  .jh-views button{padding:6px 7px;font-size:11px}
  .jh-dock.sheet ~ .jh-step{display:none}
  .jh-views{top:auto;bottom:auto;left:auto;right:8px;top:8px;transform:none}
  .jh-tr{display:none}
  .jh-step{left:0;right:0;bottom:0;transform:none;width:auto;border-radius:16px 16px 0 0;border-left:0;border-top:3px solid #e77ec2;padding:10px 12px;gap:2px 10px}
  .jh-ring{width:44px;height:44px}
  .jh-act{font-size:19px}
  .jh-why{font-size:12px}
  .jh-hint{display:none}
  .jh-alert{top:48px;font-size:14px}
  .jh-dock.sheet{display:flex;left:0;right:0;top:auto;bottom:0;width:auto;height:62cqh;border-radius:16px 16px 0 0}
}
@container jhud (max-height: 380px){ .jh-why{display:none} .jh-dock{top:56px} }
`;

const ICON = { pending: '○', current: '▸', done: '✓', late: '↯', missed: '✕', na: '–' };
const ring = (r, frac, col = '#e77ec2', w = 5) => { const c = 2 * Math.PI * r; return `<svg viewBox="0 0 ${2 * r + w * 2} ${2 * r + w * 2}"><circle cx="${r + w}" cy="${r + w}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="${w}"/><circle cx="${r + w}" cy="${r + w}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}" style="transition:stroke-dashoffset .6s"/></svg>`; };

export function createHUD(wrap, api) {
  if (!document.getElementById('jet-hud-css')) { const s = document.createElement('style'); s.id = 'jet-hud-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.className = 'jhud'; wrap.appendChild(root);
  root.innerHTML = `
  <svg class="jh-svg" aria-hidden="true"><defs><filter id="jhglow"><feGaussianBlur stdDeviation="2.2"/></filter></defs><g class="lead" style="display:none"><line stroke="#ff9fd6" stroke-width="5" opacity=".35" filter="url(#jhglow)"/><line stroke="#ffd2ec" stroke-width="1.4"/><circle r="4" fill="#ffd2ec"/><circle r="11" fill="none" stroke="#ff9fd6" stroke-width="1.5" opacity=".6"/></g></svg>
  <div class="g jh-tl"><button class="jh-menuB" aria-label="Trainer menu" aria-expanded="false">☰</button><span class="jh-mode"></span><span class="jh-scn"></span></div>
  <div class="g jh-menu" role="dialog" aria-label="Trainer menu">
    <div><p class="k">Mode</p><div class="row" data-g="mode"></div></div>
    <div><p class="k">Scenario</p><div class="row" data-g="scn"></div></div>
    <div><p class="k">Time of day</p><div class="row" data-g="tod"></div></div>
    <div><p class="k">Timings</p><div class="row" data-g="fast"></div></div>
    <div class="row" data-g="acts"></div>
  </div>
  <div class="g jh-views" role="group" aria-label="Camera"></div>
  <div class="g jh-tr"><span><span class="k">Time</span> <span class="v" data-k="time">0:00</span></span><span><span class="k">Steps</span> <span class="v" data-k="prog">0<small>/0</small></span></span><span><span class="k">Score</span> <span class="v" data-k="score">—</span></span><button data-a="sound" aria-label="Sound">♪</button><button data-a="dock" aria-label="Checklist">☰ List</button></div>
  <div class="g jh-alert" role="alert"></div>
  <div class="g jh-dock"><div style="display:flex;justify-content:space-between;align-items:center;padding-right:6px"><span class="k">Flow</span><span class="k" data-k="phase"></span></div><div class="jh-tl2"></div><ol class="jh-list"></ol></div>
  <div class="g jh-step" aria-live="polite"><div class="jh-ring"></div><div class="jh-ph"><span class="k p"></span><span class="k n"></span></div><div class="jh-act"></div><div class="jh-why"></div><div class="jh-btns"><button data-a="show">Show me</button><button data-a="check" class="pri">Checked</button><button data-a="confirm" class="pri">Done</button><button data-a="finish">Finish and score</button><span class="jh-fb"></span></div></div>
  <div class="g jh-call"><div class="t"></div><div class="a"></div></div>
  <div class="g jh-edge" role="button" tabindex="0"><b>➜</b><span></span></div>
  <div class="g jh-tip"></div>
  <div class="g jh-deb" role="dialog" aria-label="Debrief"></div>
  <div class="g jh-hint">Drag to look · tap a control · pinch or wheel to zoom</div>`;
  const q = s => root.querySelector(s);
  const H = { root, tip: q('.jh-tip'), edge: q('.jh-edge'), call: q('.jh-call'), lead: q('.lead'), deb: q('.jh-deb'), step: q('.jh-step'), dock: q('.jh-dock') };
  const menu = q('.jh-menu'), menuB = q('.jh-menuB');
  menuB.addEventListener('click', () => { const o = !menu.classList.contains('open'); menu.classList.toggle('open', o); menuB.setAttribute('aria-expanded', String(o)); });
  const groups = {};
  H.group = (name, opts, cur, fn) => { const el = q(`[data-g="${name}"]`); el.innerHTML = ''; groups[name] = opts.map(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; b.setAttribute('aria-pressed', String(v === cur)); b.addEventListener('click', () => fn(v)); el.appendChild(b); return b; }); };
  H.setGroup = (name, v) => (groups[name] || []).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(v))));
  H.action = (t, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.addEventListener('click', fn); q('[data-g="acts"]').appendChild(b); return b; };
  const views = q('.jh-views'); let vb = [];
  H.views = (list, cur, fn) => { views.innerHTML = ''; vb = list.map(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; b.setAttribute('aria-pressed', String(v === cur)); b.addEventListener('click', () => fn(v)); views.appendChild(b); return b; }); };
  H.setView = v => vb.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  root.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b && api[b.dataset.a]) api[b.dataset.a](); });
  H.edge.addEventListener('click', () => api.show && api.show()); H.edge.addEventListener('keydown', e => { if (e.key === 'Enter') api.show && api.show(); });
  let dockOpen = true;
  H.toggleDock = (o = !dockOpen) => { dockOpen = o; H.dock.classList.toggle('closed', !o); H.dock.classList.toggle('sheet', o); };
  // list rendering
  const list = q('.jh-list'), tl = q('.jh-tl2');
  let rows = [], lastFlow = null, lastCur = -1, lastFb = null, phases = [];
  function build(flow) {
    lastFlow = flow; lastCur = -1; list.innerHTML = ''; rows = []; phases = [];
    let ph = null;
    flow.steps.forEach((s, i) => {
      if (s.ph !== ph) { ph = s.ph; phases.push(ph); const li = document.createElement('li'); li.className = 'h'; li.innerHTML = `<span>${PHASES[ph]}</span><span data-ph="${ph}"></span>`; list.appendChild(li); }
      const li = document.createElement('li'); li.className = 's pending'; li.innerHTML = `<i>○</i><span>${s.t}</span>`; list.appendChild(li); rows.push(li);
    });
    tl.innerHTML = phases.map(p => `<i title="${PHASES[p]}" data-p="${p}"><span style="width:0"></span></i>`).join('');
    q('.jh-scn').textContent = flow.title; q('.jh-mode').textContent = flow.mode;
  }
  H.render = (flow, sys, extra = {}) => {
    if (flow !== lastFlow) build(flow);
    const memory = flow.mode === 'memory' && !flow.finished;
    list.classList.toggle('hide', memory);
    flow.steps.forEach((s, i) => { const li = rows[i], cls = 's ' + s.state; if (li.className !== cls) { li.className = cls; li.firstChild.textContent = ICON[s.state] || '○'; } });
    for (const p of phases) { const st = flow.steps.filter(s => s.ph === p && s.state !== 'na'); const d = st.filter(s => s.state === 'done' || s.state === 'late').length; const el = tl.querySelector(`[data-p="${p}"]`); el.firstChild.style.width = (st.length ? d / st.length * 100 : 0) + '%'; el.classList.toggle('cur', !!flow.current() && flow.current().ph === p); const e2 = list.querySelector(`[data-ph="${p}"]`); if (e2) e2.textContent = `${d}/${st.length}`; }
    const c = flow.current(), pr = flow.progress();
    if (c && flow.cur !== lastCur && !memory) { lastCur = flow.cur; const li = rows[flow.cur]; if (li) list.scrollTo({ top: Math.max(0, li.offsetTop - list.offsetTop - 70), behavior: 'smooth' }); }
    q('[data-k="time"]').textContent = fmtT((flow.finished ? flow.tEnd : sys.t) - flow.t0);
    q('[data-k="prog"]').innerHTML = `${pr.done}<small>/${pr.total}</small>`;
    q('[data-k="score"]').textContent = extra.score != null ? String(extra.score) : '—';
    q('[data-k="phase"]').textContent = c ? PHASES[c.ph] : 'complete';
    // step card
    const st = H.step; st.style.display = flow.finished ? 'none' : '';
    q('.jh-ring').innerHTML = ring(24, pr.total ? pr.done / pr.total : 0) + `<b>${Math.round(pr.total ? pr.done / pr.total * 100 : 0)}%</b>`;
    const show = (sel, on) => { q(sel).style.display = on ? '' : 'none'; };
    if (memory) {
      q('.jh-ph .p').textContent = 'Memory mode'; q('.jh-ph .n').textContent = `${pr.done} actions logged`;
      q('.jh-act').textContent = 'Work the flow from memory'; q('.jh-why').textContent = 'The checklist is hidden. You are scored when the last step is done, or press Finish.';
      show('[data-a="show"]', false); show('[data-a="check"]', false); show('[data-a="confirm"]', !!(c && c.kind === 'confirm')); show('[data-a="finish"]', true);
    } else if (c) {
      q('.jh-ph .p').textContent = PHASES[c.ph]; q('.jh-ph .n').textContent = `Step ${flow.cur + 1} / ${flow.steps.length}${c.kind === 'wait' ? ' · monitor' : c.kind === 'check' || c.touch ? ' · touch to check' : ''}`;
      q('.jh-act').textContent = c.t;
      q('.jh-why').innerHTML = `<b>${c.where || ''}</b>${c.tip && flow.mode === 'guided' ? ' — ' + c.tip : ''}`;
      show('[data-a="show"]', flow.mode === 'guided' && c.kind !== 'confirm'); show('[data-a="check"]', c.kind === 'check' || !!c.touch); show('[data-a="confirm"]', c.kind === 'confirm'); show('[data-a="finish"]', false);
    }
    const L = flow.last, fb = q('.jh-fb');
    if (L !== lastFb) { lastFb = L; fb.className = 'jh-fb ' + (L ? L.type : ''); fb.textContent = L && flow.mode !== 'memory' ? L.msg : ''; }
    const dw = dockOpen && root.clientWidth > 760 ? Math.min(290, root.clientWidth * 0.34) + 18 : 0;
    st.style.setProperty('--dockw', dw + 'px'); st.style.marginLeft = dw ? `-${dw / 2}px` : '';
  };
  H.alert = (txt, lvl) => { const a = q('.jh-alert'); a.classList.toggle('show', !!txt); a.classList.toggle('caut', lvl === 'C'); a.textContent = txt || ''; };
  H.debrief = (flow, r, names) => {
    const pos = s => s.i + 1;
    const col = r.score >= 90 ? '#62d3a1' : r.score >= 70 ? '#e6b347' : '#ff8a80';
    const li = (arr, f) => arr.slice(0, 4).map(f).join('') + (arr.length > 4 ? `<li><small>and ${arr.length - 4} more (see the side panel)</small></li>` : '');
    H.deb.innerHTML = `<div class="top"><div class="big">${ring(40, r.score / 100, col, 7)}<b>${r.score}</b></div><div><p class="k">Debrief · ${flow.mode}</p><h4>${flow.title}</h4><p style="color:#b9c9cf;margin:4px 0 0">${r.score >= 95 ? 'Excellent flow. Try it in Memory mode next.' : r.score >= 80 ? 'Good. Tidy up the items below and go again.' : 'Run it again in Guided or Practice mode to build the sequence.'}</p></div></div>
      <div class="stats"><div><span class="k">Time</span><b>${fmtT(r.time)}</b></div><div><span class="k">In order</span><b>${r.inOrder}/${r.total}</b></div><div><span class="k">Out of order</span><b style="color:${r.late.length ? '#e6b347' : '#eef4f6'}">${r.late.length}</b></div><div><span class="k">Missed · wrong</span><b style="color:${r.missed.length + r.wrong.length ? '#ff8a80' : '#eef4f6'}">${r.missed.length} · ${r.wrong.length}</b></div></div>
      ${r.late.length ? `<div><p class="k">Out of order</p><ul>${li(r.late, s => `<li>${s.t} <small>— done ${s.order + 1}${ord(s.order + 1)}, belongs at step ${pos(s)}</small></li>`)}</ul></div>` : ''}
      ${r.missed.length ? `<div><p class="k">Missed</p><ul>${li(r.missed, s => `<li>${s.t} <small>— step ${pos(s)}</small></li>`)}</ul></div>` : ''}
      ${r.wrong.length ? `<div><p class="k">Not part of the flow</p><ul>${li(r.wrong, w => `<li>${names(w.ctl)} <small>— during step ${w.atStep + 1}</small></li>`)}</ul></div>` : ''}
      ${!r.late.length && !r.missed.length && !r.wrong.length ? '<p style="color:#62d3a1;font-weight:600;margin:0">Every step in the right order. Nothing missed.</p>' : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="pri" data-a="retry">Try again</button><button data-a="next">Next mode</button><button data-a="close">View cockpit</button></div>`;
    H.deb.classList.add('show');
  };
  H.hideDebrief = () => H.deb.classList.remove('show');
  H.closeMenu = () => { menu.classList.remove('open'); menuB.setAttribute('aria-expanded', 'false'); };
  return H;
}
function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
