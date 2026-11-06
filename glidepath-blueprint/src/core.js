/* Glidepath prototypes: shared 3D core (three.js r186, WebGL 2). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export { THREE };
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
export const norm360 = a => ((a % 360) + 360) % 360;
export const norm180 = a => { a = norm360(a); return a > 180 ? a - 360 : a; };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad3 = a => { const v = Math.round(norm360(a)) % 360; return String(v === 0 ? 360 : v).padStart(3, '0'); };
export const fmt = n => Math.round(n).toLocaleString('en-GB');
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** heading (deg, clockwise from north) to ground vector; north = -z, east = +x */
export const hdir = h => ({ x: Math.sin(h * D2R), z: -Math.cos(h * D2R) });
export const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
const LOW_POWER = (navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

/* ------------------------------------------------------------------ */
/* Stage: renderer + camera + orbit + post-processing + labels + loop  */
/* ------------------------------------------------------------------ */
/**
 * opts: { bg, cam:[x,y,z], target:[x,y,z], fov, near, far, minDist, maxDist, maxPolar,
 *         bloom:{strength,radius,threshold}|false, env:'room'|null, exposure, shadows, fog:[color,near,far] }
 */
export function createStage(host, o = {}) {
  const wrap = host.querySelector('.stage');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const maxPR = Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.5 : 2);
  let pr = maxPR;
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = o.exposure ?? 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (o.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; }
  renderer.localClippingEnabled = !!o.clipping;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  if (o.bg !== null) scene.background = new THREE.Color(o.bg ?? 0x0b1720);
  if (o.fog) scene.fog = new THREE.Fog(o.fog[0], o.fog[1], o.fog[2]);
  const camera = new THREE.PerspectiveCamera(o.fov || 45, 1, o.near || 0.05, o.far || 2000);
  camera.position.set(...(o.cam || [6, 4, 6]));
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.target.set(...(o.target || [0, 0, 0]));
  if (o.maxDist) controls.maxDistance = o.maxDist;
  if (o.minDist) controls.minDistance = o.minDist;
  controls.maxPolarAngle = o.maxPolar ?? Math.PI * 0.49;
  controls.update();

  const pmrem = new THREE.PMREMGenerator(renderer);
  if (o.env === 'room') scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // post-processing: MSAA half-float target -> bloom -> output (tone map + sRGB)
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: LOW_POWER ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let bloomPass = null;
  if (o.bloom !== false) {
    const b = o.bloom || {};
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), b.strength ?? 0.6, b.radius ?? 0.45, b.threshold ?? 1.6);
    composer.addPass(bloomPass);
  }
  composer.addPass(new OutputPass());

  const layer = document.createElement('div'); layer.className = 'labels'; wrap.appendChild(layer);
  const labels = [], lineMats = [], resizeFns = [], ticks = [];
  const v = new THREE.Vector3();
  let w = 0, h = 0;
  function resize() {
    w = wrap.clientWidth; h = wrap.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    lineMats.forEach(m => m.resolution.set(w * pr, h * pr));
    resizeFns.forEach(f => f(w, h));
  }
  new ResizeObserver(resize).observe(wrap); resize();

  // adaptive resolution: drop pixel ratio when frames are slow, raise it when fast
  let acc = 0, n = 0;
  function adapt(ms) {
    acc += ms; n++;
    if (n < 45) return;
    const avg = acc / n; acc = 0; n = 0;
    if (avg > 30 && pr > 0.75) { pr = Math.max(0.75, pr - 0.25); resize(); }
    else if (avg < 14 && pr < maxPR) { pr = Math.min(maxPR, pr + 0.25); resize(); }
  }

  let raf = 0, last = 0, visible = false;
  const S = {
    THREE, renderer, scene, camera, controls, composer, bloomPass, pmrem, wrap,
    get width() { return w; }, get height() { return h; },
    tick(fn) { ticks.push(fn); },
    onResize(fn) { resizeFns.push(fn); if (w && h) fn(w, h); },
    /** HTML label pinned to a 3D point. cls: muted | strong | pink | cyan | amber | green */
    label(text, pos, cls = '', obj = null, occ = 0) {
      const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; el.hidden = true;
      layer.appendChild(el); const l = { el, pos: pos.clone(), obj, occ, off: false }; labels.push(l); return l;
    },
    unlabel(l) { const i = labels.indexOf(l); if (i >= 0) labels.splice(i, 1); l.el.remove(); },
    /** screen-space-width line (Line2). opts: color, width(px), dashed, dashSize, gapSize, opacity, vertexColors(array) */
    fatLine(points, op = {}) {
      const g = new LineGeometry(); g.setPositions(points.flatMap(p => [p.x, p.y, p.z]));
      if (op.colors) g.setColors(op.colors);
      const m = new LineMaterial({ color: op.colors ? 0xffffff : (op.color ?? 0xffffff), linewidth: op.width ?? 3, dashed: !!op.dashed, dashSize: op.dashSize ?? 0.3, gapSize: op.gapSize ?? 0.2, transparent: op.opacity != null, opacity: op.opacity ?? 1, vertexColors: !!op.colors, worldUnits: !!op.worldUnits, depthWrite: op.depthWrite ?? true });
      m.resolution.set(w * pr || 1, h * pr || 1); lineMats.push(m);
      const L = new Line2(g, m); L.computeLineDistances(); L.userData.setPoints = pts => { g.setPositions(pts.flatMap(p => [p.x, p.y, p.z])); L.computeLineDistances(); };
      return L;
    },
    envFromScene(sc) { const old = scene.environment; scene.environment = pmrem.fromScene(sc, 0).texture; if (old && old.dispose) old.dispose(); },
    render() { composer.render(); }
  };

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dtRaw = Math.max(0, (t - last) / 1000 || 0); last = t;
    const dt = Math.min(0.05, dtRaw) * (REDUCED ? 0.5 : 1);
    const t0 = performance.now();
    for (const f of ticks) f(dt, t / 1000);
    controls.update();
    composer.render();
    for (const l of labels) {
      if (l.off) { l.el.hidden = true; continue; }
      v.copy(l.pos); if (l.obj) v.applyMatrix4(l.obj.matrixWorld);
      if (l.occ && v.dot(camera.position) < l.occ * l.occ) { l.el.hidden = true; continue; }
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { l.el.hidden = true; continue; }
      l.el.hidden = false;
      l.el.style.transform = `translate(-50%,-50%) translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    }
    adapt(performance.now() - t0 + (dtRaw > 0.2 ? 0 : 0));
  }
  function run(on) {
    if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  new IntersectionObserver(es => { for (const e of es) { visible = e.isIntersecting; run(visible && !document.hidden); } }, { rootMargin: '150px' }).observe(wrap);
  document.addEventListener('visibilitychange', () => run(visible && !document.hidden));
  return S;
}

/* ------------------------------------------------------------------ */
/* Sky + sun light + matching environment map                          */
/* ------------------------------------------------------------------ */
/** opts: elevation(deg), azimuth(deg, from north clockwise), turbidity, rayleigh, mie, mieG, scale, sunIntensity, shadow:{size,extent} */
export function addSky(S, o = {}) {
  const sky = new Sky(); sky.scale.setScalar(o.scale ?? 4000);
  const u = sky.material.uniforms;
  u.turbidity.value = o.turbidity ?? 6; u.rayleigh.value = o.rayleigh ?? 1.6;
  u.mieCoefficient.value = o.mie ?? 0.005; u.mieDirectionalG.value = o.mieG ?? 0.8;
  const sun = new THREE.Vector3();
  const el = (o.elevation ?? 25) * D2R, az = (o.azimuth ?? 135) * D2R;
  sun.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
  u.sunPosition.value.copy(sun);
  S.scene.add(sky);
  S.scene.background = null;
  // environment from sky only
  const envScene = new THREE.Scene(); const sky2 = sky.clone(); sky2.material = sky.material; envScene.add(sky2);
  S.envFromScene(envScene);
  S.scene.environmentIntensity = o.envIntensity ?? 0.35;
  S.renderer.toneMappingExposure = o.exposure ?? 0.55;
  const light = new THREE.DirectionalLight(o.sunColor ?? 0xfff2df, o.sunIntensity ?? 2.6);
  light.position.copy(sun).multiplyScalar(60);
  if (o.shadow) {
    light.castShadow = true; const e = o.shadow.extent ?? 20;
    light.shadow.mapSize.set(o.shadow.size ?? 2048, o.shadow.size ?? 2048);
    Object.assign(light.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 200 });
    light.shadow.bias = -0.0004; light.shadow.normalBias = 0.02; light.shadow.radius = 3;
  }
  S.scene.add(light); S.scene.add(light.target);
  const hemi = new THREE.HemisphereLight(o.skyColor ?? 0xbfd8ff, o.groundColor ?? 0x3a4a3a, o.hemi ?? 0.5); S.scene.add(hemi);
  return { sky, sun, light, hemi };
}

/* ------------------------------------------------------------------ */
/* Noise + terrain                                                     */
/* ------------------------------------------------------------------ */
const perlin = new ImprovedNoise();
export function noise3(x, y, z) { return perlin.noise(x, y, z); }
export function fbm(x, z, oct = 5, seed = 0.37) { let a = 0, f = 1, amp = 1, sum = 0; for (let i = 0; i < oct; i++) { a += perlin.noise(x * f, seed * 10 + i * 7.1, z * f) * amp; sum += amp; f *= 2.03; amp *= 0.5; } return a / sum; }

/**
 * Terrain mesh centred on origin. opts: size, seg, height(x,z)->y, color(y, slope, x, z)->[r,g,b] (linear 0..1)
 */
export function makeTerrain(o = {}) {
  const size = o.size ?? 60, seg = o.seg ?? 160;
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  const H = o.height || ((x, z) => fbm(x * 0.05, z * 0.05) * 3);
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  const nrm = g.attributes.normal;
  const C = o.color || ((y, s) => s > 0.35 ? [0.32, 0.30, 0.26] : [0.18 + y * 0.01, 0.30, 0.14]);
  for (let i = 0; i < p.count; i++) { const c = C(p.getY(i), 1 - nrm.getY(i), p.getX(i), p.getZ(i)); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.95, metalness: 0, flatShading: !!o.flat }));
  m.receiveShadow = true;
  return m;
}
/** Field patchwork colour for farmland (returns linear rgb) */
export function fieldColor(x, z, y = 0, s = 0) {
  const cx = Math.floor(x / 2.3 + fbm(x * 0.07, z * 0.07, 2) * 2), cz = Math.floor(z / 1.7 + fbm(z * 0.07, x * 0.07, 2) * 2);
  const k = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
  const base = k < 0.33 ? [0.16, 0.27, 0.09] : k < 0.6 ? [0.24, 0.31, 0.12] : k < 0.8 ? [0.35, 0.33, 0.17] : [0.13, 0.22, 0.08];
  const n = fbm(x * 0.6, z * 0.6, 2) * 0.06;
  if (s > 0.3) return [0.3, 0.28, 0.24];
  return [Math.max(0, base[0] + n), Math.max(0, base[1] + n), Math.max(0, base[2] + n * 0.5)];
}

/* ------------------------------------------------------------------ */
/* Generic light aircraft (low-wing trainer). Nose = -z, up = +y.      */
/* ------------------------------------------------------------------ */
export function makeAircraft(o = {}) {
  const s = o.scale ?? 1;
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: o.color ?? 0xf3f5f6, roughness: 0.32, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const accent = new THREE.MeshPhysicalMaterial({ color: o.accent ?? 0xb0206e, roughness: 0.35, clearcoat: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2a36, roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22282c, roughness: 0.6 });
  // fuselage: lathe profile (radius along length)
  const prof = [[0, -0.55], [0.05, -0.54], [0.085, -0.5], [0.1, -0.42], [0.108, -0.25], [0.108, -0.05], [0.1, 0.1], [0.075, 0.3], [0.045, 0.45], [0.02, 0.52], [0, 0.53]];
  const lat = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 28);
  lat.rotateX(Math.PI / 2); // lathe axis y -> z (nose at -z)
  const fus = new THREE.Mesh(lat, paint); g.add(fus);
  // stripe
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.109 * s, 0.104 * s, 0.3 * s, 28, 1, true), accent); stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.1 * s; stripe.scale.set(1, 1, 1); g.add(stripe);
  // canopy
  const can = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), glass); can.scale.set(0.8, 0.75, 1.9); can.position.set(0, 0.07 * s, -0.12 * s); g.add(can);
  // wing: aerofoil extrusion, tapered via scale
  const af = new THREE.Shape(); const c = 0.2 * s, t = 0.022 * s;
  af.moveTo(0, 0); for (let i = 1; i <= 20; i++) { const x = i / 20; af.lineTo(x * c, t * (2.97 * Math.sqrt(x) - 1.26 * x - 3.52 * x * x + 2.84 * x ** 3 - 1.015 * x ** 4) * 1.2); }
  for (let i = 19; i >= 0; i--) { const x = i / 20; af.lineTo(x * c, -t * 0.35 * (2.97 * Math.sqrt(x) - 1.26 * x - 3.52 * x * x + 2.84 * x ** 3 - 1.015 * x ** 4)); }
  const wg = new THREE.ExtrudeGeometry(af, { depth: 1.1 * s, bevelEnabled: false, steps: 1 });
  wg.translate(0, 0, -0.55 * s); wg.rotateY(Math.PI / 2); // span along x, chord along z (leading edge at -z)
  wg.translate(0, 0, 0);
  const wing = new THREE.Mesh(wg, paint); wing.position.set(0, -0.06 * s, -0.12 * s); wing.rotation.z = 0; g.add(wing);
  // wing tips accent
  [-1, 1].forEach(sd => { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012 * s, 0.02 * s, 0.2 * s), accent); tip.position.set(sd * 0.55 * s, -0.055 * s, -0.02 * s); g.add(tip); });
  // tailplane + fin
  const tp = new THREE.Mesh(new THREE.BoxGeometry(0.42 * s, 0.012 * s, 0.1 * s), paint); tp.position.set(0, 0.0, 0.46 * s); g.add(tp);
  const finS = new THREE.Shape(); finS.moveTo(0, 0); finS.lineTo(0.16 * s, 0); finS.lineTo(0.13 * s, 0.17 * s); finS.lineTo(0.07 * s, 0.17 * s); finS.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finS, { depth: 0.012 * s, bevelEnabled: false }), accent); fin.rotation.y = -Math.PI / 2; fin.position.set(0.006 * s, 0.03 * s, 0.37 * s); g.add(fin);
  // spinner + propeller disc
  const spin = new THREE.Mesh(new THREE.ConeGeometry(0.04 * s, 0.09 * s, 20), dark); spin.rotation.x = -Math.PI / 2; spin.position.z = -0.59 * s; g.add(spin);
  const prop = new THREE.Group(); prop.position.z = -0.57 * s; g.add(prop);
  [0, Math.PI].forEach(a => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.025 * s, 0.17 * s, 0.006 * s), dark); b.position.y = 0.085 * s; const p = new THREE.Group(); p.rotation.z = a; p.add(b); prop.add(p); });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18 * s, 32), new THREE.MeshBasicMaterial({ color: 0x9aa4aa, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })); disc.position.z = -0.575 * s; g.add(disc);
  // gear
  [[-0.12, -0.12], [0.12, -0.12], [0, -0.42]].forEach(([x, z]) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.025 * s, 0.015 * s, 14), dark); wh.rotation.z = Math.PI / 2; wh.position.set(x * s, -0.14 * s, z * s); g.add(wh); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.06 * s, 6), dark); leg.position.set(x * s, -0.11 * s, z * s); g.add(leg); });
  // nav lights (emissive, bloom)
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.2) })); navL.position.set(-0.56 * s, -0.05 * s, -0.05 * s); g.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 4, 0.5) })); navR.position.set(0.56 * s, -0.05 * s, -0.05 * s); g.add(navR);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.012 * s, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) })); strobe.position.set(0, 0.2 * s, 0.5 * s); g.add(strobe);
  g.traverse(m => { if (m.isMesh && m.material !== disc.material) { m.castShadow = true; } });
  let tt = 0;
  g.userData.update = dt => { tt += dt; prop.rotation.z += dt * 40; strobe.visible = (tt % 1.2) < 0.06; };
  return g;
}

/* ------------------------------------------------------------------ */
/* Arrows, glow sprites                                                */
/* ------------------------------------------------------------------ */
/** Solid arrow along +y from origin. call .setLength(L) */
export function makeArrow(color, o = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: o.glow ?? 0.6, roughness: 0.4 });
  const r = o.radius ?? 0.035, hr = o.headRadius ?? r * 2.6, hl = o.headLength ?? r * 6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 16), mat); const head = new THREE.Mesh(new THREE.ConeGeometry(hr, hl, 20), mat);
  g.add(shaft, head);
  g.userData.setLength = L => { const sl = Math.max(0.001, L - hl); shaft.scale.y = sl; shaft.position.y = sl / 2; head.position.y = sl + hl / 2; head.visible = L > 0.01; };
  g.userData.setLength(1);
  g.userData.mat = mat;
  return g;
}
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); _glowTex = new THREE.CanvasTexture(c); return _glowTex;
}
/** additive glow sprite; color can exceed 1 for bloom */
export function glowSprite(color, size = 0.3, intensity = 2) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}
/** round soft points material (for particles) */
export function softPointsMaterial(o = {}) {
  return new THREE.PointsMaterial({ size: o.size ?? 0.1, map: glowTexture(), color: o.color ?? 0xffffff, transparent: true, opacity: o.opacity ?? 0.9, depthWrite: false, blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, vertexColors: !!o.vertexColors, sizeAttenuation: true });
}
/** canvas text sprite for in-world labels that should occlude */
export function textSprite(text, o = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d'); const fs = 64;
  x.font = `700 ${fs}px ${MONO}`; const w = Math.ceil(x.measureText(text).width) + 24; c.width = w; c.height = fs + 24;
  x.font = `700 ${fs}px ${MONO}`; x.fillStyle = o.color ?? '#ffffff'; x.textBaseline = 'middle'; x.fillText(text, 12, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const h = o.height ?? 0.3; s.scale.set(h * w / c.height, h, 1); return s;
}

/* ------------------------------------------------------------------ */
/* Controls (DOM)                                                      */
/* ------------------------------------------------------------------ */
export function ui(host) {
  const box = host.querySelector('.controls'), out = host.querySelector('.readout');
  return {
    slider(id, label, min, max, value, step = 1, f = x => x) {
      const sid = host.id + '-' + id;
      const wrap = document.createElement('div'); wrap.className = 'ctl';
      wrap.innerHTML = `<label class="ctl-l" for="${sid}">${label}</label><output for="${sid}"></output><input type="range" id="${sid}" min="${min}" max="${max}" step="${step}" value="${value}">`;
      box.appendChild(wrap);
      const inp = wrap.querySelector('input'), o = wrap.querySelector('output'), fs = [];
      const show = () => { o.textContent = f(+inp.value); };
      inp.addEventListener('input', () => { show(); fs.forEach(fn => fn(+inp.value)); });
      show();
      return { get v() { return +inp.value; }, set v(x) { inp.value = x; show(); }, on(fn) { fs.push(fn); return this; } };
    },
    seg(id, label, opts, value) {
      const g = document.createElement('div'); g.className = 'ctl ctl-seg';
      g.innerHTML = `<span class="ctl-l" id="${host.id}-${id}-l">${label}</span><div class="seg" role="group" aria-labelledby="${host.id}-${id}-l"></div>`;
      const sg = g.querySelector('.seg'); let cur = value; const fs = [];
      const btns = opts.map(([val, txt]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.dataset.v = val;
        b.setAttribute('aria-pressed', String(val === cur));
        b.addEventListener('click', () => set(val)); sg.appendChild(b); return b;
      });
      function set(val) { cur = val; btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v == String(val)))); fs.forEach(fn => fn(cur)); }
      box.appendChild(g);
      return { get v() { return cur; }, set, on(fn) { fs.push(fn); return this; } };
    },
    button(label, fn) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn-sm'; b.textContent = label;
      b.addEventListener('click', fn); box.appendChild(b); return b;
    },
    readout(html) { out.innerHTML = html; }
  };
}
export function hiDPI(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = cv.getBoundingClientRect();
  const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}
/** draw a realistic instrument bezel (round), returns radius; ctx is translated to centre */
export function bezel(ctx, W, H) {
  const s = Math.min(W, H), r = s * 0.44;
  ctx.translate(W / 2, H / 2);
  const g1 = ctx.createLinearGradient(-r, -r, r, r); g1.addColorStop(0, '#4a5258'); g1.addColorStop(0.5, '#1d2226'); g1.addColorStop(1, '#3a4146');
  ctx.fillStyle = '#15191c'; ctx.beginPath(); ctx.roundRect(-r * 1.12, -r * 1.12, r * 2.24, r * 2.24, r * 0.12); ctx.fill();
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(0, 0, r * 1.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#090c0e'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a6268'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a * r * 0.98, b * r * 0.98, r * 0.045, 0, 7); ctx.fill(); ctx.strokeStyle = '#2a3034'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a * r * 0.98 - r * 0.03, b * r * 0.98); ctx.lineTo(a * r * 0.98 + r * 0.03, b * r * 0.98); ctx.stroke(); });
  return r;
}
export function glassGlare(ctx, r) {
  const g = ctx.createLinearGradient(-r, -r, r * 0.2, r * 0.4); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.5, 'rgba(255,255,255,0.02)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
}
