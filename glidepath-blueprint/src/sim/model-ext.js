/* High-fidelity C172-class exterior, built in code. Units metres; nose = -z, up = +y, ground contact at y = -1.45.
   Length 8.28 m (spinner to rudder), span 11.0 m, height 2.72 m, high wing with 1.7° dihedral, tapered outer panels. */
import { THREE } from '../core.js';
import * as TX from './textures.js';

const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ================= fuselage ================= */
// z, half width, waist y, top y, bottom y, top exponent, bottom exponent
const ST = [
  [-2.50, 0.30, -0.24, 0.00, -0.52, 2.2, 2.2], [-2.36, 0.40, -0.24, 0.05, -0.63, 2.4, 2.4], [-2.05, 0.47, -0.25, 0.10, -0.72, 2.6, 2.6],
  [-1.65, 0.50, -0.25, 0.13, -0.78, 2.8, 2.6], [-1.30, 0.52, -0.24, 0.15, -0.82, 3.0, 2.8], [-1.00, 0.545, -0.20, 0.27, -0.87, 3.0, 2.8],
  [-0.66, 0.56, -0.16, 0.41, -0.91, 3.2, 3.0], [0.00, 0.56, -0.15, 0.43, -0.92, 3.4, 3.0], [0.55, 0.555, -0.14, 0.43, -0.90, 3.4, 3.0],
  [1.00, 0.52, -0.11, 0.41, -0.85, 3.0, 2.8], [1.60, 0.42, -0.06, 0.33, -0.70, 2.6, 2.6], [2.40, 0.31, 0.00, 0.26, -0.48, 2.4, 2.4],
  [3.30, 0.21, 0.05, 0.22, -0.27, 2.2, 2.2], [4.20, 0.13, 0.08, 0.20, -0.09, 2.1, 2.1], [4.85, 0.07, 0.10, 0.18, 0.00, 2.0, 2.0], [5.02, 0.015, 0.10, 0.13, 0.06, 2.0, 2.0]
];
const Z0 = ST[0][0], Z1 = ST[ST.length - 1][0];
// monotone cubic interpolation of each column vs z
const cols = ST[0].length;
const slopes = []; for (let k = 1; k < cols; k++) {
  const n = ST.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ST[i + 1][k] - ST[i][k]) / (ST[i + 1][0] - ST[i][0]));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]);
  m[0] = d[0]; m[n - 1] = d[n - 2]; slopes[k] = m;
}
export function station(z) {
  z = clamp(z, Z0, Z1); let i = 0; while (i < ST.length - 2 && z > ST[i + 1][0]) i++;
  const a = ST[i], b = ST[i + 1], h = b[0] - a[0], t = (z - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const out = [z];
  for (let k = 1; k < cols; k++) out.push((2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * h * slopes[k][i] + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * h * slopes[k][i + 1]);
  return out;
}
export function ringPt(st, th) {
  const [z, hw, ym, top, bot, et, eb] = st, s = Math.sin(th), c = Math.cos(th), e = c >= 0 ? et : eb;
  return [Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * hw, c >= 0 ? ym + Math.pow(c, 2 / e) * (top - ym) : ym - Math.pow(-c, 2 / e) * (ym - bot), z];
}
/** window id at a surface point (0 = metal) */
export function windowAt(z, th, x, y) {
  const a = Math.abs(((th + Math.PI) % (2 * Math.PI)) - Math.PI);           // 0 = top
  // A-pillar: slopes from the glareshield corner (y 0.05, z -1.05) up to the wing root leading edge (y 0.38, z -0.68)
  const zA = -1.05 + (clamp(y, 0.05, 0.38) - 0.05) * 1.12, side = Math.abs(x) > 0.3;
  if (z > -1.24 && z < -0.7 && a < 1.3 + Math.max(0, z + 1.0) * 0.6 && (!side || z < zA - 0.02)) return 1;   // windscreen
  if (side && z > zA + 0.045 && z < 0.4 && y > -0.1 && y < 0.37) return 2;                                     // door windows, back to the door post
  if (Math.abs(x) > 0.24 && z > 0.48 && z < 1.3 && y > -0.05 && y < 0.33 - (z - 0.48) * 0.16) return 3;            // rear side windows
  if (z > 1.08 && z < 1.85 && a < 0.72 - (z - 1.08) * 0.2) return 4;           // rear (omni-vision) window
  return 0;
}
const NZ = 170, NT = 120;
function zAt(u) { return Z0 + (Z1 - Z0) * u; }

/** fuselage livery, panel-line normal map and roughness, painted in surface space */
function fuselageTextures() {
  const W = 2048, H = 1024;
  const col = TX.canvas(W, H), img = col.x.createImageData(W, H), cd = img.data;
  const rough = TX.canvas(W, H), rimg = rough.x.createImageData(W, H), rd = rimg.data;
  const Hgt = new Float32Array(W * H);
  const stCache = []; for (let i = 0; i < W; i++) stCache.push(station(zAt((i + 0.5) / W)));
  const MAG = [0.62, 0.07, 0.33], INK = [0.07, 0.11, 0.15], WHITE = [0.95, 0.955, 0.95];
  const stripeY = z => -0.36 + 0.26 * sstep(-1.5, 4.9, z);
  const seamsZ = [-1.30, -0.66, 0.45, 1.02, 2.0, 3.0, 4.0];
  for (let j = 0; j < H; j++) {
    const th = (j + 0.5) / H * Math.PI * 2;
    for (let i = 0; i < W; i++) {
      const st = stCache[i], [x, y, z] = ringPt(st, th);
      let c = WHITE.slice(), r = 0.32, h = 0.5;
      // livery: magenta sweep + ink pinstripe on the sides, ink belly band at the cowl
      const sy = stripeY(z);
      if (z > -2.3 && y > sy && y < sy + 0.085 + 0.03 * sstep(2, 4.9, z)) c = MAG.slice();
      else if (z > -2.3 && y > sy - 0.045 && y < sy - 0.025) c = INK.slice();
      // door outline + seams (grooves) and rivet rows
      const ax = Math.abs(x);
      for (const sz of seamsZ) { const d = Math.abs(z - sz); if (d < 0.004) h -= 0.5; else if (Math.abs(d - 0.018) < 0.003 && (j % 9) < 2) h += 0.45; }
      if (ax > 0.3) {
        const inZ = z > -0.66 && z < 0.45, inY = y > -0.84 && y < 0.42;
        if (inZ && inY && (Math.abs(z + 0.66) < 0.004 || Math.abs(z - 0.45) < 0.004 || Math.abs(y + 0.84) < 0.004)) h -= 0.6;
      }
      if (z < -1.3 && Math.abs(y + 0.24) < 0.004) h -= 0.5;                       // cowl split line
      if (z > 1.0 && ((Math.abs(y - st[2]) < 0.004) || (ax < 0.03 && y < 0) )) h -= 0.3; // tail-cone seams
      if (z > 1.0 && (i % 11) < 2 && Math.abs(((y - st[2]) * 4) % 1) < 0.02) h += 0.35;   // stringer rivets
      // windows: rubber frames
      const w0 = windowAt(z, th, x, y);
      if (!w0) { const d = 0.022; if (windowAt(z + d, th, x, y) || windowAt(z - d, th, x, y) || windowAt(z, th, x, y + d) || windowAt(z, th, x, y - d)) { c = [0.05, 0.055, 0.06]; r = 0.6; h -= 0.15; } }
      else { c = [0.08, 0.1, 0.12]; r = 0.1; }
      // exhaust soot (right side under the cowl, streaking aft) and belly oil film
      if (x > 0 && y < -0.5) { const s = Math.exp(-Math.pow((y + 0.78) / 0.12, 2)) * sstep(-1.75, -1.5, z) * (1 - sstep(-1.2, 1.4, z)); c = c.map(v => v * (1 - 0.55 * s)); r += 0.35 * s; }
      if (y < -0.8) { const s = 0.25 * sstep(-1.6, -0.6, z) * (1 - sstep(0.5, 2.5, z)); c = c.map(v => v * (1 - s)); r += 0.2 * s; }
      const k = (j * W + i) * 4; cd[k] = c[0] * 255; cd[k + 1] = c[1] * 255; cd[k + 2] = c[2] * 255; cd[k + 3] = 255;
      rd[k] = rd[k + 1] = rd[k + 2] = clamp(r, 0, 1) * 255; rd[k + 3] = 255;
      Hgt[j * W + i] = h;
    }
  }
  col.x.putImageData(img, 0, 0); rough.x.putImageData(rimg, 0, 0);
  const nrm = TX.heightToNormal(Hgt, W, H, 3, false);
  const map = TX.tex(col.c, { aniso: 8 }), nmap = TX.tex(nrm, { srgb: false }), rmap = TX.tex(rough.c, { srgb: false });
  return { map, nmap, rmap };
}

function fuselageGeometry(glass) {
  const pos = [], nrmA = [], uv = [], col = [], idx = [], gpos = [], guv = [], gidx = [];
  const grid = [];
  for (let i = 0; i <= NZ; i++) {
    const u = i / NZ, st = station(zAt(u)); const row = [];
    for (let j = 0; j <= NT; j++) { const th = j / NT * Math.PI * 2; const p = ringPt(st, th); row.push({ p, th, z: p[2] }); }
    grid.push(row);
  }
  for (let i = 0; i <= NZ; i++) for (let j = 0; j <= NT; j++) {
    const { p } = grid[i][j]; pos.push(...p); uv.push(i / NZ, 1 - j / NT);
    // baked AO: belly, wing root shadow, strut roots, tail cone underside
    const [x, y, z] = p;
    let ao = 1 - 0.18 * sstep(-0.4, -0.9, y) - 0.25 * sstep(0.32, 0.43, y) * sstep(-0.75, -0.55, z) * (1 - sstep(0.95, 1.15, z)) - 0.15 * Math.exp(-Math.pow((y + 0.66) / 0.08, 2) - Math.pow((z + 0.25) / 0.2, 2)) * sstep(0.4, 0.55, Math.abs(x));
    col.push(ao, ao, ao);
  }
  const cell = (i, j) => { const a = grid[i][j], b = grid[i + 1][j + 1]; const z = (a.z + b.z) / 2, th = (a.th + b.th) / 2; const p = ringPt(station(z), th); return windowAt(z, th, p[0], p[1]); };
  const W1 = NT + 1;
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NT; j++) {
    const k = i * W1 + j, w = cell(i, j);
    if (!w) idx.push(k, k + W1, k + 1, k + 1, k + W1, k + W1 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // repair normals so the window edges stay smooth: use the full-surface normals
  const full = new THREE.BufferGeometry(); full.setAttribute('position', g.attributes.position); const fi = []; for (let i = 0; i < NZ; i++) for (let j = 0; j < NT; j++) { const k = i * W1 + j; fi.push(k, k + W1, k + 1, k + 1, k + W1, k + W1 + 1); } full.setIndex(fi); full.computeVertexNormals();
  g.setAttribute('normal', full.attributes.normal);
  // glass: window cells (+ one-cell margin), pushed out along the normal
  const N = full.attributes.normal, P = g.attributes.position, map = new Map();
  const near = (i, j) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a, jj = (j + b + NT) % NT; if (ii >= 0 && ii < NZ && cell(ii, jj)) return cell(ii, jj); } return 0; };
  const vtx = k => { if (map.has(k)) return map.get(k); const id = gpos.length / 3; gpos.push(P.getX(k) + N.getX(k) * 0.005, P.getY(k) + N.getY(k) * 0.005, P.getZ(k) + N.getZ(k) * 0.005); guv.push(P.getZ(k), P.getY(k)); map.set(k, id); return id; };
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NT; j++) {
    if (!near(i, j)) continue; const k = i * W1 + j;
    const a = vtx(k), b = vtx(k + W1), c = vtx(k + 1), d = vtx(k + W1 + 1); gidx.push(a, b, c, c, b, d);
  }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2)); gg.setIndex(gidx); gg.computeVertexNormals();
  return { g, glass: gg };
}

