/* Generic twin-jet flight deck (classic narrow-body layout). Frame: metres, x right, y up, z aft, cabin floor y = 0.
   Captain's eye at (-0.53, 1.20, 0). */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from '../sim/textures.js';
import { createPanel, mats, FONT, LCDFONT, smudgeTex } from './panel.js';
import { CTL, FMS_FK, FMS_AK, FMS_NK, fmsId } from './controls.js';
import { drawFMS, fmsKeyState, baroText, freqText } from './avionics.js';
import { drawPFD, drawND, drawEWD, drawSD, drawStby, drawClock, drawBrake } from './displays.js';
import { fmtT } from './systems.js';
import { buildShell, buildReflections } from './shell.js';

const D2R = Math.PI / 180;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const EYE = V(-0.53, 1.2, 0.0);
const A = 'amber', Wh = 'white', Bl = 'blue', G = 'green', R = 'red';
const FO = (t = 'FAULT', b = 'OFF') => ({ top: t, topC: A, bot: b, botC: Wh });

function lcdText(x, W, H, lines, col = '#ffb340', font = 0.62) {
  x.fillStyle = '#060504'; x.fillRect(0, 0, W, H);
  x.fillStyle = col; x.textBaseline = 'middle';
  lines.forEach(([t, u, v, s = font, al = 'left', c]) => { x.font = `700 ${H * s}px ${LCDFONT}`; x.textAlign = al; x.fillStyle = c || col; x.fillText(t, u * W, v * H); });
}

