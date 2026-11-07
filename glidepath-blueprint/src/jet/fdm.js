/* Ground and flight dynamics for the generic medium twin-jet (about 64 t, two engines of about 120 kN).
   Believable and teachable, not certified: point-mass flight path with a simple attitude control law (the stick
   commands pitch rate and roll rate; attitude is held when the stick is released), a bicycle steering model on the
   ground, rolling friction, toe brakes with brake heating, flaps / slats, gear, ground spoilers and an RTO autobrake.
   SI units, fixed timestep, no three.js (runs in Node for tests). Every figure is approximate and generic.
   Scene frame (see layout.js): x right, y up, z aft. yaw: rotation about +y, the nose points along (-sin yaw, -cos yaw).
   The reference point is the main-gear contact point; h is its height above the runway. */
import { PARK, PUSH_PATH, LINEUP, P, yawOfA, hdgOfYaw, yawOfHdg, WIND, ELEV_FT, WHEELBASE } from './layout.js';

export const KT = 0.514444, FT = 0.3048, G = 9.80665;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lag = (x, t, tau, dt) => x + (t - x) * (1 - Math.exp(-dt / Math.max(1e-3, tau)));
const towards = (x, t, rate, dt) => x + clamp(t - x, -rate * dt, rate * dt);

export const AF = {
  m: 64000, S: 122.6,
  Tmax: 120000, n1Toga: 92,                          // per engine, sea level static at TOGA N1
  CLa: 5.1, CL0: [0.24, 0.74, 0.86, 1.0, 1.18], CLmax: [1.42, 1.95, 2.15, 2.35, 2.6], aMax: [11.5, 14, 14.5, 15, 15.5],
  CD0: 0.0215, CDflap: [0, 0.009, 0.021, 0.035, 0.062], CDgear: 0.018, k: 0.047,
  VFE: [350, 230, 200, 185, 177], VLO: 220, VLE: 280, VMO: 350,
  mu0: 0.0085, mu1: 0.0005, muBrk: 0.48, brakeCap: 71000,
  tailPitch: 11.7, wheelbase: WHEELBASE
};
export const FLAP_NAMES = ['0', '1', '2', '3', 'FULL'];
export const rho = altM => 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * altM), 4.2559);
/** thrust of one engine (N) from N1 (%), air density and Mach number (thrust lapse with speed and altitude) */
export function thrustOf(n1, altM, mach) { if (n1 < 1) return 0; return AF.Tmax * Math.pow(n1 / AF.n1Toga, 2.2) * Math.pow(rho(altM) / 1.225, 0.75) * (1 - 0.95 * Math.min(0.5, mach)); }
/** wind as a scene vector (m/s, the direction the air moves) */
export function windVec(w = WIND) { const yaw = yawOfHdg((w.from + 180) % 360); return { x: -Math.sin(yaw) * w.kt * KT, z: -Math.cos(yaw) * w.kt * KT }; }

