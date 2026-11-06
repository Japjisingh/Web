/* Canvas-drawn flight deck displays for the generic twin-jet trainer. Generic layouts and our own wording. */
import { fmtT, REF, OAT } from './systems.js';

const F = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const C = { g: '#35f27a', w: '#f2f6f8', a: '#ffad1f', c: '#36d6ff', m: '#ff4fd8', r: '#ff3a2e', y: '#ffe23a', grey: '#7d8a92', dk: '#2a3238', sky: '#2e86d8', gnd: '#8a5428' };
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtK = n => Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');

function txt(x, t, X, Y, col = C.w, size = 18, align = 'center', w = 600) { x.font = `${w} ${size}px ${F}`; x.fillStyle = col; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(t, X, Y); }
function box(x, X, Y, W, H, col = C.w, lw = 2) { x.strokeStyle = col; x.lineWidth = lw; x.strokeRect(X, Y, W, H); }
function ln(x, pts, col = C.g, lw = 3) { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
function blank(x, N, M = N) { x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, N, M); }
function flag(x, t, X, Y, size = 26) { txt(x, t, X, Y, C.r, size, 'center', 700); }

/* ---------------- PFD ---------------- */
export function drawPFD(x, N, sys, side = 0) {
  blank(x, N); const s = sys.st, w = sys.sw;
  const ir = s.irs[side === 0 ? 0 : 1];
  const adr = ir.mode !== 'OFF';
  const att = ir.att, hdgOk = ir.aligned || false;
  const k = N / 512; x.save(); x.scale(k, k);
  // FMA boxes (empty on the ground, separators only)
  x.strokeStyle = C.grey; x.lineWidth = 2; for (const X of [104, 196, 288, 380]) ln(x, [[X, 8], [X, 62]], C.grey, 2);
  if (s.eng.some(e => e.running)) { txt(x, '1FD2', 430, 36, C.w, 17); }
  // attitude
  const cx = 240, cy = 230, pitch = 0.6, bank = 0;
  x.save(); x.beginPath(); x.roundRect(146, 112, 188, 236, 26); x.clip();
  if (att) {
    x.translate(cx, cy); x.rotate(-bank * D2R); const pp = 4.2; // px per degree
    x.fillStyle = C.sky; x.fillRect(-300, -600 + pitch * pp, 600, 600); x.fillStyle = C.gnd; x.fillRect(-300, pitch * pp, 600, 600);
    ln(x, [[-300, pitch * pp], [300, pitch * pp]], C.w, 2);
    for (let p = -30; p <= 30; p += 2.5) { if (!p) continue; const Y = (pitch - p) * pp, L = p % 10 === 0 ? 46 : p % 5 === 0 ? 26 : 12; ln(x, [[-L, Y], [L, Y]], C.w, 2); if (p % 10 === 0) { txt(x, String(Math.abs(p)), -L - 16, Y, C.w, 15); txt(x, String(Math.abs(p)), L + 16, Y, C.w, 15); } }
  } else { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); }
  x.restore();
  if (att) {
    // bank scale + pointer
    x.save(); x.translate(cx, cy); for (const a of [-45, -30, -20, -10, 0, 10, 20, 30, 45]) { const r1 = 112, r2 = a % 30 === 0 || a === 0 ? 124 : 118; ln(x, [[Math.sin(a * D2R) * r1, -Math.cos(a * D2R) * r1], [Math.sin(a * D2R) * r2, -Math.cos(a * D2R) * r2]], C.w, 2); }
    x.fillStyle = C.y; x.beginPath(); x.moveTo(0, -110); x.lineTo(-8, -98); x.lineTo(8, -98); x.closePath(); x.fill(); x.restore();
    // aircraft symbol
    x.fillStyle = '#000'; x.strokeStyle = C.y; x.lineWidth = 3;
    for (const sd of [-1, 1]) { x.beginPath(); x.rect(cx + sd * 34 - (sd > 0 ? 0 : 42), cy - 4, 42, 8); x.fill(); x.stroke(); x.beginPath(); x.rect(cx + sd * 34 + (sd > 0 ? 0 : -8) + (sd > 0 ? 0 : 42) - (sd > 0 ? 0 : 42), cy - 4, 8, 22); }
    x.fillStyle = C.y; x.fillRect(cx - 5, cy - 5, 10, 10);
  } else flag(x, 'ATT', cx, cy, 30);
  // speed tape
  x.fillStyle = '#3b4248'; x.fillRect(46, 112, 70, 236);
  if (adr) {
    x.save(); x.beginPath(); x.rect(46, 112, 70, 236); x.clip();
    const spd = 30, ppk = 3.4; for (let v = 30; v <= 120; v += 10) { const Y = cy - (v - spd) * ppk; ln(x, [[104, Y], [116, Y]], C.w, 2); if (v % 20 === 0) txt(x, String(v), 88, Y, C.w, 18, 'right'); }
    x.restore(); ln(x, [[118, cy], [138, cy]], C.y, 4);
  } else flag(x, 'SPD', 81, cy);
  // altitude tape
  x.fillStyle = '#3b4248'; x.fillRect(370, 112, 64, 236);
  const alt = 420;
  if (adr) {
    x.save(); x.beginPath(); x.rect(370, 112, 64, 236); x.clip();
    const ppf = 0.55; for (let a = 0; a <= 900; a += 100) { const Y = cy - (a - alt) * ppf; ln(x, [[370, Y], [382, Y]], C.w, 2); if (a % 500 === 0) txt(x, String(a / 100).padStart(2, '0'), 400, Y, C.w, 18, 'left'); }
    x.restore();
    x.fillStyle = '#000'; x.fillRect(372, cy - 18, 70, 36); box(x, 372, cy - 18, 70, 36, C.y, 2); txt(x, String(alt).padStart(5, ' '), 438, cy, C.g, 22, 'right', 700);
    txt(x, 'QNH 1013', 402, 368, C.c, 17);
  } else flag(x, 'ALT', 402, cy);
  // vertical speed scale
  x.fillStyle = '#2f353a'; x.beginPath(); x.moveTo(448, 140); x.lineTo(482, 170); x.lineTo(482, 290); x.lineTo(448, 320); x.closePath(); x.fill();
  if (adr) { for (const [v, Y] of [[0, cy], [1, cy - 30], [2, cy - 55], [6, cy - 80], [-1, cy + 30], [-2, cy + 55], [-6, cy + 80]]) { ln(x, [[452, Y], [462, Y]], C.w, 2); if (v && Math.abs(v) !== 1) txt(x, String(Math.abs(v)), 474, Y, C.w, 13); } ln(x, [[492, cy], [456, cy]], C.g, 3); } else flag(x, 'V/S', 466, cy, 18);
  // heading tape
  x.fillStyle = '#3b4248'; x.fillRect(150, 376, 180, 40);
  if (hdgOk) {
    x.save(); x.beginPath(); x.rect(150, 376, 180, 40); x.clip(); const hdg = 274, pph = 7;
    for (let h = 250; h <= 300; h += 5) { const X = 240 + (h - hdg) * pph; ln(x, [[X, 376], [X, h % 10 ? 384 : 390]], C.w, 2); if (h % 10 === 0) txt(x, String(h / 10).padStart(2, '0'), X, 402, C.w, 17); }
    x.restore(); ln(x, [[240, 370], [240, 392]], C.y, 4);
  } else flag(x, 'HDG', 240, 396);
  if (ir.mode === 'NAV' && !ir.aligned && ir.mode !== 'OFF') txt(x, 'IRS ALIGN ' + fmtT(sys.alignRemaining()), 240, 448, C.w, 18);
  else if (ir.mode === 'ATT') txt(x, 'IRS ATT MODE', 240, 448, C.a, 18);
  x.restore();
}