/* ================= lifting surfaces ================= */
function nacaPts(n, t, m, p, closeTE = true) { // returns [{f, yu, yl}]
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = (1 - Math.cos(Math.PI * i / n)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(f) - 0.126 * f - 0.3516 * f * f + 0.2843 * f ** 3 - (closeTE ? 0.1036 : 0.1015) * f ** 4);
    const yc = m ? (f < p ? m / (p * p) * (2 * p * f - f * f) : m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * f - f * f)) : 0;
    out.push({ f, yu: yc + yt, yl: yc - yt });
  }
  return out;
}
/** loft a surface between spanwise stations. st: {o (Vector3 leading edge), c (chord), tw (rad, nose-up), span axis 'x' or 'y'}
    profile fraction range f0..f1; returns BufferGeometry with uv (span metres, chord fraction) */
function surface(stations, { t = 0.12, m = 0.02, p = 0.4, f0 = 0, f1 = 1, vertical = false, n = 26, capEnds = true } = {}) {
  const prof = nacaPts(n, t, m, p).filter(q => q.f >= f0 - 1e-6 && q.f <= f1 + 1e-6);
  if (prof[0].f > f0 + 1e-4) prof.unshift({ f: f0, yu: prof[0].yu, yl: prof[0].yl });
  const loop = [...prof.map(q => [q.f, q.yu]), ...prof.slice().reverse().map(q => [q.f, q.yl])];
  const M = loop.length, pos = [], uv = [], idx = [];
  stations.forEach((s, si) => {
    for (const [f, yy] of loop) {
      const df = (f - 0.25) * s.c, cz = Math.cos(s.tw), sz = Math.sin(s.tw);
      const along = df * cz + yy * s.c * sz, up = -df * sz + yy * s.c * cz;  // rotate about quarter chord, nose up
      const base = s.o.clone(); base.z += 0.25 * s.c;
      if (!vertical) pos.push(base.x, base.y + up, base.z + along); else pos.push(base.x + up, base.y, base.z + along);
      uv.push(vertical ? s.o.y : s.o.x, f);
    }
  });
  for (let si = 0; si < stations.length - 1; si++) for (let j = 0; j < M - 1; j++) { const a = si * M + j; idx.push(a, a + M, a + 1, a + 1, a + M, a + M + 1); }
  if (capEnds) { const cap = (o, fl) => { for (let j = 1; j < M - 1; j++) fl ? idx.push(o, o + j + 1, o + j) : idx.push(o, o + j, o + j + 1); }; cap(0, false); cap((stations.length - 1) * M, true); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function wingNormalMap() {
  const W = 512, H = 256, Hm = new Float32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let h = 0.5; const u = i / W, v = j / H;
    if (Math.abs((u * 3) % 1 - 0.5) > 0.49) h -= 0.3;                                     // rib rows (3 per metre)
    if (Math.abs((u * 3) % 1 - 0.5) > 0.47 && (j % 6) < 2) h += 0.35;
    for (const sp of [0.12, 0.27, 0.72]) { if (Math.abs(v - sp) < 0.004) h -= 0.3; if (Math.abs(v - sp) < 0.012 && (i % 7) < 2) h += 0.3; }
    Hm[j * W + i] = h;
  }
  const t = TX.tex(TX.heightToNormal(Hm, W, H, 2.5), { srgb: false }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* ================= exterior ================= */
export function buildExterior() {
  const root = new THREE.Group(), all = new THREE.Group(); root.add(all);
  const FT = fuselageTextures(), wingN = wingNormalMap();
  const paint = new THREE.MeshPhysicalMaterial({ map: FT.map, normalMap: FT.nmap, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: FT.rmap, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07, vertexColors: true });
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f2, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, normalMap: wingN, normalScale: new THREE.Vector2(0.35, 0.35) });
  const whiteS = white.clone(); whiteS.side = THREE.DoubleSide;
  const mag = new THREE.MeshPhysicalMaterial({ color: 0x9e1f63, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  const ink = new THREE.MeshPhysicalMaterial({ color: 0x12202a, roughness: 0.35, clearcoat: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.7 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.92 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb4bbc0, roughness: 0.38, metalness: 1, envMapIntensity: 0.6 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xaab2b8, roughness: 0.4, metalness: 0.9 });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x2a3a44, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide, depthWrite: false });
  const glows = [];

  // fuselage + glass
  const FG = fuselageGeometry();
  const fus = new THREE.Mesh(FG.g, paint); fus.castShadow = fus.receiveShadow = true; all.add(fus);
  const glass = new THREE.Mesh(FG.glass, glassM); glass.renderOrder = 2; all.add(glass); glows.push(glass);

  // spinner
  const spProf = []; for (let i = 0; i <= 16; i++) { const t = i / 16; spProf.push(new THREE.Vector2(0.185 * Math.sqrt(Math.max(0, 1 - Math.pow(1 - t, 2.2))), -0.36 * (1 - t))); }
  const spinner = new THREE.Mesh(new THREE.LatheGeometry(spProf, 40), new THREE.MeshPhysicalMaterial({ color: 0xf2f3f2, roughness: 0.25, clearcoat: 1 }));
  spinner.rotation.x = -Math.PI / 2; spinner.position.set(0, -0.22, -2.5); spinner.castShadow = true; all.add(spinner);
  const bulk = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 40), alu); bulk.rotation.x = Math.PI / 2; bulk.position.set(0, -0.22, -2.505); all.add(bulk);
  // cowl intakes, landing gear well, exhaust, oil door, air filter
  for (const sx of [-1, 1]) { const intake = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 6, 16), dark); intake.rotation.z = Math.PI / 2; intake.scale.set(1, 1, 0.3); intake.position.set(sx * 0.21, -0.27, -2.47); all.add(intake); }
  const filt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.04), dark); filt.position.set(0, -0.52, -2.43); all.add(filt);
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.26, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x5a4a40, roughness: 0.55, metalness: 0.7, side: THREE.DoubleSide })); exh.position.set(0.24, -0.79, -1.62); exh.rotation.x = 1.1; all.add(exh);
  const oil = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0xe8e9e8, roughness: 0.4 })); oil.position.set(0, 0.1, -1.95); oil.rotation.x = -Math.PI / 2 + 0.1; all.add(oil);

  /* --- wing --- */
  const TE = 1.01, wy = x => 0.47 + Math.abs(x) * Math.tan(1.73 * D2R);
  const chord = x => { const a = Math.abs(x); return a <= 2.6 ? 1.63 : 1.63 - (a - 2.6) / 2.85 * 0.51; };
  const twist = x => (1.5 - 3 * sstep(0.6, 5.4, Math.abs(x))) * D2R;
  const ws = x => ({ o: V(x, wy(x), TE - chord(x)), c: chord(x), tw: twist(x) });
  const wing = new THREE.Group(); all.add(wing);
  const panels = [[0, 0.62, 1], [0.62, 2.75, 0.725], [2.75, 2.85, 1], [2.85, 5.05, 0.745], [5.05, 5.42, 1]];
  for (const sd of [-1, 1]) for (const [a, b, f] of panels) {
    const xs = []; const n = Math.max(1, Math.ceil(Math.abs(b - a) / 0.5)); for (let i = 0; i <= n; i++) xs.push(sd * (a + (b - a) * i / n));
    if (sd < 0) xs.reverse();
    const g = surface(xs.map(ws), { f1: f });
    const m = new THREE.Mesh(g, white); m.castShadow = m.receiveShadow = true; wing.add(m);
  }
  // rounded tips
  for (const sd of [-1, 1]) {
    const st = []; for (let k = 0; k <= 4; k++) { const x = sd * (5.42 + 0.08 * k / 4), s = ws(x), sc = Math.cos(k / 4 * Math.PI / 2); st.push({ o: V(x, s.o.y, s.o.z + (1 - sc) * 0.12), c: s.c - (1 - sc) * 0.24, tw: s.tw }); }
    if (sd < 0) st.reverse();
    const tip = new THREE.Mesh(surface(st, { t: 0.12 }), white); tip.scale.set(1, 1, 1); tip.castShadow = true; wing.add(tip);
    const hous = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0, transparent: true, opacity: 0.45, roughness: 0.05 }));
    hous.rotation.z = -sd * Math.PI / 2; hous.position.set(sd * 5.5, wy(5.5) + 0.02, TE - chord(5.5) + 0.12); hous.scale.set(1, 1, 2.2); all.add(hous);
  }
  const hinged = (stations, f0, opt = {}) => {
    const s0 = stations[0], s1 = stations[stations.length - 1];
    const h0 = V(s0.o.x, s0.o.y, s0.o.z + f0 * s0.c), h1 = V(s1.o.x, s1.o.y, s1.o.z + f0 * s1.c);
    const g = surface(stations, { f0, ...opt }); g.translate(-h0.x, -h0.y, -h0.z);
    const mesh = new THREE.Mesh(g, opt.mat || white); mesh.castShadow = true;
    const piv = new THREE.Group(); piv.position.copy(h0); piv.add(mesh); const axis = h1.clone().sub(h0).normalize();
    piv.userData = { axis, h0: h0.clone(), setAngle(a, slide = 0) { piv.quaternion.setFromAxisAngle(axis, a); piv.position.copy(h0).add(V(0, -slide * 0.4, slide)); } };
    return piv;
  };
  const span = (a, b, n = 3) => { const xs = []; for (let i = 0; i <= n; i++) xs.push(a + (b - a) * i / n); return xs.map(ws); };
  const flapL = hinged(span(-2.75, -0.62), 0.725), flapR = hinged(span(0.62, 2.75), 0.725);
  const ailL = hinged(span(-5.05, -2.85), 0.745), ailR = hinged(span(2.85, 5.05), 0.745);
  wing.add(flapL, flapR, ailL, ailR);
  // fuel caps, stall warning inlet, pitot, lights in the left wing
  for (const sd of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 20), alu); cap.position.set(sd * 1.9, wy(1.9) + 0.105, -0.25); all.add(cap); }
  const stallW = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), dark); stallW.position.set(-1.65, wy(1.65) + 0.005, TE - chord(1.65) - 0.004); all.add(stallW);
  const pitot = new THREE.Group(); const pt1 = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8), steel); pt1.position.y = -0.08; const pt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), steel); pt2.rotation.x = Math.PI / 2; pt2.position.set(0, -0.16, -0.06); pitot.add(pt1, pt2); pitot.position.set(-3.7, wy(3.7) - 0.03, TE - chord(3.7) + 0.35); all.add(pitot);
  const lensM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0.02 });
  for (const [x] of [[-2.3], [-2.55]]) { const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), lensM); lens.position.set(x, wy(2.4) + 0.03, TE - chord(2.4) - 0.01); lens.rotation.y = Math.PI; all.add(lens); }

  // streamlined struts with fairings
  for (const sd of [-1, 1]) {
    const a = V(sd * 0.55, -0.64, -0.22), b = V(sd * 2.55, wy(2.55) + 0.02, -0.25), dir = b.clone().sub(a), L = dir.length();
    const g = new THREE.CylinderGeometry(1, 1, L, 20, 1); g.scale(0.022, 1, 0.06);
    const st = new THREE.Mesh(g, white); st.position.copy(a).lerp(b, 0.5); st.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize()); st.castShadow = true; all.add(st);
    for (const [p, s] of [[a, 1], [b, 1]]) { const fr = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), white); fr.scale.set(0.045, 0.07, 0.11); fr.position.copy(p); fr.castShadow = true; all.add(fr); }
  }

  /* --- tail --- */
  const hs = x => { const a = Math.abs(x); return { o: V(x, 0.12, 3.98 + a * 0.18), c: 1.3 - a * 0.21, tw: 0 }; };
  for (const sd of [-1, 1]) { const xs = [0.04, 0.6, 1.2, 1.72].map(v => sd * v); if (sd < 0) xs.reverse(); const m = new THREE.Mesh(surface(xs.map(hs), { t: 0.09, m: 0, f1: 0.62 }), white); m.castShadow = true; all.add(m); }
  const elevL = hinged([-1.72, -1.2, -0.6, -0.04].map(hs), 0.62, { t: 0.09, m: 0 }), elevR = hinged([0.04, 0.6, 1.2, 1.72].map(hs), 0.62, { t: 0.09, m: 0 });
  all.add(elevL, elevR);
  const tabPiv = new THREE.Group(); const tab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.09), mag); tab.position.set(0, 0, 0.045); tabPiv.add(tab);
  { const h0 = elevR.userData.h0; const s = hs(0.55); tabPiv.position.set(0.55 - h0.x, 0, s.o.z + s.c - h0.z - 0.005); elevR.children[0].add(tabPiv); }
  // fin (vertical surface), dorsal fillet, rudder
  const fs = y => { const t = (y - 0.2) / 1.05; return { o: V(0, y, 3.72 + t * 0.95), c: (4.94 - 3.72) - t * (0.95 - 0.02), tw: 0 }; };
  const fin = new THREE.Mesh(surface([0.15, 0.6, 1.0, 1.25].map(fs), { t: 0.1, m: 0, vertical: true }), white); fin.castShadow = true; all.add(fin);
  const dorsal = new THREE.Shape(); dorsal.moveTo(2.15, 0.25); dorsal.quadraticCurveTo(3.2, 0.3, 3.85, 0.62); dorsal.lineTo(3.85, 0.2); dorsal.lineTo(2.15, 0.2);
  const dg = new THREE.ExtrudeGeometry(dorsal, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }); dg.rotateY(-Math.PI / 2); dg.translate(0.025, 0, 0);
  const dors = new THREE.Mesh(dg, white); dors.castShadow = true; all.add(dors);
  const rs = new THREE.Shape(); rs.moveTo(0, -0.05); rs.lineTo(0.5, -0.02); rs.lineTo(0.42, 1.12); rs.quadraticCurveTo(0.2, 1.32, -0.12, 1.27); rs.lineTo(-0.1, 1.08); rs.lineTo(0, 1.05); rs.lineTo(0, -0.05);
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }); rg.rotateY(-Math.PI / 2); rg.translate(0.0225, 0, 0);
  const rud = new THREE.Mesh(rg, mag); rud.castShadow = true; const rudPiv = new THREE.Group(); rudPiv.position.set(0, 0.17, 4.94); rudPiv.add(rud); all.add(rudPiv);
  const rudAxis = V(0, 1, 0.02).normalize();
  // registration decal (clearly fictional) on both sides of the fin
  const regC = TX.decal(512, 160, (x, w, h) => { x.fillStyle = '#12202a'; x.font = '700 118px "Barlow Condensed", "Arial Narrow", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('GP-172', w / 2, h / 2 + 6); });
  const regT = TX.tex(regC);
  for (const sd of [-1, 1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.19), new THREE.MeshPhysicalMaterial({ map: regT, transparent: true, roughness: 0.3, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); d.rotation.y = sd * Math.PI / 2; d.position.set(sd * 0.05, 0.52, 4.42); d.rotation.z = 0; all.add(d); }

  /* --- landing gear --- */
  const wheel = (r, wdt) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.3, 14, 32), tyre); t.rotation.y = Math.PI / 2; g.add(t); const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.42, r * 0.42, wdt, 24), alu); hub.rotation.z = Math.PI / 2; g.add(hub); return g; };
  const pant = (len, wdt, hgt) => { const p = []; for (let i = 0; i <= 18; i++) { const t = i / 18; p.push(new THREE.Vector2(Math.max(0.001, Math.sin(Math.PI * Math.pow(t, 0.75)) * 1), (t - 0.45) * 1)); } const g = new THREE.LatheGeometry(p, 28); g.rotateX(Math.PI / 2); g.scale(wdt, hgt, len); return g; };
  for (const sd of [-1, 1]) {
    const a = V(sd * 0.48, -0.86, 0.35), b = V(sd * 1.22, -1.17, 0.35), dir = b.clone().sub(a);
    const lg = new THREE.CylinderGeometry(1, 1, dir.length(), 4, 1); lg.rotateY(Math.PI / 4); lg.scale(0.045, 1, 0.014);
    const leg = new THREE.Mesh(lg, white); leg.position.copy(a).lerp(b, 0.5); leg.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); leg.castShadow = true; all.add(leg);
    const wh = wheel(0.24, 0.15); wh.position.set(sd * 1.27, -1.21, 0.35); all.add(wh);
    const pg = new THREE.Mesh(pant(0.95, 0.13, 0.24), pgMat());
    pg.position.set(sd * 1.27, -1.14, 0.32); pg.castShadow = true; all.add(pg);
    const stripe = new THREE.Mesh(pant(0.951, 0.1305, 0.06), mag); stripe.position.set(sd * 1.27, -1.08, 0.32); all.add(stripe);
    if (sd < 0) { const step = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.8 })); step.position.copy(a).lerp(b, 0.35).add(V(0, 0, 0.02)); all.add(step); }
  }
  const oleo = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.38, 16), steel); oleo.position.set(0, -0.98, -1.58); oleo.rotation.x = -0.08; all.add(oleo);
  const oleoF = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.32, 16), white); oleoF.position.set(0, -0.72, -1.6); oleoF.scale.set(1, 1, 1.6); oleoF.castShadow = true; all.add(oleoF);
  const torque = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.06), alu); torque.position.set(0, -1.05, -1.5); torque.rotation.x = 0.4; all.add(torque);
  const nw = wheel(0.19, 0.11); nw.position.set(0, -1.26, -1.55); all.add(nw);
  const npant = new THREE.Mesh(pant(0.72, 0.1, 0.2), pgMat()); npant.position.set(0, -1.19, -1.57); npant.castShadow = true; all.add(npant);
  function pgMat() { return new THREE.MeshPhysicalMaterial({ color: 0xf2f3f2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }); }

  /* --- doors: handles and hinges; antennas --- */
  for (const sd of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.07, 4, 8), steel); h.rotation.x = Math.PI / 2; h.position.set(sd * 0.565, -0.2, 0.36); all.add(h);
    for (const y of [-0.55, 0.15]) { const hg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), alu); hg.position.set(sd * 0.565, y, -0.64); all.add(hg); }
  }
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.6, 6), dark); whip.position.set(0, 0.62, 1.55); whip.rotation.x = 0.55; all.add(whip);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.12), ink); blade.position.set(0, 0.42, 2.2); blade.rotation.x = 0.35; all.add(blade);
  const gps = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), ink); gps.scale.set(1, 0.4, 1.4); gps.position.set(0, 0.565, 0.55); all.add(gps);
  for (const sd of [-1, 1]) { const vor = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), steel); vor.position.set(sd * 0.2, 1.1, 4.62); vor.rotation.z = -sd * 1.2; vor.rotation.x = 0.4; all.add(vor); }
  // prop: two twisted blades
  const prop = new THREE.Group(); prop.position.set(0, -0.22, -2.56); all.add(prop);
  const bladeM = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.45, metalness: 0.3, transparent: true, opacity: 1 });
  const tipM = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5, transparent: true, opacity: 1 });
  const bladeGeo = (from, to) => { const sts = []; for (let i = 0; i <= 10; i++) { const r = from + (to - from) * i / 10, rr = r / 0.95; const c = 0.065 + 0.075 * Math.pow(Math.sin(Math.PI * Math.min(1, (rr - 0.08) / 0.98)), 0.7) * (rr > 0.9 ? Math.sqrt(Math.max(0.05, (1 - rr) / 0.1)) : 1); const beta = Math.atan(1.35 / (2 * Math.PI * Math.max(0.12, r))); sts.push({ o: V(0, r, -c * 0.4), c, tw: beta }); } return surface(sts, { t: 0.1, m: 0.03, vertical: true, n: 14 }); };
  for (const a of [0, Math.PI]) { const g = new THREE.Group(); g.rotation.z = a; const b1 = new THREE.Mesh(bladeGeo(0.14, 0.86), bladeM); const b2 = new THREE.Mesh(bladeGeo(0.86, 0.95), tipM); [b1, b2].forEach(m => { m.rotation.y = Math.PI / 2; m.castShadow = true; g.add(m); }); prop.add(g); }
  const discT = TX.tex(TX.decal(256, 256, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(40,42,45,0.0)'); g.addColorStop(0.3, 'rgba(40,42,45,0.35)'); g.addColorStop(0.88, 'rgba(40,42,45,0.25)'); g.addColorStop(0.9, 'rgba(242,194,48,0.55)'); g.addColorStop(1, 'rgba(242,194,48,0.0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.96, 64), new THREE.MeshStandardMaterial({ map: discT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7 })); disc.position.set(0, -0.22, -2.555); all.add(disc); glows.push(disc);

  /* --- lights --- */
  const lamps = []; const lamp = (c, p, r = 0.03) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) })); m.position.set(...p); m.userData.base = c; all.add(m); lamps.push(m); return m; };
  const navL = lamp([24, 0.6, 0.6], [-5.5, wy(5.5) + 0.03, TE - chord(5.5) + 0.12]), navR = lamp([0.6, 24, 2], [5.5, wy(5.5) + 0.03, TE - chord(5.5) + 0.12]);
  const strL = lamp([30, 30, 30], [-5.52, wy(5.5) + 0.03, TE - chord(5.5) + 0.22], 0.025), strR = lamp([30, 30, 30], [5.52, wy(5.5) + 0.03, TE - chord(5.5) + 0.22], 0.025);
  const bcnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.05, 16), dark); bcnBase.position.set(0, 1.29, 4.62); all.add(bcnBase);
  const bcnDome = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.6, roughness: 0.05 })); bcnDome.position.set(0, 1.315, 4.62); all.add(bcnDome);
  const bcn = lamp([26, 1, 0.5], [0, 1.33, 4.62], 0.03);
  const tail = lamp([22, 22, 20], [0, 0.2, 5.46], 0.02);
  const landL = lamp([30, 30, 24], [-2.3, wy(2.4) + 0.03, TE - chord(2.4) - 0.005], 0.035), taxiL = lamp([24, 24, 20], [-2.55, wy(2.4) + 0.03, TE - chord(2.4) - 0.005], 0.03);
  const landSpot = new THREE.SpotLight(0xfff4e0, 0, 900, 0.16, 0.45, 1.6); landSpot.position.set(-2.3, wy(2.4), TE - chord(2.4) - 0.1); landSpot.target.position.set(-2.3, -9, -120); all.add(landSpot, landSpot.target);
  const taxiSpot = new THREE.SpotLight(0xfff0d8, 0, 220, 0.42, 0.6, 1.6); taxiSpot.position.set(-2.55, wy(2.4), TE - chord(2.4) - 0.1); taxiSpot.target.position.set(-1.5, -4, -40); all.add(taxiSpot, taxiSpot.target);

  /* --- contact shadow (soft dark blobs under the wheels) --- */
  const ctT = TX.tex(TX.decal(256, 256, (x, w, h) => { const blob = (cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }; const s = w / 4.4; blob(w / 2 - 1.27 * s, h / 2 + 0.35 * s, 0.32 * s, 0.75); blob(w / 2 + 1.27 * s, h / 2 + 0.35 * s, 0.32 * s, 0.75); blob(w / 2, h / 2 - 1.55 * s, 0.26 * s, 0.7); const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.45); g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }));
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: ctT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, toneMapped: true }));
  contact.renderOrder = 1; root.add(contact); glows.push(contact);
  const qi = new THREE.Quaternion(), flat = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), tmp = new THREE.Vector3();

  all.traverse(o => { if (o.isMesh && o.material !== glassM && o !== disc) { o.castShadow = true; o.receiveShadow = true; } });
  let tt = 0;
  return {
    root, cabinMeshes: [], prop, disc, glows,
    update(c, s, dt) {
      tt += dt;
      const a = c.roll * 20 * D2R; ailL.userData.setAngle(a); ailR.userData.setAngle(-a);
      const fdeg = s.flapPos * 10, fl = fdeg * D2R, slide = fdeg / 30 * 0.11; flapL.userData.setAngle(fl, slide); flapR.userData.setAngle(fl, slide);
      const de = clamp(-c.pitch * 0.44 + c.trim, -0.5, 0.5); elevL.userData.setAngle(de); elevR.userData.setAngle(de); tabPiv.rotation.x = -c.trim * 2.2;
      rudPiv.quaternion.setFromAxisAngle(rudAxis, -c.yaw * 16 * D2R);
      prop.rotation.z -= s.rpm / 60 * Math.PI * 2 * dt * (s.rpm > 900 ? 0.0137 : 1);
      const blur = clamp((s.rpm - 500) / 900, 0, 1); bladeM.opacity = tipM.opacity = 1 - 0.85 * blur; disc.material.opacity = blur * 0.85;
      const on = c.bat; navL.visible = navR.visible = tail.visible = on && c.lights.nav; landL.visible = on && c.lights.land; taxiL.visible = on && c.lights.taxi;
      const lk = 0.1 + 0.9 * Math.sqrt(s._night ?? 0); if (Math.abs(lk - (this._lk ?? -1)) > 0.01) { this._lk = lk; lamps.forEach(m => m.material.color.setRGB(...m.userData.base.map(v => v * lk))); }
      const nk = Math.pow(s._night ?? 0, 2); landSpot.intensity = on && c.lights.land ? 9e4 * nk : 0; taxiSpot.intensity = on && c.lights.taxi ? 2.5e4 * nk : 0;
      strL.visible = strR.visible = on && c.lights.strb && (tt % 1.1) < 0.07;
      bcn.visible = on && c.lights.bcn && (tt % 1.3) < 0.18;
      // contact shadow lies flat on the ground under the aircraft
      if (s._gy != null) {
        const agl = s.pos.y - 1.45 - s._gy; contact.visible = agl < 4;
        qi.copy(s.q).invert(); tmp.set(0, s._gy + 0.04 - s.pos.y, 0).applyQuaternion(qi); contact.position.copy(tmp);
        contact.quaternion.copy(qi).multiply(flat);
        const fwd = V(0, 0, -1).applyQuaternion(s.q); contact.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.atan2(-fwd.x, -fwd.z)));
        contact.material.opacity = clamp(1 - agl / 3, 0, 1) * (0.55 + 0.45 * (1 - (s._night ?? 0)));
      }
    }
  };
}