export function createFDM() {
  const F = { events: [] };
  const emit = (type, d = {}) => F.events.push({ type, ...d });
  F.reset = (at = 'park') => {
    const pose = at === 'lineup' ? { ...P(LINEUP.s, LINEUP.n), yaw: yawOfA(LINEUP.a) } : { ...P(PARK.s, PARK.n), yaw: yawOfA(PARK.a) };
    Object.assign(F, {
      x: pose.x, z: pose.z, h: 0, yaw: pose.yaw, pitch: 0, roll: 0, q: 0, p: 0,
      u: 0, V: 0, gamma: 0, vs: 0, onGround: true, airT: 0, gndT: 0,
      flap: 0, gear: 1, spoiler: 0, abActive: false, abDecel: false, decel: 0, brakeCmd: 0,
      brakeT: [68, 74, 61, 70], tailstrike: false, push: null, mode: 'GROUND', nwsAngle: 0,
      ias: 0, tas: 0, gs: 0, trk: 0, ax: 0, vx: 0, vz: 0
    });
    F.events.length = 0; derived(0);
  };
  /* scripted pushback: the tug pushes the aircraft back along PUSH_PATH and turns it onto the taxi line */
  F.startPush = () => { if (F.mode !== 'GROUND' || F.push || F.u > 0.3) return false; F.push = { t: 0, dur: 46, idx: 0, done: false, disconnectT: -1 }; F.mode = 'PUSH'; emit('pushStart'); return true; };
  function pushStep(dt, inp) {
    const pu = F.push;
    if (inp.park) { pu.held = true; return; }                       // the tug waits while the parking brake is set
    pu.held = false;
    if (pu.done) { pu.disconnectT -= dt; if (pu.disconnectT <= 0) { F.mode = 'GROUND'; F.push = { ...pu, gone: true }; emit('pushDone'); } return; }
    pu.t += dt; const k = clamp(pu.t / pu.dur, 0, 1), e = k * k * (3 - 2 * k), fi = e * (PUSH_PATH.length - 1), i = Math.min(PUSH_PATH.length - 2, Math.floor(fi)), f = fi - i;
    const a = PUSH_PATH[i], b = PUSH_PATH[i + 1], s = a.s + (b.s - a.s) * f, n = a.n + (b.n - a.n) * f;
    const pos = P(s, n), dirA = Math.atan2(-(b.n - a.n), -(b.s - a.s));  // moving backwards: the nose points opposite the path tangent
    const px = F.x, pz = F.z; F.x = pos.x; F.z = pos.z; F.yaw = yawOfA(dirA);
    F.u = -Math.hypot(F.x - px, F.z - pz) / Math.max(dt, 1e-6);
    if (k >= 1) { pu.done = true; pu.disconnectT = 8; F.u = 0; emit('pushStopped'); }
  }

  /** inp: { T:[N,N], pitch, roll (-1..1, + aft / right), rudder, tiller (+ right), brakeL, brakeR (0..1), park, flapLever (0..4),
   *  gearDown, spoilerArmed, autoBrk (0 off, 1 LO, 2 MED, 3 MAX), thrIdle, ap: { q, p } (rad/s, when the autopilot flies) } */
  F.step = (dt, inp) => {
    const W = AF.m * G, altM = ELEV_FT * FT + F.h, r = rho(altM), wv = windVec(inp.wind);
    const dx = -Math.sin(F.yaw), dz = -Math.cos(F.yaw);
    // flaps / slats and gear move towards their levers
    F.flap = towards(F.flap, clamp(inp.flapLever, 0, 4), 1 / 7, dt);
    const gTgt = inp.gearDown || F.onGround ? 1 : 0, g0 = F.gear; F.gear = towards(F.gear, gTgt, 1 / 9, dt);
    if (g0 < 1 && F.gear >= 1) emit('gearDown'); if (g0 > 0 && F.gear <= 0) emit('gearUp'); if (g0 === 1 && F.gear < 1) emit('gearMoving');
    const fi = Math.min(3, Math.floor(F.flap)), ff = F.flap - fi, mix = arr => arr[fi] + (arr[Math.min(4, fi + 1)] - arr[fi]) * ff;
    const CL0 = mix(AF.CL0), CLmax = mix(AF.CLmax), CDf = mix(AF.CDflap), aMax = mix(AF.aMax) * D2R;
    const Tsum = (inp.T[0] || 0) + (inp.T[1] || 0);
    // ground spoilers: armed, on the ground, levers at idle, above about 72 kt (take-off rejected or landing)
    const spoTgt = inp.spoilerArmed && F.onGround && inp.thrIdle && F.ias > 72 ? 1 : inp.thrIdle && F.onGround && F.spoiler > 0 && F.gs > 3 ? 1 : 0;
    F.spoiler = towards(F.spoiler, spoTgt, 1.5, dt);
    if (F.mode === 'PUSH') { pushStep(dt, inp); derived(dt, wv, r); return; }

    if (F.onGround) {
      const hw = -(wv.x * dx + wv.z * dz), Va = F.u + hw, qd = 0.5 * r * Va * Math.abs(Va);
      const CL = Math.min(CLmax, CL0 + AF.CLa * F.pitch) - 0.7 * F.spoiler, CD = AF.CD0 + CDf + AF.CDgear * F.gear + AF.k * CL * CL + 0.09 * F.spoiler;
      const L = qd * AF.S * CL, D = qd * AF.S * CD, Ng = Math.max(0, W - L), T = Tsum * Math.cos(F.pitch);
      // brakes: pedals, parking brake, RTO autobrake (MAX armed, above 72 kt, levers to idle)
      if (inp.autoBrk === 3 && inp.thrIdle && F.ias > 72 && F.gs > 20) { if (!F.abActive) emit('rto'); F.abActive = true; }
      if (F.abActive && (!inp.thrIdle || inp.autoBrk !== 3)) F.abActive = false;
      const pedal = Math.max(inp.brakeL || 0, inp.brakeR || 0);
      const bL = Math.max(inp.brakeL || 0, inp.park ? 1 : 0, F.abActive ? 1 : 0), bR = Math.max(inp.brakeR || 0, inp.park ? 1 : 0, F.abActive ? 1 : 0);
      F.brakeCmd = (bL + bR) / 2;
      const Fb = AF.muBrk * 0.92 * Ng * F.brakeCmd, Fr = (AF.mu0 + AF.mu1 * Math.abs(F.u)) * Ng;
      if (Math.abs(F.u) < 0.02 && Math.abs(T - D) <= Fr * 1.15 + Fb) { F.u = 0; F.ax = 0; }
      else {
        const sgn = Math.sign(F.u) || Math.sign(T - D) || 1;
        const a = (T - D * Math.sign(Va || 1) - sgn * (Fr + Fb)) / AF.m, u0 = F.u;
        F.u += a * dt; if (u0 !== 0 && Math.sign(F.u) !== Math.sign(u0)) F.u = 0; F.ax = a;
        // brake heating: energy into the four brakes (left pair / right pair by pedal split)
        const P = Fb * Math.abs(F.u), sh = bL + bR > 0 ? bL / (bL + bR) : 0.5;
        for (let j = 0; j < 4; j++) F.brakeT[j] += P * dt * (j < 2 ? sh : 1 - sh) / 2 / AF.brakeCap;
      }
      F.decel = -F.ax; F.abDecel = F.abActive && F.decel > 2.5;
      // steering: tiller (about ±75° at low speed, fading out above 20 kt) and rudder pedals (about ±6°)
      const ukt = Math.abs(F.u) / KT, auth = ukt < 20 ? 1 : clamp(1 - (ukt - 20) / 30, 0, 1);
      const delta = clamp((inp.tiller || 0) * 75 * auth + (inp.rudder || 0) * 6, -75, 75) * D2R;
      F.nwsAngle = lag(F.nwsAngle, delta, 0.25, dt);
      let rate = F.u * Math.tan(F.nwsAngle) / AF.wheelbase;
      const latMax = 0.15 * G / Math.max(0.5, Math.abs(F.u)); rate = clamp(rate, -latMax, latMax);
      rate += (inp.rudder || 0) * clamp(Va / 70, 0, 1) ** 2 * 3 * D2R;                       // rudder: aerodynamic yaw at speed
      rate += ((inp.brakeR || 0) - (inp.brakeL || 0)) * clamp(F.u / 3, 0, 1) * 0.1;          // differential braking
      if (F.pitch > 0.5 * D2R) rate *= 0.3;                                                  // nose wheel off the ground
      F.yaw -= rate * dt;                                                                    // right turn = heading up = yaw down
      F.x += dx * F.u * dt; F.z += dz * F.u * dt;
      // rotation about the main gear: elevator authority builds from about 100 kt
      const auth2 = clamp((Va / KT - 100) / 30, 0, 1);
      const stick = inp.ap ? inp.ap.q / (4.5 * D2R) : inp.pitch;
      const qc = stick > 0.05 ? stick * 4.5 * D2R * auth2 : stick < -0.05 ? stick * 3 * D2R : -2 * D2R;
      F.q = lag(F.q, qc, 0.35, dt); F.pitch = Math.max(0, F.pitch + F.q * dt); if (F.pitch === 0 && F.q < 0) F.q = 0;
      if (F.pitch > AF.tailPitch * D2R && !F.tailstrike) { F.tailstrike = true; emit('tailstrike'); }
      F.roll = lag(F.roll, 0, 0.3, dt); F.p = 0;
      if (L > W && F.pitch > 2 * D2R) { F.onGround = false; F.V = Va; F.gamma = 0; F.airT = 0; F.abActive = false; emit('liftoff', { ias: F.ias, pitch: F.pitch / D2R }); }
    } else {
      const V = Math.max(20, F.V), qd = 0.5 * r * V * V, alpha = F.pitch - F.gamma;
      let CL = CL0 + AF.CLa * alpha; if (alpha > aMax + 2 * D2R) CL = CLmax * 0.8; CL = Math.min(CL, CLmax);
      const CD = AF.CD0 + CDf + AF.CDgear * F.gear + AF.k * CL * CL, L = qd * AF.S * CL, D = qd * AF.S * CD;
      F.V += ((Tsum * Math.cos(alpha) - D) / AF.m - G * Math.sin(F.gamma)) * dt;
      F.gamma += ((L * Math.cos(F.roll) + Tsum * Math.sin(alpha) - W * Math.cos(F.gamma)) / (AF.m * V)) * dt;
      F.yaw -= (L * Math.sin(F.roll) / (AF.m * V * Math.cos(F.gamma))) * dt;
      // control law: stick → pitch rate / roll rate; attitude held when released; pitch, bank and angle-of-attack limits
      let qc = inp.ap ? inp.ap.q : inp.pitch * 5 * D2R;
      if (alpha > aMax - 1.5 * D2R) qc = Math.min(qc, -(alpha - (aMax - 1.5 * D2R)) * 1.5);
      if (F.pitch > 25 * D2R) qc = Math.min(qc, 0); if (F.pitch < -15 * D2R) qc = Math.max(qc, 0);
      F.q = lag(F.q, qc, 0.45, dt); F.pitch += F.q * dt;
      let pc = inp.ap ? inp.ap.p : inp.roll * 15 * D2R;
      if (!inp.ap && Math.abs(inp.roll) < 0.05 && Math.abs(F.roll) > 33 * D2R) pc = -Math.sign(F.roll) * 5 * D2R;
      if (Math.abs(F.roll) > 67 * D2R && Math.sign(pc) === Math.sign(F.roll)) pc = 0;
      F.p = lag(F.p, pc, 0.3, dt); F.roll += F.p * dt;
      F.h += V * Math.sin(F.gamma) * dt; F.airT += dt;
      F.x += (dx * V * Math.cos(F.gamma) + wv.x) * dt; F.z += (dz * V * Math.cos(F.gamma) + wv.z) * dt;
      F.ax = 0;
      if (F.h <= 0) { F.h = 0; F.onGround = true; F.u = V * Math.cos(F.gamma) - (-(wv.x * dx + wv.z * dz)); F.gamma = 0; F.roll = 0; emit('touchdown', { vs: F.vs }); }
    }
    for (let j = 0; j < 4; j++) F.brakeT[j] = 15 + (F.brakeT[j] - 15) * Math.exp(-dt / (F.onGround ? 1500 : 700));
    derived(dt, wv, r);
  };
  function derived(dt, wv = windVec(), r = rho(ELEV_FT * FT + F.h)) {
    const dx = -Math.sin(F.yaw), dz = -Math.cos(F.yaw);
    if (F.onGround) { F.vx = dx * F.u; F.vz = dz * F.u; F.vs = 0; const hw = -(wv.x * dx + wv.z * dz); F.tas = Math.max(0, F.u + hw); }
    else { F.vx = dx * F.V * Math.cos(F.gamma) + wv.x; F.vz = dz * F.V * Math.cos(F.gamma) + wv.z; F.vs = F.V * Math.sin(F.gamma); F.tas = F.V; }
    F.ias = F.tas * Math.sqrt(r / 1.225) / KT;
    F.gs = Math.hypot(F.vx, F.vz) / KT;
    F.hdg = hdgOfYaw(F.yaw);
    F.trk = F.gs > 3 ? hdgOfYaw(Math.atan2(-F.vx, -F.vz)) : F.hdg;
    F.alt = ELEV_FT + F.h / FT; F.ra = F.h / FT;
  }
  F.reset();
  return F;
}
