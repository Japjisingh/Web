/* C172-class cockpit in the same frame as the exterior (eye at y 0.2, panel face at z -1.0). */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as INS from './instruments.js';
import * as TX from './textures.js';
import { station, ringPt, windowAt } from './model-ext.js';

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const EYE = V(-0.255, 0.2, -0.42);
const PZ = -1.0;
const F = '"JetBrains Mono", ui-monospace, Menlo, monospace';

function drawNav(x, N, label) { // OBS-style nav indicator face (static needles centred)
  const R = N / 2; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N); x.translate(R, R);
  x.fillStyle = '#0d0e0f'; x.beginPath(); x.arc(0, 0, R * 0.96, 0, 7); x.fill();
  x.strokeStyle = '#e8eaea'; x.fillStyle = '#e8eaea'; x.font = `600 ${R * 0.15}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 10) { const a = d * D2R; x.lineWidth = d % 30 ? 1.5 : 3; x.beginPath(); x.moveTo(Math.sin(a) * R * 0.86, -Math.cos(a) * R * 0.86); x.lineTo(Math.sin(a) * R * (d % 30 ? 0.8 : 0.74), -Math.cos(a) * R * (d % 30 ? 0.8 : 0.74)); x.stroke(); if (d % 30 === 0) x.fillText(String(d / 10), Math.sin(a) * R * 0.62, -Math.cos(a) * R * 0.62); }
  for (let i = -5; i <= 5; i++) if (i) { x.beginPath(); x.arc(i * R * 0.08, 0, R * 0.02, 0, 7); x.fill(); }
  x.lineWidth = R * 0.04; x.beginPath(); x.moveTo(0, -R * 0.45); x.lineTo(0, R * 0.45); x.stroke();
  x.fillStyle = '#9aa3a8'; x.font = `600 ${R * 0.11}px ${F}`; x.fillText(label, 0, R * 0.32);
}

export function buildCockpit(renderer) {
  const g = new THREE.Group(); const hits = []; const aniso = renderer.capabilities.getMaxAnisotropy();
  const tx = (c, o = {}) => TX.tex(c, { aniso, ...o });
  // ---------- materials ----------
  const panelPaint = (() => { const { c, x } = TX.canvas(1024, 512); const gr = x.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#2c3236'); gr.addColorStop(1, '#202528'); x.fillStyle = gr; x.fillRect(0, 0, 1024, 512); x.globalAlpha = 0.2; x.strokeStyle = '#9aa3a7'; x.lineWidth = 4; x.strokeRect(3, 3, 1018, 506); x.globalAlpha = 1; return c; })();
  const grain = tx(TX.grain(256, 256, 150, 80, 11), { srgb: false, repeat: [4, 2] });
  const M = {
    panel: new THREE.MeshStandardMaterial({ map: tx(panelPaint), roughness: 0.82, roughnessMap: grain, bumpMap: grain, bumpScale: 0.35, metalness: 0.15 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.55, metalness: 0.2 }),
    screw: new THREE.MeshStandardMaterial({ color: 0x7a8186, roughness: 0.45, metalness: 1, envMapIntensity: 0.45 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xa9afb3, roughness: 0.42, metalness: 1, envMapIntensity: 0.45 }), // brushed / satin
    black: new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.5 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.6 }),
    yoke: new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.42, metalness: 0.1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.03, envMapIntensity: 0.5, depthWrite: false, clearcoat: 0.4, specularIntensity: 0.5 })
  };
  const fabW = TX.fabric('#9a9284', '#857d70', 3, 4), fabH = TX.fabric('#a7a296', '#8f8a80', 4, 6), carpet = TX.fabric('#2a2b2d', '#3c3e41', 2, 8);
  const sidewall = new THREE.MeshStandardMaterial({ map: tx(fabW.map, { repeat: [1, 1] }), normalMap: tx(fabW.normal, { srgb: false, repeat: [1, 1] }), roughness: 1, side: THREE.DoubleSide, vertexColors: true });
  const headliner = new THREE.MeshStandardMaterial({ map: tx(fabH.map, { repeat: [4, 5] }), normalMap: tx(fabH.normal, { srgb: false, repeat: [4, 5] }), roughness: 1, side: THREE.DoubleSide });
  const carpetM = new THREE.MeshStandardMaterial({ map: tx(carpet.map, { repeat: [6, 8] }), normalMap: tx(carpet.normal, { srgb: false, repeat: [6, 8] }), roughness: 1 });
  const L = TX.leather([78, 62, 50], 3);
  const leather = new THREE.MeshStandardMaterial({ map: tx(L.map), normalMap: tx(L.normal, { srgb: false }), normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.62 });
  const fab2 = TX.fabric('#16181a', '#2c2f32', 2, 9);
  const glareM = new THREE.MeshStandardMaterial({ map: tx(fab2.map, { repeat: [10, 2] }), normalMap: tx(fab2.normal, { srgb: false, repeat: [10, 2] }), roughness: 1 });

  // ---------- shell: panel, glareshield, floor, sidewalls, headliner, bulkheads ----------
  const pShape = new THREE.Shape(); pShape.moveTo(-0.53, -0.42); pShape.lineTo(0.53, -0.42); pShape.lineTo(0.53, 0.04); pShape.quadraticCurveTo(0, 0.1, -0.53, 0.04); pShape.closePath();
  const pg = new THREE.ShapeGeometry(pShape, 16); const uv = pg.attributes.uv, pp = pg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pp.getX(i) + 0.53) / 1.06, (pp.getY(i) + 0.42) / 0.52);
  const panel = new THREE.Mesh(pg, M.panel); panel.position.z = PZ; g.add(panel);
  const gs = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.05, 0.2, 3, 0.022), glareM); gs.position.set(0, 0.085, PZ - 0.07); g.add(gs);
  const lip = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 1.02, 4, 12), glareM); lip.rotation.z = Math.PI / 2; lip.position.set(0, 0.072, PZ + 0.025); g.add(lip);
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.44), new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.9 })); lower.position.set(0, -0.64, PZ - 0.06); g.add(lower);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.6), carpetM); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.8, 0.05); g.add(floor);
  // cabin liner: the fuselage rings pulled inwards, with the window openings left open (seen from inside)
  { const pos = [], uvs = [], idx = [], cols = [], NZ = 64, NT = 96, z0 = -1.02, z1 = 1.42, inset = 0.022;
    for (let i = 0; i <= NZ; i++) { const z = z0 + (z1 - z0) * i / NZ, st = station(z); for (let j = 0; j <= NT; j++) { const th = j / NT * Math.PI * 2, p = ringPt(st, th); const cy = st[2], dx = p[0], dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; pos.push(p[0] - dx / l * inset, p[1] - dy / l * inset, z); uvs.push(z * 2.2, j / NT * 6); const lowr = p[1] < -0.12 ? 0.3 : p[1] > 0.36 ? 1 : 0.62, ao = 1 - 0.35 * Math.exp(-Math.abs(z - z0) * 6) - 0.25 * Math.exp(-Math.abs(p[1] + 0.8) * 8); cols.push(lowr * ao, lowr * ao, lowr * ao); } }
    for (let i = 0; i < NZ; i++) for (let j = 0; j < NT; j++) { const z = z0 + (z1 - z0) * (i + 0.5) / NZ, th = (j + 0.5) / NT * Math.PI * 2, p = ringPt(station(z), th); if (windowAt(z, th, p[0], p[1])) continue; if (p[1] > -0.12 && Math.abs(z - (-1.05 + (clamp(p[1], 0.05, 0.38) - 0.05) * 1.12)) < 0.06) continue; /* A-pillar band: smooth post instead */ const k = i * (NT + 1) + j; idx.push(k, k + 1, k + NT + 1, k + 1, k + NT + 2, k + NT + 1); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); lg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); lg.setIndex(idx); lg.computeVertexNormals();
    const liner = new THREE.Mesh(lg, sidewall); g.add(liner); }
  const toe = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.3), carpetM); toe.position.set(0, -0.76, -1.16); toe.rotation.x = -0.9; g.add(toe);
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.7), headliner); roof.rotation.x = Math.PI / 2; roof.position.set(0, 0.385, 0.25); g.add(roof);
  for (const sd of [-1, 1]) {
    // door / sidewall below the windows, with armrest, handle and window latch
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.06, 0.48, 3, 0.02), leather); arm.position.set(sd * 0.49, -0.36, -0.2); g.add(arm);
    const hdl = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.07, 4, 8), M.chrome); hdl.rotation.x = Math.PI / 2; hdl.position.set(sd * 0.515, -0.27, 0.32); g.add(hdl);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.04), M.chrome); latch.position.set(sd * 0.52, -0.06, -0.1); g.add(latch);
    const pocket = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.14), new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 1, side: THREE.DoubleSide })); pocket.rotation.y = -sd * Math.PI / 2; pocket.position.set(sd * 0.488, -0.6, -0.25); g.add(pocket);
    // posts (A-pillar inner trim, door post)
    const post = (a, b, r = 0.03) => { const d = b.clone().sub(a); const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, d.length(), 4, 10), M.plastic); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m); };
    { const a = V(sd * 0.515, -0.12, -1.07), b = V(sd * 0.52, 0.05, -1.05), c2 = V(sd * 0.53, 0.39, -0.67); post(a, b, 0.05); const d = c2.clone().sub(b); const pm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, d.length(), 4, 12), M.plastic); pm.scale.set(1, 1, 0.7); pm.position.copy(b).lerp(c2, 0.5); pm.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(pm); } post(V(sd * 0.525, -0.11, -1.0), V(sd * 0.535, -0.11, 0.42), 0.018); post(V(sd * 0.54, -0.08, 0.43), V(sd * 0.54, 0.37, 0.43), 0.025);
    // overhead vent, sun visor
    const vent = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), M.chrome); vent.position.set(sd * 0.42, 0.37, -0.52); g.add(vent);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20), M.plastic); ring.rotation.x = Math.PI / 2; ring.position.set(sd * 0.42, 0.378, -0.52); g.add(ring);
    const visor = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.16, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 })); visor.position.set(sd * 0.24, 0.365, -0.6); visor.rotation.x = -1.48; g.add(visor);
  }
  { const hdr = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1.0, 4, 12), M.plastic); hdr.rotation.z = Math.PI / 2; hdr.scale.set(1, 1, 0.8); hdr.position.set(0, 0.395, -0.68); g.add(hdr); }
  const bulk = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x3a3c3f, roughness: 1 })); bulk.position.set(0, -0.3, 1.4); bulk.rotation.y = Math.PI; g.add(bulk);
  // windscreen centre strip + magnetic compass
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.5), M.plastic); strip.position.set(0, 0.37, -0.88); strip.rotation.x = -0.75; g.add(strip);
  const comp = new THREE.Group(); comp.position.set(0, 0.29, -0.78);
  const cb = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.06, 0.05, 2, 0.01), M.black); cb.position.z = -0.03; comp.add(cb);
  const cardT = TX.tex((() => { const { c, x } = TX.canvas(512, 64); x.fillStyle = '#ece4c6'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#1b1b1b'; x.font = '700 22px monospace'; x.textAlign = 'center'; const L = { 0: 'N', 9: 'E', 18: 'S', 27: 'W' }; for (let d = 0; d < 36; d++) { const px = 512 - d / 36 * 512; x.fillRect(px, 44, 2, 14); if (d % 3 === 0) x.fillText(L[d] || String(d), px, 36); } return c; })());
  const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 32, 1, true), new THREE.MeshStandardMaterial({ map: cardT, roughness: 0.6, emissive: 0x403a28, side: THREE.DoubleSide })); cw.position.set(0, 0, 0.0); comp.add(cw);
  const cwin = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.028), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.05 })); cwin.position.set(0, 0, 0.031); comp.add(cwin);
  const cm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.02), M.plastic); cm.position.set(0, 0.05, -0.02); comp.add(cm); g.add(comp);
  // dome light
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), new THREE.MeshStandardMaterial({ color: 0xe8e4d8, emissive: 0xffe9c0, emissiveIntensity: 0, roughness: 0.4 })); dome.position.set(0, 0.38, 0.1); g.add(dome);

  // ---------- seats with stitched leather, seatbelts; rear bench ----------
  for (const sx of [-0.27, 0.27]) {
    const cush = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.13, 0.5, 4, 0.05), leather); cush.position.set(sx, -0.54, -0.18); g.add(cush);
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.66, 0.13, 4, 0.05), leather); back.position.set(sx, -0.14, 0.1); back.rotation.x = 0.18; g.add(back);
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.15, 0.1, 3, 0.04), leather); head.position.set(sx, 0.27, 0.17); head.rotation.x = 0.18; g.add(head);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.7), M.chrome); rail.position.set(sx, -0.82, -0.3); g.add(rail);
    // belts: shoulder strap from the door post to the inboard hip, lap belt
    const strap = (a, b) => { const d = b.clone().sub(a); const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, d.length(), 0.004), new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.9 })); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); g.add(m); return m; };
    const out = Math.sign(sx);
    strap(V(sx + out * 0.21, 0.32, 0.18), V(sx - out * 0.16, -0.44, -0.02)); strap(V(sx + out * 0.22, -0.45, 0.0), V(sx - out * 0.22, -0.45, 0.0));
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), M.chrome); buckle.position.set(sx - out * 0.12, -0.44, -0.01); g.add(buckle);
  }
  const bench = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.13, 0.48, 4, 0.05), leather); bench.position.set(0, -0.5, 0.75); g.add(bench);
  const benchB = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.6, 0.12, 4, 0.05), leather); benchB.position.set(0, -0.14, 1.02); benchB.rotation.x = 0.16; g.add(benchB);

  // ---------- instruments: bezels, screws, faces, glass ----------
  const G = {}, glassList = [], lit = [];
  const tex = (w, h) => { const { c, x } = TX.canvas(w, h); const t = tx(c); return { c, x, t }; };
  const gauge = (key, x, y, r, px = 320, name = key) => {
    const t = tex(px, px);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ map: t.t })); face.position.set(x, y, PZ + 0.0085); g.add(face);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(r * 2.3, r * 2.3, 0.01, 2, 0.006), M.bezel); plate.position.set(x, y, PZ + 0.002); g.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.09, 10, 48), M.bezel); rim.position.set(x, y, PZ + 0.011); g.add(rim);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.08, 0.004, 10), M.screw); sc.rotation.x = Math.PI / 2; sc.position.set(x + a * r * 1.0, y + b * r * 1.0, PZ + 0.0085); g.add(sc); }
    const gl = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 40), M.glass); gl.position.set(x, y, PZ + 0.017); g.add(gl); glassList.push(gl);
    G[key] = { ...t, N: px, mesh: face }; face.userData.ctl = { name }; hits.push(face); lit.push(face.material); return face;
  };
  const R6 = 0.04;
  gauge('asi', -0.365, -0.06, R6, 320, 'Airspeed indicator'); gauge('ai', -0.27, -0.06, R6, 320, 'Attitude indicator'); gauge('alt', -0.175, -0.06, R6, 320, 'Altimeter');
  gauge('tc', -0.365, -0.16, R6, 320, 'Turn coordinator'); gauge('hi', -0.27, -0.16, R6, 320, 'Heading indicator'); gauge('vsi', -0.175, -0.16, R6, 320, 'Vertical speed indicator');
  gauge('nav1', -0.075, -0.06, 0.036, 256, 'NAV 1 course deviation indicator'); gauge('nav2', -0.075, -0.16, 0.036, 256, 'NAV 2 course deviation indicator');
  gauge('tach', -0.365, -0.255, 0.034, 256, 'Tachometer'); gauge('vac', -0.175, -0.255, 0.03, 200, 'Suction and ammeter');
  gauge('fuel', -0.47, -0.04, 0.03, 200, 'Fuel quantity'); gauge('oil', -0.47, -0.12, 0.03, 200, 'Oil temperature and pressure');
  drawNav(G.nav1.x, 256, 'NAV 1'); drawNav(G.nav2.x, 256, 'NAV 2'); G.nav1.t.needsUpdate = G.nav2.t.needsUpdate = true;
  // radio stack (audio, com/nav, gps, transponder) + autopilot strip
  const rt = tex(400, 540); const radio = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.27), new THREE.MeshBasicMaterial({ map: rt.t })); radio.position.set(0.11, -0.15, PZ + 0.0095); g.add(radio); radio.userData.ctl = { name: 'Avionics: audio panel, COM/NAV 1, transponder' }; hits.push(radio); lit.push(radio.material);
  const rframe = new THREE.Mesh(new RoundedBoxGeometry(0.215, 0.285, 0.012, 2, 0.004), M.bezel); rframe.position.set(0.11, -0.15, PZ + 0.002); g.add(rframe);
  for (let i = 0; i < 4; i++) for (const kx of [0.185, 0.2]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.014, 16), M.plastic); k.rotation.x = Math.PI / 2; k.position.set(kx - 0.012, -0.05 - i * 0.067, PZ + 0.017); g.add(k); }
  let radioOn = null;
  // placards / decals
  const plac = (w, h, x, y, lines, pxw = 256, opts = {}) => { const t = tex(pxw, Math.max(8, Math.round(pxw * h / w))); INS.drawPlacard(t.x, t.c.width, t.c.height, lines, opts); t.t.needsUpdate = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.t, transparent: true })); m.position.set(x, y, PZ + 0.004); g.add(m); lit.push(m.material); return m; };
  plac(0.21, 0.075, 0.37, -0.04, [{ t: 'OPERATING LIMITATIONS', s: 15, w: 700 }, { t: 'NORMAL CATEGORY · NO ACROBATICS', s: 11 }, { t: 'VNE 163 KIAS · VNO 129 KIAS', s: 11 }, { t: 'VA 105 KIAS AT 2,550 LB · VFE 85 KIAS', s: 11 }, { t: 'APPROXIMATE · PROTOTYPE ONLY', s: 10, c: '#d59a6a' }], 512, { bg: '#1c2023' });
  plac(0.16, 0.012, -0.27, 0.025, [{ t: 'C172-CLASS TRAINER · GP-172', s: 13 }], 512, { bg: 'rgba(0,0,0,0)', color: '#aab3b7' });
  // circuit breaker panel (lower right)
  const cbNames = ['FLAP', 'INST', 'AVN BUS', 'NAV LT', 'BCN', 'LDG LT', 'TAXI', 'STROBE', 'FUEL', 'PITOT', 'TURN', 'ALT FLD'];
  plac(0.22, 0.09, 0.39, -0.36, [{ t: '', s: 1 }], 64, { bg: '#1a1d20' });
  cbNames.forEach((n, i) => { const x = 0.3 + (i % 6) * 0.035, y = -0.335 - Math.floor(i / 6) * 0.045; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 12), M.black); b.rotation.x = Math.PI / 2; b.position.set(x, y, PZ + 0.01); g.add(b); plac(0.032, 0.008, x, y + 0.017, [{ t: n, s: 13 }], 128, { bg: 'rgba(0,0,0,0)' }); });
  plac(0.06, 0.014, 0.45, -0.24, [{ t: 'HOBBS 1234.5', s: 13 }], 256, { bg: '#0d0e0f', color: '#e8e2c8' });
  const glove = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.09, 0.006, 2, 0.004), M.plastic); glove.position.set(0.4, -0.19, PZ + 0.003); g.add(glove);
  const gh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), M.chrome); gh.position.set(0.4, -0.155, PZ + 0.008); g.add(gh);

  // ---------- controls ----------
  const C = {};
  const reg = (m, name, key) => { m.userData.ctl = { name, key }; m.traverse(o => { if (o.isMesh) { o.userData.ctl = m.userData.ctl; hits.push(o); } }); return m; };
  const knobMat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.6 });
  const ridged = (r, h, col, n = 24) => { const pts = []; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2; pts.push(new THREE.Vector2(Math.cos(a) * (r + (i % 2 ? 0.0015 : 0)), Math.sin(a) * (r + (i % 2 ? 0.0015 : 0)))); } const sh = new THREE.Shape(pts); const g2 = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 2 }); return new THREE.Mesh(g2, knobMat(col)); };
  const pushPull = (x, y, kind) => {
    const grp = new THREE.Group(); grp.position.set(x, y, PZ); const mv = new THREE.Group(); grp.add(mv);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.17, 10), M.chrome); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.06; mv.add(shaft);
    let k;
    if (kind === 'throttle') k = ridged(0.019, 0.024, 0x101112);
    else if (kind === 'mixture') k = ridged(0.016, 0.022, 0xb3222a, 18);
    else { k = new THREE.Mesh(new RoundedBoxGeometry(0.038, 0.022, 0.018, 2, 0.006), knobMat(0xd8d9d6)); }
    k.position.z = 0.02; mv.add(k);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 16), M.chrome); collar.rotation.x = Math.PI / 2; collar.position.z = 0.003; grp.add(collar);
    g.add(grp); grp.userData.mv = mv; return grp;
  };
  C.carb = pushPull(-0.075, -0.37, 'carb'); C.throttle = pushPull(0.0, -0.37, 'throttle'); C.mixture = pushPull(0.075, -0.37, 'mixture');
  plac(0.05, 0.01, -0.075, -0.395, [{ t: 'CARB HEAT', s: 14 }], 160); plac(0.05, 0.01, 0, -0.395, [{ t: 'THROTTLE', s: 14 }], 160); plac(0.05, 0.01, 0.075, -0.395, [{ t: 'MIXTURE', s: 14 }], 160);
  // flap lever + position indicator
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.004), M.black); slot.position.set(0.25, -0.29, PZ + 0.003); g.add(slot);
  C.flap = new THREE.Group(); const fh = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.024, 0.03, 2, 0.008), knobMat(0xe8e8e6)); fh.position.z = 0.04; const fsh = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.04), M.chrome); fsh.position.z = 0.018; C.flap.add(fh, fsh); C.flap.position.set(0.25, -0.225, PZ); g.add(C.flap);
  plac(0.035, 0.15, 0.285, -0.29, [{ t: '0°', y: 14 }, { t: '10°', y: 52 }, { t: '20°', y: 90 }, { t: '30°', y: 128 }, { t: 'FLAP', y: 150, s: 11 }], 40, { bg: '#1b1f22' });
  // ignition key + magneto labels
  const magT = tex(128, 128); const magFace = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), new THREE.MeshBasicMaterial({ map: magT.t })); magFace.position.set(-0.47, -0.29, PZ + 0.004); g.add(magFace); lit.push(magFace.material);
  { const x = magT.x; x.fillStyle = '#121416'; x.beginPath(); x.arc(64, 64, 63, 0, 7); x.fill(); x.fillStyle = '#e8eaea'; x.font = '600 15px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; [['OFF', -70], ['R', -35], ['L', 0], ['BOTH', 35], ['START', 70]].forEach(([t, a]) => x.fillText(t, 64 + Math.sin(a * D2R) * 46, 64 - Math.cos(a * D2R) * 46)); magT.t.needsUpdate = true; }
  C.key = new THREE.Group(); C.key.position.set(-0.47, -0.29, PZ + 0.01);
  const kb = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 20), M.chrome); kb.rotation.x = Math.PI / 2; const kh = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.03, 0.006, 2, 0.003), M.black); kh.position.z = 0.014; const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 6, 12), M.chrome); ring2.position.set(0, -0.022, 0.014); C.key.add(kb, kh, ring2); g.add(C.key);
  // master (split red rocker ALT | BAT), avionics master, light switches, panel/flood dimmers — lower left row
  const rocker = (x, y, col) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.032, 0.012, 2, 0.004), knobMat(col)); m.position.set(x, y, PZ + 0.01); g.add(m); return m; };
  C.alt = rocker(-0.505, -0.375, 0xc0262c); C.bat = rocker(-0.487, -0.375, 0xc0262c); plac(0.042, 0.009, -0.496, -0.4, [{ t: 'ALT  BAT', s: 14 }], 160);
  C.avn = rocker(-0.455, -0.375, 0x2a2d30); plac(0.034, 0.009, -0.455, -0.4, [{ t: 'AVN', s: 14 }], 128);
  C.lights = {};
  [['bcn', 'BCN'], ['land', 'LAND'], ['taxi', 'TAXI'], ['nav', 'NAV'], ['strb', 'STROBE']].forEach(([k, t], i) => { const x = -0.425 + i * 0.028; const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.022, 8), M.chrome); sw.rotation.x = Math.PI / 2; const base = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 12), M.chrome); base.rotation.x = Math.PI / 2; base.position.set(x, -0.375, PZ + 0.004); g.add(base); sw.position.set(x, -0.375, PZ + 0.012); g.add(sw); C.lights[k] = sw; plac(0.027, 0.008, x, -0.4, [{ t, s: 15 }], 128); });
  const dimmer = (x, label) => { const k = ridged(0.009, 0.012, 0x1c1e20, 16); k.position.set(x, -0.375, PZ); g.add(k); const ptr = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.006, 0.003), knobMat(0xffffff)); ptr.position.set(0, 0.006, 0.014); k.add(ptr); plac(0.034, 0.009, x, -0.4, [{ t: label, s: 13 }], 128); return k; };
  C.panelK = dimmer(-0.215, 'PANEL'); C.floodK = dimmer(-0.18, 'FLOOD');
  // parking brake T-handle under the panel lip
  C.park = new THREE.Group(); const ph = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.014, 0.014, 2, 0.005), knobMat(0xc0262c)); const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 8), M.chrome); pst.rotation.x = Math.PI / 2; pst.position.z = -0.03; C.park.add(ph, pst); C.park.position.set(-0.36, -0.435, PZ + 0.012); g.add(C.park);
  // centre pedestal: trim wheel + indicator, fuel selector on the floor
  const ped = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.42, 0.24, 3, 0.02), M.plastic); ped.position.set(0, -0.63, -0.9); g.add(ped);
  C.trim = new THREE.Group(); C.trim.position.set(0, -0.6, -0.78);
  const twg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.028, 40), new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.55 })); twg.rotation.z = Math.PI / 2; C.trim.add(twg);
  for (let i = 0; i < 20; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.012, 0.016), M.black); const a = i / 20 * Math.PI * 2; r.position.set(0, Math.cos(a) * 0.1, Math.sin(a) * 0.1); r.rotation.x = a; C.trim.add(r); }
  const tmark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.018), knobMat(0xffffff)); tmark.position.set(0, 0.1, 0); C.trim.add(tmark);
  g.add(C.trim);
  const trimInd = tex(64, 256); const trimIndM = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.11), new THREE.MeshBasicMaterial({ map: trimInd.t })); trimIndM.position.set(-0.072, -0.6, -0.8); trimIndM.rotation.y = -Math.PI / 2; g.add(trimIndM); lit.push(trimIndM.material);
  const fsT = tex(256, 256); const fsel = new THREE.Mesh(new THREE.CircleGeometry(0.075, 40), new THREE.MeshBasicMaterial({ map: fsT.t })); fsel.rotation.x = -Math.PI / 2 + 0.25; fsel.position.set(0, -0.83, -0.62); g.add(fsel); lit.push(fsel.material);
  { const x = fsT.x; x.fillStyle = '#1a1c1e'; x.beginPath(); x.arc(128, 128, 126, 0, 7); x.fill(); x.fillStyle = '#e8eaea'; x.font = '700 26px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BOTH', 128, 30); x.fillText('LEFT', 40, 128); x.fillText('RIGHT', 212, 128); x.fillStyle = '#e04040'; x.fillText('OFF', 128, 226); x.font = '600 14px monospace'; x.fillStyle = '#aab'; x.fillText('FUEL', 128, 160); fsT.t.needsUpdate = true; }
  C.fuel = new THREE.Group(); C.fuel.position.set(0, -0.82, -0.62); C.fuel.rotation.x = 0.25; const fptr = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.024, 0.11, 2, 0.006), knobMat(0xd6d8d8)); fptr.position.set(0, 0.012, -0.02); C.fuel.add(fptr); g.add(C.fuel);

  // ---------- ram's-horn yokes with PTT and trim switches ----------
  const yoke = (x) => {
    const grp = new THREE.Group(); grp.position.set(x, -0.25, PZ);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 20), M.chrome); collar.rotation.x = Math.PI / 2; collar.position.z = 0.008; grp.add(collar);
    const mv = new THREE.Group(); grp.add(mv);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 16), M.chrome); shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.05; mv.add(shaft);
    const rot = new THREE.Group(); rot.position.z = 0.25; mv.add(rot);
    const hub = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.06, 0.05, 3, 0.015), M.yoke); rot.add(hub);
    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.016, 20), new THREE.MeshStandardMaterial({ color: 0x9e1f63, roughness: 0.3 })); badge.position.z = 0.026; rot.add(badge);
    for (const sd of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([V(sd * 0.05, -0.005, 0), V(sd * 0.12, -0.02, 0.005), V(sd * 0.17, 0.02, 0.01), V(sd * 0.175, 0.09, 0.0)]);
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.017, 12, false), M.yoke); rot.add(horn);
      const capE = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), M.yoke); capE.position.set(sd * 0.175, 0.09, 0); rot.add(capE);
      if (sd < 0) { const ptt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10), knobMat(0xc0262c)); ptt.rotation.x = Math.PI / 2; ptt.position.set(sd * 0.168, 0.07, 0.016); rot.add(ptt); const trs = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.016, 0.008, 1, 0.002), M.black); trs.position.set(sd * 0.175, 0.108, 0.006); rot.add(trs); }
    }
    g.add(grp); grp.userData = { mv, rot }; return grp;
  };
  C.yokeL = yoke(-0.27); C.yokeR = yoke(0.27);
  // rudder pedals with toe brakes
  C.pedals = [];
  for (const [x, side] of [[-0.35, 'L'], [-0.19, 'R'], [0.19, 'L'], [0.35, 'R']]) { const p = new THREE.Group(); p.position.set(x, -0.8, -1.08); const plate = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.15, 0.015, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x5a6065, roughness: 0.45, metalness: 0.6 })); plate.position.y = 0.08; plate.rotation.x = -0.35; const top = new THREE.Group(); top.add(plate); p.add(top); const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.015), M.chrome); arm.position.set(0, 0.11, -0.04); p.add(arm); g.add(p); p.userData = { side, top }; C.pedals.push(p); }

  // ---------- register clickables ----------
  reg(C.throttle, 'Throttle (click: +25%, wraps to idle)', 'throttle'); reg(C.mixture, 'Mixture (click: rich / idle cut-off)', 'mixture'); reg(C.carb, 'Carb heat (click: on / off)', 'carb');
  reg(C.flap, 'Flap lever (click upper half: up, lower half: down)', 'flap'); reg(C.key, 'Magnetos / starter key (click: OFF, R, L, BOTH, START)', 'mags');
  reg(C.bat, 'Master switch: BAT', 'bat'); reg(C.alt, 'Master switch: ALT', 'alt'); reg(C.avn, 'Avionics master', 'avionics');
  Object.entries(C.lights).forEach(([k, m]) => reg(m, 'Light switch: ' + { bcn: 'beacon', land: 'landing', taxi: 'taxi', nav: 'navigation', strb: 'strobe' }[k], 'light:' + k));
  reg(C.panelK, 'Panel lights (click: off, dim, bright)', 'panelLt'); reg(C.floodK, 'Flood light (click: off, white, red)', 'flood');
  reg(C.park, 'Parking brake (click: set / release)', 'park'); reg(C.trim, 'Elevator trim (click top: nose down, bottom: nose up)', 'trim'); reg(C.fuel, 'Fuel selector (click: BOTH, LEFT, RIGHT, OFF)', 'fuel');
  reg(C.yokeL, 'Control yoke: pull for nose up, turn to roll'); reg(C.yokeR, 'Control yoke (right seat)'); C.pedals.forEach(p => reg(p, 'Rudder pedals: push to yaw, toes for brakes'));

  // ---------- lighting ----------
  const flood = new THREE.PointLight(0xffe9d2, 0, 2.4, 2); flood.position.set(0, 0.34, -0.45); g.add(flood);
  const panelGlow = new THREE.PointLight(0xffd7a8, 0, 0.9, 2); panelGlow.position.set(-0.2, 0.05, PZ + 0.15); g.add(panelGlow);
  g.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial && o.material !== M.glass) { o.receiveShadow = true; o.castShadow = true; } });
  let litLevel = -1;
  function setLighting(night, panelLt, floodMode) {
    const lvl = night < 0.35 ? 1.35 : 0.035 + [0, 0.45, 1][panelLt] * (0.7 + 0.3 * (1 - night)) + (floodMode ? 0.18 : 0);
    if (Math.abs(lvl - litLevel) > 1e-3) { litLevel = lvl; const warm = night >= 0.35 && panelLt ? [1, 0.9, 0.78] : [1, 1, 1]; lit.forEach(m => m.color.setRGB(lvl * warm[0], lvl * warm[1], lvl * warm[2])); }
    flood.color.setHex(floodMode === 2 ? 0xff3a28 : 0xffe9d2); flood.intensity = floodMode ? (floodMode === 2 ? 0.22 : 0.16) * (0.4 + night) : 0;
    panelGlow.intensity = night >= 0.35 ? [0, 0.12, 0.3][panelLt] : 0;
    dome.material.emissiveIntensity = floodMode === 1 && night > 0.35 ? 1.5 : 0;
  }
  let yokesOn = true;
  let acc = 0;
  return {
    group: g, hits, eye: EYE.clone(), glass: glassList, setLighting,
    setYokes(on) { yokesOn = on; C.yokeL.visible = C.yokeR.visible = on; },
    get yokesVisible() { return yokesOn; },
    /** which half of a two-way control was clicked: +1 = up/forward, -1 = down */
    half(key, lp) { if (key === 'flap') return lp.y > C.flap.position.y ? 1 : -1; if (key === 'trim') return lp.y > C.trim.position.y ? 1 : -1; return 1; },
    update(c, s, dt, force = false) {
      C.throttle.userData.mv.position.z = (1 - c.throttle) * 0.065; C.mixture.userData.mv.position.z = (1 - c.mixture) * 0.065; C.carb.userData.mv.position.z = c.carb ? 0.055 : 0;
      C.flap.position.y = -0.225 - c.flap / 3 * 0.11;
      C.key.rotation.z = -[-70, -35, 0, 35, 70][c.mags] * D2R;
      C.bat.rotation.x = c.bat ? -0.3 : 0.3; C.alt.rotation.x = c.alt ? -0.3 : 0.3; C.avn.rotation.x = c.avionics ? -0.3 : 0.3;
      Object.entries(C.lights).forEach(([k, m]) => { m.rotation.x = Math.PI / 2 + (c.lights[k] ? -0.45 : 0.45); });
      C.panelK.rotation.z = -[-2, 0, 2][c.panelLt ?? 1]; C.floodK.rotation.z = -[-2, 0, 2][c.flood ?? 0];
      C.park.position.z = PZ + 0.012 + (c.park ? 0.05 : 0);
      C.trim.rotation.x = c.trim * 14;
      C.fuel.rotation.y = -[0, -90, 90, 180][c.fuel] * D2R;
      for (const y of [C.yokeL, C.yokeR]) { y.userData.mv.position.z = c.pitch * 0.07; y.userData.rot.rotation.z = -c.roll * 70 * D2R; }
      for (const p of C.pedals) { const push = (p.userData.side === 'L' ? -1 : 1) * c.yaw; p.position.z = -1.08 - push * 0.05; const br = c.park ? 1 : p.userData.side === 'L' ? c.brakeL : c.brakeR; p.userData.top.rotation.x = -br * 0.3; }
      cw.rotation.y = (s.hdg || 0) * D2R;
      acc += dt; if (!force && acc < 1 / 30) return; acc = 0;
      const pw = c.bat, spin = s.rpm > 500 ? 1 : 0.3;
      INS.drawASI(G.asi.x, G.asi.N, s.ias); INS.drawAI(G.ai.x, G.ai.N, s.pitch, s.bank, spin); INS.drawALT(G.alt.x, G.alt.N, s.alt); INS.drawTC(G.tc.x, G.tc.N, s.turnRate, s.ball, pw);
      INS.drawHI(G.hi.x, G.hi.N, s.hdg, s.hdgBug ?? 0); INS.drawVSI(G.vsi.x, G.vsi.N, s.vs); INS.drawTach(G.tach.x, G.tach.N, s.rpm);
      INS.drawFuel(G.fuel.x, G.fuel.N, s.fuelL, s.fuelR, pw); INS.drawOil(G.oil.x, G.oil.N, s.oilT, s.oilP); INS.drawVac(G.vac.x, G.vac.N, s.rpm > 500 ? 5 : s.rpm / 100, pw ? s.amps : 0);
      ['asi', 'ai', 'alt', 'tc', 'hi', 'vsi', 'tach', 'fuel', 'oil', 'vac'].forEach(k => { G[k].t.needsUpdate = true; });
      const ron = c.bat && c.avionics; if (ron !== radioOn) { radioOn = ron; INS.drawRadio(rt.x, 400, 540, ron); rt.t.needsUpdate = true; }
      { const x = trimInd.x; x.fillStyle = '#121416'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#e8eaea'; x.font = '600 12px monospace'; x.textAlign = 'center'; x.fillText('DN', 32, 16); x.fillText('UP', 32, 248); x.fillStyle = '#2fa84f'; x.fillRect(22, 118, 20, 20); x.fillStyle = '#9aa'; x.font = '600 9px monospace'; x.fillText('T/O', 32, 150); x.fillStyle = '#f2f2f2'; const y = 128 - clamp(c.trim / 0.25, -1, 1) * 100; x.fillRect(10, y - 3, 44, 6); trimInd.t.needsUpdate = true; }
    }
  };
}
