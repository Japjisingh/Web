/* Panel toolkit for the jet flight deck: one crisp canvas decal per panel (labels, module outlines, fasteners),
   instanced pushbutton caps + legend faces (one atlas, emissive glow per instance for bloom), toggles,
   rotary selectors, guards and LCD windows. Static parts are merged per material to keep draw calls low. */
import { THREE } from '../core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FONT = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", sans-serif';
export const LCDFONT = '"JetBrains Mono", ui-monospace, Menlo, monospace';
export const LEG = { amber: '#ffae1a', white: '#f4f7ff', blue: '#45b8ff', green: '#3ff07e', red: '#ff3020', cyan: '#3fe8ff' };
const D2R = Math.PI / 180;

let _M = null, _noise = null;
let _wear = null;
/** paint wear: roughness variation, polished patches and fine scratches (roughness = map.g) */
export function wearTex() {
  if (_wear) return _wear; const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); let sd = 777; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.fillStyle = 'rgb(176,176,176)'; x.fillRect(0, 0, 512, 512);
  x.globalAlpha = 0.18; x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, 512, 512); x.globalAlpha = 1;
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(110,110,110,0.35)'); g.addColorStop(1, 'rgba(110,110,110,0)'); x.save(); x.translate(r() * 512, r() * 512); x.scale(20 + r() * 60, 10 + r() * 40); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore(); }
  x.strokeStyle = 'rgba(120,120,120,0.5)'; x.lineWidth = 0.6; for (let i = 0; i < 90; i++) { const a = r() * 6.28, l = 6 + r() * 30, X = r() * 512, Y = r() * 512; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (_wear = t);
}
let _smudge = null;
/** cover-glass smudges for displays (roughness = map.g) */
export function smudgeTex() {
  if (_smudge) return _smudge; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); let sd = 4242; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.fillStyle = 'rgb(22,22,22)'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) { const X = 30 + r() * 196, Y = 60 + r() * 180; for (let k = 0; k < 5; k++) { const g = x.createRadialGradient(X + k * 3, Y - k * 6, 0, X + k * 3, Y - k * 6, 9 + r() * 6); g.addColorStop(0, 'rgba(120,120,120,0.35)'); g.addColorStop(1, 'rgba(120,120,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); } }
  const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, 'rgba(90,90,90,0.18)'); g.addColorStop(0.5, 'rgba(90,90,90,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return (_smudge = new THREE.CanvasTexture(c));
}
function noiseTile() {
  if (_noise) return _noise; const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const id = x.createImageData(256, 256); let sd = 12345;
  for (let i = 0; i < id.data.length; i += 4) { sd = (sd * 16807) % 2147483647; const v = (sd / 2147483647) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0); return (_noise = c);
}
/** shared materials */
export function mats() {
  if (_M) return _M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  _M = {
    cap: std({ color: 0x24282c, roughness: 0.45, metalness: 0.05 }),
    knob: std({ color: 0x2a2e33, roughness: 0.5, metalness: 0.08 }),
    knobGrey: std({ color: 0x8d969c, roughness: 0.42, metalness: 0.2 }),
    white: std({ color: 0xe9ecee, roughness: 0.5 }),
    metal: std({ color: 0xb4babe, roughness: 0.32, metalness: 1 }),
    darkMetal: std({ color: 0x4a5056, roughness: 0.4, metalness: 0.9 }),
    black: std({ color: 0x0c0d0e, roughness: 0.55 }),
    bezel: std({ color: 0x2b3035, roughness: 0.6, metalness: 0.1 }),
    paint: std({ color: 0x55626d, roughness: 0.62, metalness: 0.05 }),
    paintDark: std({ color: 0x3c464f, roughness: 0.66, metalness: 0.05 }),
    guardRed: new THREE.MeshPhysicalMaterial({ color: 0xc0201c, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.62, clearcoat: 0.6, depthWrite: false }),
    guardClear: new THREE.MeshPhysicalMaterial({ color: 0xd8dde0, roughness: 0.15, transparent: true, opacity: 0.32, clearcoat: 0.8, depthWrite: false }),
    guardBlack: std({ color: 0x1a1c1f, roughness: 0.4 }),
    lcdGlass: new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.12, clearcoat: 1 }),
    dial: std({ color: 0xffffff, vertexColors: true, roughness: 0.48, metalness: 0.08 })
  };
  return _M;
}

