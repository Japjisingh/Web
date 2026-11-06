/* Opt-in WebAudio sound: layered engine with prop beat, wind, tyre rumble, stall horn, flap motor, clicks. */
export function createSound() {
  let ctx = null, n = null, on = false, lastFlap = 0;
  function noiseBuf(sec = 2) { const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    // engine: firing-frequency saw + detuned saw (beat) + sub square (crank) through a throttle-opened low-pass, AM by prop blade pass
    const eLP = ctx.createBiquadFilter(); eLP.type = 'lowpass'; eLP.Q.value = 0.8;
    const eAM = ctx.createGain(); eAM.gain.value = 0.7; const eG = ctx.createGain(); eG.gain.value = 0;
    eLP.connect(eAM); eAM.connect(eG); eG.connect(master);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; const o3 = ctx.createOscillator(); o3.type = 'square';
    const g3 = ctx.createGain(); g3.gain.value = 0.35; const g2 = ctx.createGain(); g2.gain.value = 0.6;
    o1.connect(eLP); o2.connect(g2); g2.connect(eLP); o3.connect(g3); g3.connect(eLP);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; const lfoG = ctx.createGain(); lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(eAM.gain);
    // combustion roughness: band-passed noise
    const cN = ctx.createBufferSource(); cN.buffer = noiseBuf(); cN.loop = true; const cBP = ctx.createBiquadFilter(); cBP.type = 'bandpass'; cBP.Q.value = 1.2; const cG = ctx.createGain(); cG.gain.value = 0; cN.connect(cBP); cBP.connect(cG); cG.connect(master);
    // wind
    const wN = ctx.createBufferSource(); wN.buffer = noiseBuf(); wN.loop = true; const wBP = ctx.createBiquadFilter(); wBP.type = 'bandpass'; wBP.Q.value = 0.5; const wG = ctx.createGain(); wG.gain.value = 0; wN.connect(wBP); wBP.connect(wG); wG.connect(master);
    // tyre rumble
    const tN = ctx.createBufferSource(); tN.buffer = noiseBuf(); tN.loop = true; const tLP = ctx.createBiquadFilter(); tLP.type = 'lowpass'; tLP.frequency.value = 140; const tG = ctx.createGain(); tG.gain.value = 0; tN.connect(tLP); tLP.connect(tG); tG.connect(master);
    // stall horn (reed): triangle with vibrato
    const horn = ctx.createOscillator(); horn.type = 'triangle'; horn.frequency.value = 760; const vib = ctx.createOscillator(); vib.frequency.value = 7; const vibG = ctx.createGain(); vibG.gain.value = 9; vib.connect(vibG); vibG.connect(horn.frequency); const hG = ctx.createGain(); hG.gain.value = 0; horn.connect(hG); hG.connect(master);
    // flap motor
    const fm = ctx.createOscillator(); fm.type = 'sawtooth'; fm.frequency.value = 118; const fLP = ctx.createBiquadFilter(); fLP.type = 'lowpass'; fLP.frequency.value = 600; const fG = ctx.createGain(); fG.gain.value = 0; fm.connect(fLP); fLP.connect(fG); fG.connect(master);
    [o1, o2, o3, lfo, cN, wN, tN, horn, vib, fm].forEach(o => o.start());
    n = { master, o1, o2, o3, lfo, eLP, eG, cBP, cG, wBP, wG, tG, hG, fG };
  }
  function click(vol = 0.25, len = 0.03) {
    if (!on) return; const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
    const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = vol; s.buffer = b; s.connect(g); g.connect(n.master); s.start();
  }
  return {
    get on() { return on; },
    toggle() { try { if (!ctx) build(); } catch (e) { return null; } on = !on; if (on) ctx.resume(); else ctx.suspend(); return on; },
    click,
    update(s, c) {
      if (!on) return; const t = ctx.currentTime, k = 0.06;
      const f = Math.max(6, s.rpm / 60 * 2);                 // 4-cylinder four-stroke firing frequency = 2-blade prop blade-pass frequency
      n.o1.frequency.setTargetAtTime(f, t, k); n.o2.frequency.setTargetAtTime(f * 1.012 + 0.6, t, k); n.o3.frequency.setTargetAtTime(f * 0.5, t, k); n.lfo.frequency.setTargetAtTime(f * 0.5, t, k);
      n.eLP.frequency.setTargetAtTime(260 + 1500 * c.throttle * (s.running ? 1 : 0.2) + s.rpm * 0.12, t, 0.1);
      n.eG.gain.setTargetAtTime(s.running ? 0.07 + 0.14 * c.throttle : s.rpm > 150 ? 0.035 * (s.rpm / 800) : 0, t, 0.12);
      n.cBP.frequency.setTargetAtTime(f * 3, t, k); n.cG.gain.setTargetAtTime(s.running ? 0.03 + 0.06 * c.throttle : 0, t, 0.12);
      n.wBP.frequency.setTargetAtTime(500 + s.ias * 9, t, 0.2); n.wG.gain.setTargetAtTime(Math.min(0.3, Math.pow(s.ias / 110, 2) * 0.22), t, 0.25);
      const gs = Math.hypot(s.vel.x, s.vel.z); n.tG.gain.setTargetAtTime(s.onGround ? Math.min(0.5, gs / 30) * 0.5 : 0, t, 0.08);
      n.hG.gain.setTargetAtTime(s.stallWarn || s.stalled ? 0.12 : 0, t, 0.03);
      const moving = Math.abs(s.flapPos - c.flap) > 0.01; n.fG.gain.setTargetAtTime(moving ? 0.06 : 0, t, 0.05);
      const det = Math.round(s.flapPos * 10) / 10; if (!moving && Math.abs(det - lastFlap) > 0.5) { click(0.35, 0.05); lastFlap = Math.round(det); }
    }
  };
}
