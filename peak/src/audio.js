export function createAudio() {
  let ctx = null;
  let master = null;
  let wind = null;
  let on = true;

  function ensure() {
    if (ctx) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    startWind();
  }

  function startWind() {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    wind = { src, filter, g };
  }

  function beep(freq, dur = 0.12, type = "square", vol = 0.2) {
    if (!on) return;
    ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      if (on) ensure();
      if (master) master.gain.value = on ? 0.18 : 0;
      return on;
    },
    unlock() {
      ensure();
      if (ctx.state === "suspended") ctx.resume();
    },
    hire() {
      beep(620, 0.08, "square", 0.12);
      beep(880, 0.1, "square", 0.08);
    },
    fall() {
      beep(220, 0.28, "sawtooth", 0.14);
    },
    payday() {
      beep(523, 0.12, "square", 0.16);
      setTimeout(() => beep(659, 0.12, "square", 0.16), 90);
      setTimeout(() => beep(784, 0.18, "square", 0.18), 180);
    },
    flare() {
      beep(440, 0.2, "triangle", 0.2);
      beep(880, 0.4, "sine", 0.08);
    },
    enter() {
      beep(392, 0.1);
      setTimeout(() => beep(523, 0.12), 80);
      setTimeout(() => beep(659, 0.18), 160);
    },
  };
}