/* -------- pushbutton bank: instanced caps + instanced legend faces with an emissive atlas -------- */
function faceMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0, map: tex, emissive: 0x000000 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uGain = { value: 22.0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRect; attribute vec3 aGlowT; attribute vec3 aGlowB; attribute vec2 aMode;\nvarying vec2 vAUv; varying vec2 vLUv; varying vec3 vGT; varying vec3 vGB; varying vec2 vMode;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLUv = uv; vAUv = vec2(mix(aRect.x, aRect.z, uv.x), mix(aRect.y, aRect.w, uv.y)); vGT = aGlowT; vGB = aGlowB; vMode = aMode;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGain; varying vec2 vAUv; varying vec2 vLUv; varying vec3 vGT; varying vec3 vGB; varying vec2 vMode;')
      .replace('#include <map_fragment>', 'vec4 lg = texture2D(map, vAUv); vec3 gl = vLUv.y > vMode.x ? vGT : vGB;\n float pm = vMode.y > 1.5 ? (vLUv.y > vMode.x ? 1.0 : 0.0) : vMode.y;\n diffuseColor.rgb = mix(vec3(0.016) + lg.rgb * 0.055, lg.rgb * 0.85 + 0.015, pm);')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += lg.rgb * gl * uGain;');
  };
  return m;
}

function createBank(parent, max, atlasW = 2048, atlasH = 1024) {
  const cv = document.createElement('canvas'); cv.width = atlasW; cv.height = atlasH;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, atlasW, atlasH);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const capGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
  const faceGeo = new THREE.PlaneGeometry(1, 1);
  const aRect = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), aGT = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3), aGB = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3), aMode = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  aGT.setUsage(THREE.DynamicDrawUsage); aGB.setUsage(THREE.DynamicDrawUsage);
  faceGeo.setAttribute('aRect', aRect); faceGeo.setAttribute('aGlowT', aGT); faceGeo.setAttribute('aGlowB', aGB); faceGeo.setAttribute('aMode', aMode);
  const caps = new THREE.InstancedMesh(capGeo, mats().cap, max), faces = new THREE.InstancedMesh(faceGeo, faceMaterial(tex), max);
  caps.count = faces.count = 0; caps.castShadow = true; caps.receiveShadow = true; faces.receiveShadow = true;
  parent.add(caps, faces);
  const B = { caps, faces, tex, ctx, items: [], ids: [], shelf: { x: 2, y: 2, h: 0 }, dirtyM: false, dirtyG: false };
  caps.userData.bank = B; faces.userData.bank = B;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  B.add = (id, x, y, z0, w, h, d, legend) => {
    const i = caps.count++; faces.count++;
    // atlas cell (shelf packing), cell height ~120 px, aspect follows the button face
    const ch = Math.round(120 * Math.min(1.4, Math.max(0.8, h / 0.019))), cw = Math.round(ch * w / h);
    if (B.shelf.x + cw > atlasW) { B.shelf.x = 2; B.shelf.y += B.shelf.h + 2; B.shelf.h = 0; }
    const cx = B.shelf.x, cy = B.shelf.y; B.shelf.x += cw + 2; B.shelf.h = Math.max(B.shelf.h, ch);
    drawLegend(ctx, cx, cy, cw, ch, legend);
    aRect.setXYZW(i, cx / atlasW, 1 - (cy + ch) / atlasH, (cx + cw) / atlasW, 1 - cy / atlasH);
    aMode.setXY(i, legend.single ? -1 : 0.5, legend.paint ? (legend.bar ? 2 : 1) : 0); // 2: printed caption, unprinted light bar
    const it = { i, id, x, y, z0, w, h, d, off: 0, offT: 0, legend, glowT: 0, glowB: 0 };
    B.items.push(it); B.ids[i] = id; place(it); return it;
  };
  function place(it) {
    p.set(it.x, it.y, it.z0 + it.d / 2 + it.off); s.set(it.w, it.h, it.d); m4.compose(p, q, s); caps.setMatrixAt(it.i, m4);
    p.set(it.x, it.y, it.z0 + it.d + it.off + 0.0003); s.set(it.w * 0.9, it.h * 0.9, 1); m4.compose(p, q, s); faces.setMatrixAt(it.i, m4);
    B.dirtyM = true;
  }
  B.setOff = (it, off) => { if (Math.abs(it.off - off) < 1e-5) return; it.off = off; place(it); };
  B.setGlow = (it, t, b) => {
    if (it.glowT === t && it.glowB === b) return; it.glowT = t; it.glowB = b;
    const cT = it.legend.topGlow || 1, cB = it.legend.botGlow || 1;
    aGT.setXYZ(it.i, t * cT, t * cT, t * cT); aGB.setXYZ(it.i, b * cB, b * cB, b * cB); B.dirtyG = true;
  };
  B.finish = () => { caps.instanceMatrix.needsUpdate = faces.instanceMatrix.needsUpdate = true; caps.computeBoundingSphere(); faces.computeBoundingSphere(); aRect.needsUpdate = aMode.needsUpdate = true; tex.needsUpdate = true; };
  B.flush = () => { if (B.dirtyM) { caps.instanceMatrix.needsUpdate = faces.instanceMatrix.needsUpdate = true; B.dirtyM = false; } if (B.dirtyG) { aGT.needsUpdate = aGB.needsUpdate = true; B.dirtyG = false; } };
  B.redrawAll = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, atlasW, atlasH); for (const it of B.items) { const a = aRect.array, k = it.i * 4; const cx = a[k] * atlasW, cy = (1 - a[k + 3]) * atlasH, cw = (a[k + 2] - a[k]) * atlasW, ch = (a[k + 3] - a[k + 1]) * atlasH; drawLegend(ctx, Math.round(cx), Math.round(cy), Math.round(cw), Math.round(ch), it.legend); } tex.needsUpdate = true; };
  return B;
}

