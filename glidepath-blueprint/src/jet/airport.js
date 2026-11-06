/* Apron at a generic airport, seen from the parked twin-jet. Angled contact stand: the terminal pier recedes to the
   left, the apron, taxiway and runway open up ahead with their light rows, a tree line sits on a hazy horizon.
   Everything is procedural and cheap: merged static geometry, instanced aircraft, trees and lights. Ground is 3.4 m
   below the cabin floor; the aircraft's nose points along -z. */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from '../sim/textures.js';
import { FONT } from './panel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const GROUND = -3.4;
const D2R = Math.PI / 180;

function clean(geo) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }

export function buildAirport(renderer) {
  const root = new THREE.Group(); root.name = 'airport';
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const merged = new Map();
  const add = (geo, mat, pos, rot, scale) => {
    const g = clean(geo);
    g.applyMatrix4(new THREE.Matrix4().compose(pos || V(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), scale || V(1, 1, 1)));
    if (!merged.has(mat)) merged.set(mat, []); merged.get(mat).push(g);
  };
  const Y = GROUND;
  const tex = (c, o = {}) => TX.tex(c, { aniso, ...o });

  /* ---------------- layout: terminal axis runs forward-left of the aircraft ---------------- */
  const th = 35 * D2R;
  const U = V(-Math.sin(th), 0, -Math.cos(th));        // along the facade (forward-left)
  const N = V(Math.cos(th), 0, -Math.sin(th));          // facade normal, towards the apron
  const A = V(-24, 0, 0);                                // a point on the facade line
  const P = (s, n, y = 0) => A.clone().addScaledVector(U, s).addScaledVector(N, n).setY(Y + y);
  const yawU = Math.atan2(U.x, U.z);                     // rotation that maps +z onto U

  /* ---------------- ground: grass, apron concrete, taxiway and runway strips ---------------- */
  const grassT = (() => { const { c, x } = TX.canvas(512, 512); const r = TX.rng(41); x.fillStyle = '#5f6b3f'; x.fillRect(0, 0, 512, 512); for (let i = 0; i < 2600; i++) { const v = r(); x.fillStyle = v < 0.5 ? 'rgba(80,92,48,0.5)' : v < 0.8 ? 'rgba(112,118,70,0.45)' : 'rgba(70,74,44,0.6)'; x.fillRect(r() * 512, r() * 512, 2 + r() * 10, 1 + r() * 3); } return c; })();
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ map: tex(grassT, { repeat: [400, 400] }), roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = Y - 0.05; root.add(grass);
  const conc = (() => {
    const { c, x } = TX.canvas(1024, 1024); const r = TX.rng(17);
    x.fillStyle = '#a7a8a3'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = 158 + (r() - 0.5) * 16; x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(i * 64, j * 64, 64, 64); }
    { const g = TX.grain(256, 256, 128, 60, 9); x.save(); x.globalAlpha = 0.35; x.globalCompositeOperation = 'overlay'; x.fillStyle = x.createPattern(g, 'repeat'); x.fillRect(0, 0, 1024, 1024); x.restore(); }
    for (let k = 0; k < 70; k++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(40,38,34,0.2)'); g.addColorStop(1, 'rgba(40,38,34,0)'); x.save(); x.translate(r() * 1024, r() * 1024); x.scale(10 + r() * 40, 6 + r() * 26); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
    x.strokeStyle = 'rgba(55,55,52,0.7)'; x.lineWidth = 2; for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(1024, i * 64); x.stroke(); }
    return c;
  })();
  const apronL = 900, apronW = 110;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(apronW, apronL), new THREE.MeshStandardMaterial({ map: tex(conc, { repeat: [apronW / 80, apronL / 80] }), roughness: 0.9 }));
  { const c = P(260, apronW / 2 - 8); apron.geometry.rotateX(-Math.PI / 2); apron.geometry.rotateY(yawU); apron.position.set(c.x, Y, c.z); }
  apron.receiveShadow = true; root.add(apron);
  const stripT = (kind) => {
    const { c, x } = TX.canvas(256, 1024); const r = TX.rng(kind === 'rwy' ? 5 : 9);
    x.fillStyle = kind === 'rwy' ? '#3d3f40' : '#4b4d4d'; x.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 1800; i++) { const v = 50 + r() * 40; x.fillStyle = `rgba(${v},${v},${v},0.5)`; x.fillRect(r() * 256, r() * 1024, 2, 2); }
    if (kind === 'rwy') { x.fillStyle = '#e9e9e2'; x.fillRect(6, 0, 5, 1024); x.fillRect(245, 0, 5, 1024); for (let y = 0; y < 1024; y += 256) x.fillRect(124, y + 40, 8, 120); x.fillStyle = 'rgba(20,20,20,0.35)'; for (let k = 0; k < 6; k++) x.fillRect(90 + k * 12, 0, 6, 1024); }
    else { x.fillStyle = '#e1b52a'; x.fillRect(125, 0, 6, 1024); x.fillRect(4, 0, 4, 1024); x.fillRect(248, 0, 4, 1024); }
    return c;
  };
  const strip = (n, width, len, kind) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshStandardMaterial({ map: tex(stripT(kind), { repeat: [1, len / (kind === 'rwy' ? 240 : 60)] }), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 })); m.geometry.rotateX(-Math.PI / 2); m.geometry.rotateY(yawU); const c = P(300, n); m.position.set(c.x, Y + 0.02, c.z); m.receiveShadow = true; root.add(m); return m; };
  const TWY = 62, RWY = 360;
  strip(TWY, 23, 2400, 'twy'); strip(RWY, 45, 3600, 'rwy');

  /* ---------------- stand markings (lead-in line, stop bar, safety lines, stand number) ---------------- */
  {
    const S = 2048, M = 90; const { c, x } = TX.canvas(S, S); const k = S / M; const cz = -30;
    const toC = (xm, zm) => [(xm + M / 2) * k, (zm - cz + M / 2) * k];
    const yl = '#e9b928', rd = '#c8322b', wh = '#ecece6';
    const line = (pts, col, w, dash) => { x.strokeStyle = col; x.lineWidth = w * k; if (dash) x.setLineDash(dash.map(d => d * k)); x.beginPath(); pts.forEach(([a, b], i) => { const [u, v] = toC(a, b); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.stroke(); x.setLineDash([]); };
    // lead-in: from the taxiway centreline (ahead) to our nose wheel
    const tw0 = A.clone().addScaledVector(N, TWY); const tPt = s => { const p = tw0.clone().addScaledVector(U, s); return [p.x, p.z]; };
    const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const a = [0, -6 - t * 40]; const b = tPt(-58 + (1 - t) * 0); pts.push([a[0] * (1 - t * t) + b[0] * t * t, a[1] * (1 - t * t) + b[1] * t * t]); }
    line(pts.reverse(), yl, 0.2); line([[0, -6], [0, -2.0]], yl, 0.2);
    line([[-1.8, -2.8], [1.8, -2.8]], yl, 0.42);
    line([[-12, 18], [-12, -10], [14, -10], [14, 18]], rd, 0.22);
    line([[-12, -11.5], [14, -11.5]], wh, 0.12, [2.5, 2.5]);
    x.save(); const [hu, hv] = toC(-8, -7.5); x.strokeStyle = yl; x.lineWidth = 0.12 * k; x.strokeRect(hu, hv, 4 * k, 3 * k); for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(hu + i * 0.6 * k, hv); x.lineTo(hu + i * 0.6 * k + 0.6 * k, hv + 3 * k); x.stroke(); } x.restore();
    x.save(); const [nu, nv] = toC(0, -16); x.translate(nu, nv); x.fillStyle = yl; x.font = `700 ${4.4 * k}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('12', 0, 0); x.restore();
    for (let i = 0; i < 50; i++) { const [u, v] = toC((Math.random() - 0.5) * 3, -2 - Math.random() * 30); x.fillStyle = 'rgba(30,30,28,0.07)'; x.beginPath(); x.ellipse(u, v, 0.6 * k, 2.2 * k, 0, 0, 7); x.fill(); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(M, M), new THREE.MeshStandardMaterial({ map: tex(c), transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, Y + 0.03, cz); m.receiveShadow = true; root.add(m);
  }

  /* ---------------- materials ---------------- */
  const glazeT = (() => {
    const { c, x } = TX.canvas(1024, 256); const r = TX.rng(5);
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#b9c8d4'); g.addColorStop(0.45, '#6f8496'); g.addColorStop(1, '#2d3a46'); x.fillStyle = g; x.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 40; i++) { if (r() < 0.45) { x.fillStyle = `rgba(255,232,186,${0.08 + r() * 0.16})`; x.fillRect(i * 25.6 + 2, 110 + r() * 40, 22, 146); } }
    x.fillStyle = 'rgba(30,36,42,0.55)'; for (let i = 0; i < 18; i++) x.fillRect(r() * 1024, 200 + r() * 30, 6, 26); // people / furniture silhouettes
    x.fillStyle = '#2a3036'; for (let i = 0; i <= 40; i++) x.fillRect(i * 25.6 - 1.5, 0, 3, 256); x.fillRect(0, 0, 1024, 5); x.fillRect(0, 124, 1024, 4); x.fillRect(0, 251, 1024, 5);
    return c;
  })();
  const glassM = new THREE.MeshStandardMaterial({ map: tex(glazeT, { repeat: [8, 1] }), roughness: 0.08, metalness: 0.6, envMapIntensity: 1.3, emissive: 0xffe2a8, emissiveIntensity: 0 });
  glassM.emissiveMap = glassM.map;
  const concM = new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.85 }), darkM = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 }), metalM = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.4, metalness: 0.8 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xeef0f1, roughness: 0.35, metalness: 0.1 }), greyM = new THREE.MeshStandardMaterial({ color: 0x8c9399, roughness: 0.5, metalness: 0.2 }), yellowM = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.55 }), blackM = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.6 }), roofM = new THREE.MeshStandardMaterial({ color: 0xd4d7d8, roughness: 0.45, metalness: 0.45 });

  /* ---------------- terminal pier (glazed, receding along U) ---------------- */
  {
    const L = 340, s0 = -20, D = 34;
    const mid = (s, n, y) => P(s0 + L / 2 + s, n, y);
    const box = (w, h, d, s, n, y, mat) => add(new THREE.BoxGeometry(w, h, d), mat, mid(s, n, y), [0, yawU, 0]);
    box(D, 4.6, L, 0, -D / 2, 2.3, concM);                         // apron level
    const fac = new THREE.Mesh(new THREE.PlaneGeometry(L, 7.6), glassM); fac.geometry.rotateY(yawU - Math.PI / 2); const fp = mid(0, 0.4, 8.4); fac.position.copy(fp); root.add(fac);
    box(D, 7.6, L, 0, -D / 2 - 0.6, 8.4, darkM);
    box(D + 6, 0.9, L + 4, 0, -D / 2 + 3, 12.7, roofM);             // roof with overhang
    box(0.6, 1.2, L + 4, 0, 5.8, 12.4, metalM);                      // fascia
    for (let s = -L / 2; s <= L / 2; s += 9) { box(0.45, 8.2, 0.45, s, 0.9, 8.4, metalM); }
    for (let s = -L / 2 + 6; s < L / 2; s += 11) box(3.4, 2.7, 0.25, s, 0.15, 1.4, darkM); // service doors
    for (let i = 0; i < 9; i++) box(4 + (i % 3), 1.8, 6, -L / 2 + 20 + i * 36, -D / 2 - 4, 14.1, greyM); // rooftop plant
  }
  // main terminal hall far away (curved roof) and a control tower
  {
    const hall = P(330, -120, 0); const roof = new THREE.CylinderGeometry(70, 70, 360, 32); roof.rotateX(Math.PI / 2); roof.scale(1, 0.32, 1);
    add(roof, roofM, V(hall.x, Y + 18, hall.z), [0, yawU, 0]); add(new THREE.BoxGeometry(140, 18, 360), concM, V(hall.x, Y + 9, hall.z), [0, yawU, 0]);
    add(new THREE.PlaneGeometry(360, 12), glassM, P(330, -48, 9), [0, yawU - Math.PI / 2, 0]);
    const tw = P(560, 140, 0);
    add(new THREE.CylinderGeometry(3.4, 4.4, 46, 20), concM, V(tw.x, Y + 23, tw.z)); add(new THREE.CylinderGeometry(7.6, 5.8, 5, 20), glassM, V(tw.x, Y + 48, tw.z)); add(new THREE.CylinderGeometry(8, 8, 1, 20), roofM, V(tw.x, Y + 51, tw.z));
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(80, 22, 60), concM, V(260 + i * 95, Y + 11, -420 - i * 30), [0, 0.5, 0]);
  }

  /* ---------------- jet bridge from the pier to the left forward door ---------------- */
  {
    const rot = P(-6, 7, 0); const cab = V(-3.7, 0, 3.4);
    add(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 20), whiteM, V(rot.x, Y + 5.2, rot.z)); add(new THREE.CylinderGeometry(0.6, 0.6, 3.6, 12), greyM, V(rot.x, Y + 1.8, rot.z));
    add(new THREE.BoxGeometry(3.2, 3.0, 9), greyM, V(rot.x, Y + 5.2, rot.z).addScaledVector(N, -5), [0, Math.atan2(N.x, N.z), 0]);
    const d = cab.clone().setY(0).sub(V(rot.x, 0, rot.z)); const len = d.length() - 2.2, ang = Math.atan2(d.x, d.z);
    const mid = V(rot.x, 0, rot.z).add(d.clone().setLength(len / 2 + 1.0));
    add(new THREE.BoxGeometry(2.9, 2.9, len), greyM, V(mid.x, Y + 4.95, mid.z), [0, ang, 0]);
    add(new THREE.BoxGeometry(3.0, 0.25, len), darkM, V(mid.x, Y + 3.45, mid.z), [0, ang, 0]);
    for (let i = 0; i < 9; i++) { const p = V(rot.x, 0, rot.z).add(d.clone().setLength(2.4 + i * len / 9)); add(new THREE.BoxGeometry(2.95, 0.1, 0.08), metalM, V(p.x, Y + 6.38, p.z), [0, ang, 0]); }
    const wp = V(rot.x, 0, rot.z).add(d.clone().setLength(len * 0.72));
    for (const s of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.5, 3.3, 0.5), greyM, V(wp.x + s * Math.cos(ang), Y + 1.7, wp.z - s * Math.sin(ang)), [0, ang, 0]);
    add(new RoundedBoxGeometry(3.0, 0.6, 1.2, 2, 0.15), darkM, V(wp.x, Y + 0.45, wp.z), [0, ang, 0]);
    add(new RoundedBoxGeometry(3.4, 3.1, 3.0, 2, 0.15), whiteM, V(cab.x - 0.6, Y + 4.95, cab.z), [0, ang, 0]);
    add(new RoundedBoxGeometry(0.6, 3.2, 3.2, 2, 0.2), blackM, V(cab.x + 1.1, Y + 4.95, cab.z), [0, ang * 0.2, 0]);
  }
  // stand guidance display on a pole ahead of the nose (generic)
  const vd = (() => { const { c, x } = TX.canvas(256, 192); x.fillStyle = '#050505'; x.fillRect(0, 0, 256, 192); x.fillStyle = '#ff3a2a'; x.font = `700 64px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STOP', 128, 70); x.fillStyle = '#ffd040'; x.font = `700 40px ${FONT}`; x.fillText('STAND 12', 128, 142); return c; })();
  const vdM = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex(vd), emissiveIntensity: 2.0 })); vdM.position.set(-1.2, Y + 6.2, -24.6); root.add(vdM);
  add(new RoundedBoxGeometry(1.9, 1.5, 0.5, 2, 0.08), blackM, V(-1.2, Y + 6.2, -24.9)); add(new THREE.CylinderGeometry(0.16, 0.2, 5.6, 10), greyM, V(-1.2, Y + 2.8, -25.0));

  /* ---------------- generic parked twin-jets: instanced, three materials ---------------- */
  {
    const parts = { white: [], grey: [], black: [] };
    const put = (geo, k, pos, rot = [0, 0, 0], sc = [1, 1, 1]) => { const g = clean(geo); g.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(...sc))); parts[k].push(g); };
    const prof = []; const Lf = 37; for (let i = 0; i <= 40; i++) { const t = i / 40, z = -Lf / 2 + t * Lf; let r = 1.98; if (t < 0.12) r = 1.98 * Math.sqrt(t / 0.12) * (0.25 + 0.75 * Math.sqrt(t / 0.12)); if (t > 0.78) r = 1.98 * (1 - Math.pow((t - 0.78) / 0.22, 1.6) * 0.82); prof.push(new THREE.Vector2(Math.max(0.05, r), z)); }
    const fus = new THREE.LatheGeometry(prof, 24); fus.rotateX(Math.PI / 2); put(fus, 'white', [0, 3.5, 0], [0, 0, 0], [1, 1.05, 1]);
    put(new THREE.CylinderGeometry(1.99, 1.99, 22, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), 'grey', [0, 3.5, 1], [Math.PI / 2, 0, 0]);
    const wingS = new THREE.Shape(); wingS.moveTo(0, 0); wingS.lineTo(17, 6.5); wingS.lineTo(17, 8.0); wingS.lineTo(0, 6.5); wingS.closePath();
    for (const s of [-1, 1]) {
      const wg = new THREE.ExtrudeGeometry(wingS, { depth: 0.35, bevelEnabled: false }); wg.rotateX(Math.PI / 2); wg.scale(s, 1, 1); if (s < 0) { const p = wg.attributes.position; for (let i = 0; i < p.count; i += 3) { const ax = p.getX(i + 1), ay = p.getY(i + 1), az = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, ax, ay, az); } wg.computeVertexNormals(); }
      put(wg, 'white', [s * 1.4, 2.4, -3], [0, 0, s * 0.09]);
      put(new THREE.CylinderGeometry(1.0, 0.85, 4.2, 16), 'white', [s * 5.8, 1.4, -2.6], [Math.PI / 2, 0, 0]);
      put(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 16), 'black', [s * 5.8, 1.4, -4.72], [Math.PI / 2, 0, 0]);
      put(new THREE.BoxGeometry(6.2, 0.2, 2.8), 'white', [s * 3.4, 4.4, 15.5], [0, s * 0.35, 0]);
    }
    const finS = new THREE.Shape(); finS.moveTo(0, 0); finS.lineTo(5.5, 0); finS.lineTo(7.0, 6.2); finS.lineTo(5.0, 6.2); finS.closePath();
    const fin = new THREE.ExtrudeGeometry(finS, { depth: 0.3, bevelEnabled: false }); put(fin, 'white', [0.15, 5.0, 12.5], [0, -Math.PI / 2, 0]);
    put(new THREE.SphereGeometry(1.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), 'black', [0, 4.55, -15.6], [0, 0, 0], [1, 0.45, 0.9]);
    for (const [x, z] of [[0, -14], [-2.6, 0.5], [2.6, 0.5]]) { put(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), 'black', [x, 0.55, z], [0, 0, Math.PI / 2]); put(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), 'grey', [x, 1.6, z]); }
    // stands: two along the pier (nose towards the facade), two remote stands across the apron
    const nose = Math.atan2(N.x, N.z); const stands = [[P(58, 30), nose], [P(108, 30), nose], [P(158, 30), nose], [P(150, 104), nose + Math.PI - 0.6], [P(225, 104), nose + Math.PI - 0.6]];
    const mats = { white: whiteM, grey: greyM, black: blackM };
    for (const k of Object.keys(parts)) {
      const g = mergeGeometries(parts[k], false); const im = new THREE.InstancedMesh(g, mats[k], stands.length);
      stands.forEach(([p, yaw], i) => im.setMatrixAt(i, new THREE.Matrix4().compose(V(p.x, Y, p.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1))));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im);
    }
  }

  /* ---------------- ground equipment ---------------- */
  const gpu = new THREE.Group(); gpu.position.set(-4.2, Y, -5.5); root.add(gpu);
  { const g = []; const pg = (geo, pos, rot) => { const c = clean(geo); c.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), V(1, 1, 1))); return c; };
    gpu.add(new THREE.Mesh(mergeGeometries([pg(new RoundedBoxGeometry(1.4, 1.1, 2.2, 2, 0.08), [0, 0.85, 0])], false), yellowM));
    gpu.add(new THREE.Mesh(mergeGeometries([[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]].map(([x, z]) => pg(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12), [x, 0.22, z], [0, 0, Math.PI / 2])).concat([clean(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.5, 1.0, 0.6), V(1.6, 0.05, 1.8), V(3.2, 0.05, 3.5), V(4.0, 1.6, 4.4)]), 30, 0.05, 6))]), false), blackM)); }
  const coneM = new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.6 }), tugM = new THREE.MeshStandardMaterial({ color: 0x2c5f8a, roughness: 0.5 }), cartM = new THREE.MeshStandardMaterial({ color: 0x6e7479, roughness: 0.6 }), hangM = new THREE.MeshStandardMaterial({ color: 0xb4bcc2, roughness: 0.7 });
  for (const [x, z] of [[0, -3.6], [-1.2, -3.4], [1.2, -3.4], [-8, 14], [9, 16]]) add(new THREE.ConeGeometry(0.2, 0.7, 12), coneM, V(x, Y + 0.35, z));
  add(new RoundedBoxGeometry(2.0, 1.2, 3.6, 2, 0.15), tugM, V(8.5, Y + 0.9, 4));
  add(new RoundedBoxGeometry(1.2, 1.0, 0.8, 2, 0.1), darkM, V(8.5, Y + 1.9, 4.8));
  for (let i = 0; i < 3; i++) { add(new THREE.BoxGeometry(1.6, 1.4, 2.6), cartM, V(8.5, Y + 1.0, 8 + i * 3.2)); add(new THREE.BoxGeometry(1.8, 0.1, 2.8), greyM, V(8.5, Y + 1.75, 8 + i * 3.2)); }
  // apron light masts along the pier
  const mastPos = [P(10, 46), P(70, 46), P(130, 46), P(190, 46), P(-40, 46)];
  for (const m of mastPos) { add(new THREE.CylinderGeometry(0.25, 0.4, 28, 10), greyM, V(m.x, Y + 14, m.z)); add(new RoundedBoxGeometry(3.4, 0.9, 1.2, 2, 0.2), darkM, V(m.x, Y + 28.4, m.z)); }

  /* ---------------- our own nose, wipers, fuselage skin under the side windows ---------------- */
  {
    const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.max(0.02, 2.0 * Math.pow(t, 0.55)), -3.0 + t * 3.0)); }
    const nose = new THREE.LatheGeometry(prof, 32); nose.rotateX(Math.PI / 2); const nm = new THREE.Mesh(nose, whiteM); nm.position.set(0, 0.55, -1.1); nm.scale.set(0.98, 0.78, 1); root.add(nm);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.02, 0.012, 0.62), blackM, V(s * 0.38, 1.07, -1.13), [0, s * 1.35, 0.2]); add(new THREE.BoxGeometry(0.035, 0.02, 0.5), blackM, V(s * 0.40, 1.06, -1.14), [0, s * 1.35, 0.2]); }
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: 0.4, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(2.0, 2.0, 4.0, 24, 1, true, s > 0 ? Math.PI * 0.55 : Math.PI * 1.05, Math.PI * 0.4); const m = new THREE.Mesh(g, skin); m.rotation.x = Math.PI / 2; m.position.set(0, 0.3, 1.3); root.add(m); }
  }

  /* ---------------- tree line on the horizon (instanced) ---------------- */
  {
    const n = 420, g = new THREE.IcosahedronGeometry(1, 0); const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x3a4a2e, roughness: 1, flatShading: true }), n); const r = TX.rng(77); const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = 1500 + r() * 1400; const h = 8 + r() * 12; m4.compose(V(Math.sin(a) * d, Y + h * 0.55, Math.cos(a) * d), new THREE.Quaternion(), V(h * (0.6 + r() * 0.7), h, h * (0.6 + r() * 0.7))); im.setMatrixAt(i, m4); }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im);
  }

  /* ---------------- light rows: taxiway edge (blue) and centreline (green), runway (white / threshold), apron floods ---------------- */
  const pts = [], cols = [];
  const lp = (p, c) => { pts.push(p.x, Y + 0.35, p.z); cols.push(...c); };
  for (let s = -500; s <= 1100; s += 30) { lp(P(s, TWY - 11.8), [0.25, 0.45, 1.6]); lp(P(s, TWY + 11.8), [0.25, 0.45, 1.6]); }
  for (let s = -500; s <= 1100; s += 15) lp(P(s, TWY), [0.3, 1.5, 0.45]);
  for (let s = -1400; s <= 2000; s += 60) { lp(P(s, RWY - 23), [1.5, 1.42, 1.25]); lp(P(s, RWY + 23), [1.5, 1.42, 1.25]); }
  for (let s = -1400; s <= 2000; s += 15) lp(P(s, RWY), [1.4, 1.35, 1.25]);
  for (let k = -20; k <= 20; k += 2.5) lp(P(-1410, RWY + k), [0.3, 1.6, 0.4]);
  for (let i = 1; i <= 25; i++) for (let k = -12; k <= 12; k += 3) lp(P(-1410 - i * 30, RWY + k), [1.6, 1.5, 1.3]);
  const lightsGeo = new THREE.BufferGeometry(); lightsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); lightsGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const lightsMat = new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })() });
  const lights = new THREE.Points(lightsGeo, lightsMat); lights.frustumCulled = false; root.add(lights);
  // apron flood heads (glow) + two real spot lights near our stand
  const headGeo = new THREE.BufferGeometry(); headGeo.setAttribute('position', new THREE.Float32BufferAttribute(mastPos.flatMap(m => [m.x, Y + 28, m.z]), 3));
  const headMat = new THREE.PointsMaterial({ size: 16, sizeAttenuation: false, color: new THREE.Color(0, 0, 0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: lightsMat.map });
  const heads = new THREE.Points(headGeo, headMat); heads.frustumCulled = false; root.add(heads);
  const spots = [];
  for (const m of [mastPos[0], mastPos[4]]) { const sp = new THREE.SpotLight(0xffe1b0, 0, 120, 0.8, 0.6, 1.6); sp.position.set(m.x, Y + 28, m.z); sp.target.position.set(m.x * 0.3, Y, m.z * 0.3 + 4); root.add(sp, sp.target); spots.push(sp); }
  // stars (night only)
  const starGeo = new THREE.BufferGeometry(); { const r = TX.rng(9), a = [], cl = []; for (let i = 0; i < 900; i++) { const u = r() * Math.PI * 2, v = Math.asin(0.14 + r() * 0.86); a.push(Math.cos(v) * Math.sin(u) * 2700, Math.sin(v) * 2700, Math.cos(v) * Math.cos(u) * 2700); const b = Math.pow(r(), 3) * 0.9 + 0.08; cl.push(b, b, b * 1.08); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); starGeo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); }
  const starMat = new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, color: new THREE.Color(0, 0, 0), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; root.add(stars);

  for (const [mat, list] of merged) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); }

  /* night factor k (0 day … 1 night): glazing, floodlights, light rows, stars */
  function setNight(k) {
    glassM.emissiveIntensity = 0.95 * k;
    for (const sp of spots) sp.intensity = 900 * k;
    headMat.color.setRGB(7 * k, 6.2 * k, 4.8 * k);
    lightsMat.opacity = 0.35 + 0.65 * k; lightsMat.size = 2.5 + 2.5 * k; lightsMat.color = new THREE.Color(1, 1, 1).multiplyScalar(1 + 5 * k * k);
    starMat.color.setRGB(1.6 * Math.max(0, k - 0.7) / 0.3, 1.6 * Math.max(0, k - 0.7) / 0.3, 1.7 * Math.max(0, k - 0.7) / 0.3);
  }
  setNight(0);
  return { root, gpu, setNight, stars, update(sys) { gpu.visible = sys.st.elec.extAvail; } };
}
