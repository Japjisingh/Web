/* Live flow checklist + debrief for the .jet-flow side panel. Uses the page tokens so light and dark themes both work. */
import { PHASES } from './flows.js';
import { fmtT } from './systems.js';

const CSS = `
.jet-flow{font-size:14px;line-height:1.35}
.jet-flow .jf-top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px}
.jet-flow .jf-title{font:600 19px/1.1 var(--f-display);margin:0}
.jet-flow .jf-stats{display:flex;gap:10px;font:600 12.5px/1 var(--f-mono);color:var(--muted);font-variant-numeric:tabular-nums}
.jet-flow .jf-stats b{color:var(--ink)}
.jet-flow .jf-mode{display:inline-block;font:700 11px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--magenta);border:1px solid currentColor;border-radius:4px;padding:3px 5px;margin-left:6px;vertical-align:2px}
.jet-flow .jf-cur{background:var(--sunk);border:1px solid var(--line);border-left:3px solid var(--magenta);border-radius:8px;padding:9px 10px;display:grid;gap:3px}
.jet-flow .jf-cur[hidden]{display:none}
.jet-flow .jf-k{font:600 11.5px/1.2 var(--f-mono);color:var(--muted);letter-spacing:.02em}
.jet-flow .jf-t{font-weight:700;font-size:15px}
.jet-flow .jf-w{color:var(--muted);font-size:13px}
.jet-flow .jf-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.jet-flow .jf-btns button{font:600 12.5px/1 var(--f-body);color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:7px 9px;cursor:pointer}
.jet-flow .jf-btns button.pri{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.jet-flow .jf-fb{font-size:13px;min-height:1.2em;margin-top:2px}
.jet-flow .jf-fb.ok{color:var(--green)} .jet-flow .jf-fb.wrong{color:var(--red)} .jet-flow .jf-fb.early,.jet-flow .jf-fb.partial,.jet-flow .jf-fb.hint{color:var(--amber)}
.jet-flow .jf-list{list-style:none;margin:0;padding:0 2px 0 0;max-height:430px;overflow:auto;overscroll-behavior:contain;display:grid;gap:1px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.jet-flow .jf-ph{font:700 11.5px/1 var(--f-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:10px 2px 4px;display:flex;justify-content:space-between;position:sticky;top:0;background:var(--surface);z-index:1}
.jet-flow .jf-st{display:grid;grid-template-columns:22px minmax(0,1fr);gap:2px 4px;padding:4px 4px;border-radius:5px;font-size:13.5px;color:var(--muted)}
.jet-flow .jf-st .i{font:700 12px/1.35 var(--f-mono);text-align:center}
.jet-flow .jf-st .n{font:600 10.5px/1 var(--f-mono);opacity:.75;margin-right:4px}
.jet-flow .jf-st .x{grid-column:2;font-size:12px;color:var(--amber)}
.jet-flow .jf-st.current{background:var(--tint-m);color:var(--ink);font-weight:700}
.jet-flow .jf-st.current .i{color:var(--magenta)}
.jet-flow .jf-st.done{color:var(--ink)} .jet-flow .jf-st.done .i{color:var(--green)}
.jet-flow .jf-st.late{color:var(--ink)} .jet-flow .jf-st.late .i{color:var(--amber)}
.jet-flow .jf-st.missed .i{color:var(--red)} .jet-flow .jf-st.missed{color:var(--red)}
.jet-flow .jf-st.na{text-decoration:line-through;opacity:.6}
.jet-flow .jf-mem{background:var(--sunk);border:1px dashed var(--line);border-radius:8px;padding:10px;color:var(--muted);font-size:13.5px}
.jet-flow .jf-deb{border:1px solid var(--line);border-radius:10px;padding:12px;display:grid;gap:8px;background:var(--surface)}
.jet-flow .jf-deb[hidden],.jet-flow .jf-mem[hidden]{display:none}
.jet-flow .jf-score{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.jet-flow .jf-score b{font:600 40px/1 var(--f-display);color:var(--magenta)}
.jet-flow .jf-score span{color:var(--muted);font:600 13px/1.3 var(--f-mono)}
.jet-flow .jf-deb h5{margin:4px 0 0;font:700 12px/1 var(--f-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.jet-flow .jf-deb ul{margin:0;padding-left:18px;display:grid;gap:3px;font-size:13.5px}
.jet-flow .jf-deb li small{color:var(--muted)}
.jet-flow .jf-deb .good{color:var(--green);font-weight:600}
`;

