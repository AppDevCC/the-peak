import {
  CAMPS,
  PARKA,
  ROLES,
  capToPitch,
  campForCap,
  fakeWallet,
} from "./config.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createSim() {
  const rand = rng(0x51ce);
  const climbers = [];
  const START_CAP = 173_300;
  const START_ATH = 811_600;
  const N = 483;

  for (let i = 0; i < N; i++) {
    const r = rand();
    const joinCap = 3_000 + r * Math.min(START_ATH, START_CAP * 1.8);
    const holding = rand() > 0.08;
    const camp = campForCap(Math.min(joinCap, START_CAP));
    climbers.push({
      id: i,
      wallet: fakeWallet(1000 + i * 97),
      campId: camp.id,
      joinPitch: capToPitch(joinCap),
      holding,
      survivedPayday: holding && rand() > 0.15,
      bag: 200 + rand() * 18000,
      color: PARKA[i % PARKA.length],
      role: ROLES[r > 0.82 ? 2 : r > 0.55 ? 1 : 0],
      joinedAt: Date.now() - Math.floor(rand() * 12 * 864e5),
      ledge: rand(),
      phase: rand() * Math.PI * 2,
      falling: false,
      fallT: 0,
      cheer: 0,
      highlighted: false,
    });
  }

  const state = {
    cap: START_CAP,
    ath: START_ATH,
    targetCap: START_CAP,
    workers: climbers.filter((c) => c.holding && !c.falling).length,
    climbers,
    mode: "sim",
    speed: 1,
    paused: false,
    paydayIn: 14,
    paydayPulse: 0,
    lastPayday: null,
    burned: 2_400_000,
    treasury: { peak: 100_000_000, gold: 0.084, buybacks: { count: 3, peak: 1_200_000, gold: 0.04 } },
    events: [],
    flares: [],
    cacheDrops: [],
    falls: [],
    banners: [],
    log: [],
    tick: 0,
    vol: 0,
    mint: "",
    pairUrl: "",
    priceUsd: 0,
    liveReady: false,
    liveOk: false,
    feedStatus: "",
  };

  recount(state);
  return state;
}

function recount(s) {
  s.workers = s.climbers.filter((c) => c.holding && !c.falling).length;
}

export function currentCampId(cap) {
  return campForCap(cap).id;
}

export function coldPitches(s) {
  const a = Math.floor(capToPitch(s.ath) + 1e-9);
  const b = Math.floor(capToPitch(s.cap) + 1e-9);
  return Math.max(0, a - b);
}

export function campOccupied(s, campId) {
  return s.climbers.some((c) => c.holding && !c.falling && c.campId === campId && c.survivedPayday);
}

export function campCrew(s, campId) {
  return s.climbers.filter((c) => c.holding && !c.falling && c.campId === campId);
}

function pushLog(s, item) {
  s.log.unshift(item);
  if (s.log.length > 8) s.log.pop();
}

function pickHolder(s, rand) {
  const pool = s.climbers.filter((c) => c.holding && !c.falling);
  if (!pool.length) return null;
  return pool[Math.floor(rand() * pool.length)];
}

export function hire(s, n = 1, whale = false) {
  const camp = campForCap(s.cap);
  for (let i = 0; i < n; i++) {
    const recycled = s.climbers.find((c) => !c.holding && !c.falling);
    const id = recycled ? recycled.id : s.climbers.length;
    const c = {
      id,
      wallet: fakeWallet(9000 + id * 13 + (Date.now() % 999)),
      campId: camp.id,
      joinPitch: capToPitch(s.cap),
      holding: true,
      survivedPayday: false,
      bag: whale ? 8000 + Math.random() * 40000 : 80 + Math.random() * 4000,
      color: PARKA[id % PARKA.length],
      role: ROLES[Math.random() > 0.8 ? 2 : 0],
      joinedAt: Date.now(),
      ledge: Math.random(),
      phase: Math.random() * 6.28,
      falling: false,
      fallT: 0,
      cheer: 0,
      highlighted: false,
      arriving: 1,
    };
    if (recycled) Object.assign(recycled, c, { id: recycled.id });
    else s.climbers.push(c);
    s.events.push({ kind: "hire", climber: recycled || c, t: 0 });
    if (i === 0 || whale) {
      pushLog(s, { wallet: c.wallet, how: "roped in", pnl: Math.random() * 0.4, up: true });
    }
  }
  if (s.mode === "sim") s.targetCap *= 1 + 0.004 * n * (whale ? 3 : 1);
  s.vol += n * (whale ? 900 : 120);
  recount(s);
}

