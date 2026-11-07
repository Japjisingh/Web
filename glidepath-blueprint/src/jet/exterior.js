/* Generic twin-jet exterior for the Outside view, and the pushback tug. Procedural and low-poly: parts merged per
   material; gear legs, fans and lights move. No markings beyond a plain generic stripe (no names, no logos).
   Body frame: origin at the main-gear contact point on the ground, x right, y up, nose along -z. */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clean = geo => { const g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; };
const mirrorX = geo => { const g = geo.index ? geo.toNonIndexed() : geo; g.scale(-1, 1, 1); for (const a of Object.keys(g.attributes)) { const at = g.attributes[a], n = at.itemSize; for (let i = 0; i < at.count; i += 3) for (let k = 0; k < n; k++) { const t = at.array[(i + 1) * n + k]; at.array[(i + 1) * n + k] = at.array[(i + 2) * n + k]; at.array[(i + 2) * n + k] = t; } } g.computeVertexNormals(); return g; };
const ZN = -17.9, LF = 37, YC = 3.6;    // nose tip z, fuselage length, fuselage centre height

function skinTexture() {
  // canvas x: along the fuselage (nose → tail); canvas y = 512 · (1 − a), a = angle around from the belly (0), right side (0.25), top (0.5), left side (0.75)
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const x = c.getContext('2d');
  const Y = a => 512 * (1 - a);
  x.fillStyle = '#e4e8eb'; x.fillRect(0, 0, 2048, 512);
  x.fillStyle = '#a3a9ad'; x.fillRect(0, Y(0.09), 2048, 512 - Y(0.09)); x.fillRect(0, 0, 2048, Y(0.91));            // grey belly
  for (const [a, dir] of [[0.27, 1], [0.73, -1]]) {
    const y = Y(a);
    x.fillStyle = '#2d5e8c'; x.fillRect(250, y + dir * 26 - 5, 1680, 10); x.fillStyle = '#86a8c6'; x.fillRect(250, y + dir * 36 - 2, 1680, 4);   // plain generic stripe
    for (let u = 300; u < 1700; u += 21) { if (u > 860 && u < 960) continue; x.fillStyle = '#1d2329'; x.beginPath(); x.roundRect(u, y - 8, 10, 15, 4); x.fill(); }
    x.strokeStyle = '#8f969b'; x.lineWidth = 3; for (const u of [250, 1745]) { x.beginPath(); x.roundRect(u, y - 30, 36, 62, 6); x.stroke(); }
    for (const u of [880, 935]) { x.beginPath(); x.roundRect(u, y - 13, 18, 28, 4); x.stroke(); }
    x.fillStyle = '#151a1f'; x.beginPath(); x.moveTo(70, y - 26 * dir); x.lineTo(150, y - 30 * dir); x.lineTo(160, y + 4 * dir); x.lineTo(85, y + 8 * dir); x.closePath(); x.fill();   // side cockpit windows
  }
  x.fillStyle = '#151a1f'; x.beginPath(); x.moveTo(40, Y(0.42)); x.lineTo(70, Y(0.37)); x.lineTo(70, Y(0.63)); x.lineTo(40, Y(0.58)); x.closePath(); x.fill();   // front windscreen
  x.strokeStyle = 'rgba(80,88,94,0.35)'; x.lineWidth = 1.5; for (let u = 120; u < 2048; u += 96) { x.beginPath(); x.moveTo(u, 0); x.lineTo(u, 512); x.stroke(); }   // panel joints
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export function buildExterior() {
  const root = new THREE.Group(); root.name = 'exterior';
  const white = new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.45, metalness: 0.1 }), wingM = new THREE.MeshStandardMaterial({ color: 0xbfc5c9, roughness: 0.5, metalness: 0.25 });
  const skin = new THREE.MeshStandardMaterial({ map: skinTexture(), roughness: 0.42, metalness: 0.08 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.5, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc2c7cb, roughness: 0.3, metalness: 0.9 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.85 });
  const parts = new Map(); const put = (geo, mat, pos = [0, 0, 0], rot = [0, 0, 0], sc = [1, 1, 1]) => { const g = clean(geo); g.applyMatrix4(new THREE.Matrix4().compose(V(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ')), V(...sc))); if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(g); };
  // fuselage: lathe profile (nose cone, constant section, tail cone swept up)
  { const prof = []; for (let i = 0; i <= 48; i++) { const t = i / 48, z = t * LF; let r = 1.98; if (t < 0.11) r = 1.98 * Math.pow(t / 0.11, 0.5) * (0.3 + 0.7 * Math.pow(t / 0.11, 0.35)); if (t > 0.76) r = 1.98 * (1 - Math.pow((t - 0.76) / 0.24, 1.5) * 0.86); prof.push(new THREE.Vector2(Math.max(0.04, r), z)); }
    const g = new THREE.LatheGeometry(prof, 36); g.rotateX(Math.PI / 2);   // axis along +z, u around, v along
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, u); }
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), t = z / LF; if (t > 0.76) p.setY(i, p.getY(i) + Math.pow((t - 0.76) / 0.24, 1.6) * 1.25); }
    g.computeVertexNormals(); g.translate(0, YC, ZN); put(g, skin, [0, 0, 0], [0, 0, 0], [1, 1.04, 1]); }
  // wings: swept, tapered, with dihedral; winglet fences; flap-track fairings
  for (const sd of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(15.8, 7.4); sh.lineTo(15.8, 8.9); sh.lineTo(4.2, 7.0); sh.lineTo(0, 6.6); sh.closePath();
    let g = new THREE.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 2 }); g.rotateX(Math.PI / 2);
    if (sd < 0) g = mirrorX(g);
    put(g, wingM, [sd * 1.5, 1.95, -6.1], [0, 0, sd * 0.1]);
    put(new THREE.BoxGeometry(0.25, 2.3, 1.4), white, [sd * 17.2, 3.9, 2.7], [0, 0, sd * 0.25]);
    for (const k of [0.3, 0.55, 0.8]) put(new THREE.CapsuleGeometry(0.22, 1.6, 4, 8), grey, [sd * (1.5 + 14 * k), 1.9 + 1.4 * k, -6.1 + 6.6 + 7.4 * k * 0.95], [Math.PI / 2, 0, 0]);
    // engine: nacelle (lathe), pylon, intake lip, exhaust cone
    const ex = sd * 5.75, ey = 1.75, ez = -8.6;
    const np = []; for (let i = 0; i <= 18; i++) { const t = i / 18; np.push(new THREE.Vector2(1.08 * (1 - 0.18 * Math.pow(t, 2.2)) + (t < 0.08 ? -0.06 * (1 - t / 0.08) : 0), t * 4.4)); }
    const ng = new THREE.LatheGeometry(np, 28); ng.rotateX(Math.PI / 2); put(ng, white, [ex, ey, ez]);
    put(new THREE.TorusGeometry(1.0, 0.09, 8, 28), metal, [ex, ey, ez + 0.02]);
    put(new THREE.CircleGeometry(1.0, 28), dark, [ex, ey, ez + 0.35], [Math.PI, 0, 0]);
    put(new THREE.ConeGeometry(0.42, 1.3, 16), metal, [ex, ey, ez + 4.9], [Math.PI / 2, 0, 0]);
    put(new THREE.BoxGeometry(0.42, 1.2, 3.6), white, [ex, ey + 1.2, ez + 3.0], [-0.08, 0, 0]);
  }
  // wing-body and belly fairing
  put(new THREE.CapsuleGeometry(1.85, 9, 6, 16), grey, [0, 2.15, -1.6], [Math.PI / 2, 0, 0], [1.05, 0.55, 1]);
  // tail: fin and horizontal stabilisers
  { const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.lineTo(5.6, 0); fs.lineTo(7.4, 6.4); fs.lineTo(5.3, 6.4); fs.closePath(); const fin = new THREE.ExtrudeGeometry(fs, { depth: 0.32, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 }); fin.translate(0, 0, -0.16); fin.rotateY(-Math.PI / 2); put(fin, white, [0, 5.2, 12.3]);
    for (const sd of [-1, 1]) { const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.lineTo(6.0, 2.6); hs.lineTo(6.0, 3.6); hs.lineTo(0, 3.9); hs.closePath(); let g = new THREE.ExtrudeGeometry(hs, { depth: 0.18, bevelEnabled: false }); g.rotateX(Math.PI / 2); if (sd < 0) g = mirrorX(g); put(g, white, [sd * 0.6, 4.9, 13.6], [0, 0, sd * 0.08]); } }
  for (const [mat, list] of parts) { const m = new THREE.Mesh(mergeGeometries(list, false), mat); m.castShadow = true; m.receiveShadow = true; root.add(m); }
  // landing gear: legs that retract (nose forward, mains inwards)
  const leg = (wheels, len) => { const g = new THREE.Group(); const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, len, 10), metal); strut.position.y = -len / 2; g.add(strut);
    for (const x of wheels) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.42, 18), tire); w.rotation.z = Math.PI / 2; w.position.set(x, -len, 0); w.castShadow = true; g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.44, 12), grey); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub); } return g; };
  const noseG = leg([-0.28, 0.28], 2.0); noseG.position.set(0, 2.56, -12.6); root.add(noseG);
  const mains = [-1, 1].map(sd => { const g = leg([sd * -0.45, sd * 0.45], 2.25); g.position.set(sd * 3.8, 2.8, 0); root.add(g); return g; });
  noseG.children[1].scale.setScalar(0.72); noseG.children[3] && noseG.children[3].scale.setScalar(0.72);
  // fans (turn with N1)
  const fanTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#16191c'; x.fillRect(0, 0, 128, 128); x.translate(64, 64); x.strokeStyle = '#6d7479'; x.lineWidth = 5; for (let i = 0; i < 22; i++) { x.rotate(Math.PI * 2 / 22); x.beginPath(); x.moveTo(8, 0); x.quadraticCurveTo(40, 10, 62, 4); x.stroke(); } x.fillStyle = '#8b9196'; x.beginPath(); x.arc(0, 0, 13, 0, 7); x.fill(); return new THREE.CanvasTexture(c); })();
  const fans = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.98, 28), new THREE.MeshStandardMaterial({ map: fanTex, roughness: 0.5, metalness: 0.6 })); m.position.set(sd * 5.75, 1.75, -8.6 + 0.45); m.rotation.y = Math.PI; root.add(m); return m; });
  // lights: navigation (red left, green right, white tail), beacon, strobes, landing lights
  const lamp = (col, pos, r = 0.12) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(0.05) })); m.position.set(...pos); root.add(m); m.userData.col = new THREE.Color(col); return m; };
  const L = { navL: lamp(0xff2a1a, [-17.3, 3.2, 2.0]), navR: lamp(0x22ff66, [17.3, 3.2, 2.0]), tail: lamp(0xffffff, [0, 4.6, 19.0]), bcnT: lamp(0xff2010, [0, 5.75, 0.0], 0.16), bcnB: lamp(0xff2010, [0, 1.65, 1.0], 0.16),
    strL: lamp(0xffffff, [-17.4, 3.3, 2.4]), strR: lamp(0xffffff, [17.4, 3.3, 2.4]), landL: lamp(0xfff2d8, [-3.0, 2.2, -5.4], 0.1), landR: lamp(0xfff2d8, [3.0, 2.2, -5.4], 0.1), taxi: lamp(0xfff2d8, [0, 2.0, -12.9], 0.08) };
  const landBeam = new THREE.SpotLight(0xfff0d8, 0, 600, 0.3, 0.6, 1.2); landBeam.position.set(0, 0.9, -17.5); landBeam.target.position.set(0, -3, -130);   // ahead of and below the nose: lights the runway, not the airframe root.add(landBeam, landBeam.target);
  // soft contact shadow under the aircraft (visible on the ground; the sun shadow does the rest)
  const blob = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 })); m.rotation.x = -Math.PI / 2; m.scale.set(30, 40, 1); m.position.set(0, 0.05, -1); root.add(m); return m; })();
  let fanA = 0;
  function update(sys, dt, t) {
    const Fd = sys.st.fdm, w = sys.sw, g = Fd.gear, on = sys.st.elec.dc;
    blob.visible = Fd.h < 30; blob.material.opacity = Math.max(0, 1 - Fd.h / 30); blob.position.y = 0.05 - Fd.h;
    noseG.rotation.x = (1 - g) * 1.65; noseG.visible = g > 0.02;
    mains.forEach((m, i) => { m.rotation.z = (i ? 1 : -1) * (1 - g) * 1.55; m.visible = g > 0.02; });
    sys.st.eng.forEach((e, i) => { fanA = (fanA + dt * e.n1 * 0.9) % (Math.PI * 2); fans[i].rotation.z = fanA * (i ? 1 : 1.07); });
    const set = (m, k) => m.material.color.copy(m.userData.col).multiplyScalar(k);
    const nav = on && w.navLogo > 0 ? 3 : 0.05; set(L.navL, nav); set(L.navR, nav); set(L.tail, nav);
    const bc = on && w.beacon && (t % 1.1) < 0.12 ? 6 : 0.05; set(L.bcnT, bc); set(L.bcnB, (t + 0.55) % 1.1 < 0.12 && on && w.beacon ? 6 : 0.05);
    const st = on && (w.strobe === 2 || (w.strobe === 1 && !Fd.onGround)) && ((t % 1.2) < 0.06 || ((t - 0.15) % 1.2 + 1.2) % 1.2 < 0.05) ? 10 : 0.05; set(L.strL, st); set(L.strR, st);
    const ld = on && (w.landL === 2 || w.landR === 2) ? 8 : 0.05; set(L.landL, w.landL === 2 && on ? 1.6 : 0.05); set(L.landR, w.landR === 2 && on ? 1.6 : 0.05); set(L.taxi, on && w.nose > 0 ? 1.6 : 0.05);
    landBeam.intensity = ld > 1 ? 60000 * (sys.night || 0) : 0;
  }
  return { root, update, noseG, mains };
}

/** pushback tug with a tow bar; placed in the aircraft's body frame while pushing, then it drives away */
export function buildTug() {
  const g = new THREE.Group(); g.name = 'tug';
  const yel = new THREE.MeshStandardMaterial({ color: 0xd9a51f, roughness: 0.55 }), dk = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.7 }), gl = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.5 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.8, 1.1, 5.2, 2, 0.15), yel); body.position.y = 0.95; g.add(body);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.0, 1.4, 2, 0.12), gl); cab.position.set(0, 1.95, 1.2); g.add(cab);
  for (const [x, z] of [[-1.2, -1.7], [1.2, -1.7], [-1.2, 1.7], [1.2, 1.7]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.45, 14), dk); w.rotation.z = Math.PI / 2; w.position.set(x, 0.5, z); g.add(w); }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.0), dk); bar.position.set(0, 0.6, 5.0); g.add(bar);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff9a20 })); beacon.position.set(0, 2.55, 1.2); g.add(beacon);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { group: g, bar, beacon };
}
