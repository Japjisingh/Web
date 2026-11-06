/* Apron at a generic airport, seen from the parked twin-jet (nose-in at stand 12). Ground is 3.4 m below the cabin floor. */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from '../sim/textures.js';
import { FONT } from './panel.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const GROUND = -3.4;

export function buildAirport(renderer) {
  const root = new THREE.Group(); root.name = 'airport';
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const merged = new Map();
  const add = (geo, mat, pos, rot, scale) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().compose(pos || V(0, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]), 'YXZ')), scale || V(1, 1, 1)));
    if (!merged.has(mat)) merged.set(mat, []); merged.get(mat).push(g);
  };
  const Y = GROUND;

  /* ---- concrete apron ---- */
  const conc = (() => {
    const { c, x } = TX.canvas(1024, 1024); const r = TX.rng(17);
    x.fillStyle = '#a9aaa6'; x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = 160 + (r() - 0.5) * 18; x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(i * 64, j * 64, 64, 64); }
    { const g = TX.grain(256, 256, 128, 60, 9); x.save(); x.globalAlpha = 0.35; x.globalCompositeOperation = 'overlay'; x.fillStyle = x.createPattern(g, 'repeat'); x.fillRect(0, 0, 1024, 1024); x.restore(); }
    for (let k = 0; k < 70; k++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(40,38,34,0.22)'); g.addColorStop(1, 'rgba(40,38,34,0)'); x.save(); x.translate(r() * 1024, r() * 1024); x.scale(10 + r() * 40, 6 + r() * 26); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
    x.strokeStyle = 'rgba(55,55,52,0.75)'; x.lineWidth = 2; for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 1024); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(1024, i * 64); x.stroke(); }
    return c;
  })();
  const ctex = TX.tex(conc, { aniso, repeat: [600 / 80, 600 / 80] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = Y; ground.receiveShadow = true; root.add(ground);
  // grass + far field beyond the apron
  const far = new THREE.Mesh(new THREE.RingGeometry(300, 4000, 64, 1), new THREE.MeshStandardMaterial({ color: 0x6f7d4f, roughness: 1 })); far.rotation.x = -Math.PI / 2; far.position.y = Y - 0.05; root.add(far);

  /* ---- painted markings (transparent decal over the stand area) ---- */
  {
    const S = 2048, M = 80; // 80 x 80 m around the stand
    const { c, x } = TX.canvas(S, S); const k = S / M; const P = (xm, zm) => [(xm + M / 2) * k, (zm + M / 2 + 18) * k];
    const yl = '#e9b928', rd = '#c8322b', wh = '#ecece6';
    const line = (pts, col, w) => { x.strokeStyle = col; x.lineWidth = w * k; x.beginPath(); pts.forEach(([a, b], i) => { const [u, v] = P(a, b); i ? x.lineTo(u, v) : x.moveTo(u, v); }); x.stroke(); };
    // lead-in line with a curve from the taxi lane
    line([[0, -5], [0, 30], [0, 34]], yl, 0.18); line([[0, 34], [3, 40], [12, 44], [40, 46]], yl, 0.18);
    line([[-40, 46], [40, 46]], yl, 0.18); // taxi lane centreline
    // stop bar
    line([[-1.6, -2.6], [1.6, -2.6]], yl, 0.35);
    // equipment restraint / safety lines (red) and service road (white dashed)
    line([[-24, -9], [24, -9]], rd, 0.2); line([[-24, -9], [-24, 30]], rd, 0.2); line([[24, -9], [24, 30]], rd, 0.2);
    x.setLineDash([3 * k, 3 * k]); line([[-40, -13], [40, -13]], wh, 0.15); line([[-40, -16.5], [40, -16.5]], wh, 0.15); x.setLineDash([]);
    line([[-40, -14.75], [40, -14.75]], wh, 0.08);
    // hatched no-parking box for the GPU
    x.save(); const [hu, hv] = P(-6, -7); x.strokeStyle = yl; x.lineWidth = 0.12 * k; x.strokeRect(hu, hv, 4 * k, 3 * k); for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(hu + i * 0.6 * k, hv); x.lineTo(hu + i * 0.6 * k + 0.6 * k, hv + 3 * k); x.stroke(); } x.restore();
    // stand number
    x.save(); const [nu, nv] = P(0, 9); x.translate(nu, nv); x.fillStyle = yl; x.font = `700 ${4 * k}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('12', 0, 0); x.restore();
    // wear: rubber + oil streaks along the lead-in line
    for (let i = 0; i < 40; i++) { const [u, v] = P((Math.random() - 0.5) * 3, -2 + Math.random() * 30); x.fillStyle = 'rgba(30,30,28,0.07)'; x.beginPath(); x.ellipse(u, v, 0.6 * k, 2.2 * k, 0, 0, 7); x.fill(); }
    const t = TX.tex(c, { aniso }); const m = new THREE.Mesh(new THREE.PlaneGeometry(M, M), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, Y + 0.012, -18); m.receiveShadow = true; // canvas top = z -58, bottom = z +22
    root.add(m);
  }

  /* ---- terminal building with glass facade ---- */
  const glassTex = (() => {
    const { c, x } = TX.canvas(1024, 512); const r = TX.rng(5);
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#9fb4c4'); g.addColorStop(0.5, '#5d7387'); g.addColorStop(1, '#33424f'); x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 6; j++) { if (r() < 0.25) { x.fillStyle = `rgba(255,236,190,${0.12 + r() * 0.2})`; x.fillRect(i * 42.7 + 3, j * 85 + 3, 37, 79); } }
    x.fillStyle = '#2b3138'; for (let i = 0; i <= 24; i++) x.fillRect(i * 42.7 - 2, 0, 4, 512); for (let j = 0; j <= 6; j++) x.fillRect(0, j * 85.3 - 3, 1024, 6);
    return c;
  })();
  const glassM = new THREE.MeshStandardMaterial({ map: TX.tex(glassTex, { aniso, repeat: [6, 1] }), roughness: 0.12, metalness: 0.55, envMapIntensity: 1.2 });
  const concM = new THREE.MeshStandardMaterial({ color: 0xc7c4bb, roughness: 0.85 }), darkM = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7 }), metalM = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: 0.4, metalness: 0.8 }), whiteM = new THREE.MeshStandardMaterial({ color: 0xeef0f1, roughness: 0.35, metalness: 0.1 }), greyM = new THREE.MeshStandardMaterial({ color: 0x8c9399, roughness: 0.5, metalness: 0.2 }), yellowM = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.55 }), blackM = new THREE.MeshStandardMaterial({ color: 0x151719, roughness: 0.6 }), roofM = new THREE.MeshStandardMaterial({ color: 0xd8dadb, roughness: 0.5, metalness: 0.4 });
  const TZ = -26; // facade
  const fac = new THREE.Mesh(new THREE.PlaneGeometry(200, 10), glassM); fac.position.set(0, Y + 4.2 + 5, TZ); root.add(fac);
  add(new THREE.BoxGeometry(200, 4.2, 1), concM, V(0, Y + 2.1, TZ - 0.4));
  add(new THREE.BoxGeometry(200, 15, 40), concM, V(0, Y + 7.5, TZ - 20.6));
  add(new THREE.BoxGeometry(204, 0.9, 8), roofM, V(0, Y + 14.6, TZ - 2.5));
  for (let i = -100; i <= 100; i += 12.5) add(new THREE.BoxGeometry(0.5, 14.2, 0.6), metalM, V(i, Y + 7.1, TZ + 0.3));
  for (let i = -98; i < 100; i += 7) add(new THREE.BoxGeometry(3.2, 2.6, 0.2), darkM, V(i, Y + 1.4, TZ + 0.12));
  // control tower in the distance (right)
  add(new THREE.CylinderGeometry(3.4, 4.2, 42, 20), concM, V(120, Y + 21, -150)); add(new THREE.CylinderGeometry(7.2, 5.6, 5, 20), glassM, V(120, Y + 44, -150)); add(new THREE.CylinderGeometry(7.6, 7.6, 1, 20), roofM, V(120, Y + 47, -150));
  // hangars far left
  for (let i = 0; i < 3; i++) { add(new THREE.BoxGeometry(60, 18, 50), new THREE.MeshStandardMaterial({ color: 0xb8bfc4, roughness: 0.7 }), V(-170 - i * 66, Y + 9, -60)); }
  // light masts
  for (const xm of [-34, 34, -100, 100]) { add(new THREE.CylinderGeometry(0.25, 0.4, 28, 10), greyM, V(xm, Y + 14, -12)); add(new RoundedBoxGeometry(3.4, 0.9, 1.2, 2, 0.2), darkM, V(xm, Y + 28.4, -12)); }

  /* ---- jet bridge to the left forward door (L1, ~3.5 m aft of the cockpit) ---- */
  {
    const rot = V(-17, 0, TZ + 4);
    add(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 20), whiteM, V(rot.x, Y + 5.2, rot.z)); add(new THREE.CylinderGeometry(0.6, 0.6, 3.6, 12), greyM, V(rot.x, Y + 1.8, rot.z));
    const cab = V(-3.6, 0, 3.4); const d = cab.clone().sub(rot); const len = d.length() - 2.2, ang = Math.atan2(d.x, d.z);
    const mid = rot.clone().add(d.clone().setLength(len / 2 + 1.0));
    const tun = new THREE.BoxGeometry(2.9, 2.9, len); add(tun, greyM, V(mid.x, Y + 4.95, mid.z), [0, ang, 0]);
    add(new THREE.BoxGeometry(3.0, 0.25, len), darkM, V(mid.x, Y + 3.45, mid.z), [0, ang, 0]);
    for (let i = 0; i < 9; i++) { const p = rot.clone().add(d.clone().setLength(2.4 + i * len / 9)); add(new THREE.BoxGeometry(2.95, 0.1, 0.08), metalM, V(p.x, Y + 6.38, p.z), [0, ang, 0]); }
    const wp = rot.clone().add(d.clone().setLength(len * 0.72));
    add(new THREE.BoxGeometry(0.5, 3.3, 0.5), greyM, V(wp.x - 0.9, Y + 1.7, wp.z), [0, ang, 0]); add(new THREE.BoxGeometry(0.5, 3.3, 0.5), greyM, V(wp.x + 0.9, Y + 1.7, wp.z), [0, ang, 0]);
    add(new RoundedBoxGeometry(3.0, 0.6, 1.2, 2, 0.15), darkM, V(wp.x, Y + 0.45, wp.z), [0, ang, 0]);
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 18), blackM, V(wp.x + s * 1.2, Y + 0.45, wp.z), [0, 0, Math.PI / 2]);
    // cab with canopy against the fuselage
    add(new RoundedBoxGeometry(3.4, 3.1, 3.0, 2, 0.15), whiteM, V(cab.x - 0.6, Y + 4.95, cab.z), [0, ang, 0]);
    add(new RoundedBoxGeometry(0.6, 3.2, 3.2, 2, 0.2), blackM, V(cab.x + 1.1, Y + 4.95, cab.z), [0, ang * 0.2, 0]);
    // generic stand guidance display on the facade, on the captain's side of the centreline
  }
  // stand guidance (generic): dark box with an LED "STOP" message
  const vd = (() => { const { c, x } = TX.canvas(256, 192); x.fillStyle = '#050505'; x.fillRect(0, 0, 256, 192); x.fillStyle = '#ff3a2a'; x.font = `700 64px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('STOP', 128, 70); x.fillStyle = '#ffd040'; x.font = `700 40px ${FONT}`; x.fillText('STAND 12', 128, 142); return c; })();
  const vdM = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: TX.tex(vd), emissiveIntensity: 2.2 })); vdM.position.set(-0.6, Y + 5.6, TZ + 0.45); root.add(vdM);
  add(new RoundedBoxGeometry(2.8, 2.3, 0.6, 2, 0.1), blackM, V(-0.6, Y + 5.6, TZ + 0.15));

  /* ---- neighbouring aircraft (generic twin-jet, no markings) ---- */
  function twinJet(px, pz, yaw = 0) {
    const g = new THREE.Group(); g.position.set(px, Y, pz); g.rotation.y = yaw;
    const prof = []; const Lf = 37; for (let i = 0; i <= 40; i++) { const t = i / 40, z = -Lf / 2 + t * Lf; let r = 1.98; if (t < 0.12) r = 1.98 * Math.sqrt(t / 0.12) * (0.25 + 0.75 * Math.sqrt(t / 0.12)); if (t > 0.78) r = 1.98 * (1 - Math.pow((t - 0.78) / 0.22, 1.6) * 0.82); prof.push(new THREE.Vector2(Math.max(0.05, r), z)); }
    const fus = new THREE.LatheGeometry(prof, 28); fus.rotateX(Math.PI / 2); const fm = new THREE.Mesh(fus, whiteM); fm.position.y = 3.5; fm.scale.set(1, 1.05, 1); g.add(fm);
    const belly = new THREE.Mesh(new THREE.CylinderGeometry(1.99, 1.99, 22, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76), greyM); belly.rotation.x = Math.PI / 2; belly.position.set(0, 3.5, 1); g.add(belly);
    const wingS = new THREE.Shape(); wingS.moveTo(0, 0); wingS.lineTo(17, 6.5); wingS.lineTo(17, 8.0); wingS.lineTo(0, 6.5); wingS.closePath();
    for (const s of [-1, 1]) {
      const wg = new THREE.ExtrudeGeometry(wingS, { depth: 0.35, bevelEnabled: false }); wg.rotateX(Math.PI / 2); const w = new THREE.Mesh(wg, whiteM); w.scale.x = s; w.position.set(s * 1.4, 2.4, -3); w.rotation.z = s * 0.09; g.add(w);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 4.2, 20), whiteM); eng.rotation.x = Math.PI / 2; eng.position.set(s * 5.8, 1.4, -2.6); g.add(eng);
      const inl = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 24), metalM); inl.position.set(s * 5.8, 1.4, -4.7); g.add(inl);
      const tp = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.2, 2.8), whiteM); tp.position.set(s * 3.4, 4.4, 15.5); tp.rotation.y = s * 0.35; g.add(tp);
    }
    const finS = new THREE.Shape(); finS.moveTo(0, 0); finS.lineTo(5.5, 0); finS.lineTo(7.0, 6.2); finS.lineTo(5.0, 6.2); finS.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finS, { depth: 0.3, bevelEnabled: false }), whiteM); fin.rotation.y = -Math.PI / 2; fin.position.set(0.15, 5.0, 12.5); g.add(fin);
    const ck = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), blackM); ck.scale.set(1.0, 0.45, 0.9); ck.position.set(0, 4.55, -15.6); g.add(ck);
    for (const [x, z] of [[0, -14], [-2.6, 0.5], [2.6, 0.5]]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), blackM); wh.rotation.z = Math.PI / 2; wh.position.set(x, 0.55, z); g.add(wh); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), greyM); leg.position.set(x, 1.6, z); g.add(leg); }
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    root.add(g); return g;
  }
  twinJet(-46, 2.5); twinJet(46, 2.5); twinJet(-120, 6);

  /* ---- ground equipment ---- */
  const gpu = new THREE.Group(); gpu.position.set(-4.2, Y, -5.5); root.add(gpu);
  { const b = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.1, 2.2, 2, 0.08), yellowM); b.position.y = 0.85; gpu.add(b); for (const [x, z] of [[-0.6, -0.8], [0.6, -0.8], [-0.6, 0.8], [0.6, 0.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 12), blackM); w.rotation.z = Math.PI / 2; w.position.set(x, 0.22, z); gpu.add(w); }
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.5, 1.0, 0.6), V(1.6, 0.05, 1.8), V(3.2, 0.05, 3.5), V(4.0, 1.6, 4.4)]), 30, 0.05, 6), blackM); gpu.add(cable); }
  // cones at the nose, chocks, a tug and baggage carts on the right
  for (const [x, z] of [[0, -3.6], [-1.2, -3.4], [1.2, -3.4]]) { add(new THREE.ConeGeometry(0.2, 0.7, 14), new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.6 }), V(x, Y + 0.35, z)); }
  add(new RoundedBoxGeometry(2.0, 1.2, 3.6, 2, 0.15), new THREE.MeshStandardMaterial({ color: 0x2c5f8a, roughness: 0.5 }), V(7.5, Y + 0.9, 6));
  for (let i = 0; i < 3; i++) { add(new THREE.BoxGeometry(1.6, 1.4, 2.6), new THREE.MeshStandardMaterial({ color: 0x6e7479, roughness: 0.6 }), V(7.5, Y + 1.0, 10 + i * 3.2)); add(new THREE.BoxGeometry(1.8, 0.1, 2.8), greyM, V(7.5, Y + 1.75, 10 + i * 3.2)); }
  // nose of our own aircraft below the windscreen + windscreen wipers + fuselage skin under the side windows
  {
    const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(new THREE.Vector2(Math.max(0.02, 2.0 * Math.pow(t, 0.55)), -3.0 + t * 3.0)); }
    const nose = new THREE.LatheGeometry(prof, 32); nose.rotateX(Math.PI / 2); const nm = new THREE.Mesh(nose, whiteM); nm.position.set(0, 0.55, -1.1); nm.scale.set(0.98, 0.78, 1); root.add(nm);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.02, 0.012, 0.62), blackM, V(s * 0.38, 1.07, -1.13), [0, s * 1.35, 0.2]); add(new THREE.BoxGeometry(0.035, 0.02, 0.5), blackM, V(s * 0.40, 1.06, -1.14), [0, s * 1.35, 0.2]); }
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9ecee, roughness: 0.4, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(2.0, 2.0, 4.0, 24, 1, true, s > 0 ? Math.PI * 0.55 : Math.PI * 1.05, Math.PI * 0.4); const m = new THREE.Mesh(g, skin); m.rotation.x = Math.PI / 2; m.position.set(0, 0.3, 1.3); root.add(m); }
  }
  for (const [mat, list] of merged) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; root.add(m); }
  // night: lit terminal, apron floodlights
  glassM.emissive = new THREE.Color(0xffe2a8); glassM.emissiveMap = glassM.map; glassM.emissiveIntensity = 0;
  const lamps = [];
  for (const xm of [-34, 34]) { const sp = new THREE.SpotLight(0xffe1b0, 0, 90, 0.75, 0.6, 2); sp.position.set(xm, Y + 28, -12); sp.target.position.set(xm * 0.4, Y, 4); root.add(sp, sp.target); lamps.push(sp);
    const head = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) })); head.position.set(xm, Y + 27.9, -11.35); head.rotation.x = -Math.PI / 2 + 0.3; root.add(head); lamps.push(head); }
  function setNight(k) { glassM.emissiveIntensity = 0.9 * k; for (const l of lamps) { if (l.isSpotLight) l.intensity = 700 * k; else l.material.color.setRGB(6 * k, 5.2 * k, 4 * k); } }
  return { root, gpu, setNight, update(sys) { gpu.visible = sys.st.elec.extAvail; } };
}
