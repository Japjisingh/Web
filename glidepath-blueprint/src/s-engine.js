/* Four-stroke air-cooled aviation cylinder, cutaway (Airframes, Systems & Powerplant). */
import { createStage, glowSprite, softPointsMaterial, ui, THREE, D2R, V3, REDUCED } from './core.js';

export default function (host) {
  const S = createStage(host, {
    bg: 0x0b161d, env: 'room', shadows: true, clipping: true, exposure: 1.0,
    cam: [2.9, 2.75, 4.9], target: [0, 1.8, 0], minDist: 2.5, maxDist: 14, maxPolar: Math.PI * 0.85,
    bloom: { strength: 0.75, radius: 0.4, threshold: 1.3 }
  });
  const { scene } = S;
  scene.environmentIntensity = 0.75;

  /* ---- studio backdrop: vignette background, plinth, lights ---- */
  {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 110, 10, 128, 128, 190); g.addColorStop(0, '#22343f'); g.addColorStop(1, '#060b0f');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  }
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.14, 64), new THREE.MeshStandardMaterial({ color: 0x1a2329, roughness: 0.7, metalness: 0.2 }));
  plinth.position.y = -1.25; plinth.receiveShadow = true; scene.add(plinth);
  const key = new THREE.DirectionalLight(0xfff4e6, 2.4); key.position.set(4, 8, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3, near: 1, far: 25 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 3; scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fc8ff, 1.3); rim.position.set(-5, 3, -5); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1410, 0.35));

  /* ---- materials ---- */
  const clip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)]; // removes the half nearest the viewer (z > 0)
  const M = (o) => new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, clippingPlanes: clip, clipShadows: true }, o));
  const hatch = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#8e3d35'; x.fillRect(0, 0, 64, 64); x.strokeStyle = 'rgba(60,14,10,0.35)'; x.lineWidth = 3;
    for (let i = -64; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 64, 0); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const cutMat = new THREE.MeshStandardMaterial({ map: hatch, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const alu = M({ color: 0xc3c8cc, metalness: 0.85, roughness: 0.42 });
  const barrelPaint = M({ color: 0x5b6670, metalness: 0.35, roughness: 0.5 });
  const casePaint = M({ color: 0x5f676e, metalness: 0.5, roughness: 0.5 });
  const pistonMat = M({ color: 0xd8dcde, metalness: 0.85, roughness: 0.28 });
  const ringMat = M({ color: 0x30363b, metalness: 0.9, roughness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 1, roughness: 0.22 });
  const forged = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, metalness: 0.95, roughness: 0.34 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x4a5056, metalness: 0.9, roughness: 0.4 });
  const ceramic = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.25, metalness: 0 });
  const intakeMat = M({ color: 0x6f8aa3, metalness: 0.7, roughness: 0.35 });
  const exhaustMat = M({ color: 0x6d5a4e, metalness: 0.8, roughness: 0.45, emissive: new THREE.Color(1.0, 0.35, 0.08), emissiveIntensity: 0 });
  const shadowAll = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };

  /** lathe solid of a closed (r, y) profile, clipped in half, with hatched cut faces at z = 0 */
  function latheCut(prof, mat, holes = [], seg = 96) {
    const g = new THREE.Group();
    const v2 = prof.map(([r, y]) => new THREE.Vector2(r, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(v2, seg), mat));
    const sh = new THREE.Shape(v2);
    holes.forEach(h => sh.holes.push(new THREE.Path(h.map(([r, y]) => new THREE.Vector2(r, y)))));
    const sg = new THREE.ShapeGeometry(sh);
    const c1 = new THREE.Mesh(sg, cutMat), c2 = new THREE.Mesh(sg, cutMat); c2.scale.x = -1;
    g.add(c1, c2);
    return shadowAll(g);
  }

  /* ---- geometry constants ---- */
  const rc = 0.55, Lr = 1.9, ROOF = 2.95, LIFT = 0.12;

  /* ---- cylinder barrel with cooling fins ---- */
  {
    const p = [[0.66, 1.30], [0.66, ROOF], [0.74, ROOF]];
    for (let y = 2.9; y > 1.45; y -= 0.1) { const ro = 0.93 + 0.1 * (y - 1.45) / 1.45; p.push([0.74, y], [ro, y], [ro, y - 0.035], [0.74, y - 0.035]); }
    p.push([0.74, 1.38], [0.92, 1.38], [0.92, 1.30]);
    scene.add(latheCut(p, barrelPaint));
  }
  /* ---- cylinder head (finned) with port and valve-guide channels in the cut face ---- */
  {
    const p = [[0, ROOF], [0.8, ROOF], [0.8, 3.25]];
    for (let y = 3.25; y < 3.42; y += 0.06) p.push([1.08, y], [1.08, y + 0.03], [0.8, y + 0.03], [0.8, y + 0.06]);
    p.push([0.8, 3.45], [0, 3.45]);
    const hole = [[0.13, 2.955], [0.47, 2.955], [0.47, 3.04], [0.78, 3.04], [0.78, 3.2], [0.33, 3.2], [0.33, 3.44], [0.27, 3.44], [0.27, 3.2], [0.2, 3.15], [0.13, 3.0]];
    scene.add(latheCut(p, alu, [hole]));
  }
  /* ---- crankcase: U-section walls, back plate, deck ---- */
  {
    const u = new THREE.Shape();
    u.moveTo(-1.35, 1.30); u.lineTo(-1.35, -0.8); u.quadraticCurveTo(-1.35, -1.05, -1.1, -1.05); u.lineTo(1.1, -1.05); u.quadraticCurveTo(1.35, -1.05, 1.35, -0.8);
    u.lineTo(1.35, 1.30); u.lineTo(1.2, 1.30); u.lineTo(1.2, -0.75); u.quadraticCurveTo(1.2, -0.9, 1.05, -0.9); u.lineTo(-1.05, -0.9); u.quadraticCurveTo(-1.2, -0.9, -1.2, -0.75); u.lineTo(-1.2, 1.30); u.closePath();
    const walls = new THREE.Mesh(new THREE.ExtrudeGeometry(u, { depth: 1.7, bevelEnabled: false, curveSegments: 10 }), casePaint); walls.position.z = -0.85; scene.add(walls);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(u, 10), cutMat); scene.add(cap);
    const bp = new THREE.Shape(); bp.moveTo(-1.35, -0.8); bp.quadraticCurveTo(-1.35, -1.05, -1.1, -1.05); bp.lineTo(1.1, -1.05); bp.quadraticCurveTo(1.35, -1.05, 1.35, -0.8); bp.lineTo(1.35, 1.30); bp.lineTo(-1.35, 1.30); bp.closePath();
    const hb = new THREE.Path(); hb.absarc(0, 0, 0.26, 0, Math.PI * 2, false); bp.holes.push(hb);
    const back = new THREE.Mesh(new THREE.ExtrudeGeometry(bp, { depth: 0.12, bevelEnabled: false, curveSegments: 24 }), casePaint); back.position.z = -0.97; scene.add(back);
    const dk = new THREE.Shape(); dk.moveTo(-1.35, -0.85); dk.lineTo(1.35, -0.85); dk.lineTo(1.35, 0.85); dk.lineTo(-1.35, 0.85); dk.closePath();
    const hd = new THREE.Path(); hd.absarc(0, 0, 0.7, 0, Math.PI * 2, false); dk.holes.push(hd);
    const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(dk, { depth: 0.08, bevelEnabled: false, curveSegments: 40 }), casePaint); deck.rotation.x = Math.PI / 2; deck.position.y = 1.30; scene.add(deck);
    [-1, 1].forEach(sd => { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.08), cutMat); r.position.set(sd * 1.025, 1.26, 0); scene.add(r); });
    shadowAll(walls); shadowAll(back); shadowAll(deck);
  }

  /* ---- piston (hollow, ringed) + wrist pin ---- */
  const piston = new THREE.Group(); scene.add(piston);
  {
    const p = [[0, 0.31], [0.645, 0.31]];
    [0.26, 0.19, 0.12].forEach(y => p.push([0.645, y], [0.618, y], [0.618, y - 0.025], [0.645, y - 0.025]));
    p.push([0.645, -0.31], [0.59, -0.31], [0.59, 0.19], [0, 0.19]);
    piston.add(latheCut(p, pistonMat));
    [0.2475, 0.1775, 0.1075].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.632, 0.011, 8, 96), ringMat); r.rotation.x = Math.PI / 2; r.position.y = y; piston.add(r); });
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.18, 24), M({ color: 0xd0d5d9, metalness: 1, roughness: 0.2 })); pin.rotation.x = Math.PI / 2; piston.add(pin);
    shadowAll(piston);
  }
  /* ---- connecting rod (I-beam) ---- */
  const rod = new THREE.Group(); scene.add(rod);
  {
    const big = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 32), forged); big.rotation.x = Math.PI / 2; rod.add(big);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.17, 24), darkSteel); cap.rotation.x = Math.PI / 2; rod.add(cap);
    const small = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.14, 28), forged); small.rotation.x = Math.PI / 2; small.position.y = Lr; rod.add(small);
    const web = new THREE.Shape(); web.moveTo(-0.13, 0.18); web.lineTo(0.13, 0.18); web.lineTo(0.075, Lr - 0.1); web.lineTo(-0.075, Lr - 0.1); web.closePath();
    const wm = new THREE.Mesh(new THREE.ExtrudeGeometry(web, { depth: 0.05, bevelEnabled: false }), forged); wm.position.z = -0.025; rod.add(wm);
    [-1, 1].forEach(sd => {
      const f = new THREE.Shape(); const a = 0.13, b = 0.075, t = 0.035;
      f.moveTo(sd * a, 0.18); f.lineTo(sd * (a - t), 0.18); f.lineTo(sd * (b - t), Lr - 0.1); f.lineTo(sd * b, Lr - 0.1); f.closePath();
      const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: 0.14, bevelEnabled: false }), forged); fm.position.z = -0.07; rod.add(fm);
    });
    shadowAll(rod);
  }
  /* ---- crankshaft ---- */
  const crank = new THREE.Group(); scene.add(crank);
  {
    const web = new THREE.Shape();
    web.absarc(0, rc, 0.22, 0, Math.PI, false); web.lineTo(-0.6, -0.15); web.absarc(0, 0, 0.66, Math.PI * 1.08, Math.PI * 1.92, false); web.lineTo(0.22, rc); web.closePath();
    [[0.1, 0.13], [-0.23, 0.13]].forEach(([z, d]) => { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(web, { depth: d, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2, curveSegments: 24 }), forged); m.position.z = z; crank.add(m); });
    const pinM = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.46, 28), steel); pinM.rotation.x = Math.PI / 2; pinM.position.y = rc; crank.add(pinM);
    const j1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 28), steel); j1.rotation.x = Math.PI / 2; j1.position.z = 0.5; crank.add(j1);
    const j2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.85, 28), steel); j2.rotation.x = Math.PI / 2; j2.position.z = -0.65; crank.add(j2);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.07, 40), forged); fl.rotation.x = Math.PI / 2; fl.position.z = -1.1; crank.add(fl);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), darkSteel); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.34, Math.sin(a) * 0.34, -1.12); crank.add(b); }
    shadowAll(crank);
  }
  /* ---- valves, springs, rockers, pushrods, cams ---- */
  function helix(len, r, turns) { const pts = []; for (let i = 0; i <= turns * 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(V3(Math.cos(a) * r, i / (turns * 24) * len, Math.sin(a) * r)); } return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.014, 6, false); }
  function camShape() { const s = new THREE.Shape(); for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; const r = 0.14 + 0.12 * Math.pow(Math.max(0, Math.cos(a - Math.PI / 2)), 3); i ? s.lineTo(r * Math.cos(a), r * Math.sin(a)) : s.moveTo(r * Math.cos(a), r * Math.sin(a)); } return s; }
  const camshaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 16), steel); camshaft.rotation.z = Math.PI / 2; camshaft.position.set(0, 0.3, -0.55); scene.add(camshaft);
  function valveSet(sx, accentCol) {
    const o = {};
    o.valve = new THREE.Group(); scene.add(o.valve);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.05, 32), new THREE.MeshStandardMaterial({ color: accentCol, metalness: 0.9, roughness: 0.3 })); head.position.y = -0.025; o.valve.add(head);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12), steel); stem.position.y = 0.4; o.valve.add(stem);
    const ret = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.03, 20), darkSteel); ret.position.y = 0.74; o.valve.add(ret);
    o.spring = new THREE.Mesh(helix(1, 0.085, 7), new THREE.MeshStandardMaterial({ color: 0x3a6f9a, metalness: 0.6, roughness: 0.35 })); o.spring.position.set(sx, 3.45, 0); scene.add(o.spring);
    o.rocker = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 1), forged); scene.add(o.rocker);
    o.pivot = V3(Math.sign(sx) * 0.625, 3.775, -0.275);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.31, 0.12), alu.clone()); ped.material.clippingPlanes = null; ped.position.set(o.pivot.x, 3.6, o.pivot.z); scene.add(ped);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 14), steel); shaft.rotation.z = Math.PI / 2; shaft.position.copy(o.pivot); scene.add(shaft);
    o.push = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), steel); scene.add(o.push);
    o.tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.1, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x8b949a, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })); o.tube.position.set(Math.sign(sx) * 0.95, 2.35, -0.55); scene.add(o.tube);
    o.tappet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16), darkSteel); scene.add(o.tappet);
    const cg = new THREE.ExtrudeGeometry(camShape(), { depth: 0.1, bevelEnabled: false, curveSegments: 4 }); cg.translate(0, 0, -0.05); cg.rotateY(Math.PI / 2);
    o.cam = new THREE.Mesh(cg, steel); o.cam.position.set(Math.sign(sx) * 0.95, 0.3, -0.55); scene.add(o.cam);
    o.sx = sx;
    [o.valve, o.spring, o.rocker, o.push, o.tappet, o.cam, ped, shaft].forEach(shadowAll);
    return o;
  }
  const vIn = valveSet(-0.3, 0x7fa9cf), vEx = valveSet(0.3, 0xb07a52);
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  function placeBetween(mesh, a, b) { tmp.subVectors(b, a); const L = tmp.length(); mesh.position.addVectors(a, b).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(up, tmp.normalize()); mesh.scale.set(1, L, 1); }
  function setValve(o, lift, camAngle) {
    o.valve.position.set(o.sx, ROOF - 0.015 - lift, 0);
    const len = 0.24 - lift; o.spring.scale.set(1, len, 1);
    const a = V3(o.sx, 3.775 - lift, 0), b = V3(Math.sign(o.sx) * 0.95, 3.775 + lift, -0.55);
    const d = tmp.subVectors(b, a); const L = d.length(); o.rocker.position.addVectors(a, b).multiplyScalar(0.5);
    o.rocker.lookAt(b); o.rocker.scale.set(1, 1, L + 0.1);
    placeBetween(o.push, V3(Math.sign(o.sx) * 0.95, 0.52 + lift, -0.55), V3(Math.sign(o.sx) * 0.95, 3.74 + lift, -0.55));
    o.tappet.position.set(Math.sign(o.sx) * 0.95, 0.52 + lift, -0.55);
    o.cam.rotation.x = camAngle;
  }
  /* ---- spark plugs (dual ignition) ---- */
  const sparks = [];
  [-1, 1].forEach(sz => {
    const g = new THREE.Group();
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.09, 6), steel); hex.position.y = 0.12; g.add(hex);
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.26, 20), ceramic); ins.position.y = 0.3; g.add(ins);
    const term = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), steel); term.position.y = 0.47; g.add(term);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16), darkSteel); g.add(body);
    const tip = V3(0, -0.12, 0);
    const spr = glowSprite(0xaad4ff, 0.32, 0); spr.position.copy(tip); g.add(spr); sparks.push(spr);
    g.position.set(0, 3.12, sz * 0.38); g.rotation.x = sz * 0.75;
    shadowAll(g); scene.add(g);
  });
  /* ---- ports (half-pipes in the cut) ---- */
  const inCurve = new THREE.CatmullRomCurve3([V3(-0.3, 2.97, 0), V3(-0.42, 3.12, 0), V3(-0.8, 3.12, 0), V3(-1.3, 3.08, 0), V3(-1.75, 2.85, 0), V3(-1.95, 2.3, 0)]);
  const exCurve = new THREE.CatmullRomCurve3(inCurve.points.map(p => V3(-p.x, p.y, p.z)));
  const inPipe = new THREE.Mesh(new THREE.TubeGeometry(inCurve, 96, 0.085, 20, false), intakeMat); scene.add(shadowAll(inPipe));
  const exPipe = new THREE.Mesh(new THREE.TubeGeometry(exCurve, 96, 0.085, 20, false), exhaustMat); scene.add(shadowAll(exPipe));
  [inCurve, exCurve].forEach(c => { const fl = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 8, 24), darkSteel); const p = c.getPointAt(1), t = c.getTangentAt(1); fl.position.copy(p); fl.lookAt(p.clone().add(t)); scene.add(fl); });

  /* ---- gas: chamber particles + port flow ---- */
  const NG = 420, gPos = new Float32Array(NG * 3), gCol = new Float32Array(NG * 3), gU = new Float32Array(NG), gR = new Float32Array(NG), gA = new Float32Array(NG);
  for (let i = 0; i < NG; i++) { gU[i] = Math.random(); gR[i] = Math.sqrt(Math.random()) * 0.6; gA[i] = Math.random() * Math.PI * 2; }
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  const gMat = softPointsMaterial({ size: 0.09, vertexColors: true, opacity: 0.85 }); gMat.clippingPlanes = clip;
  const gas = new THREE.Points(gGeo, gMat); gas.renderOrder = 3; scene.add(gas);
  const glowVol = new THREE.Mesh(new THREE.CylinderGeometry(0.655, 0.655, 1, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x5fb6ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: clip }));
  scene.add(glowVol);
  function portFlow(curve, col) {
    const N = 110, pos = new Float32Array(N * 3), s = new Float32Array(N), j = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { s[i] = Math.random(); j[i * 2] = (Math.random() - 0.5) * 0.11; j[i * 2 + 1] = (Math.random() - 0.5) * 0.11; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = softPointsMaterial({ size: 0.08, color: col, opacity: 0.95 }); m.clippingPlanes = clip;
    const p = new THREE.Points(g, m); p.renderOrder = 3; scene.add(p);
    return { N, pos, s, j, g, m, p, curve };
  }
  const inFlow = portFlow(inCurve, new THREE.Color(0.35, 0.75, 1.6)), exFlow = portFlow(exCurve, new THREE.Color(1.4, 0.7, 0.35));
  const flashLight = new THREE.PointLight(0xffa040, 0, 4, 2); flashLight.position.set(0, 2.85, -0.2); scene.add(flashLight);

  /* ---- labels ---- */
  S.label('Intake: fuel–air mixture in', V3(-1.95, 2.12, 0), 'cyan');
  S.label('Exhaust out', V3(1.98, 2.12, 0), 'amber');
  S.label('Two spark plugs', V3(0, 3.78, -0.62), 'strong');
  S.label('Rocker arm', V3(-0.62, 4.02, -0.3), '');
  S.label('Pushrod', V3(-1.2, 0.45, -0.55), '');
  S.label('Cooling fins', V3(1.2, 1.72, 0), '');
  S.label('Crankshaft', V3(1.0, -0.62, 0.5), '');
  const pLab = S.label('Piston', V3(), ''), rLab = S.label('Connecting rod', V3(), '');

  /* ---- controls + readout ---- */
  const U = ui(host);
  let th = 30, playing = !REDUCED;
  const sSpd = U.slider('spd', 'Speed', 5, 120, 40, 1, v => v + ' rpm (slowed down)');
  const playBtn = U.button(playing ? 'Pause' : 'Play', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; });
  U.button('Next stroke', () => { th = ((Math.floor(th / 180) + 1) * 180) % 720 + 20; place(0); });
  const STAGES = [
    ['Intake', 'The piston moves down with the intake valve open, drawing in the fuel–air mixture.'],
    ['Compression', 'Both valves close. The piston rises and squeezes the mixture, which heats it and makes it burn better.'],
    ['Power', 'Both spark plugs fire just before the top. The burning gas pushes the piston down: the only stroke that makes power.'],
    ['Exhaust', 'The exhaust valve opens and the rising piston pushes the burnt gas out.']
  ];
  let lastStage = -1;
  const cA = new THREE.Color(), cB = new THREE.Color();
  function place(dt) {
    const T = th % 720, t = T * D2R;
    const py = rc * Math.cos(t) + Math.sqrt(Lr * Lr - Math.pow(rc * Math.sin(t), 2));
    crank.rotation.z = -t;
    const cx = rc * Math.sin(t), cy = rc * Math.cos(t);
    piston.position.y = py;
    rod.position.set(cx, cy, 0); rod.rotation.z = Math.atan2(cx, py - cy);
    pLab.pos.set(-0.3, py - 0.05, 0.1); rLab.pos.set(0.55, (py + cy) / 2 + 0.1, 0.2);
    const st = Math.floor(T / 180), f = (T % 180) / 180;
    const liftIn = st === 0 ? Math.sin(f * Math.PI) * LIFT : 0, liftEx = st === 3 ? Math.sin(f * Math.PI) * LIFT : 0;
    const phi = T / 2; // camshaft turns at half crank speed
    setValve(vIn, liftIn, -(phi - 45) * D2R); setValve(vEx, liftEx, -(phi - 315) * D2R);
    // gas column
    const pTop = py + 0.31, hgt = Math.max(0.02, ROOF - pTop);
    glowVol.scale.y = hgt; glowVol.position.y = pTop + hgt / 2;
    const fire = T >= 340 && T < 362;
    const fireK = fire ? 1 - Math.abs(T - 350) / 12 : 0;
    sparks.forEach(s => { s.material.color.setRGB(3, 4.5, 8).multiplyScalar(Math.max(0, fireK) * 1.6); s.scale.setScalar(0.25 + 0.25 * Math.max(0, fireK)); });
    let fill = 1, op = 0.85;
    if (st === 0) { cA.setRGB(0.25, 0.6, 1.25); fill = f; }
    else if (st === 1) { cA.setRGB(0.2, 0.45, 1.3).lerp(cB.setRGB(0.35, 0.55, 1.6), f); }
    else if (st === 2) { if (f < 0.12) cA.setRGB(5, 3.6, 1.6); else cA.setRGB(3.2, 1.3, 0.35).lerp(cB.setRGB(0.7, 0.22, 0.08), Math.min(1, (f - 0.12) / 0.7)); }
    else { cA.setRGB(0.55, 0.42, 0.34); fill = 1 - f; }
    if (fire && st === 1) cA.lerp(cB.setRGB(5, 3.6, 1.6), fireK * 0.8);
    const flash = st === 2 ? Math.max(0, 1 - f * 3) : fire ? fireK * 0.6 : 0;
    flashLight.intensity = flash * 18;
    glowVol.material.color.copy(cA).multiplyScalar(st === 2 ? 0.25 : 0.12); glowVol.material.opacity = 1;
    const nVis = Math.floor(NG * fill);
    for (let i = 0; i < NG; i++) {
      gA[i] += (dt || 0) * (0.5 + gR[i]) * (st === 2 ? 2.2 : 1);
      gU[i] += (dt || 0) * (Math.random() - 0.5) * 0.3; if (gU[i] < 0) gU[i] += 1; if (gU[i] > 1) gU[i] -= 1;
      const k = i * 3;
      if (i >= nVis) { gPos[k + 1] = -50; continue; }
      gPos[k] = Math.cos(gA[i]) * gR[i]; gPos[k + 2] = Math.sin(gA[i]) * gR[i]; gPos[k + 1] = pTop + 0.03 + gU[i] * (hgt - 0.06);
      const v = 0.8 + (i % 7) * 0.05; gCol[k] = cA.r * v; gCol[k + 1] = cA.g * v; gCol[k + 2] = cA.b * v;
    }
    gGeo.attributes.position.needsUpdate = true; gGeo.attributes.color.needsUpdate = true;
    exhaustMat.emissiveIntensity = st === 3 ? 0.9 * Math.sin(f * Math.PI) + 0.25 : st === 2 ? 0.25 * f : 0.25 * Math.max(0, 1 - f * 2) * (st === 0 ? 1 : 0);
    // port flows
    const vPist = Math.abs(Math.sin(t)) + 0.15;
    const sp = (sSpd.v / 40) * 0.9;
    [[inFlow, st === 0, 1], [exFlow, st === 3, 1]].forEach(([F, on]) => {
      F.p.visible = on;
      if (!on) return;
      for (let i = 0; i < F.N; i++) {
        F.s[i] += (dt || 0) * sp * vPist * (0.7 + (i % 5) * 0.08);
        F.s[i] -= Math.floor(F.s[i]);
        const s = Math.min(1, Math.max(0, F === inFlow ? 1 - F.s[i] : F.s[i]));
        const p = F.curve.getPointAt(s);
        F.pos[i * 3] = p.x; F.pos[i * 3 + 1] = p.y + F.j[i * 2]; F.pos[i * 3 + 2] = F.j[i * 2 + 1] - 0.03;
      }
      F.g.attributes.position.needsUpdate = true;
    });
    if (st !== lastStage) {
      lastStage = st;
      U.readout(`<p class="ro-big">${st + 1} of 4 · ${STAGES[st][0]}</p><p>${STAGES[st][1]}</p>
        <p class="note">Two turns of the crankshaft give one power stroke. Aircraft engines have two spark plugs per cylinder, each fed by its own magneto, so the engine keeps running if one ignition system fails. Real engines also open and close the valves a little early or late (valve overlap); this model keeps the timing simple.</p>`);
    }
  }
  place(0);
  S.tick(dt => { dt = Math.max(0, dt); if (playing) th = (th + dt * sSpd.v * 6) % 720; place(playing ? dt : 0); });
}
