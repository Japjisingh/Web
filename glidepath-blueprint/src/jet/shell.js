/* Flight-deck shell for the jet trainer: windscreen and side windows (curved panes, gaskets, painted frames with
   fasteners, sliding-window rails, sun visors), lined sidewalls with seams, side consoles (sidestick, tiller,
   oxygen-mask box, cup holder), seats with sheepskin covers, floor and rudder pedals, contact-shadow cards and
   cheap display reflections in the windscreen. All procedural; static parts are merged by the caller. */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from '../sim/textures.js';
import { mats, wearTex, FONT } from './panel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------- procedural textures ---------------- */
function liningTex() { // 0.5 m tile: light grey moulded panel, seam lines, a few fasteners, mottling
  const { c, x } = TX.canvas(512, 512); const r = TX.rng(31);
  x.fillStyle = '#c3c7ca'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const v = r() < 0.5 ? '120,124,128' : '230,232,234'; g.addColorStop(0, `rgba(${v},0.08)`); g.addColorStop(1, `rgba(${v},0)`); x.save(); x.translate(r() * 512, r() * 512); x.scale(10 + r() * 40, 10 + r() * 40); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
  x.globalAlpha = 0.18; x.drawImage(TX.grain(256, 256, 128, 90, 4), 0, 0, 512, 512); x.globalAlpha = 1;
  x.fillStyle = '#5d6266'; x.fillRect(0, 0, 512, 3); x.fillRect(0, 0, 3, 512); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, 3, 512, 2); x.fillRect(3, 0, 2, 512);
  for (const [u, v] of [[22, 22], [490, 22], [22, 490], [490, 490], [256, 22], [22, 256]]) { x.fillStyle = '#8e9398'; x.beginPath(); x.arc(u, v, 5, 0, 7); x.fill(); x.fillStyle = '#5b6064'; x.fillRect(u - 4, v - 0.8, 8, 1.6); }
  return c;
}
function sheepTex() { // sheepskin: cream curls + height for a normal map
  const w = 256, h = 256, r = TX.rng(12), H = new Float32Array(w * h);
  for (let k = 0; k < 2600; k++) { const cx = r() * w, cy = r() * h, rad = 2 + r() * 4; for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) { const d = Math.hypot(i, j); if (d > rad) continue; const X = ((cx + i) | 0 + w) % w, Y = ((cy + j) | 0 + h) % h; const id = ((Y + h) % h) * w + ((X + w) % w); H[id] += 0.12 * Math.cos(d / rad * 1.4); } }
  const { c, x } = TX.canvas(w, h); const img = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = 0.78 + H[i] * 0.5; img.data[i * 4] = 214 * v; img.data[i * 4 + 1] = 202 * v; img.data[i * 4 + 2] = 178 * v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  return { map: c, normal: TX.heightToNormal(H, w, h, 2.5) };
}
function dustTex() { // windscreen dust and dried rain spots (very faint alpha)
  const { c, x } = TX.canvas(512, 512); const r = TX.rng(8);
  x.fillStyle = 'rgba(255,255,255,0.012)'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(235,232,224,${0.01 + r() * 0.02})`; const s = 0.5 + r() * 1.6; x.beginPath(); x.arc(r() * 512, r() * 512, s, 0, 7); x.fill(); }
  for (let i = 0; i < 40; i++) { const X = r() * 512, Y0 = r() * 300; x.strokeStyle = `rgba(235,232,225,${0.015 + r() * 0.025})`; x.lineWidth = 1 + r(); x.beginPath(); x.moveTo(X, Y0); for (let k = 1; k < 8; k++) x.lineTo(X + (r() - 0.5) * 6, Y0 + k * (8 + r() * 10)); x.stroke(); }
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(230,226,215,0.03)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  return c;
}
function aoTex() { // luminance = darkening amount (used as alphaMap). left half: linear falloff, right half: radial blob
  const { c, x } = TX.canvas(256, 128); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 128);
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgb(158,158,158)'); g.addColorStop(0.45, 'rgb(64,64,64)'); g.addColorStop(1, 'rgb(0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const rg = x.createRadialGradient(192, 64, 0, 192, 64, 62); rg.addColorStop(0, 'rgb(150,150,150)'); rg.addColorStop(0.6, 'rgb(56,56,56)'); rg.addColorStop(1, 'rgb(0,0,0)'); x.fillStyle = rg; x.fillRect(128, 0, 128, 128);
  return c;
}
function consoleTex() { // side console top plate lettering
  const { c, x } = TX.canvas(256, 1024); x.fillStyle = '#3b4249'; x.fillRect(0, 0, 256, 1024);
  x.globalAlpha = 0.12; x.drawImage(TX.grain(256, 256, 128, 90, 2), 0, 0, 256, 1024); x.globalAlpha = 1;
  x.strokeStyle = '#e8ebed'; x.lineWidth = 2; x.fillStyle = '#e8ebed'; x.font = `600 22px ${FONT}`; x.textAlign = 'center';
  x.strokeRect(30, 120, 196, 210); x.fillText('OXYGEN MASK', 128, 110); x.fillText('PRESS TO TEST', 128, 350);
  x.fillText('NOSE WHEEL STEERING', 128, 470); x.fillText('SIDESTICK', 128, 690); x.fillText('CUP', 128, 960);
  x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 3; x.strokeRect(4, 4, 248, 1016);
  return c;
}

export function buildShell(ctx) {
  const { S, quad, root, tx, aniso } = ctx;
  const M = mats();
  /* ---- materials ---- */
  const linT = tx(liningTex(), { repeat: [1, 1] }); linT.wrapS = linT.wrapT = THREE.RepeatWrapping;
  const lining = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: linT, color: 0xf0f2f3, roughness: 0.82, roughnessMap: wearTex() });
  const liningDk = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: linT, color: 0x8c9196, roughness: 0.78, roughnessMap: wearTex() });
  const charcoal = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.62, roughnessMap: wearTex(), metalness: 0.08 });
  const frameM = new THREE.MeshStandardMaterial({ color: 0x80878d, roughness: 0.5, roughnessMap: wearTex(), metalness: 0.3 });
  const frameLip = new THREE.MeshStandardMaterial({ color: 0x6c7379, roughness: 0.42, roughnessMap: wearTex(), metalness: 0.35 });
  const rivetM = new THREE.MeshStandardMaterial({ color: 0x5d646a, roughness: 0.45, metalness: 0.7 });
  const sealM = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.75 });
  const dust = tx(dustTex()); dust.wrapS = dust.wrapT = THREE.RepeatWrapping;
  const glass = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, map: dust, transparent: true, opacity: 1, roughness: 0.06, metalness: 0, envMapIntensity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const visorM = new THREE.MeshStandardMaterial({ color: 0x24302b, transparent: true, opacity: 0.62, roughness: 0.15, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const sh = sheepTex();
  const sheep = new THREE.MeshStandardMaterial({ map: tx(sh.map, { repeat: [3, 3] }), normalMap: tx(sh.normal, { srgb: false, repeat: [3, 3] }), normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1 });
  const L = TX.leather([36, 38, 42], 3);
  const leather = new THREE.MeshStandardMaterial({ map: tx(L.map), normalMap: tx(L.normal, { srgb: false }), normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.5 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.55, roughnessMap: wearTex() });
  const consoleTop = new THREE.MeshStandardMaterial({ map: tx(consoleTex()), roughness: 0.7 });
  const out = { lining, liningDk, charcoal, frameM, glass, leather, plastic };

  /* ---- frame member: flat painted profile with bevels, gasket strip and fasteners ---- */
  const rivets = [];
  const member = (a, b, r, mat = frameM, rows = 2) => {
    const mid = a.clone().lerp(b, 0.5), d = b.clone().sub(a), len = d.length(); const y = d.clone().normalize();
    const inward = V(0, 1.25, 0.1).sub(mid); const z = inward.sub(y.clone().multiplyScalar(inward.dot(y))).normalize(); const x = y.clone().cross(z).normalize();
    const g0 = new RoundedBoxGeometry(r * 2.2, len + r * 1.4, r * 0.9, 3, Math.min(r * 0.42, 0.012)); const g = g0.index ? g0.toNonIndexed() : g0;
    g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(mid)); ctx.push(mat, g);
    // stepped profile: a narrower raised lip along the member
    { const l0 = new RoundedBoxGeometry(r * 1.0, len + r * 0.6, r * 0.5, 2, Math.min(r * 0.2, 0.006)); const l = l0.index ? l0.toNonIndexed() : l0; l.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z).setPosition(mid.clone().addScaledVector(z, r * 0.55))); ctx.push(frameLip, l); }
    const n = Math.floor(len / 0.075);
    for (let k = 1; k < n; k += 1) for (let rr = 0; rr < rows; rr++) { const off = rows === 1 ? 0 : (rr ? 1 : -1) * r * 0.78; const p = a.clone().addScaledVector(y, len * k / n).addScaledVector(x, off).addScaledVector(z, r * 0.45 + 0.0006); rivets.push(new THREE.Matrix4().makeBasis(x, z, y.clone().negate()).setPosition(p)); }
    return { x, y, z };
  };
  /* ---- glass pane: bilinear patch with a slight outward bulge, gasket around the edge ---- */
  const glassMeshes = [], panes = [];
  const pane = (pts, bulge = 0.012, flip = false) => {
    const [a, b, c, d] = pts; const nx = 10, ny = 8; const pos = [], uv = [], idx = [];
    const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize(); const outward = n.dot(a.clone().sub(V(0, 1.2, 0))) > 0 ? n : n.clone().negate();
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const u = i / nx, v = j / ny; const p = a.clone().multiplyScalar((1 - u) * (1 - v)).addScaledVector(b, u * (1 - v)).addScaledVector(c, u * v).addScaledVector(d, (1 - u) * v); p.addScaledVector(outward, bulge * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)); pos.push(p.x, p.y, p.z); uv.push(u * 1.4, v); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * (nx + 1) + i; flip ? idx.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2) : idx.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, glass); m.renderOrder = 3; root.add(m); glassMeshes.push(m);
    // gasket: thin dark strip just inside the frame
    for (let i = 0; i < 4; i++) { const p0 = pts[i], p1 = pts[(i + 1) % 4]; const cen = a.clone().add(b).add(c).add(d).multiplyScalar(0.25); const q0 = p0.clone().lerp(cen, 0.035), q1 = p1.clone().lerp(cen, 0.035); const dd = q1.clone().sub(q0); const gg = new THREE.BoxGeometry(0.014, dd.length(), 0.006).toNonIndexed(); const yy = dd.clone().normalize(), zz = outward.clone(), xx = yy.clone().cross(zz).normalize(); zz.copy(xx.clone().cross(yy)); gg.applyMatrix4(new THREE.Matrix4().makeBasis(xx, yy, zz).setPosition(q0.clone().lerp(q1, 0.5))); ctx.push(sealM, gg); }
    return m;
  };
  for (const sd of [-1, 1]) {
    const X = v => V(v.x * sd, v.y, v.z);
    // front pane: bottom-inner, bottom-outer, top-outer, top-inner
    const fp = [V(0.025, 1.035, -1.06), V(0.84, 1.035, -0.935), V(0.79, 1.66, -0.64), V(0.025, 1.70, -0.75)].map(X);
    pane(fp, 0.018, sd < 0); panes.push(fp);
    member(fp[1], fp[2], 0.034); member(fp[0], fp[1], 0.018, frameM, 1); member(fp[3], fp[2], 0.026);
    // side windows (front sliding + rear fixed)
    const sw1 = [V(0.88, 1.03, -0.88), V(1.0, 1.0, -0.36), V(0.93, 1.56, -0.4), V(0.83, 1.62, -0.62)].map(X);
    const sw2 = [V(1.01, 0.99, -0.30), V(1.04, 0.98, 0.14), V(0.97, 1.5, 0.14), V(0.94, 1.55, -0.34)].map(X);
    pane(sw1, 0.006, sd < 0); pane(sw2, 0.006, sd < 0);
    for (const w of [sw1, sw2]) { member(w[0], w[1], 0.026); member(w[1], w[2], 0.034); member(w[2], w[3], 0.03); member(w[3], w[0], 0.034); }
    // sliding window: rails along top and bottom, latch handle and lock lever
    for (const [p0, p1, dy] of [[sw1[0], sw1[1], 0.03], [sw1[3], sw1[2], -0.03]]) { const a2 = p0.clone().add(V(-sd * 0.035, dy, 0)), b2 = p1.clone().add(V(-sd * 0.035, dy, 0.04)); const d = b2.clone().sub(a2); const g = new THREE.CylinderGeometry(0.006, 0.006, d.length(), 8); g.applyMatrix4(new THREE.Matrix4().compose(a2.clone().lerp(b2, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1))); ctx.push(M.metal, g.toNonIndexed()); }
    S(new RoundedBoxGeometry(0.026, 0.11, 0.035, 2, 0.008), M.black, X(V(0.945, 1.2, -0.43)));
    S(new RoundedBoxGeometry(0.018, 0.05, 0.018, 2, 0.005), M.knobGrey, X(V(0.935, 1.27, -0.43)), [0.4, 0, 0]);
    // sun visor on its rail along the top of the side windows, half pulled out over the sliding window
    { const a2 = X(V(0.86, 1.64, -0.66)), b2 = X(V(0.95, 1.58, 0.12)); const d = b2.clone().sub(a2); const g = new THREE.CylinderGeometry(0.007, 0.007, d.length(), 8); g.applyMatrix4(new THREE.Matrix4().compose(a2.clone().lerp(b2, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1))); ctx.push(M.metal, g.toNonIndexed()); }
    { // visor parallel to the sliding window, just inside it, near the top
      const ex = sw1[1].clone().sub(sw1[0]).normalize(), ey = sw1[3].clone().sub(sw1[0]); ey.sub(ex.clone().multiplyScalar(ey.dot(ex))).normalize(); let ez = ex.clone().cross(ey).normalize(); if (ez.dot(V(0, 1.2, -0.3).sub(sw1[0])) < 0) ez.negate();
      const top = sw1[3].clone().lerp(sw1[2], 0.45); const cen = top.clone().addScaledVector(ey, -0.12).addScaledVector(ez, 0.045);
      const basis = new THREE.Matrix4().makeBasis(ex, ey, ez);
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.30, 0.18, 0.005, 2, 0.002), visorM); m.quaternion.setFromRotationMatrix(basis); m.position.copy(cen); m.renderOrder = 4; root.add(m);
      const fr = new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.018, 0.014, 2, 0.005), plastic); fr.quaternion.copy(m.quaternion); fr.position.copy(cen).addScaledVector(ey, 0.095); root.add(fr); }
    // lined sidewalls with seams; window sill trim; lining above to the overhead
    quad(X(V(1.06, 0.0, -0.95)), X(V(1.06, 0.0, 1.6)), X(V(1.04, 0.98, 1.6)), X(V(0.98, 1.0, -0.95)), lining, 2);
    quad(X(V(0.98, 1.0, -0.95)), X(V(1.04, 0.98, 1.6)), X(V(1.06, 0.95, 1.6)), X(V(0.88, 1.03, -0.88)), lining, 2);
    quad(X(V(0.97, 1.5, 0.14)), X(V(0.98, 1.55, 1.6)), X(V(0.40, 2.12, 1.6)), X(V(0.38, 2.08, 0.16)), lining, 2);
    quad(X(V(0.83, 1.62, -0.62)), X(V(0.97, 1.5, 0.14)), X(V(0.38, 2.08, 0.16)), X(V(0.36, 1.86, -0.62)), lining, 2);
    quad(X(V(0.79, 1.66, -0.64)), X(V(0.83, 1.62, -0.62)), X(V(0.36, 1.86, -0.62)), X(V(0.025, 1.70, -0.75)), liningDk, 2);
    quad(X(V(1.04, 0.98, 0.14)), X(V(1.04, 0.98, 1.6)), X(V(0.98, 1.55, 1.6)), X(V(0.97, 1.5, 0.14)), lining, 2);
    { const a2 = X(V(0.97, 0.985, -0.9)), b2 = X(V(1.035, 0.965, 1.55)); const d = b2.clone().sub(a2); const g = new RoundedBoxGeometry(0.05, d.length(), 0.03, 2, 0.01); g.applyMatrix4(new THREE.Matrix4().compose(a2.clone().lerp(b2, 0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()), V(1, 1, 1))); ctx.push(charcoal, g.index ? g.toNonIndexed() : g); }
    // document pocket and air outlet on the lower sidewall
    S(new RoundedBoxGeometry(0.03, 0.22, 0.42, 2, 0.01), charcoal, X(V(1.035, 0.82, 0.45)));
    S(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 18), M.darkMetal, X(V(1.03, 1.0, 0.3)), [0, 0, sd * Math.PI / 2]);
    // side console: body, top plate with lettering, sidestick, tiller, oxygen-mask box, cup holder, armrest
    const cx = sd * 0.93;
    S(new RoundedBoxGeometry(0.26, 0.66, 1.15, 3, 0.025), charcoal, V(cx, 0.33, -0.1));
    { const top = new THREE.PlaneGeometry(0.22, 0.9); top.rotateX(-Math.PI / 2); top.translate(cx - sd * 0.008, 0.6635, -0.1); ctx.push(consoleTop, top); }
    // sidestick: rubber boot, ergonomic grip, trigger and push-to-talk button
    S(new THREE.CylinderGeometry(0.028, 0.048, 0.04, 20), M.black, V(cx - sd * 0.012, 0.685, -0.2));
    { const prof = [[0, 0], [0.016, 0], [0.019, 0.02], [0.017, 0.05], [0.021, 0.08], [0.024, 0.105], [0.02, 0.125], [0.012, 0.135], [0, 0.137]].map(([r2, y]) => new THREE.Vector2(r2, y)); const g = new THREE.LatheGeometry(prof, 16); S(g, M.black, V(cx - sd * 0.012, 0.70, -0.2), [0.12, 0, -sd * 0.1], V(1, 1, 1.25)); }
    S(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10), new THREE.MeshStandardMaterial({ color: 0xa01c1c, roughness: 0.5 }), V(cx - sd * 0.03, 0.835, -0.205), [0, 0, sd * 0.9]);
    // tiller: hand wheel on a hub
    { const t = new THREE.TorusGeometry(0.052, 0.009, 10, 32); S(t, M.black, V(cx - sd * 0.03, 0.70, -0.48), [Math.PI / 2 - 0.25, 0, 0]); S(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 16), M.darkMetal, V(cx - sd * 0.03, 0.685, -0.48)); S(new THREE.CylinderGeometry(0.008, 0.008, 0.035, 10), M.black, V(cx - sd * 0.03 + 0.04, 0.72, -0.47)); }
    // oxygen mask stowage box with flip doors and test lever
    S(new RoundedBoxGeometry(0.16, 0.05, 0.19, 2, 0.01), plastic, V(cx - sd * 0.005, 0.69, -0.86));
    S(new THREE.BoxGeometry(0.004, 0.003, 0.18), M.black, V(cx - sd * 0.005, 0.716, -0.86));
    S(new RoundedBoxGeometry(0.03, 0.012, 0.02, 2, 0.004), new THREE.MeshStandardMaterial({ color: 0xd8b420, roughness: 0.5 }), V(cx - sd * 0.05, 0.718, -0.78));
    S(new RoundedBoxGeometry(0.018, 0.01, 0.026, 2, 0.003), new THREE.MeshStandardMaterial({ color: 0x2f9a48, roughness: 0.5 }), V(cx + sd * 0.04, 0.718, -0.78));
    // cup holder ring
    S(new THREE.TorusGeometry(0.04, 0.006, 8, 24), M.metal, V(cx, 0.667, 0.33), [Math.PI / 2, 0, 0]);
    S(new THREE.CylinderGeometry(0.038, 0.038, 0.004, 20), M.black, V(cx, 0.664, 0.33));
    // armrest on its stalk
    S(new RoundedBoxGeometry(0.09, 0.06, 0.34, 3, 0.022), leather, V(cx + sd * 0.02, 0.75, 0.18));
    S(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 10), M.darkMetal, V(cx + sd * 0.02, 0.70, 0.18));
  }
  // centre windscreen post with wiper housing
  member(V(0, 1.03, -1.07), V(0, 1.71, -0.755), 0.03);
  S(new RoundedBoxGeometry(0.08, 0.06, 0.07, 2, 0.015), frameM, V(0, 1.68, -0.73));

  /* ---- seats: shell, leather base, sheepskin covers, headrest, armrests, column, track rails ---- */
  for (const sx of [-0.53, 0.53]) {
    S(new RoundedBoxGeometry(0.46, 0.11, 0.48, 4, 0.045), leather, V(sx, 0.47, 0.33));
    S(new RoundedBoxGeometry(0.40, 0.035, 0.42, 4, 0.016), sheep, V(sx, 0.535, 0.32));
    for (const sd of [-1, 1]) S(new RoundedBoxGeometry(0.07, 0.10, 0.46, 3, 0.03), leather, V(sx + sd * 0.215, 0.50, 0.33));
    for (let k = 0; k < 5; k++) { const y = 0.60 + k * 0.13, z = 0.58 + k * 0.025 + k * k * 0.004; S(new RoundedBoxGeometry(0.46 - k * 0.012, 0.14, 0.12, 4, 0.045), leather, V(sx, y, z), [0.16 + k * 0.02, 0, 0]); S(new RoundedBoxGeometry(0.36 - k * 0.012, 0.13, 0.03, 3, 0.012), sheep, V(sx, y, z - 0.065), [0.16 + k * 0.02, 0, 0]); }
    for (let k = 0; k < 6; k++) { const y = 0.58 + k * 0.115, z = 0.665 + k * 0.024 + k * k * 0.0035; S(new RoundedBoxGeometry(0.50 - k * 0.014, 0.125, 0.05, 3, 0.022), plastic, V(sx, y, z), [0.17 + k * 0.022, 0, 0]); }
    S(new RoundedBoxGeometry(0.30, 0.26, 0.02, 3, 0.008), charcoal, V(sx, 0.78, 0.72), [0.2, 0, 0]);   // map pocket on the seat back
    for (const sd of [-1, 1]) S(new RoundedBoxGeometry(0.06, 0.52, 0.13, 3, 0.03), leather, V(sx + sd * 0.235, 0.80, 0.62), [0.18, 0, 0]);
    S(new RoundedBoxGeometry(0.30, 0.2, 0.13, 5, 0.06), leather, V(sx, 1.34, 0.77), [0.2, 0, 0]);
    S(new RoundedBoxGeometry(0.2, 0.1, 0.02, 3, 0.01), sheep, V(sx, 1.33, 0.70), [0.2, 0, 0]);
    S(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10), M.metal, V(sx - 0.07, 1.22, 0.75)); S(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 10), M.metal, V(sx + 0.07, 1.22, 0.75));
    for (const sd of [-1, 1]) { S(new RoundedBoxGeometry(0.075, 0.05, 0.34, 3, 0.022), leather, V(sx + sd * 0.30, 0.68, 0.38), [-0.05, 0, 0]); S(new THREE.BoxGeometry(0.025, 0.14, 0.03), M.darkMetal, V(sx + sd * 0.30, 0.6, 0.5)); }
    S(new THREE.CylinderGeometry(0.06, 0.08, 0.38, 16), M.darkMetal, V(sx, 0.22, 0.36));
    S(new RoundedBoxGeometry(0.36, 0.05, 0.42, 2, 0.015), M.darkMetal, V(sx, 0.40, 0.36));
    for (const sd of [-1, 1]) { S(new THREE.BoxGeometry(0.035, 0.03, 1.0), M.metal, V(sx + sd * 0.15, 0.015, 0.25)); S(new THREE.BoxGeometry(0.05, 0.008, 1.0), M.black, V(sx + sd * 0.15, 0.003, 0.25)); }
    S(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), M.knobGrey, V(sx + 0.2, 0.38, 0.12), [0, 0, Math.PI / 2]);
  }
  /* ---- floor detail and rudder pedals ---- */
  for (const sd of [-1, 1]) {
    for (const dx of [-0.09, 0.09]) { S(new RoundedBoxGeometry(0.08, 0.17, 0.02, 2, 0.008), M.black, V(sd * 0.53 + dx, 0.15, -0.82), [-0.55, 0, 0]); for (let k = 0; k < 5; k++) S(new THREE.BoxGeometry(0.07, 0.006, 0.004), M.darkMetal, V(sd * 0.53 + dx, 0.09 + k * 0.03, -0.81 + k * 0.017), [-0.55, 0, 0]); S(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 8), M.darkMetal, V(sd * 0.53 + dx, 0.2, -0.92), [0.7, 0, 0]); }
    S(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10), M.metal, V(sd * 0.53, 0.06, -0.62), [0, 0, Math.PI / 2]);
  }
  /* ---- contact-shadow cards (cheap AO): one merged mesh ---- */
  {
    const aoM = new THREE.MeshBasicMaterial({ alphaMap: tx(aoTex(), { srgb: false }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, color: 0x000000 });
    const cards = [];
    const card = (w, h, pos, rot, radial = false) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (radial ? 0.5 : 0) + uv.getX(i) * 0.5); g.applyMatrix4(new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), V(1, 1, 1))); cards.push(g); };
    card(1.9, 0.16, V(0, 0.865, -0.905), [-0.21, 0, 0]);                         // under the glareshield on the panel top
    card(1.96, 0.12, V(0, 1.043, -1.0), [-Math.PI / 2, 0, Math.PI]);             // glareshield top meets the windscreen
    for (const sx of [-0.53, 0.53]) card(0.8, 0.9, V(sx, 0.004, 0.35), [-Math.PI / 2, 0, 0], true);   // under the seats
    card(0.7, 1.2, V(0, 0.004, -0.3), [-Math.PI / 2, 0, 0], true);               // pedestal base
    for (const sd of [-1, 1]) { card(1.1, 0.14, V(sd * 0.795, 0.08, -0.1), [0, sd * Math.PI / 2, Math.PI], false); card(1.2, 0.18, V(sd * 0.36, 1.95, -0.2), [0.3, sd * Math.PI / 2 * 0.0, 0], false); }
    const mesh = new THREE.Mesh(ctx.merge(cards), aoM); mesh.renderOrder = 2; root.add(mesh);
  }
  // rivets: one instanced mesh
  { const g = new THREE.CylinderGeometry(0.0019, 0.0022, 0.0014, 8); const im = new THREE.InstancedMesh(g, rivetM, rivets.length); rivets.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im); }
  return { ...out, glassMeshes, panes, glass };
}

/** fake reflections of lit displays in the two windscreen panes (additive, clipped to each pane's half) */
export function buildReflections(root, panes, screens) {
  const group = new THREE.Group(); group.name = 'reflections';
  const mats = [];
  panes.forEach((pts, pi) => {
    const [a, b, , d] = pts; const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize(); const p = a;
    const R = new THREE.Matrix4().set(1 - 2 * n.x * n.x, -2 * n.x * n.y, -2 * n.x * n.z, 0, -2 * n.y * n.x, 1 - 2 * n.y * n.y, -2 * n.y * n.z, 0, -2 * n.z * n.x, -2 * n.z * n.y, 1 - 2 * n.z * n.z, 0, 0, 0, 0, 1);
    const T = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z).multiply(R).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    // our panes are steeper than real windscreens: lift the mirrored images up the glass so they sit where pilots see them
    const up = d.clone().sub(a).normalize(); T.premultiply(new THREE.Matrix4().makeTranslation(up.x * 0.26, up.y * 0.26, up.z * 0.26));
    const side = Math.sign(a.x + b.x) || -1;
    const clip = [new THREE.Plane(V(side, 0, 0), 0), new THREE.Plane(n.clone().multiplyScalar(n.dot(V(0, 1.2, 0).sub(p)) > 0 ? -1 : 1), 0)];
    clip[1].constant = -clip[1].normal.dot(p);
    for (const s of screens) {
      const wx = s.mesh.getWorldPosition(V(0, 0, 0)).x; if (Math.sign(wx) !== side && Math.abs(wx) > 0.12) continue;
      const m = new THREE.MeshBasicMaterial({ map: s.mesh.material.emissiveMap, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: clip, toneMapped: true });
      const r = new THREE.Mesh(s.mesh.geometry, m); r.matrixAutoUpdate = false; r.matrix.copy(T).multiply(s.mesh.matrixWorld); r.renderOrder = 2; group.add(r); mats.push(m);
    }
  });
  root.add(group);
  return { group, setStrength(k) { for (const m of mats) m.opacity = k; group.visible = k > 0.005; } };
}