/** legend cell: { top, topC, bot, botC, single, paint (printed caption), bar } */
function drawLegend(x, cx, cy, cw, ch, L) {
  x.save(); x.beginPath(); x.rect(cx, cy, cw, ch); x.clip();
  x.fillStyle = '#000'; x.fillRect(cx, cy, cw, ch);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const fit = (t, size, maxW) => { let s = size; x.font = `700 ${s}px ${FONT}`; while (x.measureText(t).width > maxW && s > 8) { s -= 1; x.font = `700 ${s}px ${FONT}`; } };
  const line = (t, col, ymid, size) => {
    const parts = String(t).split('\n'); const lh = size * 0.95;
    parts.forEach((p, k) => { fit(p, size, cw * 0.92); x.fillStyle = col; x.fillText(p, cx + cw / 2, ymid + (k - (parts.length - 1) / 2) * lh); });
  };
  const sz = ch * 0.36;
  if (L.single) line(L.top || '', LEG[L.topC] || L.topC || '#fff', cy + ch * 0.52, L.size ? ch * L.size : ch * (String(L.top).includes('\n') ? 0.27 : 0.36));
  else {
    if (L.top) line(L.top, LEG[L.topC] || L.topC, cy + ch * 0.26, L.topSize ? ch * L.topSize : sz);
    if (L.bot) line(L.bot, LEG[L.botC] || L.botC, cy + ch * 0.75, L.botSize ? ch * L.botSize : sz);
    if (L.bar) { x.fillStyle = LEG[L.botC] || '#fff'; x.fillRect(cx + cw * 0.2, cy + ch * 0.66, cw * 0.6, ch * 0.12); }
  }
  x.restore();
}

/* ------------------------------------------------------------------ */
/**
 * Panel: local frame x right, y up, +z towards the pilot; face at z=0, origin = panel centre.
 * Layout coordinates (u, v) are metres from the top-left corner of the decal (v grows downwards).
 * opts: { name, w, h, ppm, paint, atlas:[w,h], max }
 */
