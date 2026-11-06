/* Render quality presets for the sim. Exposes host.__quality and fires a 'sim-quality' CustomEvent on host. */
import { THREE } from '../core.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

export const LEVELS = {
  low: { label: 'Low', pixelRatio: 1, shadowMap: 1024, shadowRadius: 2, ao: false, aoSamples: 0, cloudRes: 0.3, cloudSteps: 'low' },
  medium: { label: 'Medium', pixelRatio: 1.5, shadowMap: 2048, shadowRadius: 3, ao: false, aoSamples: 0, cloudRes: 0.4, cloudSteps: 'medium' },
  high: { label: 'High', pixelRatio: 2, shadowMap: 2048, shadowRadius: 3, ao: true, aoSamples: 12, cloudRes: 0.5, cloudSteps: 'high' },
  ultra: { label: 'Ultra', pixelRatio: 2, shadowMap: 4096, shadowRadius: 4, ao: true, aoSamples: 16, cloudRes: 0.65, cloudSteps: 'ultra' }
};
export const AUTO_LEVEL = ((navigator.hardwareConcurrency || 8) <= 4 || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) ? 'medium' : 'high';

/** S: stage, light: shadow-casting DirectionalLight */
export function createQuality(S, host, light) {
  const R = S.renderer, comp = S.composer;
  let cap = 2, gtao = null, level = null;
  // clamp every pixel-ratio change the stage makes (it adapts resolution on its own)
  const rSet = R.setPixelRatio.bind(R), cSet = comp.setPixelRatio.bind(comp);
  R.setPixelRatio = v => rSet(Math.min(v, cap)); comp.setPixelRatio = v => cSet(Math.min(v, cap));
  function ensureAO(on, samples) {
    if (on && !gtao) {
      const pr = R.getPixelRatio();
      gtao = new GTAOPass(S.scene, S.camera, Math.max(1, S.width * pr), Math.max(1, S.height * pr));
      gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      comp.insertPass(gtao, 1);
    }
    if (gtao) { gtao.enabled = on; if (on) gtao.updateGtaoMaterial({ samples }); }
  }
  function set(name) {
    const L = LEVELS[name] || LEVELS[AUTO_LEVEL]; level = name in LEVELS ? name : AUTO_LEVEL;
    cap = L.pixelRatio;
    const pr = Math.min(window.devicePixelRatio || 1, cap);
    rSet(pr); R.setSize(S.width, S.height, false); cSet(pr); comp.setSize(S.width, S.height);
    if (light && light.shadow) { if (light.shadow.mapSize.x !== L.shadowMap) { light.shadow.mapSize.set(L.shadowMap, L.shadowMap); if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; } } light.shadow.radius = L.shadowRadius; }
    try { ensureAO(L.ao, L.aoSamples); } catch (e) { console.warn('AO unavailable', e); }
    const detail = { level, ...L };
    host.__quality = detail;
    host.dispatchEvent(new CustomEvent('sim-quality', { detail }));
    return detail;
  }
  return { set, get level() { return level; }, get ao() { return gtao; } };
}
