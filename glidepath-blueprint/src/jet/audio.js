/* WebAudio for the jet trainer (built only after the user presses "Sound on"): control clicks and clunks,
   avionics fans, APU and engine spool (whine + rumble), ignitor ticks, PTU bark, chimes. */
export function createJetAudio() {
  let ctx = null, n = null, on = false, crcT = 0, ignT = [0, 0];
  function noise(sec = 2) { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function loopNoise(type, f, q, g0 = 0) { const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = g0; s.connect(fl); fl.connect(g); g.connect(n.master); s.start(); return { fl, g }; }
  function osc(type, f, g0 = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = g0; o.connect(g); g.connect(n.master); o.start(); return { o, g }; }
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0.6; const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    n = { master };
    n.fans = loopNoise('bandpass', 900, 0.4); // avionics ventilation hiss when powered
    n.apuW = osc('sawtooth', 100); n.apuWf = ctx.createBiquadFilter(); n.apuWf.type = 'bandpass'; n.apuWf.Q.value = 6; n.apuW.o.disconnect(); n.apuW.o.connect(n.apuWf); n.apuWf.connect(n.apuW.g);
    n.apuR = loopNoise('lowpass', 300, 0.7);
    n.rumble = loopNoise('lowpass', 120, 0.9); n.thump = loopNoise('bandpass', 60, 1.2); n.wind = loopNoise('bandpass', 700, 0.5); n.windHi = loopNoise('highpass', 2400, 0.4);
    n.eng = [0, 1].map(() => { const w = osc('sawtooth', 200); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; w.o.disconnect(); w.o.connect(f); f.connect(w.g); const fan = osc('triangle', 60); const r = loopNoise('lowpass', 220, 0.8); const roar = loopNoise('bandpass', 1400, 0.6); return { w, f, fan, r, roar }; });
  }
  function burst(len, vol, f = 3000, type = 'bandpass', q = 1.5, decay = 4) {
    if (!on) return; const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vol; s.buffer = b; s.connect(fl); fl.connect(g); g.connect(n.master); s.start();
  }
  function thump(f = 90, len = 0.12, vol = 0.5) { if (!on) return; const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + len); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); o.connect(g); g.connect(n.master); o.start(t); o.stop(t + len + 0.02); }
  function ding(freqs, len = 1.1, vol = 0.22, at = 0) { if (!on) return; const t = ctx.currentTime + at; for (const [f, a] of freqs) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + len); o.connect(g); g.connect(n.master); o.start(t); o.stop(t + len + 0.05); } }
  const CHIME = [[880, 1], [1760, 0.35], [2640, 0.12], [1318, 0.25]];
  return {
    get on() { return on; },
    toggle() { try { if (!ctx) build(); } catch (e) { return null; } on = !on; if (on) ctx.resume(); else ctx.suspend(); return on; },
    control(kind) {
      if (!on) return;
      if (kind === 'pb') { burst(0.012, 0.5, 3500, 'bandpass', 2, 6); setTimeout(() => burst(0.02, 0.35, 1800, 'bandpass', 2, 5), 45); }
      else if (kind === 'tog') { burst(0.01, 0.8, 4200, 'highpass', 1, 8); thump(240, 0.05, 0.25); }
      else if (kind === 'rot') { burst(0.008, 0.6, 5000, 'bandpass', 3, 8); }
      else if (kind === 'lever') { thump(110, 0.16, 0.55); burst(0.05, 0.3, 900, 'lowpass', 1, 3); }
      else if (kind === 'guard') { burst(0.03, 0.4, 2200, 'bandpass', 1, 3); thump(300, 0.05, 0.2); }
      else if (kind === 'touch') { burst(0.006, 0.15, 6000, 'bandpass', 2, 8); }
      else if (kind === 'knob') { burst(0.005, 0.45, 6200, 'bandpass', 4, 9); }
      else if (kind === 'key') { burst(0.008, 0.32, 2800, 'bandpass', 2, 6); }
      else if (kind === 'stick') { burst(0.04, 0.25, 600, 'lowpass', 1, 2); thump(140, 0.08, 0.2); }
    },
    chime() { ding(CHIME, 1.0, 0.2); },
    event(e) {
      if (!on) return;
      if (e.type === 'caut') ding(CHIME, 1.0, 0.22);
      else if (e.type === 'apuStarter' || e.type === 'engStart') thump(70, 0.3, 0.4);
      else if (e.type === 'ptu') { for (let i = 0; i < 4; i++) setTimeout(() => { thump(55, 0.09, 0.45); burst(0.06, 0.25, 300, 'lowpass', 1, 2); }, i * 95); }
      else if (e.type === 'agent') { burst(0.6, 0.35, 700, 'lowpass', 0.7, 1.5); thump(60, 0.3, 0.5); }
      else if (e.type === 'gpuOff') thump(120, 0.2, 0.3);
      else if (e.type === 'gearUp' || e.type === 'gearDown') { thump(70, 0.35, 0.7); burst(0.12, 0.4, 400, 'lowpass', 1, 3); }
      else if (e.type === 'gearMoving') { burst(0.8, 0.12, 300, 'lowpass', 0.7, 0.8); }
      else if (e.type === 'liftoff') burst(0.3, 0.2, 200, 'lowpass', 1, 2);
      else if (e.type === 'touchdown') { thump(55, 0.4, 0.8); burst(0.3, 0.5, 900, 'bandpass', 1, 3); }
      else if (e.type === 'pushStart' || e.type === 'pushDone') thump(90, 0.25, 0.4);
      else if (e.type === 'rto') { thump(60, 0.3, 0.5); }
    },
    update(sys, dt) {
      if (!on) return; const t = ctx.currentTime, s = sys.st, k = 0.15;
      n.fans.g.gain.setTargetAtTime(s.elec.ac ? 0.05 : s.elec.dc ? 0.018 : 0, t, 0.4);
      // APU: whine rises with N, rumble with combustion
      const N = s.apu.n / 100; n.apuW.o.frequency.setTargetAtTime(120 + N * 2600, t, k); n.apuWf.frequency.setTargetAtTime(240 + N * 5200, t, k);
      n.apuW.g.gain.setTargetAtTime(N > 0.01 ? 0.012 + 0.03 * N : 0, t, 0.2); n.apuR.g.gain.setTargetAtTime(N * 0.08, t, 0.3); n.apuR.fl.frequency.setTargetAtTime(160 + N * 500, t, 0.3);
      s.eng.forEach((e, i) => {
        const E = n.eng[i], n2 = e.n2 / 100, n1 = e.n1 / 100;
        E.w.o.frequency.setTargetAtTime(80 + n2 * 1900, t, k); E.f.frequency.setTargetAtTime(160 + n2 * 3800, t, k); E.w.g.gain.setTargetAtTime(n2 > 0.01 ? 0.015 + n2 * 0.05 : 0, t, 0.2);
        E.fan.o.frequency.setTargetAtTime(30 + n1 * 600, t, k); E.fan.g.gain.setTargetAtTime(n1 * 0.12, t, 0.3);
        E.r.g.gain.setTargetAtTime(e.lit ? 0.08 + n1 * 0.2 : n2 * 0.05, t, 0.4); E.roar.g.gain.setTargetAtTime(e.lit ? 0.01 + n1 * 0.06 : 0, t, 0.4);
        if (e.ign) { ignT[i] -= dt; if (ignT[i] <= 0) { ignT[i] = 0.55; burst(0.004, 0.5, 6000, 'highpass', 1, 10); } }
      });
      // airframe: runway rumble and joints, wind noise growing with airspeed
      const F = s.fdm, gs = F && F.onGround ? F.gs : 0, ias = F ? F.ias : 0;
      n.rumble.g.gain.setTargetAtTime(Math.min(0.35, gs / 140 * 0.35), t, 0.2); n.rumble.fl.frequency.setTargetAtTime(70 + gs * 1.3, t, 0.3);
      n.thump.g.gain.setTargetAtTime(gs > 2 ? (Math.sin(t * gs * 0.21) > 0.97 ? 0.4 : 0.02) * Math.min(1, gs / 40) : 0, t, 0.02);
      const wk = Math.min(1, Math.max(0, ias - 40) / 220); n.wind.g.gain.setTargetAtTime(wk * wk * 0.22 * (1 + (F && F.gear > 0.5 && !F.onGround ? 0.4 : 0)), t, 0.4); n.wind.fl.frequency.setTargetAtTime(400 + ias * 4, t, 0.5); n.windHi.g.gain.setTargetAtTime(wk * wk * 0.05, t, 0.4);
      // repetitive chime for warnings
      if (s.master.crc) { crcT -= dt; if (crcT <= 0) { crcT = 0.62; ding([[660, 1], [1320, 0.3], [990, 0.2]], 0.5, 0.2); } } else crcT = 0;
    }
  };
}