/* ---------------- ND (arc) ---------------- */
export function drawND(x, N, sys, side = 0) {
  blank(x, N); const s = sys.st; const ir = s.irs[side === 0 ? 0 : 1];
  const k = N / 512; x.save(); x.scale(k, k);
  txt(x, 'GS', 18, 22, C.w, 16, 'left'); txt(x, '0', 50, 22, C.g, 18, 'left'); txt(x, 'TAS', 82, 22, C.w, 16, 'left'); txt(x, '---', 122, 22, C.g, 18, 'left');
  txt(x, '---/---', 18, 44, C.g, 16, 'left');
  const cx = 256, cy = 440, R = 330, hdg = 274;
  if (ir.aligned) {
    x.save(); x.beginPath(); x.rect(0, 60, 512, 452); x.clip();
    x.strokeStyle = C.w; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.17, Math.PI * 1.83); x.stroke();
    for (let h = 0; h < 360; h += 5) { const a = (h - hdg) * D2R; if (Math.abs(a) > 0.58) continue; const sx = cx + Math.sin(a) * R, sy = cy - Math.cos(a) * R, L = h % 10 ? 9 : 16; ln(x, [[sx, sy], [cx + Math.sin(a) * (R + L), cy - Math.cos(a) * (R + L)]], C.w, 2); if (h % 30 === 0) txt(x, String(h / 10), cx + Math.sin(a) * (R + 30), cy - Math.cos(a) * (R + 30), C.w, 18); }
    x.setLineDash([6, 8]); x.strokeStyle = C.w; x.beginPath(); x.arc(cx, cy, R / 2, Math.PI * 1.17, Math.PI * 1.83); x.stroke(); x.setLineDash([]);
    txt(x, '5', cx - R / 2 * 0.5 - 18, cy - R / 2 * 0.86 + 6, C.c, 14);
    // generic departure: runway ahead-left and a route
    x.save(); x.translate(cx, cy); const rw = (a, d) => [Math.sin(a * D2R) * d, -Math.cos(a * D2R) * d];
    const r1 = rw(-28, 120), r2 = rw(-8, 300); ln(x, [r1, r2], C.w, 3); ln(x, [[r1[0] + 6, r1[1]], [r2[0] + 6, r2[1]]], C.w, 3);
    x.setLineDash([10, 8]); ln(x, [[0, 0], rw(-12, 140), rw(6, 230), rw(18, 300)], C.g, 3); x.setLineDash([]);
    for (const [a, d, n] of [[6, 230, 'GPX01'], [18, 300, 'GPX02']]) { const [px, py] = rw(a, d); x.save(); x.translate(px, py); x.strokeStyle = C.g; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 4 : 10, b = i * Math.PI / 4; i ? x.lineTo(Math.cos(b) * r, Math.sin(b) * r) : x.moveTo(Math.cos(b) * r, Math.sin(b) * r); } x.closePath(); x.stroke(); x.restore(); txt(x, n, px + 14, py - 12, C.g, 15, 'left'); }
    x.restore(); x.restore();
    // lubber + aircraft
    ln(x, [[cx, cy - R - 20], [cx, cy - R + 6]], C.y, 4);
    txt(x, 'HDG', 210, 22, C.g, 16); txt(x, '274', 256, 22, C.g, 20, 'center', 700);
  } else {
    x.strokeStyle = C.r; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.17, Math.PI * 1.83); x.stroke();
    flag(x, 'HDG', 256, 92, 26);
    if (ir.mode === 'NAV') txt(x, 'IRS ALIGNING ' + fmtT(sys.alignRemaining()), 256, 260, C.w, 20, 'center', 700);
    else txt(x, ir.mode === 'OFF' ? 'MAP NOT AVAIL' : 'MAP NOT AVAIL', 256, 260, C.r, 20, 'center', 700);
  }
  x.strokeStyle = C.y; x.lineWidth = 4; ln(x, [[cx - 26, cy - 6], [cx + 26, cy - 6]], C.y, 4); ln(x, [[cx, cy - 24], [cx, cy + 22]], C.y, 4); ln(x, [[cx - 10, cy + 16], [cx + 10, cy + 16]], C.y, 4);
  txt(x, 'ARC', 470, 480, C.w, 14);
  x.restore();
}