export function createChecklist(host) {
  const box = host.querySelector('.jet-flow');
  if (!document.getElementById('jet-flow-css')) { const st = document.createElement('style'); st.id = 'jet-flow-css'; st.textContent = CSS; document.head.appendChild(st); }
  box.innerHTML = `<div class="jf-top"><p class="jf-title"></p><div class="jf-stats"><span>Time <b data-k="time">0:00</b></span><span>Steps <b data-k="prog">0/0</b></span></div></div>
  <div class="jf-cur" aria-live="polite"><p class="jf-k"></p><p class="jf-t"></p><p class="jf-w"></p><div class="jf-btns"><button type="button" data-a="show">Show me</button><button type="button" class="pri" data-a="confirm" hidden>Done</button><button type="button" data-a="check" hidden>Checked</button></div><p class="jf-fb"></p></div>
  <div class="jf-mem" hidden>Memory mode: the checklist is hidden. Work the flow from memory; you are scored at the end. <div class="jf-btns"><button type="button" data-a="confirm" hidden>Done (current item)</button><button type="button" data-a="finish">Finish and score</button></div></div>
  <ol class="jf-list" aria-label="Flow checklist"></ol>
  <div class="jf-deb" hidden></div>`;
  const q = s => box.querySelector(s);
  const list = q('.jf-list'), cur = q('.jf-cur'), mem = q('.jf-mem'), deb = q('.jf-deb');
  const handlers = {};
  box.addEventListener('click', e => { const b = e.target.closest('button[data-a]'); if (b && handlers[b.dataset.a]) handlers[b.dataset.a](); });
  let rows = [], lastFlow = null, lastCur = -1, fbT = 0;
  const icon = { pending: '○', current: '▸', done: '✓', late: '↯', missed: '✕', na: '–' };
  function build(flow) {
    lastFlow = flow; lastCur = -1; list.innerHTML = ''; rows = [];
    let ph = null; const counts = {};
    flow.steps.forEach(s => { counts[s.ph] = (counts[s.ph] || 0) + 1; });
    flow.steps.forEach((s, i) => {
      if (s.ph !== ph) { ph = s.ph; const li = document.createElement('li'); li.className = 'jf-ph'; li.innerHTML = `<span>${PHASES[ph]}</span><span data-ph="${ph}"></span>`; list.appendChild(li); }
      const li = document.createElement('li'); li.className = 'jf-st pending'; li.innerHTML = `<span class="i" aria-hidden="true">○</span><span><span class="n">${i + 1}</span>${s.t}</span>`; list.appendChild(li); rows.push(li);
    });
    q('.jf-title').innerHTML = `${flow.title}<span class="jf-mode">${flow.mode}</span>`;
    deb.hidden = true;
  }
  function render(flow, sys, info = {}) {
    if (flow !== lastFlow) build(flow);
    const mode = flow.mode;
    const memory = mode === 'memory' && !flow.finished;
    list.hidden = memory; mem.hidden = !memory;
    flow.steps.forEach((s, i) => {
      const li = rows[i]; const cls = 'jf-st ' + s.state; if (li.className !== cls) { li.className = cls; li.querySelector('.i').textContent = icon[s.state] || '○'; li.setAttribute('aria-current', s.state === 'current' ? 'step' : 'false');
        const ex = li.querySelector('.x'); if (ex) ex.remove();
        if (s.state === 'late') { const d = document.createElement('span'); d.className = 'x'; d.textContent = `Done out of order (${s.order + 1}${ord(s.order + 1)} action)`; li.appendChild(d); }
      }
    });
    for (const el of list.querySelectorAll('[data-ph]')) { const ph = el.dataset.ph; const st = flow.steps.filter(s => s.ph === ph && s.state !== 'na'); el.textContent = `${st.filter(s => s.state === 'done' || s.state === 'late').length}/${st.length}`; }
    const c = flow.current();
    if (flow.cur !== lastCur && c && !memory) { lastCur = flow.cur; const li = rows[flow.cur]; if (li) { const top = li.offsetTop - list.offsetTop - 60; list.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); } }
    const pr = flow.progress(); q('[data-k="prog"]').textContent = `${pr.done}/${pr.total}`;
    q('[data-k="time"]').textContent = fmtT((flow.finished ? flow.tEnd : sys.t) - flow.t0);
    cur.hidden = memory || flow.finished || !c;
    if (c && !memory) {
      q('.jf-k').textContent = `Step ${flow.cur + 1} of ${flow.steps.length} · ${PHASES[c.ph]}${c.kind === 'wait' ? ' · monitor' : c.kind === 'check' || c.touch ? ' · touch to check' : ''}`;
      q('.jf-t').textContent = c.t;
      q('.jf-w').textContent = (c.where || '') + (c.tip && mode === 'guided' ? ' — ' + c.tip : '');
      cur.querySelector('[data-a="show"]').hidden = mode !== 'guided' || c.kind === 'confirm';
      cur.querySelector('[data-a="confirm"]').hidden = c.kind !== 'confirm';
      cur.querySelector('[data-a="check"]').hidden = !(c.kind === 'check' || c.touch);
    }
    mem.querySelector('[data-a="confirm"]').hidden = !(memory && c && c.kind === 'confirm');
    const fb = q('.jf-fb'); const L = flow.last;
    if (L && L !== fbT) { fbT = L; fb.className = 'jf-fb ' + L.type; fb.textContent = mode === 'memory' ? '' : L.msg; }
  }
  function debrief(flow, r, names) {
    const pos = s => s.i + 1;
    const late = r.late.map(s => `<li>${s.t} <small>— done ${s.order + 1}${ord(s.order + 1)}; belongs at step ${pos(s)}${s.early && s.early.atText ? `, before “${s.early.atText}”` : ''}</small></li>`).join('');
    const missed = r.missed.map(s => `<li>${s.t} <small>— step ${pos(s)}</small></li>`).join('');
    const wrong = r.wrong.map(w => `<li>${names(w.ctl)} <small>— while on step ${w.atStep + 1}: ${w.atText}</small></li>`).join('');
    const verdict = r.score >= 95 ? 'Excellent flow.' : r.score >= 80 ? 'Good. Tidy up the items below and go again.' : r.score >= 60 ? 'Getting there. Run it in Practice mode, then try Memory mode.' : 'Run it in Guided mode a few times to build the sequence.';
    deb.innerHTML = `<div class="jf-score"><b>${r.score}</b><span>/ 100 · ${fmtT(r.time)} · ${flow.mode}</span></div>
      <p>${verdict} ${r.inOrder} of ${r.total} steps in order.</p>
      ${late ? `<h5>Out of order (${r.late.length})</h5><ul>${late}</ul>` : ''}
      ${missed ? `<h5>Missed (${r.missed.length})</h5><ul>${missed}</ul>` : ''}
      ${wrong ? `<h5>Not part of the flow (${r.wrong.length})</h5><ul>${wrong}</ul>` : ''}
      ${!late && !missed && !wrong ? '<p class="good">No steps out of order, none missed.</p>' : ''}
      <div class="jf-btns"><button type="button" class="pri" data-a="retry">Try again</button><button type="button" data-a="next">Next mode</button></div>`;
    deb.hidden = false; list.hidden = false; mem.hidden = true; cur.hidden = true;
    render(flow, { t: flow.tEnd });
  }
  return { render, debrief, on(a, fn) { handlers[a] = fn; }, el: box };
}
function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }
