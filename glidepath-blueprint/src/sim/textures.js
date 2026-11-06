/* Procedural textures for the C172-class model: livery, panel-line/rivet normal maps, leather, fabric, decals. */
import { THREE } from '../core.js';

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d') }; }
export function tex(c, { srgb = true, repeat = null, aniso = 8, flipY = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.flipY = flipY;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); } return t;
}
/** height (Float32Array, w*h, 0..1) -> tangent-space normal map canvas */
export function heightToNormal(H, w, h, strength = 2, wrapX = true) {
  const { c, x } = canvas(w, h), img = x.createImageData(w, h), d = img.data;
  const at = (i, j) => H[((j + h) % h) * w + (wrapX ? (i + w) % w : Math.max(0, Math.min(w - 1, i)))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
export function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

/** stitched leather: colour + normal maps */
export function leather(base = [74, 58, 46], seed = 3) {
  const w = 512, h = 512, r = rng(seed), H = new Float32Array(w * h);
  // grain: sum of random blobs
  for (let k = 0; k < 9000; k++) { const cx = r() * w, cy = r() * h, rad = 1 + r() * 3, a = 0.04 + r() * 0.05; for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const d = Math.hypot(i, j); if (d > rad) continue; const X = (((cx + i) | 0) + w) % w, Y = (((cy + j) | 0) + h) % h; H[Y * w + X] += a * (1 - d / rad); } }
  // pleats (vertical channels) and stitches
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const u = i / w; const ch = Math.abs(((u * 4) % 1) - 0.5); H[j * w + i] += ch < 0.03 ? -0.35 : 0.25 * Math.sqrt(Math.max(0, 0.25 - (ch - 0.25) ** 2)); }
  const n = heightToNormal(H, w, h, 3.5);
  const { c, x } = canvas(w, h); const img = x.createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const v = 0.85 + H[i] * 0.4; img.data[i * 4] = base[0] * v; img.data[i * 4 + 1] = base[1] * v; img.data[i * 4 + 2] = base[2] * v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(220,205,180,0.55)'; x.setLineDash([5, 5]); x.lineWidth = 1.5;
  for (let k = 1; k < 4; k++) { for (const o of [-6, 6]) { x.beginPath(); x.moveTo(k * w / 4 + o, 0); x.lineTo(k * w / 4 + o, h); x.stroke(); } }
  return { map: c, normal: n };
}
/** woven fabric */
export function fabric(col = '#3b3e42', line = '#4c5055', n = 3, seed = 5) {
  const w = 256, h = 256, r = rng(seed), H = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H[j * w + i] = 0.5 + 0.25 * Math.sin(i / n * Math.PI) * Math.sin(j / n * Math.PI) + (r() - 0.5) * 0.15;
  const { c, x } = canvas(w, h); x.fillStyle = col; x.fillRect(0, 0, w, h); x.globalAlpha = 0.25; x.fillStyle = line;
  for (let i = 0; i < w; i += n) { x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); } x.globalAlpha = 1;
  return { map: c, normal: heightToNormal(H, w, h, 1.2) };
}
/** fine noise (roughness / bump) */
export function grain(w = 256, h = 256, base = 150, amp = 70, seed = 7) {
  const { c, x } = canvas(w, h), img = x.createImageData(w, h), r = rng(seed);
  for (let i = 0; i < w * h; i++) { const v = base + (r() - 0.5) * amp; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0); return c;
}
/** text decal (transparent canvas) */
export function decal(w, h, draw) { const { c, x } = canvas(w, h); draw(x, w, h); return c; }