/* ---------------- ENGINE & WARNING (upper) ---------------- */
function arcGauge(x, X, Y, R, v, max, opt = {}) {
  const a0 = 150 * D2R, sweep = 220 * D2R; const ang = f => a0 + clamp(f, 0, 1.05) * sweep;
  x.lineWidth = 3; x.strokeStyle = opt.dim ? C.dk : C.w; x.beginPath(); x.arc(X, Y, R, a0, a0 + sweep * (opt.redFrom ? opt.redFrom / max : 1)); x.stroke();
  if (opt.redFrom) { x.strokeStyle = C.r; x.lineWidth = 5; x.beginPath(); x.arc(X, Y, R, ang(opt.redFrom / max), a0 + sweep); x.stroke(); }
  for (const t of opt.ticks || []) { const a = ang(t / max); ln(x, [[X + Math.cos(a) * R, Y + Math.sin(a) * R], [X + Math.cos(a) * (R - 9), Y + Math.sin(a) * (R - 9)]], opt.dim ? C.dk : C.w, 2); if (opt.tickLabels) txt(x, opt.tickLabels(t), X + Math.cos(a) * (R - 22), Y + Math.sin(a) * (R - 22), opt.dim ? C.dk : C.w, 15); }
  if (opt.dim) return;
  const a = ang(v / max); x.strokeStyle = opt.needle || C.g; x.lineWidth = 4; x.beginPath(); x.moveTo(X + Math.cos(a) * R * 0.15, Y + Math.sin(a) * R * 0.15); x.lineTo(X + Math.cos(a) * (R + 4), Y + Math.sin(a) * (R + 4)); x.stroke();
}
export function drawEWD(x, N, sys) {
  blank(x, N); const s = sys.st, w = sys.sw; const k = N / 512; x.save(); x.scale(k, k);
  const cols = [138, 374];
  s.eng.forEach((e, i) => {
    const X = cols[i], dim = !e.fadec;
    // N1
    arcGauge(x, X, 92, 66, e.n1, 110, { ticks: [0, 50, 100], tickLabels: t => String(t / 10), redFrom: 104, dim });
    x.fillStyle = '#000'; x.fillRect(X + 2, 104, 92, 34); box(x, X + 2, 104, 92, 34, dim ? C.dk : C.grey, 2);
    if (dim) txt(x, 'XX', X + 48, 121, C.a, 24, 'center', 700); else txt(x, e.n1.toFixed(1), X + 88, 121, C.g, 26, 'right', 700);
    // EGT
    arcGauge(x, X, 222, 48, e.egt, 1000, { ticks: [0, 500, 1000], tickLabels: () => '', redFrom: REF.startEGTLimit + (e.running ? 300 : 0), dim, needle: e.egt > 680 && e.phase === 'START' ? C.a : C.g });
    if (dim) txt(x, 'XX', X + 4, 248, C.a, 22, 'center', 700); else txt(x, String(Math.round(e.egt)), X + 34, 250, e.egt > 680 && e.phase === 'START' ? C.a : C.g, 24, 'right', 700);
    // N2 (boxed during start), FF
    const n2c = dim ? C.a : C.g;
    if (e.phase === 'START') { x.fillStyle = '#2a2f33'; x.fillRect(X - 50, 282, 100, 32); }
    txt(x, dim ? 'XX' : e.n2.toFixed(1), X + 40, 298, n2c, 25, 'right', 700);
    txt(x, dim ? 'XX' : String(Math.round(e.ff / 10) * 10), X + 40, 334, n2c, 23, 'right', 700);
    if (e.ign) txt(x, 'IGN ' + e.ign, X - 70, 298, C.g, 16, 'left');
    if (e.phase === 'ABORT') txt(x, 'ABORT', X - 70, 334, C.a, 16, 'left');
    if (e.fire) { x.strokeStyle = C.r; x.lineWidth = 3; x.strokeRect(X - 74, 26, 148, 222); txt(x, 'FIRE', X, 18, C.r, 18, 'center', 700); }
  });
  for (const [t, Y] of [['N1', 92], ['%', 112], ['EGT', 214], ['°C', 234], ['N2', 290], ['%', 306], ['FF', 326], ['KG/H', 342]]) txt(x, t, 256, Y, C.c, 15);
  // fuel on board, flaps
  const fob = s.fuel.L + s.fuel.C + s.fuel.R;
  txt(x, 'FOB', 312, 376, C.w, 17, 'left'); txt(x, fmtK(Math.round(fob / 10) * 10) + ' KG', 500, 376, C.c, 19, 'right', 700);
  txt(x, 'FLAPS', 30, 376, C.w, 17, 'left'); txt(x, ['UP', '1', '2', '3', 'FULL'][w.flaps], 110, 376, C.g, 20, 'left', 700);
  ln(x, [[8, 396], [504, 396]], C.w, 2); ln(x, [[300, 402], [300, 506]], C.w, 2);
  // warnings and memos
  let Y = 416; const L = (t, col, size = 16, X = 14) => { if (Y > 500) return; txt(x, t, X, Y, col, size, 'left', 600); Y += 19; };
  const warn = s.alerts.filter(a => a.lvl === 'W'), caut = s.alerts.filter(a => a.lvl === 'C');
  for (const a of [...warn, ...caut]) {
    const col = a.lvl === 'W' ? C.r : C.a; L(a.title, col, 17); x.fillStyle = col; x.fillRect(14, Y - 9, Math.min(270, a.title.length * 10.3), 2);
    for (const l of a.lines) { if (l.done) continue; L(' ' + l.t, l.cond ? C.w : C.c, 13.5); }
  }
  const memos = s.memos; let Y2 = 416;
  const left = warn.length + caut.length ? [] : memos.slice(0, 5), right = warn.length + caut.length ? memos : memos.slice(5);
  for (const m of left) L(m.t, m.c === 'a' ? C.a : m.c === 'w' ? C.w : C.g, 16);
  for (const m of right.slice(0, 5)) { txt(x, m.t, 310, Y2, m.c === 'a' ? C.a : m.c === 'w' ? C.w : C.g, 13.5, 'left'); Y2 += 19; }
  x.restore();
}

