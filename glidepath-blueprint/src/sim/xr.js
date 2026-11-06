/* WebXR (immersive-vr): renders straight to the headset (no post-processing), XR camera rig at the pilot's eye. */
import { THREE } from '../core.js';

export async function xrSupported() {
  try { return !!(navigator.xr && window.isSecureContext && await navigator.xr.isSessionSupported('immersive-vr')); } catch (e) { return false; }
}
/** rig: Object3D placed at the pilot's eye (child of the aircraft). tick(dt, fromXR) advances the sim. */
export function createXR(S, rig, tick, onState) {
  const cam = new THREE.PerspectiveCamera(70, 1, 0.02, 60000); rig.add(cam); cam.layers.enable(1);
  let session = null;
  // never let the desktop post-processing chain draw while the headset is presenting
  const compRender = S.composer.render.bind(S.composer);
  S.composer.render = (...a) => { if (S.renderer.xr.isPresenting) return; compRender(...a); };
  async function enter() {
    if (session) { await session.end(); return; }
    session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
    S.renderer.xr.enabled = true; S.renderer.xr.setReferenceSpaceType('local');
    await S.renderer.xr.setSession(session);
    let last = performance.now();
    S.renderer.setAnimationLoop(t => { const dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t; tick(dt, true); S.renderer.render(S.scene, cam); });
    session.addEventListener('end', () => { S.renderer.setAnimationLoop(null); S.renderer.xr.enabled = false; session = null; onState(false); });
    onState(true);
  }
  return { enter, get presenting() { return !!session; } };
}