export function buildDeck(renderer) {
  const root = new THREE.Group(); root.name = 'deck';
  const M = mats();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tx = (c, o = {}) => TX.tex(c, { aniso, ...o });
  const panels = [], ctls = {}, hits = [], extraAnims = [];
  const addPanel = (P, parent = root) => { P.finish(); parent.add(P.group); panels.push(P); Object.assign(ctls, P.ctls); hits.push(...P.hits); return P; };

  /* ================= shell (see shell.js) ================= */
  const carpet = TX.fabric('#2c2f33', '#383c41', 2, 8), gfab = TX.fabric('#1e2023', '#2a2d30', 2, 3);
  const glare = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.95, map: tx(gfab.map, { repeat: [40, 6] }), normalMap: tx(gfab.normal, { srgb: false, repeat: [40, 6] }), normalScale: new THREE.Vector2(0.6, 0.6) });
  const carpetM = new THREE.MeshStandardMaterial({ map: tx(carpet.map, { repeat: [6, 6] }), normalMap: tx(carpet.normal, { srgb: false, repeat: [6, 6] }), roughness: 1 });
  /* shell geometry collected per material and merged */
  const shell = new Map();
  const cleanG = geo => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
  const S = (geo, mat, pos, rot, scale) => {
    const g = cleanG(geo);
    const m4 = new THREE.Matrix4().compose(pos || V(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), scale || V(1, 1, 1)); g.applyMatrix4(m4);
    if (!shell.has(mat)) shell.set(mat, []); shell.get(mat).push(g);
  };
  const quad = (a, b, c, d, mat, uvScale = 1) => { // a b c d counter-clockwise seen from the front
    const g = new THREE.BufferGeometry(); const p = [a, b, c, a, c, d].flatMap(v => [v.x, v.y, v.z]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); const w = a.distanceTo(b) * uvScale, h = a.distanceTo(d) * uvScale;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, w, 0, w, h, 0, 0, w, h, 0, h], 2)); g.computeVertexNormals(); S(g, mat);
  };
  const SH = buildShell({ S, quad, root, tx, aniso, push: (mat, g) => { if (!shell.has(mat)) shell.set(mat, []); shell.get(mat).push(cleanG(g)); }, merge: list => mergeGeometries(list.map(cleanG), false) });
  const { lining, liningDk, glass, leather } = SH; const glassMeshes = SH.glassMeshes, panes = SH.panes;
  // windscreen header + ceiling
  S(new RoundedBoxGeometry(1.7, 0.08, 0.12, 2, 0.03), liningDk, V(0, 1.74, -0.70), [0.35, 0, 0]);
  quad(V(-0.40, 2.12, 1.6), V(0.40, 2.12, 1.6), V(0.38, 2.08, 0.16), V(-0.38, 2.08, 0.16), lining, 2);
  // ceiling vault behind everything above the windows (closes gaps around the overhead panel)
  { const g = new THREE.CylinderGeometry(1.3, 1.3, 2.45, 40, 1, true, Math.PI / 2 + 0.45, Math.PI - 0.9); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5f666c, roughness: 0.9, side: THREE.BackSide })); m.rotation.x = Math.PI / 2; m.position.set(0, 0.9, 0.42); m.receiveShadow = true; root.add(m); }
  // close the vault above the windscreen header (no sky leaks round the front of the overhead)
  S(new THREE.PlaneGeometry(1.8, 0.62), liningDk, V(0, 2.03, -0.775));
  S(new THREE.PlaneGeometry(0.80, 0.30), liningDk, V(0, 1.80, -0.69), [-1.0, 0, 0]);
  // floor, rear bulkhead with door
  S(new THREE.PlaneGeometry(2.2, 2.9), carpetM, V(0, 0, 0.3), [-Math.PI / 2, 0, 0]);
  quad(V(1.06, 0, 1.6), V(-1.06, 0, 1.6), V(-0.40, 2.12, 1.6), V(0.40, 2.12, 1.6), lining, 2);
  S(new RoundedBoxGeometry(0.42, 0.06, 0.36, 3, 0.02), M.darkMetal, V(0.62, 0.55, 1.42)); S(new RoundedBoxGeometry(0.42, 0.5, 0.08, 3, 0.03), M.bezel, V(0.62, 0.85, 1.55));   // folded observer seat
  S(new RoundedBoxGeometry(0.5, 0.7, 0.06, 2, 0.01), M.paintDark, V(-0.62, 1.1, 1.57));                                                             // rear circuit-breaker panel
  S(new RoundedBoxGeometry(0.62, 1.9, 0.04, 2, 0.01), liningDk, V(0.0, 0.95, 1.58));
  S(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10), M.metal, V(0.25, 1.0, 1.55), [0, 0, Math.PI / 2]);

  /* ================= glareshield ================= */
  {
    const gs = new THREE.Shape(); gs.moveTo(-0.99, 0); gs.lineTo(0.99, 0); gs.lineTo(0.99, 0.29); gs.lineTo(-0.99, 0.29); gs.closePath();
    const top = new RoundedBoxGeometry(1.98, 0.05, 0.30, 3, 0.02); S(top, glare, V(0, 1.015, -0.925));
    S(new THREE.CapsuleGeometry(0.022, 1.94, 4, 12), glare, V(0, 1.045, -0.80), [0, 0, Math.PI / 2]);
    S(new THREE.BoxGeometry(1.98, 0.012, 0.16), glare, V(0, 0.955, -0.86));
  }
  // stitched edge of the anti-glare cover
  { const c = document.createElement('canvas'); c.width = 2048; c.height = 16; const x = c.getContext('2d'); x.fillStyle = 'rgba(160,166,172,0.9)'; for (let i = 0; i < 2048; i += 12) x.fillRect(i, 6, 7, 3); const t = tx(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
    const sm = new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.006), sm); top.rotation.x = -Math.PI / 2; top.position.set(0, 1.0675, -0.80); root.add(top);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.006), sm); front.position.set(0, 1.046, -0.7775); root.add(front); }
  // light strip under the glareshield (panel flood)
  const flood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.004, 0.012), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xfff2d8, emissiveIntensity: 0 })); flood.position.set(0, 0.948, -0.80); root.add(flood);

  /* ================= main instrument panel ================= */
  const mip = new THREE.Group(); mip.position.set(0, 0.66, -0.88); mip.rotation.x = -12 * D2R; root.add(mip);
  const display = (P, id, u, v, size = 0.168, px = 512) => {
    const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, px, px);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    const p = P.local(u, v);
    const bz = 0.024 + size;
    P.static(new RoundedBoxGeometry(bz, bz, 0.03, 3, 0.006), M.bezel, V(p.x, p.y, 0.008));
    for (const [a, b] of [[-1, -1], [1, -1]]) P.static(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 16), M.knob, V(p.x + a * (bz / 2 - 0.009), p.y + b * (bz / 2 - 0.007), 0.025), [Math.PI / 2, 0, 0]);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ color: 0x020304, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.25, roughness: 1, roughnessMap: smudgeTex(), metalness: 0, envMapIntensity: 1.4 }));
    scr.position.set(p.x, p.y, 0.0235); P.group.add(scr); P.hitMesh(scr, id);
    if (!P.ctls[id]) P.reg(id, { kind: 'ind', u, v, size });
    return { c, x, t, mesh: scr, px };
  };
  const DSP = {};
  // captain section (angled towards the pilot), centre, first officer section
  const secW = 0.70, secH = 0.58;
  const capPiv = new THREE.Group(); capPiv.position.set(-0.27, -0.01, 0); capPiv.rotation.y = 10 * D2R; mip.add(capPiv);
  const foPiv = new THREE.Group(); foPiv.position.set(0.27, -0.01, 0); foPiv.rotation.y = -10 * D2R; mip.add(foPiv);
  for (const sd of [-1, 1]) {
    const P = createPanel({ name: sd < 0 ? 'MIP-CAPT' : 'MIP-FO', w: secW, h: secH, paint: '#4c5965', max: 24, atlas: [512, 256] });
    const mir = u => sd < 0 ? u : secW - u;
    const pfdU = mir(0.255), ndU = mir(0.49), dv = 0.10;
    const pfd = display(P, sd < 0 ? 'pfd' : 'pfdFO', pfdU, dv), nd = display(P, sd < 0 ? 'nd' : 'ndFO', ndU, dv);
    if (sd < 0) { DSP.pfd = pfd; DSP.nd = nd; } else { DSP.pfdFO = pfd; DSP.ndFO = nd; }
    P.module(null, '', 0.006, 0.215, secW - 0.006, 0.50, {});
    P.text(sd < 0 ? 'CAPT' : 'F/O', mir(0.05), 0.235, 0.0055, { weight: 700 });
    P.knob(mir(0.06), 0.29, 0.009); P.text('LOUDSPEAKER', mir(0.06), 0.272, 0.0036);
    P.tog(sd < 0 ? 'd_consoleL' : 'd_consoleR', mir(0.16), 0.30, { labels: ['OFF', 'DIM', 'BRT'], label: 'CONSOLE/FLOOR' });
    P.pb(sd < 0 ? 'd_pfdxfr' : 'd_pfdxfrR', mir(0.39), 0.28, { top: 'PFD/ND', topC: Wh, single: true, paint: true, label: 'XFR', size: 0.28 });
    P.pb(sd < 0 ? 'd_chrono' : 'd_chronoR', mir(0.60), 0.27, { top: 'CHRONO', topC: Wh, single: true, paint: true, size: 0.26 });
    P.knob(mir(0.30), 0.27, 0.008); P.text('PFD', mir(0.30), 0.254, 0.0036); P.knob(mir(0.49), 0.27, 0.008); P.text('ND', mir(0.49), 0.254, 0.0036);
    P.text('INTEGRAL BRIGHTNESS', mir(0.40), 0.315, 0.0036, { color: '#cfd6da' });
    P.group.position.set(sd * secW / 2, 0, 0);
    addPanel(P, sd < 0 ? capPiv : foPiv);
    P.group.updateMatrix();
  }
  {
    const P = createPanel({ name: 'MIP-CTR', w: 0.54, h: 0.44, paint: '#4c5965', max: 24, atlas: [512, 256] });
    DSP.ewd = display(P, 'ewd', 0.27, 0.10); DSP.sd = display(P, 'sd', 0.27, 0.303);
    // standby instrument + clock (left), gear + autobrake + brake gauge (right)
    { const p = P.local(0.083, 0.072); P.static(new RoundedBoxGeometry(0.098, 0.098, 0.03, 3, 0.008), M.bezel, V(p.x, p.y, 0.008)); }
    DSP.stby = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const p = P.local(0.083, 0.072); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x020304, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.2, roughness: 0.12 })); m.position.set(p.x, p.y, 0.0235); P.group.add(m); P.hitMesh(m, 'stby'); P.reg('stby', { kind: 'ind', u: 0.083, v: 0.072, size: 0.08 }); return { c, x, t, px: 256, mesh: m }; })();
    DSP.clock = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const p = P.local(0.083, 0.165); P.static(new RoundedBoxGeometry(0.084, 0.07, 0.024, 3, 0.006), M.bezel, V(p.x, p.y, 0.006)); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.051), new THREE.MeshStandardMaterial({ color: 0x020304, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.1, roughness: 0.15 })); m.position.set(p.x, p.y, 0.0185); P.group.add(m); P.hitMesh(m, 'clock'); P.reg('clock', { kind: 'ind', u: 0.083, v: 0.165, size: 0.07 }); return { c, x, t, px: 256, mesh: m }; })();
    P.text('CLOCK', 0.083, 0.124, 0.0036);
    P.tog('d_antiskid', 0.083, 0.255, { labels: ['OFF', 'ON'], label: 'ANTI SKID & N/W STRG' });
    // landing gear indications and lever
    P.module(null, '', 0.395, 0.012, 0.535, 0.43, {});
    P.text('LDG GEAR', 0.465, 0.026, 0.0042, { weight: 700 });
    [['gearL', 0.432], ['gearN', 0.465], ['gearR', 0.498]].forEach(([id, u]) => P.ann(id, u, 0.046, { top: 'DN', topC: G, single: true, w: 0.022, h: 0.014 }));
    P.text('AUTO BRK', 0.465, 0.07, 0.0042, { weight: 700 });
    ['LO', 'MED', 'MAX'].forEach((t, i) => P.pb('autoBrk', 0.432 + i * 0.033, 0.09, { top: t, topC: Wh, bot: '', botC: G, paint: true, w: 0.022, h: 0.016, d: 0.008, bar: true, topSize: 0.42 }));
    { // gear lever: slot + lever with wheel-shaped knob (down)
      const p = P.local(0.465, 0.20);
      P.draw((x, px) => { x.fillStyle = '#15191c'; x.beginPath(); x.roundRect(px(0.459), px(0.135), px(0.012), px(0.13), px(0.006)); x.fill(); x.fillStyle = '#f2f4f5'; x.font = `700 ${px(0.0042)}px ${FONT}`; x.textAlign = 'left'; x.fillText('UP', px(0.478), px(0.14)); x.fillText('DOWN', px(0.478), px(0.262)); });
      const g = new THREE.Group(); g.position.set(p.x, p.y - 0.055, 0); P.group.add(g);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.07), M.metal); arm.position.z = 0.035; g.add(arm);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 28), M.white); wheel.rotation.z = Math.PI / 2; wheel.position.z = 0.075; g.add(wheel);
      P.custom('gear', g, 'deco', { u: 0.465, v: 0.255, size: 0.05 });
    }
    // brake & accumulator triple gauge (mechanical)
    { const p = P.local(0.465, 0.355); P.static(new THREE.CylinderGeometry(0.044, 0.046, 0.022, 40), M.bezel, V(p.x, p.y, 0.006), [Math.PI / 2, 0, 0]);
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.04, 40), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.22, roughness: 0.3 })); m.position.set(p.x, p.y, 0.0175); P.group.add(m); P.hitMesh(m, 'brakeGauge'); P.reg('brakeGauge', { kind: 'ind', u: 0.465, v: 0.355, size: 0.08 });
      const gl = new THREE.Mesh(new THREE.CircleGeometry(0.041, 40), glass); gl.position.set(p.x, p.y, 0.019); P.group.add(gl);
      DSP.brake = { c, x, t, px: 256, mesh: m }; }
    P.group.position.set(0, 0.06, 0); addPanel(P, mip);
  }
  // knee panel / lower structure
  S(new THREE.BoxGeometry(1.96, 0.34, 0.16), M.paintDark, V(0, 0.26, -0.98));
  S(new THREE.BoxGeometry(1.96, 0.05, 0.3), liningDk, V(0, 0.07, -1.0));

  /* ================= glareshield panels: FCU, EFIS + master lights ================= */
  const gsg = new THREE.Group(); gsg.position.set(0, 1.0, -0.772); gsg.rotation.x = -8 * D2R; root.add(gsg);
  {
    const P = createPanel({ name: 'FCU', w: 0.56, h: 0.075, paint: '#46525d', ppm: 3600, maxPx: 2048, atlas: [1024, 512], max: 40 });
    P.module(null, '', 0.002, 0.002, 0.558, 0.073);
    const win = (u, w, lab, draw) => { P.text(lab, u, 0.0075, 0.0038, { weight: 700 }); P.lcd(null, u, 0.022, w, 0.016, draw, { px: 384 }); };
    const on = sys => sys.st.elec.ac;
    const F = sys => sys.st.av.fcu;
    const big = (x, W, H, t, dot, lab) => lcdText(x, W, H, [[t, 0.56, 0.58, 0.68, 'center'], ...(dot ? [['•', 0.94, 0.52, 0.62, 'center']] : []), ...(lab ? [[lab, 0.03, 0.5, 0.34, 'left']] : [])]);
    win(0.07, 0.062, 'SPD          MACH', (x, W, H, sys, key) => { const f = F(sys), show = !f.spdMan || f.prevSpd > 0, t = f.unit === 'SPD' ? String(f.spd) : '.' + String(Math.round(f.mach * 100)).padStart(2, '0'); const k = on(sys) ? `${f.unit}${show ? t : '---'}${f.spdMan}` : 0; if (key) return k; if (k) big(x, W, H, show ? t : '- - -', f.spdMan, f.unit === 'SPD' ? 'SPD' : 'MACH'); });
    win(0.20, 0.062, 'HDG    TRK        LAT', (x, W, H, sys, key) => { const f = F(sys), show = !f.hdgMan || f.prevHdg > 0, t = String(f.hdg).padStart(3, '0'); const k = on(sys) ? `${f.trk}${show ? t : '---'}${f.hdgMan}` : 0; if (key) return k; if (k) big(x, W, H, show ? t : '- - -', f.hdgMan, f.trk ? 'TRK' : 'HDG'); });
    win(0.345, 0.072, 'ALT       LVL/CH', (x, W, H, sys, key) => { const f = F(sys), t = String(f.alt).padStart(5, '0'); const k = on(sys) ? `${t}${f.altMan}` : 0; if (key) return k; if (k) big(x, W, H, t, f.altMan, ''); });
    win(0.48, 0.062, 'V/S    FPA', (x, W, H, sys, key) => { const f = F(sys), show = f.vsMode || f.prevVs > 0; const t = f.trk ? (f.fpa >= 0 ? '+' : '-') + Math.abs(f.fpa).toFixed(1) : (f.vs >= 0 ? '+' : '-') + String(Math.abs(f.vs / 100)).padStart(2, '0') + 'oo'; const k = on(sys) ? `${f.trk}${show ? t : '-'}` : 0; if (key) return k; if (k) big(x, W, H, show ? t : '-----', false, f.trk ? 'FPA' : 'V/S'); });
    P.dial('spdKnob', 0.07, 0.053, 0.0115, { h: 0.012 }); P.dial('hdgKnob', 0.20, 0.053, 0.0115, { h: 0.012 });
    P.dial('altKnob', 0.345, 0.053, 0.0115, { h: 0.012, ring: { id: 'altInc', angles: [-28, 28] } }); P.dial('vsKnob', 0.48, 0.053, 0.0115, { h: 0.012 });
    P.text('100', 0.3235, 0.0335, 0.0026); P.text('1000', 0.3665, 0.0335, 0.0026);
    const fpb = (id, u, v, t, w = 0.022) => P.pb(id, u, v, { top: t, topC: Wh, bot: '', botC: G, paint: true, w, h: 0.015, d: 0.008, bar: true, topSize: 0.4 });
    fpb('spdMach', 0.022, 0.053, 'SPD/MACH', 0.024); fpb('loc', 0.137, 0.058, 'LOC'); fpb('hdgTrk', 0.27, 0.016, 'HDG-TRK', 0.026); fpb('ap1', 0.25, 0.039, 'AP 1'); fpb('ap2', 0.29, 0.039, 'AP 2'); fpb('athr', 0.27, 0.06, 'A/THR'); fpb('exped', 0.415, 0.058, 'EXPED'); fpb('appr', 0.535, 0.058, 'APPR');
    P.text('METRIC ALT', 0.415, 0.038, 0.0032);
    P.group.position.set(0, 0, 0); addPanel(P, gsg);
  }
  for (const sd of [-1, 1]) {
    const w = 0.55, P = createPanel({ name: sd < 0 ? 'EFIS-L' : 'EFIS-R', w, h: 0.075, paint: '#46525d', ppm: 3400, atlas: [1024, 512], max: 40 });
    const m = u => sd < 0 ? u : w - u, sfx = sd < 0 ? 'L' : 'R';
    P.module(null, '', 0.002, 0.002, w - 0.002, 0.073);
    P.pb('masterWarn' + sfx, m(0.035), 0.022, { top: 'MASTER\nWARN', topC: R, single: true, w: 0.036, h: 0.026, d: 0.012 });
    P.pb('masterCaut' + sfx, m(0.035), 0.055, { top: 'MASTER\nCAUT', topC: A, single: true, w: 0.036, h: 0.026, d: 0.012 });
    const side = sd < 0 ? 0 : 1;
    P.lcd(null, m(0.115), 0.018, 0.05, 0.014, (x, W, H, sys, key) => { const b = sys.st.av.baro[side], u = sys.sw['baroUnit' + sfx]; const t = b.std ? 'STD' : (u === 'inHg' ? '' : 'QNH ') + baroText(sys.st.av, side, u); const k = sys.st.elec.ac ? t : 0; if (key) return k; if (k) lcdText(x, W, H, [[t, 0.5, 0.55, 0.62, 'center']]); }, { px: 320 });
    P.dial('baro' + sfx, m(0.115), 0.052, 0.0105, { h: 0.012, ring: { id: 'baroUnit' + sfx, angles: [-28, 28] } }); P.text('inHg   hPa', m(0.115), 0.0325, 0.003);
    P.pb('fd' + sfx, m(0.172), 0.022, { top: 'FD', topC: Wh, bot: '', botC: G, paint: true, w: 0.02, h: 0.015, d: 0.008, bar: true });
    P.pb('ls' + sfx, m(0.172), 0.052, { top: 'LS', topC: Wh, bot: '', botC: G, paint: true, w: 0.02, h: 0.015, d: 0.008, bar: true });
    [['CSTR', 'cstr'], ['WPT', 'wpt'], ['VOR.D', 'vord'], ['NDB', 'ndb'], ['ARPT', 'arpt']].forEach(([t, id], i) => P.pb(id + sfx, m(0.215 + i * 0.034), 0.017, { top: t, topC: Wh, bot: '', botC: G, paint: true, w: 0.022, h: 0.013, d: 0.007, bar: true, topSize: 0.4 }));
    P.rot('ndMode' + sfx, m(0.245), 0.052, { labels: ['LS', 'VOR', 'NAV', 'ARC', 'PLAN'], angles: [-80, -40, 0, 40, 80], r: 0.0085, legendSize: 0.0028, legendR: 1.75 });
    P.rot('ndRange' + sfx, m(0.33), 0.052, { labels: ['10', '20', '40', '80', '160', '320'], angles: [-90, -54, -18, 18, 54, 90], r: 0.0085, legendSize: 0.0028, legendR: 1.75 });
    P.tog('adf1' + sfx, m(0.405), 0.053, { labels: ['VOR', 'OFF', 'ADF'], legendSize: 0.0026, len: 0.016 }); P.tog('adf2' + sfx, m(0.455), 0.053, { labels: ['VOR', 'OFF', 'ADF'], legendSize: 0.0026, len: 0.016 });
    P.text('1', m(0.405), 0.033, 0.0034); P.text('2', m(0.455), 0.033, 0.0034);
    P.group.position.set(sd * (0.30 + w / 2), 0, 0);
    addPanel(P, gsg);
  }
  S(new THREE.BoxGeometry(1.98, 0.09, 0.02), glare, V(0, 0.995, -0.785), [-8 * D2R, 0, 0]);

  /* ================= overhead panel ================= */
  const ovh = new THREE.Group(); ovh.position.set(0, 1.92, -0.235); ovh.rotation.x = (90 - 18) * D2R; root.add(ovh);
  {
    const OW = 0.66, OH = 0.78;
    const P = createPanel({ name: 'OVHD', w: OW, h: OH, paint: '#4b5864', ppm: 3000, maxPx: 2048, atlas: [2048, 1024], max: 150 });
    const C0 = 0.166, C1 = 0.494;
    // ---- FIRE ----
    P.module('FIRE', '', C0, 0.008, C1, 0.118, { areaTitle: 'FIRE' });
    const fireSec = (u, n, pbId, guardId, ag) => {
      P.text(n, u, 0.019, 0.0056, { weight: 700 });
      P.pb(pbId, u, 0.047, { top: 'FIRE', topC: R, single: true, paint: true, w: 0.05, h: 0.03, d: 0.012 });
      P.text('PUSH', u, 0.0695, 0.0034);
      P.guard(pbId, u, 0.047, 0.05, 0.03, 'red');
      ag.forEach(([id, du, lab, kind]) => { if (kind === 'test') P.pb(id, u + du, 0.097, { top: 'TEST', topC: Wh, single: true, paint: true, label: '', size: 0.3 }); else P.pb(id, u + du, 0.097, { top: 'SQUIB', topC: Wh, bot: 'DISCH', botC: A, label: lab, labelSize: 0.0036 }); });
    };
    fireSec(0.22, 'ENG 1', 'firePb1', 'fireGuard1', [['agent1_1', -0.034, 'AGENT 1'], ['test1', 0, '', 'test'], ['agent1_2', 0.034, 'AGENT 2']]);
    fireSec(0.33, 'APU', 'firePbApu', 'fireGuardApu', [['agentApu_1', -0.02, 'AGENT'], ['testApu', 0.02, '', 'test']]);
    fireSec(0.44, 'ENG 2', 'firePb2', 'fireGuard2', [['agent2_1', -0.034, 'AGENT 1'], ['test2', 0, '', 'test'], ['agent2_2', 0.034, 'AGENT 2']]);
    P.line([[0.275, 0.012], [0.275, 0.114]], { w: 0.0005 }); P.line([[0.385, 0.012], [0.385, 0.114]], { w: 0.0005 });
    // ---- HYD ----
    P.module('HYD', 'HYD', C0, 0.122, C1, 0.196);
    P.text('HYD 1', 0.200, 0.136, 0.0044, { weight: 700 }); P.text('HYD 2', 0.316, 0.136, 0.0044, { weight: 700 }); P.text('HYD 3', 0.458, 0.136, 0.0044, { weight: 700 });
    P.pb('hEng1', 0.200, 0.172, { ...FO(), label: 'ENG 1 PUMP' }); P.pb('ratMan', 0.258, 0.172, { top: 'RAT\nMAN ON', topC: Wh, single: true, paint: true, label: 'RAT', size: 0.25 }); P.guard('ratMan', 0.258, 0.172, 0.019, 0.019, 'clear');
    P.pb('hElec', 0.316, 0.172, { ...FO(), label: 'ELEC PUMP' }); P.pb('ptu', 0.388, 0.172, { ...FO(), label: 'PTU' }); P.pb('hEng2', 0.458, 0.172, { ...FO(), label: 'ENG 2 PUMP' });
    P.line([[0.200, 0.142], [0.200, 0.151]]); P.line([[0.458, 0.142], [0.458, 0.151]]); P.line([[0.2, 0.188], [0.458, 0.188]], { w: 0.0004 }); P.line([[0.388, 0.182], [0.388, 0.188]], { w: 0.0004 });
    // ---- FUEL ----
    P.module('FUEL', 'FUEL', C0, 0.200, C1, 0.300);
    P.text('L TK PUMPS', 0.2025, 0.218, 0.0041, { weight: 700 }); P.text('R TK PUMPS', 0.4575, 0.218, 0.0041, { weight: 700 });
    P.pb('pL1', 0.186, 0.247, { ...FO(), label: '1' }); P.pb('pL2', 0.219, 0.247, { ...FO(), label: '2' });
    P.pb('pC1', 0.270, 0.247, { ...FO(), label: 'CTR TK 1' }); P.pb('fuelMode', 0.330, 0.247, { ...FO('FAULT', 'MAN'), label: 'MODE SEL' }); P.pb('pC2', 0.390, 0.247, { ...FO(), label: 'CTR TK 2' });
    P.pb('pR1', 0.441, 0.247, { ...FO(), label: '1' }); P.pb('pR2', 0.474, 0.247, { ...FO(), label: '2' });
    P.pb('xfeed', 0.330, 0.283, { top: 'OPEN', topC: G, bot: 'ON', botC: Wh, label: 'X FEED' });
    P.line([[0.186, 0.290], [0.300, 0.290]], { w: 0.0005 }); P.line([[0.360, 0.290], [0.474, 0.290]], { w: 0.0005 });
    // ---- ELEC ----
    P.module('ELEC', 'ELEC', C0, 0.304, C1, 0.432);
    const batLCD = i => (x, W, H, sys, key) => { const v = sys.st.elec.batV[i].toFixed(1); if (key) return v; lcdText(x, W, H, [[v, 0.86, 0.55, 0.78, 'right'], ['V', 0.97, 0.6, 0.5, 'right']], '#ffa830'); };
    P.lcd('batV1', 0.205, 0.329, 0.032, 0.0125, batLCD(0)); P.lcd('batV2', 0.255, 0.329, 0.032, 0.0125, batLCD(1));
    P.pb('bat1', 0.205, 0.362, { ...FO(), label: 'BAT 1', labelGap: 0.0048, labelSize: 0.0038 }); P.pb('bat2', 0.255, 0.362, { ...FO(), label: 'BAT 2', labelGap: 0.0048, labelSize: 0.0038 });
    P.text('BAT', 0.23, 0.316, 0.0038);
    P.pb('acEssFeed', 0.330, 0.362, { ...FO('FAULT', 'ALTN'), label: 'AC ESS FEED' }); P.pb('galy', 0.395, 0.362, { ...FO(), label: 'GALY & CAB' }); P.pb('commercial', 0.458, 0.362, { top: '', bot: 'OFF', botC: Wh, label: 'COMMERCIAL' });
    P.pb('idg1', 0.186, 0.410, { top: 'FAULT', topC: A, bot: '', label: 'IDG 1' }); P.guard('idg1', 0.186, 0.410, 0.019, 0.019, 'black');
    P.pb('gen1', 0.228, 0.410, { ...FO(), label: 'GEN 1' }); P.pb('apuGen', 0.278, 0.410, { ...FO(), label: 'APU GEN' }); P.pb('busTie', 0.330, 0.410, { top: '', bot: 'OFF', botC: Wh, label: 'BUS TIE' });
    P.pb('extPwr', 0.382, 0.410, { top: 'AVAIL', topC: G, bot: 'ON', botC: Bl, label: 'EXT PWR' }); P.pb('gen2', 0.432, 0.410, { ...FO(), label: 'GEN 2' });
    P.pb('idg2', 0.474, 0.410, { top: 'FAULT', topC: A, bot: '', label: 'IDG 2' }); P.guard('idg2', 0.474, 0.410, 0.019, 0.019, 'black');
    P.line([[0.228, 0.4235], [0.228, 0.427], [0.432, 0.427], [0.432, 0.4235]], { w: 0.0005 });
    // ---- AIR ----
    P.module('AIR', 'AIR', C0, 0.436, C1, 0.562);
    P.pb('hotAir', 0.192, 0.474, { ...FO(), label: 'HOT AIR' });
    for (const [id, u, l] of [['tCkpt', 0.258, 'CKPT'], ['tFwd', 0.322, 'FWD CABIN'], ['tAft', 0.386, 'AFT CABIN']]) { P.knob(u, 0.476, 0.0095, { id }); P.text('COLD', u - 0.017, 0.488, 0.0029); P.text('HOT', u + 0.017, 0.488, 0.0029); P.text(l, u, 0.459, 0.0038); }
    P.rot('packFlow', 0.455, 0.476, { labels: ['LO', 'NORM', 'HI'], r: 0.0085, legendSize: 0.003, label: 'PACK FLOW', labelBelow: true });
    P.pb('pack1', 0.188, 0.533, { ...FO(), label: 'PACK 1' }); P.pb('eBleed1', 0.232, 0.533, { ...FO(), label: 'ENG 1 BLEED', labelSize: 0.0036 });
    P.pb('apuBleed', 0.281, 0.533, { top: 'FAULT', topC: A, bot: 'ON', botC: Bl, label: 'APU BLEED', labelSize: 0.0036 });
    P.rot('xbleed', 0.330, 0.536, { labels: ['SHUT', 'AUTO', 'OPEN'], r: 0.0088, legendSize: 0.0029, label: 'X BLEED', labelBelow: true });
    P.pb('eBleed2', 0.380, 0.533, { ...FO(), label: 'ENG 2 BLEED', labelSize: 0.0036 }); P.pb('pack2', 0.428, 0.533, { ...FO(), label: 'PACK 2' });
    P.pb('ramAir', 0.474, 0.533, { top: 'ON', topC: Wh, single: true, label: 'RAM AIR', labelSize: 0.0036 }); P.guard('ramAir', 0.474, 0.533, 0.019, 0.019, 'clear');
    P.line([[0.188, 0.5465], [0.188, 0.553], [0.428, 0.553], [0.428, 0.5465]], { w: 0.0005 });
    // ---- ANTI ICE / CABIN PRESS ----
    P.module('ANTIICE', 'ANTI ICE', C0, 0.566, 0.322, 0.652);
    P.pb('wingAI', 0.188, 0.620, { top: 'FAULT', topC: A, bot: 'ON', botC: Bl, label: 'WING' }); P.pb('eng1AI', 0.225, 0.620, { top: 'FAULT', topC: A, bot: 'ON', botC: Bl, label: 'ENG 1' }); P.pb('eng2AI', 0.262, 0.620, { top: 'FAULT', topC: A, bot: 'ON', botC: Bl, label: 'ENG 2' });
    P.pb('probeHeat', 0.302, 0.620, { top: '', bot: 'ON', botC: Bl, label: 'PROBE/WDW', labelSize: 0.0033 });
    P.text('HEAT', 0.302, 0.6365, 0.0033);
    P.module('PRESS', 'CABIN PRESS', 0.326, 0.566, C1, 0.652);
    P.pb('pressMan', 0.350, 0.620, { top: 'FAULT', topC: A, bot: 'MAN', botC: Wh, label: 'MODE SEL' });
    P.rot('ldgElev', 0.398, 0.622, { labels: ['AUTO', '0', '+2'], angles: [-60, 0, 60], r: 0.0085, legendSize: 0.0029, label: 'LDG ELEV', labelBelow: true });
    P.tog('d_mvs', 0.440, 0.621, { labels: ['DN', 'UP'], label: 'MAN V/S', labelGap: 0.018, legendSize: 0.003 });
    P.pb('ditching', 0.474, 0.620, { top: '', bot: 'ON', botC: Wh, label: 'DITCHING', labelSize: 0.0034 }); P.guard('ditching', 0.474, 0.620, 0.019, 0.019, 'clear');
    // ---- front row: EXT LT, APU, SIGNS, INT LT ----
    P.module('EXTLT', 'EXT LT', 0.006, 0.656, 0.300, 0.774);
    const tg = (id, u, lab, extra = {}) => P.tog(id, u, 0.735, { labels: CTL[id] ? CTL[id].labels : extra.labels, label: lab, labelGap: 0.028, legendSize: 0.0028, ...extra });
    tg('strobe', 0.024, 'STROBE'); tg('beacon', 0.060, 'BEACON'); tg('wingLt', 0.096, 'WING'); tg('navLogo', 0.132, 'NAV & LOGO'); tg('rwyTurn', 0.168, 'RWY TURN OFF', { labelSize: 0.0034 }); tg('landL', 0.204, 'LAND L'); tg('landR', 0.240, 'LAND R'); tg('nose', 0.276, 'NOSE');
    P.module('APU', 'APU', 0.304, 0.656, 0.384, 0.774);
    P.pb('apuMaster', 0.324, 0.727, { top: 'FAULT', topC: A, bot: 'ON', botC: Bl, label: 'MASTER SW', labelSize: 0.0036 });
    P.pb('apuStart', 0.364, 0.727, { top: 'AVAIL', topC: G, bot: 'ON', botC: Bl, label: 'START', labelSize: 0.0036 });
    P.module('SIGNS', 'SIGNS', 0.388, 0.656, 0.520, 0.774);
    P.tog('seatBelts', 0.408, 0.735, { labels: CTL.seatBelts.labels, label: 'SEAT BELTS', labelGap: 0.028, legendSize: 0.0028 });
    P.tog('noSmoking', 0.448, 0.735, { labels: CTL.noSmoking.labels, label: 'NO SMOKING', labelGap: 0.028, legendSize: 0.0028 });
    P.tog('emerExit', 0.489, 0.735, { labels: CTL.emerExit.labels, label: 'EMER EXIT LT', labelGap: 0.028, legendSize: 0.0028, labelSize: 0.0036 });
    P.module('INTLT', 'INT LT', 0.524, 0.656, 0.654, 0.774);
    P.rot('intLtOvhd', 0.548, 0.738, { labels: ['OFF', 'DIM', 'BRT'], r: 0.0085, legendSize: 0.0028, label: 'OVHD INTEG LT', labelSize: 0.0033 });
    P.tog('annLt', 0.592, 0.735, { labels: CTL.annLt.labels, label: 'ANN LT', labelGap: 0.028, legendSize: 0.0028 });
    P.tog('dome', 0.630, 0.735, { labels: CTL.dome.labels, label: 'DOME', labelGap: 0.028, legendSize: 0.0028 });
    // ---- left column ----
    P.module('IRS', 'IRS', 0.006, 0.008, 0.156, 0.200);
    P.lcd(null, 0.062, 0.037, 0.072, 0.0135, (x, W, H, sys, key) => { const r = sys.st.irs; const on = sys.st.elec.dcBat && r.some(i => i.mode !== 'OFF'); const al = r.every(i => i.aligned); const k = !on ? 0 : al ? 'al' : 'a' + Math.ceil(sys.alignRemaining()); if (key) return k; if (!on) return; lcdText(x, W, H, [[al ? 'N 00 00.0 E 000 00.0' : 'ALIGN ' + fmtT(sys.alignRemaining()), 0.5, 0.55, 0.62, 'center']], '#ffa830'); });
    P.text('DATA', 0.062, 0.0265, 0.0032);
    P.ann('onBat', 0.131, 0.037, { top: 'ON BAT', topC: A, single: true, w: 0.026, h: 0.014 });
    [['ir1', 0.034, 'IR 1'], ['ir2', 0.081, 'IR 2'], ['ir3', 0.128, 'IR 3']].forEach(([id, u, l]) => P.pb(id, u, 0.092, { top: 'FAULT', topC: A, bot: 'ALIGN', botC: Wh, label: l }));
    [['irs1', 0.034, '1'], ['irs2', 0.081, '2'], ['irs3', 0.128, '3']].forEach(([id, u, l]) => P.rot(id, u, 0.157, { labels: ['OFF', 'NAV', 'ATT'], r: 0.0092, legendSize: 0.0031, label: 'IRS ' + l, labelBelow: true }));
    P.module('FLTCTL1', 'FLT CTL', 0.006, 0.204, 0.156, 0.270);
    ['FCC 1', 'FCC 2', 'FCC 3'].forEach((l, i) => P.pb('d_fcc' + i, 0.034 + i * 0.047, 0.247, { ...FO(), label: l }));
    P.module('EVAC', 'EVAC', 0.006, 0.274, 0.156, 0.330);
    P.pb('d_evac', 0.045, 0.310, { top: 'EVAC', topC: R, bot: 'ON', botC: Wh, label: 'COMMAND' }); P.guard('d_evac', 0.045, 0.310, 0.019, 0.019, 'red');
    P.pb('d_horn', 0.112, 0.310, { top: 'HORN', topC: Wh, bot: 'SHUT OFF', botC: Wh, paint: true, label: '', botSize: 0.22 });
    P.module('GPWS', 'GPWS', 0.006, 0.334, 0.156, 0.404);
    ['SYS', 'G/S', 'FLAP', 'TERR'].forEach((l, i) => P.pb('d_gpws' + i, 0.026 + i * 0.036, 0.380, { ...FO(), label: l }));
    P.module('RCDR', 'RCDR', 0.006, 0.408, 0.156, 0.462);
    P.pb('d_gndctl', 0.045, 0.442, { top: '', bot: 'ON', botC: Bl, label: 'GND CTL' }); P.pb('d_cvrtest', 0.112, 0.442, { top: 'CVR\nTEST', topC: Wh, single: true, paint: true, label: '' });
    P.module('OXY', 'OXYGEN', 0.006, 0.466, 0.156, 0.540);
    P.pb('maskMan', 0.030, 0.512, { top: 'MASK\nMAN ON', topC: Wh, single: true, paint: true, label: '', size: 0.24 }); P.guard('maskMan', 0.030, 0.512, 0.019, 0.019, 'clear');
    P.pb('paxOxy', 0.080, 0.512, { top: '', bot: 'ON', botC: Wh, label: 'PAX SYS', labelSize: 0.0036 }); P.guard('paxOxy', 0.080, 0.512, 0.019, 0.019, 'clear');
    P.pb('crewOxy', 0.128, 0.512, { top: '', bot: 'OFF', botC: Wh, label: 'CREW SUPPLY', labelSize: 0.0034 });
    P.module('CALLS', 'CALLS', 0.006, 0.544, 0.156, 0.598);
    ['MECH', 'FWD', 'AFT'].forEach((l, i) => P.pb('d_call' + i, 0.034 + i * 0.047, 0.578, { top: l, topC: Wh, single: true, paint: true, size: 0.3 }));
    P.module('WIPERL', 'WIPER', 0.006, 0.602, 0.156, 0.652);
    P.rot('wiperL', 0.048, 0.632, { labels: ['OFF', 'SLOW', 'FAST'], r: 0.0085, legendSize: 0.0029 });
    P.pb('d_rainL', 0.118, 0.632, { top: 'RAIN\nRPLNT', topC: Wh, single: true, paint: true, size: 0.24 });
    // ---- right column ----
    P.module('RCOL', '', 0.504, 0.008, 0.654, 0.652, { group: 'RCOL', areaTitle: 'right column', plate: 'rgba(0,0,0,0)' });
    P.module('FLTCTL2', 'FLT CTL', 0.504, 0.008, 0.654, 0.088, { group: 'RCOL' });
    ['FCC 4', 'FCC 5', 'FCC 6'].forEach((l, i) => P.pb('d_fcc' + (i + 3), 0.532 + i * 0.047, 0.062, { ...FO(), label: l }));
    P.module('CARGO', 'CARGO SMOKE', 0.504, 0.092, 0.654, 0.170, { group: 'RCOL' });
    P.pb('d_cdisch', 0.545, 0.135, { top: 'DISCH', topC: Wh, single: true, paint: true, label: 'DISCH', size: 0.28 }); P.guard('d_cdisch', 0.545, 0.135, 0.019, 0.019, 'clear');
    P.pb('d_ctest', 0.612, 0.135, { top: 'TEST', topC: Wh, single: true, paint: true, label: '', size: 0.3 });
    P.module('VENT', 'VENTILATION', 0.504, 0.174, 0.654, 0.244, { group: 'RCOL' });
    P.pb('d_blower', 0.545, 0.218, { ...FO('FAULT', 'OVRD'), label: 'BLOWER' }); P.pb('d_extract', 0.612, 0.218, { ...FO('FAULT', 'OVRD'), label: 'EXTRACT' });
    P.module('ENGR', 'ENG', 0.504, 0.248, 0.654, 0.324, { group: 'RCOL' });
    P.text('MAN START', 0.579, 0.270, 0.0040);
    P.pb('manStart1', 0.545, 0.298, { top: '', bot: 'ON', botC: Bl, label: '1' }); P.pb('manStart2', 0.612, 0.298, { top: '', bot: 'ON', botC: Bl, label: '2' });
    P.module('CHEAT', 'CARGO HEAT', 0.504, 0.328, 0.654, 0.404, { group: 'RCOL' });
    P.knob(0.545, 0.370, 0.0095, { id: 'd_cheat' }); P.text('COLD', 0.528, 0.385, 0.0029); P.text('HOT', 0.562, 0.385, 0.0029); P.text('AFT', 0.545, 0.354, 0.0036);
    P.pb('d_cheatv', 0.612, 0.370, { ...FO('FAULT', 'OFF'), label: 'HOT AIR' });
    P.module('DOOR', 'COCKPIT DOOR', 0.504, 0.408, 0.654, 0.470, { group: 'RCOL' });
    P.tog('d_door', 0.579, 0.445, { labels: ['UNLOCK', 'NORM', 'LOCK'], legendSize: 0.0028 });
    P.module('BLANK', '', 0.504, 0.474, 0.654, 0.598, { group: 'RCOL' });
    P.module('WIPERR', 'WIPER', 0.504, 0.602, 0.654, 0.652, { group: 'RCOL' });
    P.rot('wiperR', 0.540, 0.632, { labels: ['OFF', 'SLOW', 'FAST'], r: 0.0085, legendSize: 0.0029 });
    P.pb('d_rainR', 0.612, 0.632, { top: 'RAIN\nRPLNT', topC: Wh, single: true, paint: true, size: 0.24 });
    P.text('GENERIC TWIN-JET · TRAINING ONLY', 0.33, 0.7765, 0.003, { color: '#aeb8bf', base: 'bottom' });
    addPanel(P, ovh);
    // circuit breaker field aft of the systems panels
    const CB = createPanel({ name: 'CB', w: 0.66, h: 0.22, paint: '#4b5864', ppm: 1800, noBank: true });
    CB.draw((x, px) => {
      x.font = `600 ${px(0.0034)}px ${FONT}`; x.textAlign = 'center'; x.fillStyle = '#f2f4f5';
      for (let r = 0; r < 7; r++) for (let c = 0; c < 26; c++) { const u = 0.028 + c * 0.0236, v = 0.03 + r * 0.027; if ((c * 7 + r * 3) % 11 === 0) continue; x.fillText(['FUEL', 'HYD', 'ELEC', 'AIR', 'NAV', 'COM', 'ENG'][r] + ' ' + (c + 1), px(u), px(v - 0.0095)); x.fillStyle = '#121416'; x.beginPath(); x.arc(px(u), px(v), px(0.0048), 0, 7); x.fill(); x.fillStyle = '#d8dcdf'; x.beginPath(); x.arc(px(u), px(v), px(0.0022), 0, 7); x.fill(); x.fillStyle = '#f2f4f5'; }
    });
    CB.module(null, '', 0.004, 0.004, 0.656, 0.216);
    CB.finish(); CB.group.position.set(0, OH / 2 + 0.11 + 0.004, 0); ovh.add(CB.group);
    // trim around the overhead
    S(new THREE.BoxGeometry(0.70, 0.02, 1.06), liningDk, V(0, 1.962, -0.17), [-18 * D2R, 0, 0]);
  }

  /* ================= pedestal ================= */
  const ped = new THREE.Group(); root.add(ped);
  S(new RoundedBoxGeometry(0.46, 0.44, 0.74, 3, 0.02), M.paintDark, V(0, 0.215, -0.07));
  S(new RoundedBoxGeometry(0.46, 0.44, 0.36, 3, 0.02), M.paintDark, V(0, 0.215, -0.62));
  S(new THREE.BoxGeometry(0.46, 0.08, 0.40), M.paintDark, V(0, 0.45, -0.615), [15 * D2R, 0, 0]);
  {
    // front (sloped) section: two FMS units + display page buttons
    const P = createPanel({ name: 'PED-F', w: 0.42, h: 0.345, paint: '#47535e', ppm: 3200, maxPx: 2048, atlas: [2048, 2048], max: 200 });
    for (const [cu, n] of [[0.105, 1], [0.315, 2]]) {
      P.module(null, '', cu - 0.1, 0.004, cu + 0.1, 0.252);
      P.lcd('fmsScreen' + n, cu, 0.064, 0.118, 0.09, (x, W, H, sys, key) => { if (key) return fmsKeyState(sys, n - 1); drawFMS(x, W, H, sys, n - 1); }, { px: 512, gain: 1.4 });
      P.areas.push({ id: 'FMSK' + n, title: `Flight computer ${n} keypad`, u0: cu - 0.083, v0: 0.155, u1: cu + 0.086, v1: 0.247 });
      for (let i = 0; i < 6; i++) { P.pb(fmsId(n, 'L' + (i + 1)), cu - 0.077, 0.027 + i * 0.0145, { top: '—', topC: Wh, single: true, paint: true, w: 0.011, h: 0.008, d: 0.005 }); P.pb(fmsId(n, 'R' + (i + 1)), cu + 0.077, 0.027 + i * 0.0145, { top: '—', topC: Wh, single: true, paint: true, w: 0.011, h: 0.008, d: 0.005 }); }
      FMS_FK.forEach((t, i) => { if (!t) return; P.pb(fmsId(n, t), cu - 0.075 + (i % 6) * 0.03, 0.124 + Math.floor(i / 6) * 0.017, { top: t, topC: Wh, single: true, paint: true, w: 0.025, h: 0.013, d: 0.006, size: 0.34 }); });
      FMS_AK.forEach((t, i) => P.pb(fmsId(n, t), cu + 0.008 + (i % 5) * 0.0175, 0.163 + Math.floor(i / 5) * 0.0145, { top: t === '-' ? '–' : t, topC: Wh, single: true, paint: true, w: 0.0145, h: 0.0115, d: 0.006, size: 0.5 }));
      FMS_NK.forEach((t, i) => P.pb(fmsId(n, t), cu - 0.072 + (i % 3) * 0.02, 0.168 + Math.floor(i / 3) * 0.0175, { top: t, topC: Wh, single: true, paint: true, w: 0.016, h: 0.013, d: 0.006, size: 0.5 }));
      P.knob(cu - 0.082, 0.24, 0.006); P.text('BRT', cu - 0.072, 0.24, 0.003, { align: 'left' });
    }
    P.module('PAGES', 'SYSTEM PAGES', 0.004, 0.256, 0.416, 0.341, { titleAlign: 'center' });
    ['ENG', 'BLEED', 'PRESS', 'ELEC', 'HYD', 'FUEL', 'APU', 'COND', 'DOOR', 'WHEEL', 'F/CTL', 'STS'].forEach((t, i) => P.pb('sd' + t.replace('/', ''), 0.10 + (i % 6) * 0.044, 0.288 + Math.floor(i / 6) * 0.03, { top: t, topC: Wh, single: true, paint: true, w: 0.032, h: 0.019, d: 0.008, size: 0.34 }));
    P.pb('d_toconf', 0.042, 0.288, { top: 'T.O\nCONFIG', topC: Wh, single: true, paint: true, w: 0.032, h: 0.019, size: 0.28 }); P.pb('d_emercanc', 0.042, 0.318, { top: 'EMER\nCANC', topC: Wh, single: true, paint: true, w: 0.032, h: 0.019, size: 0.28 });
    P.pb('d_clr', 0.378, 0.288, { top: 'CLR', topC: Wh, single: true, paint: true, w: 0.032, h: 0.019, size: 0.34 }); P.pb('d_rcl', 0.378, 0.318, { top: 'RCL', topC: Wh, single: true, paint: true, w: 0.032, h: 0.019, size: 0.34 });
    const g = P.group; g.position.set(0, 0.492, -0.615); g.rotation.x = (-90 + 15) * D2R; addPanel(P, ped);
  }
  {
    const P = createPanel({ name: 'PED', w: 0.42, h: 0.66, paint: '#47535e', ppm: 3000, maxPx: 2048, atlas: [1024, 1024], max: 80 });
    // thrust lever quadrant
    P.module('THR', '', 0.12, 0.004, 0.30, 0.268);
    const vp = 0.15, detA = [-20, 6, 15, 24], tl = ['IDLE', 'CL', 'FLX MCT', 'TOGA'];
    P.draw((x, px) => { for (const u of [0.185, 0.235]) { x.fillStyle = '#0c0e10'; x.beginPath(); x.roundRect(px(u - 0.006), px(0.04), px(0.012), px(0.21), px(0.006)); x.fill(); }
      x.font = `700 ${px(0.0044)}px ${FONT}`; x.fillStyle = '#f2f4f5';
      detA.forEach((a, i) => { const v = vp - 0.075 * Math.tan(a * D2R) * 1.35; x.textAlign = 'right'; x.fillText(tl[i], px(0.168), px(v)); x.textAlign = 'left'; x.fillText(tl[i], px(0.252), px(v)); x.fillRect(px(0.17), px(v) - 1, px(0.008), 2); x.fillRect(px(0.242), px(v) - 1, px(0.008), 2); });
      x.textAlign = 'right'; x.fillText('REV', px(0.168), px(0.235)); x.textAlign = 'left'; x.fillText('REV', px(0.252), px(0.235)); });
    for (const [n, u] of [[1, 0.185], [2, 0.235]]) {
      const p = P.local(u, vp); const piv = new THREE.Group(); piv.position.set(p.x, p.y, -0.07); P.group.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.014, 0.17), M.darkMetal); arm.position.z = 0.085; piv.add(arm);
      const h = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.028, 0.034, 3, 0.008), M.knobGrey); h.position.set(n === 1 ? 0.016 : -0.016, 0, 0.175); piv.add(h);
      const hc = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.03, 0.014, 3, 0.006), M.black); hc.position.set(n === 1 ? 0.016 : -0.016, 0, 0.19); piv.add(hc);
      const rev = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.006, 0.02, 2, 0.002), M.black); rev.position.set(n === 1 ? 0.016 : -0.016, 0.02, 0.165); piv.add(rev);
      P.custom('thr' + n, piv, 'lever', { u, v: vp, size: 0.05, ang: detA, axis: 'x', tipZ: 0.18, lift: 0 });
    }
    // housing cheeks
    for (const u of [0.152, 0.268]) { const p = P.local(u, 0.14); P.static(new RoundedBoxGeometry(0.018, 0.25, 0.05, 3, 0.008), M.paintDark, V(p.x, p.y, 0.025)); }
    // speed brake (left) and flaps (right)
    P.module('SPDBRK', 'SPEED BRAKE', 0.012, 0.004, 0.116, 0.268, { titleSize: 0.0042 });
    P.module('FLAPS', 'FLAPS', 0.304, 0.004, 0.408, 0.268, { titleSize: 0.0042 });
    P.draw((x, px) => { x.fillStyle = '#0c0e10'; x.beginPath(); x.roundRect(px(0.058), px(0.05), px(0.012), px(0.19), px(0.006)); x.fill(); x.beginPath(); x.roundRect(px(0.35), px(0.05), px(0.012), px(0.19), px(0.006)); x.fill();
      x.font = `700 ${px(0.0046)}px ${FONT}`; x.fillStyle = '#f2f4f5'; x.textAlign = 'left'; ['0', '1', '2', '3', 'FULL'].forEach((t, i) => x.fillText(t, px(0.372), px(0.07 + i * 0.04)));
      x.textAlign = 'right'; x.fillText('RET', px(0.052), px(0.07)); x.fillText('1/2', px(0.052), px(0.15)); x.fillText('FULL', px(0.052), px(0.23)); x.fillText('ARM', px(0.052), px(0.035)); });
    {
      const p = P.local(0.064, 0.145); const piv = new THREE.Group(); piv.position.set(p.x, p.y, -0.07); P.group.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.13), M.darkMetal); arm.position.z = 0.065; piv.add(arm);
      const h = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.02, 0.016, 3, 0.006), M.knobGrey); h.position.z = 0.135; piv.add(h);
      P.custom('spdBrk', piv, 'lever', { u: 0.064, v: 0.145, size: 0.05, ang: [33, 33], axis: 'x', tipZ: 0.14, lift: [0, 0.012] });
    }
    {
      const p = P.local(0.356, 0.145); const piv = new THREE.Group(); piv.position.set(p.x, p.y, -0.07); P.group.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.13), M.darkMetal); arm.position.z = 0.065; piv.add(arm);
      const fs = new THREE.Shape(); fs.moveTo(-0.025, 0); fs.quadraticCurveTo(0, 0.012, 0.025, 0); fs.lineTo(0.022, -0.012); fs.quadraticCurveTo(0, -0.004, -0.022, -0.012); fs.closePath();
      const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.02, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 }); fg.translate(0, 0, -0.01); fg.rotateX(Math.PI / 2);
      const h = new THREE.Mesh(fg, M.knobGrey); h.position.z = 0.138; piv.add(h);
      const ang = [0, 1, 2, 3, 4].map(i => { const v = 0.07 + i * 0.04; return Math.atan2((0.145 - v), 0.07 * 1.0) / D2R * 0.9; });
      P.custom('flaps', piv, 'lever', { u: 0.356, v: 0.145, size: 0.05, ang, axis: 'x', tipZ: 0.14, lift: 0 });
    }
    // ENG panel: masters, FIRE/FAULT lights, mode selector
    P.module('ENG', 'ENG', 0.10, 0.272, 0.32, 0.402, { titleAlign: 'center' });
    for (const [n, u] of [[1, 0.145], [2, 0.275]]) {
      P.ann('engFire' + n, u - 0.014, 0.298, { top: 'FIRE', topC: R, single: true, w: 0.022, h: 0.014 }); P.ann('engFault' + n, u + 0.014, 0.298, { top: 'FAULT', topC: A, single: true, w: 0.022, h: 0.014 });
      P.text(String(n), u, 0.3165, 0.0055, { weight: 700 });
      P.draw((x, px) => { x.fillStyle = '#0c0e10'; x.beginPath(); x.roundRect(px(u - 0.006), px(0.326), px(0.012), px(0.056), px(0.006)); x.fill(); x.fillStyle = '#f2f4f5'; x.font = `700 ${px(0.0042)}px ${FONT}`; x.textAlign = 'left'; x.fillText('ON', px(u + 0.012), px(0.334)); x.fillText('OFF', px(u + 0.012), px(0.378)); });
      const p = P.local(u, 0.354); const piv = new THREE.Group(); piv.position.set(p.x, p.y, -0.02); P.group.add(piv);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.05), M.metal); arm.position.z = 0.025; piv.add(arm);
      const h = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.016, 0.026, 3, 0.006), M.black); h.position.z = 0.055; piv.add(h);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.012), M.white); st.position.set(0, 0.0085, 0.055); piv.add(st);
      P.custom('master' + n, piv, 'master', { u, v: 0.354, size: 0.04, ang: [-28, 28], axis: 'x', tipZ: 0.06 });
    }
    P.text('MASTER', 0.21, 0.300, 0.0044, { weight: 700 });
    P.rot('engMode', 0.21, 0.360, { labels: ['CRANK', 'NORM', 'IGN / START'], angles: [-55, 0, 55], r: 0.0105, legendSize: 0.0034, legendR: 2.25, label: 'MODE', labelBelow: true });
    // radio panels (decorative)
    for (const [u0, n] of [[0.006, 1], [0.324, 2]]) {
      P.module(null, 'RMP ' + n, u0, 0.272, u0 + 0.09, 0.402, { titleSize: 0.0038 });
      const cu = u0 + 0.045;
      const rlcd = (u, act) => P.lcd(null, u, 0.298, 0.032, 0.013, (x, W, H, sys, key) => { const w = sys.sw, r = sys.st.av.radio[w['rmpSel' + n]]; const k = sys.st.elec.dc && w['rmpOn' + n] && r ? freqText(act ? r.act : r.sby) : 0; if (key) return k; if (k) lcdText(x, W, H, [[k, 0.5, 0.56, 0.5, 'center']]); }, { px: 192 });
      rlcd(cu - 0.0215, true); rlcd(cu + 0.0215, false);
      P.pb(`rmpXfer${n}`, cu, 0.298, { top: '⇆', topC: Wh, single: true, paint: true, w: 0.0085, h: 0.009, d: 0.005, size: 0.62 });
      P.text('ACTIVE    STBY', cu, 0.287, 0.003);
      ['VHF1', 'VHF2', 'VHF3'].forEach((t, i) => P.pb(`rmp${n}${t}`, u0 + 0.017 + i * 0.028, 0.322, { top: t, topC: Wh, bot: '', botC: G, paint: true, w: 0.02, h: 0.012, d: 0.006, bar: true, topSize: 0.42 }));
      P.pb('d_rmpHF', u0 + 0.017, 0.345, { top: 'HF1', topC: Wh, single: true, paint: true, w: 0.02, h: 0.012, d: 0.006, size: 0.42 }); P.pb('d_rmpAM', u0 + 0.045, 0.345, { top: 'AM', topC: Wh, single: true, paint: true, w: 0.02, h: 0.012, d: 0.006, size: 0.42 }); P.pb('d_rmpHF2', u0 + 0.073, 0.345, { top: 'HF2', topC: Wh, single: true, paint: true, w: 0.02, h: 0.012, d: 0.006, size: 0.42 });
      P.dial(`rmp${n}Outer`, cu, 0.378, 0.0115, { h: 0.006, step: 20 }); P.dial(`rmp${n}Inner`, cu, 0.378, 0.0072, { h: 0.0125, step: 20, z: 0.001 });
      P.tog(`rmpOn${n}`, u0 + 0.075, 0.378, { labels: ['OFF', 'ON'], legendSize: 0.0026, len: 0.014, legendSide: 'left' });
    }
    // park brake + audio panels
    P.module('PARK', 'PARK BRK', 0.155, 0.406, 0.265, 0.50, { titleAlign: 'center' });
    P.text('OFF', 0.18, 0.47, 0.0044, { weight: 700 }); P.text('ON', 0.243, 0.432, 0.0044, { weight: 700 });
    {
      const p = P.local(0.21, 0.458); const g = new THREE.Group(); g.position.set(p.x, p.y, 0); P.group.add(g);
      P.static(new THREE.CylinderGeometry(0.016, 0.018, 0.006, 24), M.darkMetal, V(p.x, p.y, 0.003), [Math.PI / 2, 0, 0]);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 12), M.metal); stem.rotation.x = Math.PI / 2; stem.position.z = 0.012; g.add(stem);
      const hnd = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.016, 0.014, 3, 0.006), new THREE.MeshStandardMaterial({ color: 0xc6c9cb, roughness: 0.45, metalness: 0.2 })); hnd.position.z = 0.026; g.add(hnd);
      P.custom('parkBrk', g, 'park', { u: 0.21, v: 0.458, size: 0.06 });
    }
    for (const [u0, n] of [[0.006, 1], [0.27, 2]]) {
      P.module(null, 'AUDIO ' + n, u0, 0.406, u0 + 0.144, 0.50, { titleSize: 0.0036 });
      for (let i = 0; i < 6; i++) { P.knob(u0 + 0.016 + i * 0.022, 0.452, 0.0065, { h: 0.007 }); P.text(['VHF1', 'VHF2', 'VHF3', 'HF1', 'INT', 'CAB'][i], u0 + 0.016 + i * 0.022, 0.437, 0.0028); }
      P.pb('d_acp', u0 + 0.03, 0.482, { top: 'VOICE', topC: Wh, single: true, paint: true, w: 0.024, h: 0.012, d: 0.006, size: 0.42 }); P.pb('d_acp', u0 + 0.112, 0.482, { top: 'RESET', topC: Wh, single: true, paint: true, w: 0.024, h: 0.012, d: 0.006, size: 0.42 });
    }
    // transponder + misc
    P.module('XPDR', 'ATC / TCAS', 0.11, 0.504, 0.31, 0.652, { titleAlign: 'center' });
    P.lcd(null, 0.165, 0.535, 0.05, 0.016, (x, W, H, sys, key) => { const X = sys.st.av.xpdr, w = sys.sw; const code = X.entry ? X.entry.padEnd(4, '-') : X.code; const k = sys.st.elec.dc ? `${code}|${['STBY', 'AUTO', 'ON'][w.xpdr]}|${w.altRptg}|${X.identT > 0}` : 0; if (key) return k; if (!k) return; lcdText(x, W, H, [[code, 0.58, 0.56, 0.72, 'center'], [['SBY', 'AUT', 'ON'][w.xpdr], 0.03, 0.3, 0.3, 'left'], [w.altRptg ? 'ALT' : '', 0.03, 0.72, 0.3, 'left'], [X.identT > 0 ? 'ID' : '', 0.97, 0.3, 0.3, 'right']]); }, { px: 256 });
    P.rot('xpdr', 0.262, 0.543, { labels: ['STBY', 'AUTO', 'ON'], r: 0.0095, legendSize: 0.0032 });
    for (let i = 0; i < 8; i++) P.pb('x' + i, 0.13 + (i % 4) * 0.022, 0.578 + Math.floor(i / 4) * 0.02, { top: String(i), topC: Wh, single: true, paint: true, w: 0.016, h: 0.014, d: 0.006, size: 0.5 });
    P.pb('xIdent', 0.25, 0.598, { top: 'IDENT', topC: Wh, single: true, paint: true, w: 0.03, h: 0.016, d: 0.007, size: 0.36 }); P.pb('xClr', 0.29, 0.598, { top: 'CLR', topC: Wh, single: true, paint: true, w: 0.02, h: 0.016, d: 0.007, size: 0.4 });
    P.tog('altRptg', 0.272, 0.634, { labels: ['OFF', 'ON'], legendSize: 0.0026, len: 0.013 }); P.text('ALT RPTG', 0.236, 0.634, 0.0032, { weight: 700 });
    P.module(null, 'FLOOD LT', 0.006, 0.504, 0.106, 0.652, { titleSize: 0.0036 }); P.knob(0.035, 0.56, 0.008); P.knob(0.075, 0.56, 0.008); P.text('MAIN PNL', 0.035, 0.578, 0.0028); P.text('PED', 0.075, 0.578, 0.0028);
    P.module(null, 'RUD TRIM', 0.314, 0.504, 0.414, 0.652, { titleSize: 0.0036 }); P.lcd(null, 0.364, 0.54, 0.04, 0.014, (x, W, H, sys, key) => { const k = sys.st.elec.ac ? 1 : 0; if (key) return k; if (k) lcdText(x, W, H, [['L 0.0', 0.5, 0.56, 0.55, 'center']]); }); P.knob(0.364, 0.592, 0.011, { h: 0.01 });
    const g = P.group; g.position.set(0, 0.442, -0.10); g.rotation.x = -Math.PI / 2; addPanel(P, ped);
  }

  /* ---- captain's sidestick: a control of its own (flight control check) ---- */
  if (SH.stickL) {
    const K = SH.stickL, stub = { name: 'CONSOLE', group: root, areas: [], w: 1, h: 1, local: () => V(0, 0, 0), areaAt: () => null, areaById: () => null };
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.17, 0.07), new THREE.MeshBasicMaterial({ visible: false })); hb.position.set(0, 0.08, 0); K.piv.add(hb);
    for (const m of [K.grip, K.btn, hb]) { m.userData.ctl = 'stickL'; hits.push(m); }
    ctls.stickL = { id: 'stickL', kind: 'stick', panel: stub, obj: K.btn, piv: K.piv, size: 0.07, a: null };
  }

  /* ---- merge the shell ---- */
  for (const [mat, list] of shell) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; root.add(m); }

  /* ================= update ================= */
  const lightKey = { masterWarnL: 'masterWarn', masterWarnR: 'masterWarn', masterCautL: 'masterCaut', masterCautR: 'masterCaut' };
  const pressT = {};
  let dispT = 0, lcdT = 0;
  const allCtls = Object.values(ctls);
  function update(sys, dt, t) {
    const Ls = sys.lights();
    const flash = api.flashHold || (Math.floor(t * 2.2) % 2) === 0 ? 1 : 0.15;
    for (const P of panels) {
      const B = P.bank; if (!B) continue;
      for (const it of B.items) {
        const id = it.id, c = CTL[id];
        const Lt = Ls[lightKey[id] || id];
        if (Lt) { const f = (Lt.flash ? flash : 1) * (it.legend.paint ? (it.legend.bar ? 0.32 : 0.14) : 1); B.setGlow(it, Lt.t * f, Lt.b * f); } else if (it.glowT || it.glowB) B.setGlow(it, 0, 0);
        let off = 0;
        if (c && c.k === 'pb' && c.sw && !c.free) off = sys.sw[c.sw] ? -0.0026 : 0; // avionics keys are momentary: no latched travel
        else if (c && c.k === 'gpb') off = sys.sw[c.sw] ? 0.004 : 0;
        if (pressT[id] && t - pressT[id] < 0.16) off -= 0.003;
        if (P.ctls[id] && P.ctls[id].kind === 'ann') off = 0;
        B.setOff(it, off);
      }
      B.flush();
    }
    const k = 1 - Math.exp(-dt * 14);
    const av = sys.st.av;
    for (const C of allCtls) {
      const c = CTL[C.id];
      if (C.kind === 'dial' && c && c.knob) { // working knob: detent rotation, push / pull travel
        const a = (av.turns[c.knob] || 0) * C.step * D2R; C.a = C.a == null ? a : C.a + (a - C.a) * Math.min(1, k * 1.6); C.obj.rotation.z = -C.a;
        const kk = av.kick[c.knob], dtk = kk ? sys.t - kk.t : 9; C.obj.position.z = C.z0 + (kk && dtk >= 0 && dtk < 0.3 ? kk.dir * 0.003 * Math.sin(Math.PI * dtk / 0.3) : 0); continue;
      }
      if (C.kind === 'stick') { const v = sys.sw.stickL, tx = v === 'AFT' ? 0.3 : v === 'FWD' ? -0.24 : 0, tz = v === 'LEFT' ? 0.32 : v === 'RIGHT' ? -0.32 : 0; C.piv.rotation.x += (tx - C.piv.rotation.x) * k; C.piv.rotation.z += (tz - C.piv.rotation.z) * k; continue; }
      if (!c || !c.sw) continue;
      const v = sys.sw[c.sw];
      if (C.kind === 'tog') { const i = c.pos.indexOf(v); const a = C.ang[Math.max(0, i)] * D2R; C.a = C.a == null ? a : C.a + (a - C.a) * k; C.piv.rotation.x = -C.a; }
      else if (C.kind === 'rot') { const i = c.pos.indexOf(v); const a = C.ang[Math.max(0, i)] * D2R; C.a = C.a == null ? a : C.a + (a - C.a) * k; C.piv.rotation.z = -C.a; }
      else if (C.kind === 'lever' || C.kind === 'master') {
        const i = c.k === 'master' ? (v ? 1 : 0) : c.pos.indexOf(v); const a = C.ang[Math.min(C.ang.length - 1, Math.max(0, i))] * D2R;
        const lift = Array.isArray(C.lift) ? C.lift[i] || 0 : 0;
        if (C.a == null) { C.a = a; C.l = lift; }
        const moving = Math.abs(a - C.a) > 0.01; C.a += (a - C.a) * k * 0.8; C.l = (C.l || 0) + ((c.k === 'master' && moving ? 0.008 : lift) - (C.l || 0)) * k;
        C.obj.rotation.x = -C.a; C.obj.position.z = (C.z0 ?? (C.z0 = C.obj.position.z)) + C.l;
      } else if (C.kind === 'park') { const a = v ? 90 * D2R : 0; C.a = C.a == null ? a : C.a + (a - C.a) * k; C.obj.rotation.z = -C.a; }
    }
    for (const C of allCtls) if (C.guard) { const c = CTL[C.id]; const open = c && c.guard ? !!sys.sw[c.guard] : !!C.guardOpen; const a = open ? 105 * D2R : 0; C.guard.a += (a - C.guard.a) * k; C.guard.hinge.rotation.x = -C.guard.a; }
    // displays
    dispT += dt; lcdT += dt;
    const E = sys.st.elec;
    if (dispT > 0.11) {
      dispT = 0;
      const essOn = E.ac || E.essInv, acOn = E.ac;
      drawDU(DSP.pfd, essOn, x => drawPFD(x, 512, sys, 0)); drawDU(DSP.nd, acOn, x => drawND(x, 512, sys, 0));
      drawDU(DSP.pfdFO, acOn, x => drawPFD(x, 512, sys, 1)); drawDU(DSP.ndFO, acOn, x => drawND(x, 512, sys, 1));
      drawDU(DSP.ewd, essOn, x => drawEWD(x, 512, sys)); drawDU(DSP.sd, acOn, x => drawSD(x, 512, sys));
      drawDU(DSP.stby, E.dcBat, x => drawStby(x, 256, sys));
      drawDU(DSP.clock, true, x => drawClock(x, 256, sys));
      drawBrake(DSP.brake.x, 256, sys); DSP.brake.t.needsUpdate = true;
    }
    if (lcdT > 0.1) { lcdT = 0; for (const P of panels) P.updateLCDs(sys); }
  }
  function drawDU(D, on, f) { if (!D) return; if (!on) { if (D.on !== false) { D.x.setTransform(1, 0, 0, 1, 0, 0); D.x.fillStyle = '#000'; D.x.fillRect(0, 0, D.c.width, D.c.height); D.t.needsUpdate = true; D.on = false; } return; } D.on = true; f(D.x); D.t.needsUpdate = true; }

  /* world position / normal for highlights and camera hints */
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function ctlWorld(id) {
    const C = ctls[id]; if (!C) return null;
    let pos, nrm = V(0, 0, 1), size = C.size || 0.03;
    if (C.obj) { pos = C.obj.getWorldPosition(V(0, 0, 0)); if (C.tipZ) pos = C.obj.localToWorld(V(0, 0, C.tipZ)); }
    else pos = C.panel.group.localToWorld(C.panel.local(C.u, C.v, 0.01));
    C.panel.group.getWorldQuaternion(tmpQ); nrm.applyQuaternion(tmpQ);
    return { pos, nrm, size, panel: C.panel.name, quat: tmpQ.clone() };
  }
  function areaWorld(areaId) {
    for (const P of panels) { const a = P.areaById(areaId); if (a) { const pos = P.group.localToWorld(P.local((a.u0 + a.u1) / 2, (a.v0 + a.v1) / 2, 0.004)); const n = V(0, 0, 1).applyQuaternion(P.group.getWorldQuaternion(tmpQ)); return { pos, nrm: n, w: a.u1 - a.u0, h: a.v1 - a.v0, panel: P.name, P, a, quat: tmpQ.clone() }; } }
    return null;
  }
  function press(id, t) { pressT[id] = t; }
  root.updateMatrixWorld(true);
  const reflections = buildReflections(root, panes, [DSP.pfd, DSP.nd, DSP.ewd, DSP.sd, DSP.pfdFO, DSP.ndFO, DSP.stby].filter(Boolean));
  function setIntegral(k, ovhd = k) { for (const P of panels) if (P.faceMat) P.faceMat.emissiveIntensity = (P.name === 'OVHD' || P.name === 'CB' ? ovhd : k) * 0.9; }
  const api = { root, panels, ctls, hits, update, ctlWorld, areaWorld, press, glass: glassMeshes, panes, setIntegral, flood, DSP, reflections, refont() { for (const P of panels) { P.redraw(); } } };
  return api;
}
