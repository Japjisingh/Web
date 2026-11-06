/* Final cinematic pass (after tone mapping): attention focus (darken + desaturate away from the guided target),
   vignette, subtle chromatic fringe at the edges and film grain. */
import { THREE } from '../core.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function createFinishPass() {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1.6 }, uFocus: { value: new THREE.Vector3(0.5, 0.5, 0.2) }, uDim: { value: 0 }, uVig: { value: 0.32 }, uGrain: { value: 0.035 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAspect, uDim, uVig, uGrain; uniform vec3 uFocus; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d * vec2(uAspect / 1.6, 1.0), d * vec2(uAspect / 1.6, 1.0));
        vec2 off = d * 0.0007 * r2 * 4.0;
        vec4 c = texture2D(tDiffuse, vUv); c.r = texture2D(tDiffuse, vUv + off).r; c.b = texture2D(tDiffuse, vUv - off).b;
        // attention focus around the guided target
        vec2 fd = (vUv - uFocus.xy) * vec2(uAspect, 1.0); float f = smoothstep(uFocus.z, uFocus.z * 2.6, length(fd));
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(c.rgb, mix(c.rgb, vec3(l), 0.45) * 0.55, f * uDim);
        // vignette
        c.rgb *= 1.0 - uVig * smoothstep(0.12, 0.62, r2 * 1.6);
        // grain (luma weighted)
        float n = h(vUv * vec2(1931.0, 1173.0) + fract(uTime * 7.31)) - 0.5;
        c.rgb += n * uGrain * (0.35 + 0.65 * (1.0 - l));
        gl_FragColor = vec4(c.rgb, 1.0);
      }`
  });
  return pass;
}