export function createPanel(o) {
  const M = mats();
  const P = { name: o.name, w: o.w, h: o.h, group: new THREE.Group(), ctls: {}, areas: [], hits: [], anims: [], lcds: [], ops: [], statics: new Map() };
  P.group.name = o.name;
  const maxSide = o.maxPx || 2048;
  const ppm = Math.min(o.ppm || 2900, maxSide / Math.max(o.w, o.h));
  const W = Math.round(o.w * ppm), H = Math.round(o.h * ppm);
  P.ppm = ppm; P.W = W; P.H = H;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const mainX = cv.getContext('2d'); let x = mainX;
  const gcv = document.createElement('canvas'); gcv.width = Math.round(W / 2); gcv.height = Math.round(H / 2); const gx = gcv.getContext('2d'); let glowPass = false;
  const TS = o.textScale || 1.4;
  // relief (bump) at a quarter resolution: plate seams and fastener holes
  const bc = document.createElement('canvas'); bc.width = Math.round(W / 2); bc.height = Math.round(H / 2); const bx = bc.getContext('2d');
  P.ctx = x; P.canvas = cv;
  let pscale = 1; const px = m => m * ppm * pscale;
  P.local = (u, v, z = 0) => new THREE.Vector3(u - o.w / 2, o.h / 2 - v, z);
  const bank = o.noBank ? null : createBank(P.group, o.max || 140, ...(o.atlas || [2048, 1024]));
  P.bank = bank;
  const paint = o.paint || '#4c5965';
  /* ---- decal drawing ops (recorded so they can be replayed once the web font has loaded) ---- */
  const op = (f, glow = false) => P.ops.push({ f, glow });
  P.text = (t, u, v, size0 = 0.0042, opt = {}) => op(() => {
    const size = size0 * (opt.noScale ? 1 : TS);
    x.save(); x.fillStyle = glowPass ? (opt.color && opt.color !== '#f2f4f5' ? opt.color : '#fff3dc') : opt.color || '#f2f4f5'; x.textAlign = opt.align || 'center'; x.textBaseline = opt.base || 'middle';
    x.font = `${opt.weight || 600} ${px(size)}px ${opt.font || FONT}`;
    if (opt.rot) { x.translate(px(u), px(v)); x.rotate(opt.rot); x.fillText(t, 0, 0); } else x.fillText(t, px(u), px(v));
    x.restore();
  }, true);
  P.line = (pts, opt = {}) => op(() => { x.save(); x.strokeStyle = glowPass ? '#fff3dc' : opt.color || '#f2f4f5'; x.lineWidth = px(opt.w || 0.0007); x.beginPath(); pts.forEach(([u, v], k) => k ? x.lineTo(px(u), px(v)) : x.moveTo(px(u), px(v))); if (opt.close) x.closePath(); x.stroke(); x.restore(); }, true);
  P.rect = (u, v, w, h, opt = {}) => op(() => { x.save(); if (opt.fill) { x.fillStyle = opt.fill; x.fillRect(px(u), px(v), px(w), px(h)); } if (opt.stroke !== false) { x.strokeStyle = opt.stroke || '#f2f4f5'; x.lineWidth = px(opt.w || 0.0007); x.strokeRect(px(u), px(v), px(w), px(h)); } x.restore(); });
  P.draw = (f, glow = false) => op(() => { x.save(); f(x, px, glowPass); x.restore(); }, glow);
  /** module: plate seam + title + group outline. Registers a touch area. */
  P.module = (id, title, u0, v0, u1, v1, opt = {}) => {
    P.areas.push({ id, title: opt.areaTitle || title, u0, v0, u1, v1, group: opt.group || null });
    op(() => {
      x.save();
      // plate: slightly different shade and a dark seam
      x.fillStyle = opt.plate || 'rgba(255,255,255,0.018)'; x.fillRect(px(u0), px(v0), px(u1 - u0), px(v1 - v0));
      x.strokeStyle = 'rgba(10,14,18,0.75)'; x.lineWidth = px(0.0012); x.strokeRect(px(u0), px(v0), px(u1 - u0), px(v1 - v0));
      x.strokeStyle = 'rgba(255,255,255,0.08)'; x.lineWidth = px(0.0005); x.strokeRect(px(u0 + 0.0012), px(v0 + 0.0012), px(u1 - u0 - 0.0024), px(v1 - v0 - 0.0024));
      // fasteners in the corners
      for (const [fu, fv] of [[u0 + 0.0045, v0 + 0.0045], [u1 - 0.0045, v0 + 0.0045], [u0 + 0.0045, v1 - 0.0045], [u1 - 0.0045, v1 - 0.0045]]) {
        const g = x.createRadialGradient(px(fu - 0.0006), px(fv - 0.0006), 0, px(fu), px(fv), px(0.0021)); g.addColorStop(0, '#9aa3aa'); g.addColorStop(1, '#3a434b');
        x.fillStyle = g; x.beginPath(); x.arc(px(fu), px(fv), px(0.0021), 0, 7); x.fill();
        x.strokeStyle = '#1b2026'; x.lineWidth = px(0.0005); x.beginPath(); x.moveTo(px(fu - 0.0015), px(fv + 0.0007)); x.lineTo(px(fu + 0.0015), px(fv - 0.0007)); x.stroke();
      }
      x.restore();
      bx.save(); bx.strokeStyle = '#000'; bx.lineWidth = Math.max(1, ppm * 0.0012 / 2); bx.strokeRect(px(u0) / 2, px(v0) / 2, px(u1 - u0) / 2, px(v1 - v0) / 2); bx.restore();
    });
    if (title) op(() => {
      x.save();
      {
        x.font = `700 ${px((opt.titleSize || 0.0052) * TS)}px ${FONT}`; x.textBaseline = 'middle';
        const tw = x.measureText(title).width + px(0.004), th = px(0.0072 * TS), tu = opt.titleAlign === 'center' ? px((u0 + u1) / 2) - tw / 2 : px(u0 + 0.008), tv = px(v0 + 0.0028);
        x.fillStyle = glowPass ? '#000' : paint; x.fillRect(tu, tv, tw, th);
        x.strokeStyle = glowPass ? '#fff3dc' : '#f2f4f5'; x.lineWidth = px(0.0006); x.strokeRect(tu, tv, tw, th);
        x.fillStyle = glowPass ? '#fff3dc' : '#f2f4f5'; x.textAlign = 'center'; x.fillText(title, tu + tw / 2, tv + th / 2 + px(0.0002));
      }
      x.restore();
    }, true);
  };
  /* ---- static geometry merged per material ---- */
  const tmpM = new THREE.Matrix4();
  P.static = (geo, mat, pos, rot = null, scale = null) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const e = rot ? new THREE.Euler(...rot) : new THREE.Euler(); tmpM.compose(pos, new THREE.Quaternion().setFromEuler(e), scale || new THREE.Vector3(1, 1, 1)); g.applyMatrix4(tmpM);
    if (!P.statics.has(mat)) P.statics.set(mat, []); P.statics.get(mat).push(g);
  };
  const reg = (id, c) => { c.id = id; c.panel = P; P.ctls[id] = c; return c; };
  const hit = (mesh, id) => { mesh.userData.ctl = id; P.hits.push(mesh); };
  /* ---- pushbutton ---- */
  P.pb = (id, u, v, L = {}) => {
    const w = L.w || 0.019, h = L.h || 0.019, d = L.d || 0.011;
    const p = P.local(u, v);
    // recess frame
    P.static(new RoundedBoxGeometry(w + 0.004, h + 0.004, 0.003, 1, 0.0012), M.black, new THREE.Vector3(p.x, p.y, 0.0012));
    const it = bank.add(id, p.x, p.y, 0.0, w, h, d, L);
    if (L.label) P.text(L.label, u, v - h / 2 - (L.labelGap || 0.0062), L.labelSize || 0.0041, { weight: 600 });
    if (L.label2) P.text(L.label2, u, v + h / 2 + 0.0055, L.labelSize || 0.0038);
    return reg(id, { kind: 'pb', it, u, v, w, h, size: Math.max(w, h), normalZ: d });
  };
  /** annunciator (flush light, not pressable) */
  P.ann = (id, u, v, L = {}) => { const c = P.pb(id, u, v, { d: 0.004, ...L }); c.kind = 'ann'; return c; };
  /* ---- guard over a pb ---- */
  P.guard = (id, u, v, w, h, style = 'red') => {
    const p = P.local(u, v);
    const hinge = new THREE.Group(); hinge.position.set(p.x, p.y + h / 2 + 0.002, 0.003); P.group.add(hinge);
    const mat = style === 'red' ? M.guardRed : style === 'black' ? M.guardBlack : M.guardClear;
    const t = 0.0016, depth = 0.017;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, h + 0.006, t), mat); top.position.set(0, -h / 2 - 0.003, depth); hinge.add(top);
    for (const sd of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(t, h + 0.006, depth), mat); side.position.set(sd * (w / 2 + 0.003), -h / 2 - 0.003, depth / 2); hinge.add(side); }
    const bot = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, t, depth), mat); bot.position.set(0, -h - 0.006, depth / 2); hinge.add(bot);
    hinge.children.forEach(m => { m.renderOrder = 2; hit(m, id); });
    // hinge pins
    P.static(new THREE.CylinderGeometry(0.0018, 0.0018, w + 0.01, 10), M.darkMetal, new THREE.Vector3(p.x, p.y + h / 2 + 0.002, 0.003), [0, 0, Math.PI / 2]);
    const c = P.ctls[id] || reg(id, { kind: 'pb', u, v, w, h, size: Math.max(w, h) });
    c.guard = { hinge, a: 0 };
    return c;
  };
  /* ---- toggle switch: positions bottom -> top; angles in degrees (+ = towards the top) ---- */
  P.tog = (id, u, v, opt = {}) => {
    const p = P.local(u, v); const n = opt.labels.length;
    P.static(new THREE.CylinderGeometry(0.0062, 0.0062, 0.0025, 6), M.metal, new THREE.Vector3(p.x, p.y, 0.0013), [Math.PI / 2, 0, 0]);
    P.static(new THREE.CylinderGeometry(0.0085, 0.0085, 0.001, 20), M.darkMetal, new THREE.Vector3(p.x, p.y, 0.0005), [Math.PI / 2, 0, 0]);
    const piv = new THREE.Group(); piv.position.set(p.x, p.y, 0.0025); P.group.add(piv);
    const L = opt.len || 0.021;
    const lev = new THREE.Mesh(new THREE.CylinderGeometry(0.0021, 0.0027, L, 12), M.metal); lev.rotation.x = Math.PI / 2; lev.position.z = L / 2; piv.add(lev);
    const tip = new THREE.Mesh(opt.paddle ? new RoundedBoxGeometry(0.0085, 0.006, 0.010, 2, 0.002) : new THREE.SphereGeometry(0.0034, 14, 10), opt.paddle ? M.knob : M.metal); tip.position.z = L + 0.002; piv.add(tip);
    lev.castShadow = tip.castShadow = false; // tiny: not worth a shadow-pass draw call
    hit(lev, id); hit(tip, id);
    // hit helper (bigger, invisible)
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.03, 0.03), new THREE.MeshBasicMaterial({ visible: false })); hb.position.set(p.x, p.y, 0.015); P.group.add(hb); hit(hb, id);
    const ang = opt.angles || (n === 2 ? [-28, 28] : [-30, 0, 30]);
    // position legends
    const lu = u + (opt.legendSide === 'left' ? -0.0115 : 0.0115);
    if (opt.legends !== false) opt.labels.forEach((t, k) => { const dv = n === 2 ? (k ? -0.0085 : 0.0085) : (k === 2 ? -0.011 : k === 1 ? 0 : 0.011); P.text(t, lu, v + dv, opt.legendSize || 0.0032, { align: opt.legendSide === 'left' ? 'right' : 'left', weight: 600 }); });
    if (opt.label) P.text(opt.label, u + (opt.labelDx || 0), v - (opt.labelGap || 0.022), opt.labelSize || 0.0041);
    return reg(id, { kind: 'tog', piv, ang, u, v, size: 0.02, a: null });
  };
  /* ---- rotary selector with pointer bar; angles clockwise from 12 o'clock ---- */
  P.rot = (id, u, v, opt = {}) => {
    const p = P.local(u, v), r = opt.r || 0.009;
    P.static(new THREE.CylinderGeometry(r * 1.25, r * 1.3, 0.002, 28), M.darkMetal, new THREE.Vector3(p.x, p.y, 0.001), [Math.PI / 2, 0, 0]);
    const piv = new THREE.Group(); piv.position.set(p.x, p.y, 0.002); P.group.add(piv);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.007, 28), M.knob); base.rotation.x = Math.PI / 2; base.position.z = 0.0035; piv.add(base);
    const bar = new THREE.Mesh(new RoundedBoxGeometry(r * 0.75, r * 2.6, 0.011, 2, 0.0018), M.knob); bar.position.set(0, 0, 0.012); piv.add(bar);
    const ln = new THREE.Mesh(new THREE.BoxGeometry(r * 0.16, r * 1.15, 0.0008), M.white); ln.position.set(0, r * 0.62, 0.0177); piv.add(ln);
    base.castShadow = bar.castShadow = false;
    hit(base, id); hit(bar, id);
    const ang = opt.angles || [-50, 0, 50];
    const R = r * (opt.legendR || 2.05);
    opt.labels.forEach((t, k) => { const a = ang[k] * D2R; const lu = u + Math.sin(a) * R, lv = v - Math.cos(a) * R; P.text(t, lu, lv, opt.legendSize || 0.0032, { weight: 600 }); P.line([[u + Math.sin(a) * r * 1.33, v - Math.cos(a) * r * 1.33], [u + Math.sin(a) * r * 1.6, v - Math.cos(a) * r * 1.6]], { w: 0.0005 }); });
    if (opt.label) P.text(opt.label, u, v + (opt.labelBelow ? r + 0.0075 : -(r * 2.05 + 0.0085)), opt.labelSize || 0.0041);
    return reg(id, { kind: 'rot', piv, ang, u, v, size: r * 2.4, a: null });
  };
  /** decorative knob (round, fluted) */
  P.knob = (u, v, r = 0.008, opt = {}) => {
    const p = P.local(u, v);
    const n = 24, pts = []; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = r * (i % 2 ? 0.94 : 1); pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: opt.h || 0.009, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 4 });
    P.static(g, opt.mat || M.knob, new THREE.Vector3(p.x, p.y, 0.0005));
    P.static(new THREE.BoxGeometry(r * 0.18, r * 0.7, 0.0006), M.white, new THREE.Vector3(p.x, p.y + r * 0.5, (opt.h || 0.009) + 0.0018));
    if (opt.id) { const hb = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 12), new THREE.MeshBasicMaterial({ visible: false })); hb.rotation.x = Math.PI / 2; hb.position.set(p.x, p.y, 0.006); P.group.add(hb); hit(hb, opt.id); reg(opt.id, { kind: 'deco', u, v, size: r * 2 }); }
  };
  /** working knob: turns (detents), pushes and pulls. One draw call (vertex-coloured: dark body, white index mark).
   *  opt.ring = { id, angles } adds a concentric selector ring underneath (registered as a rotary control). */
  P.dial = (id, u, v, r = 0.008, opt = {}) => {
    const p = P.local(u, v), h = opt.h || 0.009, ni = gg => gg.index ? gg.toNonIndexed() : gg;
    const g = new THREE.Group(); g.position.set(p.x, p.y, opt.z || 0.0005); P.group.add(g);
    const n = 24, pts = []; for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = r * (i % 2 ? 0.94 : 1); pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
    const body = ni(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: h, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0008, bevelSegments: 1, curveSegments: 4 }));
    const mark = ni(new THREE.BoxGeometry(r * 0.18, r * 0.7, 0.0006)); mark.translate(0, r * 0.5, h + 0.0018);
    for (const gg of [body, mark]) { for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k); if (!gg.attributes.uv) gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(gg.attributes.position.count * 2), 2)); }
    const col = (geo, c) => { const a = new Float32Array(geo.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) { a[i] = c[0]; a[i + 1] = c[1]; a[i + 2] = c[2]; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo; };
    const tone = opt.light ? [0.26, 0.29, 0.31] : [0.024, 0.028, 0.034];
    const geo = mergeGeometries([col(body, tone), col(mark, [0.82, 0.84, 0.85])], false);
    const m = new THREE.Mesh(geo, M.dial); m.castShadow = false; m.receiveShadow = true; g.add(m); hit(m, id);
    const c = reg(id, { kind: 'dial', obj: g, z0: g.position.z, u, v, size: r * 2.6, a: null, step: opt.step || 15 });
    if (opt.ring) {
      const rg = new THREE.Group(); rg.position.set(p.x, p.y, 0.0005); P.group.add(rg);
      const R = r * 1.5, disc = ni(new THREE.CylinderGeometry(R, R * 1.03, 0.0035, 32)); disc.rotateX(Math.PI / 2); disc.translate(0, 0, 0.00175);
      const tab = ni(new THREE.BoxGeometry(r * 0.42, r * 0.5, 0.0035)); tab.translate(0, R + r * 0.18, 0.00175);
      const tmk = ni(new THREE.BoxGeometry(r * 0.12, r * 0.45, 0.0006)); tmk.translate(0, R * 0.92, 0.0039);
      for (const gg of [disc, tab, tmk]) for (const k of Object.keys(gg.attributes)) if (!['position', 'normal', 'uv'].includes(k)) gg.deleteAttribute(k);
      const rm = new THREE.Mesh(mergeGeometries([col(disc, [0.05, 0.055, 0.06]), col(tab, [0.05, 0.055, 0.06]), col(tmk, [0.82, 0.84, 0.85])], false), M.dial); rm.castShadow = false; rg.add(rm); hit(rm, opt.ring.id);
      reg(opt.ring.id, { kind: 'rot', piv: rg, ang: opt.ring.angles, u, v: v - R * 0.9, size: R * 2.2, a: null });
    }
    return c;
  };
  P.screw = (u, v) => { const p = P.local(u, v); P.static(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0012, 10), M.metal, new THREE.Vector3(p.x, p.y, 0.0006), [Math.PI / 2, 0, 0]); };
  /* ---- LCD window: own small canvas texture, emissive ---- */
  P.lcd = (id, u, v, w, h, draw, opt = {}) => {
    const p = P.local(u, v);
    const cw = Math.round(opt.px || Math.min(512, w * 9000)), ch = Math.round(cw * h / w);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const cx = c.getContext('2d');
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: opt.gain || 1.6, roughness: 0.18, metalness: 0 }));
    m.position.set(p.x, p.y, opt.z ?? 0.0021); P.group.add(m);
    P.static(new RoundedBoxGeometry(w + 0.004, h + 0.004, 0.002, 1, 0.001), M.black, new THREE.Vector3(p.x, p.y, 0.0005));
    const L = { id, c, x: cx, t, w: cw, h: ch, draw, last: '' }; P.lcds.push(L);
    if (id) { hit(m, id); if (!P.ctls[id]) reg(id, { kind: 'ind', u, v, size: Math.max(w, h) }); }
    return L;
  };
  P.updateLCDs = (sys) => { for (const L of P.lcds) { const key = L.draw(null, L.w, L.h, sys, true); if (key === L.last) continue; L.last = key; L.x.fillStyle = '#000'; L.x.fillRect(0, 0, L.w, L.h); L.draw(L.x, L.w, L.h, sys, false); L.t.needsUpdate = true; } };
  /* ---- custom moving part registered as a control ---- */
  P.custom = (id, obj, kind, extra = {}) => { obj.traverse(m => { if (m.isMesh && m.material.visible !== false) { m.castShadow = true; } if (m.isMesh) hit(m, id); }); return reg(id, { kind, obj, ...extra }); };
  P.hitMesh = hit; P.reg = reg;
  /* ---- finish: decal + body + merged statics ---- */
  P.finish = () => {
    P.redraw();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    const btex = new THREE.CanvasTexture(bc); btex.anisotropy = 8;
    P.decalTex = tex; P.bumpTex = btex;
    const gtex = new THREE.CanvasTexture(gcv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8; P.glowTex = gtex;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, roughnessMap: wearTex(), metalness: 0.05, bumpMap: btex, bumpScale: 1.2, emissive: 0xffe2b8, emissiveMap: gtex, emissiveIntensity: 0 }));
    P.faceMat = face.material;
    face.receiveShadow = true; face.userData.panel = P; P.group.add(face); P.face = face; P.hits.push(face);
    if (!o.noBody) { const body = new THREE.Mesh(new THREE.BoxGeometry(o.w, o.h, 0.02), M.paintDark); body.position.z = -0.0101; body.receiveShadow = true; body.castShadow = true; P.group.add(body); }
    for (const [mat, list] of P.statics) { const g = mergeGeometries(list, false); if (!g) continue; const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; P.group.add(m); }
    P.statics.clear();
    if (bank) { bank.finish(); P.hits.push(bank.caps, bank.faces); }
  };
  P.redraw = () => {
    x.fillStyle = paint; x.fillRect(0, 0, W, H);
    // fine paint texture (tiled noise pattern, no readback)
    x.save(); x.globalAlpha = 0.05; x.fillStyle = x.createPattern(noiseTile(), 'repeat'); x.fillRect(0, 0, W, H); x.restore();
    bx.fillStyle = '#808080'; bx.fillRect(0, 0, bc.width, bc.height);
    for (const o2 of P.ops) o2.f();
    // integral-lighting layer: lettering only, half resolution
    x = gx; pscale = 0.5; glowPass = true; gx.fillStyle = '#000'; gx.fillRect(0, 0, gcv.width, gcv.height);
    for (const o2 of P.ops) if (o2.glow) o2.f();
    x = mainX; pscale = 1; glowPass = false;
    if (P.glowTex) P.glowTex.needsUpdate = true;
    if (P.decalTex) { P.decalTex.needsUpdate = true; P.bumpTex.needsUpdate = true; }
    if (bank) bank.redrawAll();
  };
  /** area at a local hit point */
  P.areaAt = (lp) => { const u = lp.x + o.w / 2, v = o.h / 2 - lp.y; let best = null; for (const a of P.areas) if (u >= a.u0 && u <= a.u1 && v >= a.v0 && v <= a.v1) { if (!best || (a.u1 - a.u0) * (a.v1 - a.v0) < (best.u1 - best.u0) * (best.v1 - best.v0)) best = a; } return best; };
  P.areaById = id => P.areas.find(a => a.id === id);
  return P;
}