export function fall(s, n = 1, whale = false) {
  const pool = s.climbers.filter((c) => c.holding && !c.falling);
  if (!pool.length) return;
  pool.sort(() => Math.random() - 0.5);
  const take = pool.slice(0, Math.min(n, pool.length));
  for (const c of take) {
    c.falling = true;
    c.holding = false;
    c.fallT = 0;
    c.survivedPayday = false;
    s.falls.push({ climber: c, t: 0 });
    const pnl = whale ? -(0.2 + Math.random() * 0.7) : (Math.random() * 1.4 - 0.9);
    pushLog(s, { wallet: c.wallet, how: "fell", pnl, up: pnl >= 0 });
  }
  if (s.mode === "sim") s.targetCap *= 1 - 0.005 * take.length * (whale ? 2.2 : 1);
  s.vol += take.length * (whale ? 700 : 90);
  recount(s);
}

function payday(s) {
  const occupied = new Set();
  const leftover = [];
  for (const camp of CAMPS) {
    const crew = campCrew(s, camp.id).filter((c) => c.survivedPayday);
    const rookies = campCrew(s, camp.id).filter((c) => !c.survivedPayday);
    if (crew.length) {
      occupied.add(camp.id);
      for (const c of crew) c.cheer = 1;
      s.cacheDrops.push({ campId: camp.id, t: 0, gold: 0.4 + Math.random() * 1.2 + crew.length * 0.02 });
    } else if (rookies.length === 0 && camp.cap <= s.ath) {
      leftover.push(camp.id);
    }
    for (const c of rookies) c.survivedPayday = true;
  }
  const gold = 0.01 + Math.random() * 0.04;
  s.treasury.gold = +(s.treasury.gold + gold).toFixed(3);
  s.lastPayday = {
    at: Date.now(),
    camps: [...occupied],
    skipped: leftover,
    gold,
  };
  s.paydayPulse = 1;
  s.banners.push(occupied.size ? "Cache dropped on occupied camps" : "No camp earned — the wall is empty");
  recount(s);
}

export function sendFlare(s, text, style) {
  s.flares.push({
    text: (text || "SUMMIT").slice(0, 40).toUpperCase(),
    style,
    t: 0,
    x: 0,
  });
  const burn = 4000 * style.usd * (800 + Math.random() * 400);
  s.burned += burn;
  s.banners.push(text.toUpperCase());
}

function animateFx(s, step) {
  s.paydayPulse = Math.max(0, s.paydayPulse - step * 0.55);
  for (const c of s.climbers) {
    if (c.arriving) c.arriving = Math.max(0, c.arriving - step * 1.6);
    if (c.cheer) c.cheer = Math.max(0, c.cheer - step * 1.1);
    if (c.falling) c.fallT += step;
  }
  s.falls = s.falls.filter((f) => {
    f.t += step;
    return f.t < 2.4;
  });
  s.cacheDrops = s.cacheDrops.filter((d) => {
    d.t += step;
    return d.t < 2.8;
  });
  s.flares = s.flares.filter((f) => {
    f.t += step;
    f.x = f.t / (f.style.laps * 2.2);
    return f.x < 1.15;
  });
  s.events = s.events.filter((e) => {
    e.t += step;
    return e.t < 1.6;
  });
}

