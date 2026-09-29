import { applyLiveQuote } from "./sim.js";
import { CHAIN } from "./config.js";

const POLL_MS = 8000;

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("http " + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function pickPair(pairs, mint) {
  const list = (pairs || []).filter((p) => {
    const base = p.baseToken?.address;
    const quote = p.quoteToken?.address;
    return base === mint || quote === mint;
  });
  list.sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0));
  return list[0] || null;
}

function fromDex(pair, mint) {
  if (!pair) return null;
  const cap = Number(pair.marketCap ?? pair.fdv);
  if (!Number.isFinite(cap) || cap < 0) return null;
  const tx = pair.txns?.h24 || {};
  return {
    marketCap: cap,
    priceUsd: Number(pair.priceUsd) || 0,
    buys: Number(tx.buys) || 0,
    sells: Number(tx.sells) || 0,
    url: pair.url || `https://dexscreener.com/${CHAIN}/` + mint,
    symbol: pair.baseToken?.address === mint ? pair.baseToken?.symbol : pair.quoteToken?.symbol,
  };
}

async function fetchQuote(mint) {
  try {
    const data = await getJson("https://api.dexscreener.com/latest/dex/tokens/" + mint);
    const quote = fromDex(pickPair(data.pairs, mint), mint);
    if (quote) return quote;
  } catch {
    /* try gecko */
  }
  try {
    const data = await getJson("https://api.geckoterminal.com/api/v2/networks/" + CHAIN + "/tokens/" + mint);
    const a = data?.data?.attributes;
    const cap = Number(a?.market_cap_usd ?? a?.fdv_usd);
    if (!Number.isFinite(cap) || cap < 0) throw new Error("no cap");
    return {
      marketCap: cap,
      priceUsd: Number(a?.price_usd) || 0,
      buys: 0,
      sells: 0,
      url: "https://dexscreener.com/" + CHAIN + "/" + mint,
      symbol: a?.symbol,
    };
  } catch {
    return { error: "Live feed · coin not indexed yet" };
  }
}

export function startFeed(store) {
  let timer = 0;
  let mint = "";
  let busy = false;

  async function pull() {
    if (!mint || busy) return;
    busy = true;
    try {
      applyLiveQuote(store, await fetchQuote(mint));
    } catch {
      applyLiveQuote(store, { error: "Live feed · waiting for a price" });
    } finally {
      busy = false;
    }
  }

  function watch(next) {
    mint = (next || "").trim();
    store.mint = mint;
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
    if (!mint) return;
    pull();
    timer = setInterval(pull, POLL_MS);
  }

  return { watch, pull };
}
