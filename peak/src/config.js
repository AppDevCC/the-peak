export const TICKER = "PEAK";
export const BRAND = "THE PEAK";
export const TAGLINE = "They never summited. We will.";
/** Paste the Solana mint here when $PEAK launches. Until then the site stays on the simulator. */
export const MINT = "";
export const CHAIN = "solana";
export const MINT_KEY = "peak.mint";
export const ABOUT = [
  "The mountain, climbed live by its holders. Every wallet is a rope team. Buys join the line, sells fall, and the mountain rises with the market cap.",
  "Cache only drops on camps whose original crew is still on the wall. Sell and you fall — that camp goes cold, and your unpaid cache stays for whoever did not jump.",
  "New climbers rope onto the current camp and do not get the drop until they survive one payday. This site is a live expedition. A wallet is needed only to send a flare.",
];

export const CAMPS = [
  { id: 0, numeral: "I", name: "Base", cap: 3_000, meters: 5200 },
  { id: 1, numeral: "II", name: "Treeline", cap: 30_000, meters: 5800 },
  { id: 2, numeral: "III", name: "Icefall", cap: 300_000, meters: 6400 },
  { id: 3, numeral: "IV", name: "Ridge", cap: 3_000_000, meters: 7000 },
  { id: 4, numeral: "V", name: "Col", cap: 30_000_000, meters: 7600 },
  { id: 5, numeral: "VI", name: "Death zone", cap: 300_000_000, meters: 8200 },
  { id: 6, numeral: "★", name: "The Peak", cap: 1_000_000_000, meters: 8848 },
];

export const PITCHES = 80;

export const SEALED_CREW = [
  { at: 10, name: "Base camp opens" },
  { at: 50, name: "Headlamps on" },
  { at: 100, name: "Rope team of 100" },
  { at: 200, name: "gm on the wall" },
  { at: 300, name: "Ape together strong" },
  { at: 400, name: "Summit or starve" },
  { at: 500, name: "Thin air club" },
  { at: 600, name: "Fixed lines in" },
  { at: 800, name: "Weather window" },
  { at: 1000, name: "A thousand on the rope" },
];

export const SEALED_CAP = [
  { at: 5_000, name: "gm" },
  { at: 7_500, name: "Probably nothing" },
  { at: 10_000, name: "Two stoves, please" },
  { at: 15_000, name: "I AM HODLING" },
  { at: 20_000, name: "Few understand" },
  { at: 30_000, name: "Above treeline. Up only." },
  { at: 45_000, name: "Ser, this is a mountain" },
  { at: 70_000, name: "Espresso at base camp" },
  { at: 100_000, name: "Six figures. For the views." },
  { at: 150_000, name: "Funds are safu" },
  { at: 200_000, name: "Wen summit" },
  { at: 300_000, name: "Icefall. Steel boots." },
  { at: 450_000, name: "This is good for Peak" },
  { at: 650_000, name: "Bear market is for climbing" },
  { at: 1_000_000, name: "One million. Don't look down." },
];

export const FLARE_STYLES = [
  { style: 1, name: "Basic", usd: 1, laps: 1, color: "#e8f4ff" },
  { style: 2, name: "Red", usd: 2, laps: 2, color: "#ff5a4a" },
  { style: 3, name: "Ice", usd: 4, laps: 3, color: "#7ec8e3" },
  { style: 4, name: "Night", usd: 8, laps: 4, color: "#c9b6ff" },
  { style: 5, name: "Legendary", usd: 15, laps: 5, color: "#ffc14a" },
];

export const ROLES = ["Porter", "Guide", "Lead"];

export const PARKA = ["#ff5a4a", "#ffc14a", "#3ecf8e", "#7ec8e3", "#c9b6ff", "#ff8a5b"];

const LOG_MIN = Math.log(1_000);
const LOG_MAX = Math.log(1_000_000_000);

export function capToPitch(cap) {
  if (!cap || cap <= 0) return 0;
  const t = (Math.log(Math.max(1000, cap)) - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return Math.max(0, Math.min(PITCHES - 0.001, t * PITCHES));
}

export function campForCap(cap) {
  let camp = CAMPS[0];
  for (const c of CAMPS) if (cap >= c.cap) camp = c;
  return camp;
}

export function nextCamp(cap) {
  return CAMPS.find((c) => c.cap > cap) || null;
}

export function formatUsd(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return "$" + (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) {
    const k = n / 1000;
    return "$" + (k >= 100 ? k.toFixed(0) : k.toFixed(1)) + "K";
  }
  return "$" + Math.round(n);
}

export function formatTok(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 100000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString("en-US");
}

export function shortWallet(w) {
  if (!w) return "—";
  return w.slice(0, 4) + "…" + w.slice(-4);
}

export function isMint(v) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(v || "").trim());
}

export function resolveMint() {
  if (isMint(MINT)) return MINT.trim();
  try {
    const q = new URLSearchParams(location.search);
    const fromUrl = q.get("ca") || q.get("mint");
    if (isMint(fromUrl)) return fromUrl.trim();
  } catch {
    /* ignore */
  }
  try {
    const saved = localStorage.getItem(MINT_KEY);
    if (isMint(saved)) return saved.trim();
  } catch {
    /* ignore */
  }
  return "";
}

export function saveMint(v) {
  if (!isMint(v)) return "";
  const mint = v.trim();
  try {
    localStorage.setItem(MINT_KEY, mint);
  } catch {
    /* ignore */
  }
  return mint;
}

export function buyUrl(mint, _pairUrl) {
  if (mint) return "https://pump.fun/coin/" + mint;
  return "";
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function fakeWallet(seed) {
  let x = (seed * 1103515245 + 12345) >>> 0;
  let s = "";
  for (let i = 0; i < 44; i++) {
    x = (x * 1664525 + 1013904223) >>> 0;
    s += B58[x % 58];
  }
  return s;
}