/* ---------------- SYSTEMS (lower) ---------------- */
const valve = (x, X, Y, open, col = C.g, horiz = false) => { x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.arc(X, Y, 13, 0, 7); x.stroke(); const a = (open ? 0 : Math.PI / 2) + (horiz ? Math.PI / 2 : 0); ln(x, [[X - Math.sin(a) * 13, Y - Math.cos(a) * 13], [X + Math.sin(a) * 13, Y + Math.cos(a) * 13]], col, 3); };
function title(x, t) { txt(x, t, 16, 26, C.w, 22, 'left', 700); x.fillStyle = C.w; x.fillRect(16, 40, t.length * 13.5, 2); }
function bottomStrip(x, sys) {
  ln(x, [[0, 466], [512, 466]], C.w, 2); ln(x, [[170, 466], [170, 512]], C.w, 2); ln(x, [[340, 466], [340, 512]], C.w, 2);
  txt(x, 'TAT', 10, 478, C.w, 13, 'left'); txt(x, `+${OAT}`, 60, 478, C.g, 15, 'left'); txt(x, '°C', 100, 478, C.c, 13, 'left');
  txt(x, 'SAT', 10, 498, C.w, 13, 'left'); txt(x, `+${OAT}`, 60, 498, C.g, 15, 'left'); txt(x, '°C', 100, 498, C.c, 13, 'left');
  const t = 6 * 3600 + 42 * 60 + sys.t; const hh = String(Math.floor(t / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(t / 60) % 60).padStart(2, '0');
  txt(x, `${hh} H ${mm}`, 255, 489, C.g, 20, 'center', 700);
  const gw = 54200 + sys.st.fuel.L + sys.st.fuel.C + sys.st.fuel.R;
  txt(x, 'GW', 350, 489, C.w, 13, 'left'); txt(x, fmtK(Math.round(gw / 100) * 100), 478, 489, C.g, 17, 'right', 700); txt(x, 'KG', 506, 489, C.c, 13, 'right');
}
function genBox(x, X, Y, name, on, avail, load, sel = true) {
  box(x, X, Y, 92, 86, avail || on ? C.w : C.grey, 2); txt(x, name, X + 46, Y + 14, on || avail ? C.w : C.a, 15, 'center', 700);
  if (!sel) { txt(x, 'OFF', X + 46, Y + 46, C.w, 16); return; }
  if (avail || on) { txt(x, String(Math.round(load)), X + 54, Y + 36, C.g, 16, 'right'); txt(x, '%', X + 60, Y + 36, C.c, 13, 'left'); txt(x, '115', X + 54, Y + 55, C.g, 16, 'right'); txt(x, 'V', X + 60, Y + 55, C.c, 13, 'left'); txt(x, '400', X + 54, Y + 74, C.g, 16, 'right'); txt(x, 'HZ', X + 60, Y + 74, C.c, 13, 'left'); }
}
function busBar(x, X, Y, W, name, on) { x.fillStyle = on ? '#1c3a24' : '#3a2a10'; x.fillRect(X, Y, W, 26); box(x, X, Y, W, 26, on ? C.g : C.a, 2); txt(x, name, X + W / 2, Y + 13, on ? C.g : C.a, 16, 'center', 700); }
const PAGES = {
  ELEC(x, sys) {
    const s = sys.st, E = s.elec, w = sys.sw; title(x, 'ELEC');
    [0, 1].forEach(i => { const X = i ? 360 : 60, on = i ? w.bat2 : w.bat1; box(x, X, 54, 92, 66, C.w, 2); txt(x, 'BAT ' + (i + 1), X + 46, 68, C.w, 15, 'center', 700); txt(x, E.batV[i].toFixed(1), X + 58, 88, C.g, 16, 'right'); txt(x, 'V', X + 64, 88, C.c, 13, 'left'); const a = Math.round(E.batA[i]); txt(x, on ? String(a) : '0', X + 58, 108, on && a < -5 ? C.a : C.g, 16, 'right'); txt(x, 'A', X + 64, 108, C.c, 13, 'left'); if (on) ln(x, [[i ? X : X + 92, 88], [i ? 312 : 200, 88]], C.g, 3); });
    busBar(x, 200, 75, 112, 'DC BAT', E.dcBat);
    busBar(x, 24, 156, 112, 'DC 1', E.dc1); busBar(x, 200, 156, 112, 'DC ESS', E.dcEss); busBar(x, 376, 156, 112, 'DC 2', E.dc2);
    [0, 1].forEach(i => { const X = i ? 396 : 44; box(x, X, 204, 72, 56, E['ac' + (i + 1)] ? C.w : C.grey, 2); txt(x, 'TR ' + (i + 1), X + 36, 218, E['ac' + (i + 1)] ? C.w : C.a, 15, 'center', 700); if (E['ac' + (i + 1)]) { txt(x, '28 V', X + 36, 236, C.g, 14); txt(x, (i ? 82 : 96) + ' A', X + 36, 252, C.g, 14); ln(x, [[X + 36, 204], [X + 36, 182]], C.g, 3); ln(x, [[X + 36, 260], [X + 36, 290]], C.g, 3); } });
    busBar(x, 24, 290, 112, 'AC 1', E.ac1); busBar(x, 200, 290, 112, 'AC ESS', E.acEss); busBar(x, 376, 290, 112, 'AC 2', E.ac2);
    const g = s.eng;
    genBox(x, 14, 360, 'GEN 1', E.genOn[0], g[0].running, 32, w.gen1); genBox(x, 132, 360, 'APU GEN', E.apuGenOn, E.apuGenAvail, E.apuGenOn ? 38 : 0, w.apuGen); genBox(x, 288, 360, 'EXT PWR', E.extOn, E.extAvail, E.extOn ? 30 : 0); genBox(x, 406, 360, 'GEN 2', E.genOn[1], g[1].running, 34, w.gen2);
    const feed = (src, X) => { if (E.src1 === src || E.src2 === src) ln(x, [[X, 360], [X, 316]], C.g, 3); };
    feed('GEN 1', 60); feed('GEN 2', 452); feed('APU GEN', 178); feed('EXT PWR', 334);
    if ((E.src1 && E.src2 && (E.src1 !== 'GEN 1' || E.src2 !== 'GEN 2'))) ln(x, [[136, 340], [376, 340]], C.g, 3);
    bottomStrip(x, sys);
  },
  APU(x, sys) {
    const A = sys.st.apu, E = sys.st.elec, B = sys.st.bleed; title(x, 'APU');
    if (A.avail) txt(x, 'AVAIL', 256, 26, C.g, 22, 'center', 700);
    const dial = (X, Y, v, max, lab, unit, red) => { arcGauge(x, X, Y, 64, v, max, { ticks: [0, max / 2, max], tickLabels: t => String(Math.round(t / (max > 500 ? 100 : 10))), redFrom: red, dim: !E.dc }); txt(x, lab, X - 40, Y + 52, C.w, 15, 'left'); txt(x, unit, X - 40, Y + 70, C.c, 14, 'left'); txt(x, E.dc ? String(Math.round(v)) : 'XX', X + 56, Y + 58, E.dc ? C.g : C.a, 24, 'right', 700); };
    dial(140, 150, A.n, 110, 'N', '%', 107); dial(140, 330, A.egt, 1200, 'EGT', '°C', 1000);
    box(x, 300, 60, 180, 96, E.apuGenAvail ? C.w : C.grey, 2); txt(x, 'APU GEN', 390, 76, E.apuGenAvail ? C.w : C.a, 16, 'center', 700);
    if (E.apuGenAvail) { [['LOAD', E.apuGenOn ? 38 : 0, '%'], ['V', 115, ''], ['HZ', 400, '']].forEach(([l, v, u], i) => { txt(x, l === 'LOAD' ? 'LOAD' : '', 312, 98 + i * 20, C.w, 13, 'left'); txt(x, String(v), 440, 98 + i * 20, C.g, 16, 'right'); txt(x, u || l, 446, 98 + i * 20, C.c, 13, 'left'); }); }
    txt(x, 'APU BLEED', 390, 200, C.w, 16, 'center', 700); txt(x, A.avail ? String(Math.round(B.apuP || 0)) : 'XX', 410, 226, A.avail ? C.g : C.a, 20, 'right', 700); txt(x, 'PSI', 416, 226, C.c, 13, 'left');
    valve(x, 390, 270, B.apuValve > 0.5, C.g); ln(x, [[390, 283], [390, 330]], C.g, 3); if (B.apuValve > 0.5) ln(x, [[390, 257], [390, 240]], C.g, 3);
    txt(x, A.flap >= 1 ? 'FLAP OPEN' : A.flap > 0 ? 'FLAP MOVING' : 'FLAP CLOSED', 390, 370, A.flap > 0 && A.flap < 1 ? C.a : A.flap >= 1 ? C.g : C.w, 16, 'center', 700);
    if (A.phase === 'START') txt(x, 'STARTING', 390, 410, C.g, 16, 'center', 700);
    if (A.phase === 'COOL') txt(x, 'COOLING ' + Math.ceil(A.cool) + ' s', 390, 410, C.g, 16, 'center', 700);
    txt(x, 'FUEL ' + Math.round(A.ff) + ' KG/H', 390, 440, C.g, 14);
    bottomStrip(x, sys);
  },
  BLEED(x, sys) {
    const s = sys.st, B = s.bleed, w = sys.sw; title(x, 'BLEED');
    [0, 1].forEach(i => {
      const X = i ? 380 : 132, p = B.duct[i];
      box(x, X - 44, 70, 88, 44, w['pack' + (i + 1)] ? C.w : C.grey, 2); txt(x, 'PACK ' + (i + 1), X, 84, w['pack' + (i + 1)] ? C.w : C.a, 15, 'center', 700); txt(x, B.pack[i] > 0.5 ? 'FLOW' : 'OFF', X, 102, B.pack[i] > 0.5 ? C.g : C.a, 14);
      ln(x, [[X, 114], [X, 230]], p > 8 ? C.g : C.grey, 3);
      txt(x, String(Math.round(p)), X + 52, 180, C.g, 20, 'right', 700); txt(x, 'PSI', X + 56, 180, C.c, 13, 'left');
      valve(x, X, 300, B.engValve[i], C.g); ln(x, [[X, 230], [X, 287]], p > 8 ? C.g : C.grey, 3); ln(x, [[X, 313], [X, 370]], s.eng[i].running ? C.g : C.grey, 3);
      txt(x, 'ENG ' + (i + 1), X, 392, C.w, 16, 'center', 700); txt(x, 'HP / IP', X, 412, C.grey, 12);
    });
    ln(x, [[132, 230], [243, 230]], C.g, 3); ln(x, [[269, 230], [380, 230]], B.xValve > 0.5 ? C.g : C.grey, 3); valve(x, 256, 230, B.xValve > 0.5, C.g, true); txt(x, 'X BLEED', 256, 206, C.w, 13);
    ln(x, [[200, 230], [200, 300]], B.apuValve > 0.5 ? C.g : C.grey, 3); valve(x, 200, 313, B.apuValve > 0.5, C.g); ln(x, [[200, 326], [200, 370]], s.apu.avail ? C.g : C.grey, 3); txt(x, 'APU', 200, 392, C.w, 16, 'center', 700);
    s.eng.forEach((e, i) => { if (e.sv) txt(x, 'START AIR', i ? 380 : 132, 440, C.g, 14); });
    bottomStrip(x, sys);
  },
  ENG(x, sys) {
    const s = sys.st; title(x, 'ENG');
    const rows = [['F.USED', 'KG', 76], ['OIL', 'QT', 130], ['', 'PSI', 186], ['', '°C', 236], ['VIB N1', '', 286], ['VIB N2', '', 312]];
    rows.forEach(([a, b, Y]) => { txt(x, a, 256, Y - 8, C.w, 13); txt(x, b, 256, Y + 8, C.c, 13); });
    s.eng.forEach((e, i) => {
      const X = i ? 390 : 122, on = e.fadec || e.n2 > 1;
      txt(x, String(Math.round(s.fuel.used[i] / 10) * 10), X, 76, C.g, 20, 'center', 700);
      txt(x, on ? e.oilQ.toFixed(1) : 'XX', X, 130, on ? C.g : C.a, 20, 'center', 700);
      arcGauge(x, X, 196, 34, e.oilP, 100, { ticks: [0, 100], redFrom: 0, dim: !on }); txt(x, on ? String(Math.round(e.oilP)) : 'XX', X + 10, 214, on ? C.g : C.a, 18, 'left', 700);
      txt(x, on ? String(Math.round(e.oilT)) : 'XX', X, 236, on ? C.g : C.a, 20, 'center', 700);
      txt(x, on ? e.vib1.toFixed(1) : 'XX', X, 286, on ? C.g : C.a, 17, 'center'); txt(x, on ? e.vib2.toFixed(1) : 'XX', X, 312, on ? C.g : C.a, 17, 'center');
      // start valve, ignition, start air pressure
      valve(x, X, 372, e.sv, e.sv ? C.g : C.g); ln(x, [[X, 385], [X, 410]], e.sv ? C.g : C.grey, 3); ln(x, [[X, 340], [X, 359]], s.bleed.duct[i] > 10 ? C.g : C.grey, 3);
      txt(x, String(Math.round(s.bleed.duct[i])) + ' PSI', X + (i ? -64 : 64), 350, C.g, 15, 'center');
      if (e.ign) txt(x, 'IGN ' + e.ign, X, 430, C.g, 16, 'center', 700);
      if (e.phase === 'START') txt(x, 'STARTING', X, 450, C.g, 13);
    });
    txt(x, 'START VALVE', 256, 372, C.w, 12);
    bottomStrip(x, sys);
  },
  HYD(x, sys) {
    const s = sys.st, H = s.hyd, w = sys.sw; title(x, 'HYD');
    const X = [108, 256, 404], names = ['HYD 1', 'HYD 2', 'HYD 3'], pumps = [['ENG 1', 'hEng1', 0], ['ELEC', 'hElec', -1], ['ENG 2', 'hEng2', 1]];
    X.forEach((cx, i) => {
      const p = H.p[i], ok = p > 1450;
      txt(x, names[i], cx, 70, ok ? C.w : C.a, 20, 'center', 700); txt(x, String(Math.round(p / 50) * 50), cx, 98, ok ? C.g : C.a, 22, 'center', 700);
      x.fillStyle = ok ? C.g : C.a; x.beginPath(); x.moveTo(cx, 116); x.lineTo(cx - 9, 130); x.lineTo(cx + 9, 130); x.closePath(); x.fill();
      ln(x, [[cx, 130], [cx, 270]], ok ? C.g : C.a, 3);
      const [pn, sw, ei] = pumps[i]; const run = ei >= 0 ? s.eng[ei].n2 > 10 && w[sw] && !w['firePb' + (ei + 1)] : w[sw] && s.elec.ac && s.eng.some(e => e.running);
      box(x, cx - 22, 270, 44, 40, run ? C.g : C.a, 3); if (run) ln(x, [[cx, 270], [cx, 310]], C.g, 3); else if (w[sw]) txt(x, 'LO', cx, 290, C.a, 15, 'center', 700); else ln(x, [[cx - 14, 290], [cx + 14, 290]], C.a, 3);
      txt(x, pn, cx, 326, C.w, 14);
      if (ei >= 0) { ln(x, [[cx, 340], [cx, 352]], C.g, 3); valve(x, cx, 368, !w['firePb' + (ei + 1)], w['firePb' + (ei + 1)] ? C.a : C.g); }
      x.strokeStyle = C.w; x.lineWidth = 2; x.strokeRect(cx - 9, 400, 18, 50); x.fillStyle = C.g; x.fillRect(cx - 7, 412, 14, 36);
    });
    // PTU between HYD 1 and HYD 3
    const yP = 190; ln(x, [[108, yP], [212, yP]], C.g, 3); ln(x, [[300, yP], [404, yP]], C.g, 3); txt(x, 'PTU', 256, yP - 24, w.ptu ? C.w : C.a, 15, 'center', 700);
    x.strokeStyle = H.ptu ? C.g : C.w; x.lineWidth = 3; x.beginPath(); x.moveTo(214, yP); x.lineTo(234, yP - 12); x.lineTo(234, yP + 12); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(298, yP); x.lineTo(278, yP - 12); x.lineTo(278, yP + 12); x.closePath(); x.stroke();
    if (H.ptu) txt(x, 'ON', 256, yP + 4, C.g, 13, 'center', 700);
    bottomStrip(x, sys);
  },
  FUEL(x, sys) {
    const s = sys.st, F = s.fuel, w = sys.sw; title(x, 'FUEL');
    txt(x, 'F.USED', 256, 66, C.w, 14); txt(x, String(Math.round((F.used[0] + F.used[1] + F.apuUsed) / 10) * 10), 256, 86, C.g, 18, 'center', 700); txt(x, 'KG', 256, 104, C.c, 13);
    [0, 1].forEach(i => { const X = i ? 392 : 120; txt(x, 'ENG ' + (i + 1), X, 70, C.w, 16, 'center', 700); valve(x, X, 112, !w['firePb' + (i + 1)] && (w['master' + (i + 1)] || s.eng[i].fuelOn), C.g); ln(x, [[X, 125], [X, 250]], s.eng[i].fuelOn ? C.g : C.grey, 3); });
    ln(x, [[120, 220], [243, 220]], C.g, 3); ln(x, [[269, 220], [392, 220]], F.xOpen > 0.5 ? C.g : C.grey, 3); valve(x, 256, 220, F.xOpen > 0.5, C.g, true); txt(x, 'X FEED', 256, 196, C.w, 13);
    ln(x, [[60, 220], [60, 250]], s.apu.ff > 0 ? C.g : C.grey, 3); txt(x, 'APU', 60, 205, C.w, 13);
    // tanks
    const tank = (X, W, kg, name, pumps) => {
      x.strokeStyle = C.w; x.lineWidth = 2; x.strokeRect(X, 250, W, 120); txt(x, name, X + W / 2, 268, C.w, 14);
      txt(x, fmtK(Math.round(kg / 10) * 10), X + W / 2, 345, C.g, 21, 'center', 700);
      pumps.forEach(([id, px]) => { const run = F.run[id]; box(x, px - 14, 282, 28, 32, run ? C.g : C.a, 3); if (run) ln(x, [[px, 282], [px, 314]], C.g, 3); else if (w[id]) txt(x, 'LO', px, 298, C.a, 12, 'center', 700); else ln(x, [[px - 9, 298], [px + 9, 298]], C.a, 3); });
    };
    tank(16, 186, F.L, 'L', [['pL1', 76], ['pL2', 142]]); tank(206, 100, F.C, 'CTR', [['pC1', 234], ['pC2', 278]]); tank(310, 186, F.R, 'R', [['pR1', 370], ['pR2', 436]]);
    txt(x, 'FOB', 120, 410, C.w, 16); txt(x, fmtK(Math.round((F.L + F.C + F.R) / 10) * 10) + ' KG', 260, 410, C.c, 21, 'center', 700);
    bottomStrip(x, sys);
  }
};
export function drawSD(x, N, sys) {
  blank(x, N); const k = N / 512; x.save(); x.scale(k, k);
  const p = sys.st.sdPage, f = PAGES[p];
  if (f) f(x, sys); else { title(x, { FCTL: 'F/CTL', STS: 'STATUS' }[p] || p); txt(x, 'Page not modelled in this trainer', 256, 240, C.w, 17); bottomStrip(x, sys); }
  x.restore();
}

/* ---------------- standby instrument ---------------- */
export function drawStby(x, N, sys) {
  blank(x, N); const k = N / 256; x.save(); x.scale(k, k); const s = sys.st;
  const t = s.elec.dcBat && s.elec.dcOnT != null ? sys.t - s.elec.dcOnT : -1;
  if (t < 0) { x.restore(); return false; }
  x.save(); x.beginPath(); x.rect(48, 34, 160, 180); x.clip();
  if (t > 8) { x.fillStyle = C.sky; x.fillRect(0, 0, 256, 126); x.fillStyle = C.gnd; x.fillRect(0, 126, 256, 140); ln(x, [[0, 126], [256, 126]], C.w, 2); for (const p of [-10, 10]) ln(x, [[108, 126 - p * 3], [148, 126 - p * 3]], C.w, 2); x.fillStyle = C.y; x.fillRect(96, 124, 26, 5); x.fillRect(134, 124, 26, 5); x.fillRect(125, 123, 6, 6); }
  else { txt(x, 'INIT', 128, 110, C.w, 20, 'center', 700); txt(x, String(Math.ceil(8 - t)) + ' s', 128, 140, C.w, 17); }
  x.restore();
  x.fillStyle = '#30363b'; x.fillRect(4, 34, 42, 180); x.fillRect(210, 34, 42, 180);
  txt(x, '30', 25, 124, C.w, 15); txt(x, '420', 231, 124, C.g, 15); txt(x, 'QNH 1013', 128, 232, C.c, 14);
  txt(x, 'STBY', 128, 18, C.grey, 13);
  x.restore(); return true;
}
/* ---------------- clock ---------------- */
export function drawClock(x, N, sys) {
  blank(x, N, N * 0.75); const k = N / 256; x.save(); x.scale(k, k);
  const t = 6 * 3600 + 42 * 60 + sys.t; const hh = String(Math.floor(t / 3600) % 24).padStart(2, '0'), mm = String(Math.floor(t / 60) % 60).padStart(2, '0'), ss = String(Math.floor(t) % 60).padStart(2, '0');
  txt(x, 'UTC', 30, 30, C.grey, 15, 'left'); txt(x, `${hh}:${mm}`, 128, 82, '#e8edf0', 64, 'center', 700); txt(x, ss, 230, 96, '#e8edf0', 24, 'right', 700);
  const et = Math.max(0, sys.t); txt(x, 'ET', 30, 150, C.grey, 15, 'left'); txt(x, `${String(Math.floor(et / 3600)).padStart(2, '0')}:${String(Math.floor(et / 60) % 60).padStart(2, '0')}`, 128, 150, '#e8edf0', 30, 'center', 700);
  x.restore();
}
/* ---------------- brake / accumulator triple gauge (mechanical) ---------------- */
export function drawBrake(x, N, sys) {
  x.setTransform(1, 0, 0, 1, 0, 0); const k = N / 256; x.save(); x.scale(k, k);
  x.fillStyle = '#121416'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#05070a'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  const H = sys.st.hyd;
  const needle = (cx, cy, a0, a1, v, R) => { const a = (a0 + (a1 - a0) * clamp(v / 4000, 0, 1)) * D2R; x.strokeStyle = '#f4f4f0'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke(); x.fillStyle = '#2a2d30'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill(); };
  const scale = (cx, cy, a0, a1, R, labels) => { x.strokeStyle = '#e8e8e2'; x.lineWidth = 2; x.beginPath(); x.arc(cx, cy, R, Math.min(a0, a1) * D2R, Math.max(a0, a1) * D2R); x.stroke(); for (let i = 0; i <= 4; i++) { const a = (a0 + (a1 - a0) * i / 4) * D2R; ln(x, [[cx + Math.cos(a) * R, cy + Math.sin(a) * R], [cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)]], '#e8e8e2', 2); if (labels) txt(x, String(i), cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22), '#e8e8e2', 14); } const ga = (a0 + (a1 - a0) * 0.75) * D2R, gb = (a0 + (a1 - a0) * 0.85) * D2R; x.strokeStyle = '#2fd060'; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, R + 4, Math.min(ga, gb), Math.max(ga, gb)); x.stroke(); };
  scale(128, 128, 200, 340, 92, true); needle(128, 128, 200, 340, H.accu, 84);
  scale(70, 210, 290, 200, 66, false); needle(70, 210, 290, 200, H.brakeL, 58);
  scale(186, 210, 250, 340, 66, false); needle(186, 210, 250, 340, H.brakeR, 58);
  txt(x, 'ACCU PRESS', 128, 70, '#e8e8e2', 13); txt(x, 'BRAKES', 128, 168, '#e8e8e2', 14); txt(x, 'L', 96, 196, '#e8e8e2', 14); txt(x, 'R', 160, 196, '#e8e8e2', 14); txt(x, 'PSI x1000', 128, 236, '#9aa', 11);
  x.restore();
}