export function tickSim(s, dt) {
  const live = s.mode === "live";
  if (s.paused) {
    animateFx(s, dt * 0.6);
    return;
  }
  const step = dt * (live ? 1 : s.speed);
  s.tick += step;
  s.vol *= 0.995;

  if (!live) {
    if (s.pumping) s.targetCap *= 1 + 0.08 * step;
    if (s.dumping) s.targetCap *= 1 - 0.07 * step;
    s.targetCap = Math.max(2_400, s.targetCap);
  }

  s.cap += (s.targetCap - s.cap) * Math.min(1, 2.2 * step);
  if (s.cap > s.ath) s.ath = s.cap;

  if (!live) {
    if (Math.random() < 0.35 * step) hire(s, 1);
    if (Math.random() < 0.28 * step) fall(s, 1);
    s.paydayIn -= step;
    if (s.paydayIn <= 0) {
      payday(s);
      s.paydayIn = 12 + Math.random() * 8;
    }
  }

  animateFx(s, step);
  recount(s);
}

export function beginLive(s) {
  s.mode = "live";
  s.paused = false;
  s.pumping = false;
  s.dumping = false;
  s.liveReady = false;
  s.liveOk = false;
  s.lastBuys = 0;
  s.lastSells = 0;
  s.priceUsd = 0;
  s.feedStatus = "Live feed · looking up the coin";
  s.climbers.length = 0;
  s.events = [];
  s.falls = [];
  s.log = [];
  s.cacheDrops = [];
  s.workers = 0;
  s.cap = 0;
  s.targetCap = 0;
  s.ath = 0;
}

export function beginSim(s) {
  const mint = s.mint;
  const pairUrl = s.pairUrl;
  const priceUsd = s.priceUsd;
  const next = createSim();
  Object.keys(next).forEach((k) => {
    s[k] = next[k];
  });
  s.mint = mint;
  s.pairUrl = pairUrl;
  s.priceUsd = priceUsd;
}

export function applyLiveQuote(s, q) {
  if (!q || q.error) {
    s.liveOk = false;
    s.feedStatus = q?.error || "Live feed · waiting for a price";
    return;
  }
  const cap = Number(q.marketCap);
  if (!Number.isFinite(cap) || cap < 0) {
    s.liveOk = false;
    s.feedStatus = "Live feed · no market cap yet";
    return;
  }
  if (!s.liveReady) {
    s.cap = cap;
    s.targetCap = cap;
    s.ath = cap;
    s.liveReady = true;
    const net = Math.max(0, (q.buys || 0) - (q.sells || 0));
    const n = Math.min(400, net || Math.min(32, q.buys || 0));
    if (n) hire(s, n, n >= 40);
    s.lastBuys = q.buys || 0;
    s.lastSells = q.sells || 0;
  } else {
    s.targetCap = cap;
    if (cap > s.ath) s.ath = cap;
    const db = (q.buys || 0) - (s.lastBuys || 0);
    const ds = (q.sells || 0) - (s.lastSells || 0);
    if (db > 0) hire(s, Math.min(40, db), db >= 12);
    if (ds > 0) fall(s, Math.min(40, ds), ds >= 12);
    s.lastBuys = q.buys || 0;
    s.lastSells = q.sells || 0;
  }
  s.priceUsd = q.priceUsd || 0;
  if (q.url) s.pairUrl = q.url;
  s.liveAt = Date.now();
  s.liveOk = true;
  s.feedStatus = "Live · market cap from the coin";
}

export function jumpToCap(s, cap) {
  s.targetCap = cap;
  s.cap = cap;
  if (cap > s.ath) s.ath = cap;
}

export function findClimber(s, query) {
  const q = (query || "").trim();
  if (!q) return null;
  const low = q.toLowerCase();
  return (
    s.climbers.find((c) => c.wallet === q) ||
    s.climbers.find((c) => c.wallet.toLowerCase().startsWith(low)) ||
    s.climbers.find((c) => c.wallet.toLowerCase().includes(low))
  );
}
