import {
  BRAND, TAGLINE, ABOUT, CAMPS, SEALED_CREW, SEALED_CAP, FLARE_STYLES,
  formatUsd, formatTok, shortWallet, capToPitch, campForCap, nextCamp, PITCHES,
} from "./config.js";
import { coldPitches, findClimber, hire, fall, jumpToCap, sendFlare } from "./sim.js";

export function mountUI(root, store, scene, audio) {
  root.innerHTML = `
    <div class="ruler" id="ruler">
      <div class="rail"></div>
      <div class="rail-fill" id="rail-fill"></div>
      <div class="here" id="here"><span id="here-cap"></span></div>
    </div>
    <header class="panel readout" id="readout">
      <button class="fold" id="fold" aria-label="Fold"></button>
      <div class="brand">${BRAND}</div>
      <div class="rune">▲ 8848</div>
      <div class="cap"><span id="r-cap">—</span></div>
      <div class="line floor"><span id="r-floor"></span> · <span id="r-tier"></span><span class="dark" id="r-dark"></span></div>
      <div class="line crew"><span class="k">Crew</span> <span id="r-crew">0</span> <span class="k sp">High</span> <span id="r-ath">—</span></div>
      <div class="treasury line"><span class="k">Expedition cache</span> <span id="r-tbabel"></span> <span class="k sp">Gold</span> <span id="r-tgold"></span></div>
      <div class="burned line"><span class="k">Burned</span> <span id="r-burned"></span></div>
      <div class="status sim" id="r-status">Simulator · live mountain</div>
      <div class="links">
        <button class="ca soon" type="button">CA soon</button>
        <a class="buy soon" href="#">Buy soon</a>
        <a href="https://x.com" target="_blank" rel="noopener">X</a>
      </div>
    </header>
    <div class="panel feedswitch">
      <button data-feed="sim" class="on">Simulator</button>
      <button data-feed="live">Live feed</button>
    </div>
    <nav class="panel views">
      <button data-view="whole" class="on">Whole mountain</button>
      <button data-view="working">Working camps</button>
      <button data-mine>My climber</button>
      <span class="gap"></span>
      <button data-zoom="out">−</button>
      <button data-zoom="in">+</button>
    </nav>
    <details class="panel sealed" id="sealed">
      <summary>Sealed events <span id="sealed-count"></span></summary>
      <h3>Holders</h3><ol id="sealed-crew"></ol>
      <h3>Market cap</h3><ol id="sealed-cap"></ol>
    </details>
    <details class="panel plan" id="plan">
      <summary>The route</summary>
      <div class="plan-body">
        <canvas id="plan-art" width="84" height="150"></canvas>
        <ol id="plan-list"></ol>
      </div>
    </details>
    <div class="panel left" id="left">
      <h2>On the wall</h2>
      <ol id="left-list"></ol>
    </div>
    <details class="panel sim" id="sim" open>
      <summary>Simulator</summary>
      <div class="row"><button data-sim="pump">Pump 10s</button><button data-sim="dump">Dump 10s</button></div>
      <div class="row"><button data-sim="whaleIn">Whale buys</button><button data-sim="whaleOut">Whale exits</button></div>
      <div class="row"><button data-sim="whaleTrim">Whale sells half</button></div>
      <div class="row"><button data-sim="pause">Pause</button><button data-speed="1" class="on">1x</button><button data-speed="4">4x</button><button data-speed="16">16x</button></div>
      <div class="row">
        <select id="sim-jump">
          ${CAMPS.map((c) => `<option value="${c.cap}">${c.name} · ${formatUsd(c.cap)}</option>`).join("")}
        </select>
        <button data-sim="jump">Jump</button>
      </div>
    </details>
    <section class="panel find" id="find" hidden>
      <label>Find my climber</label>
      <div class="row"><input id="find-input" placeholder="Paste a wallet address" /><button id="find-go">Find</button></div>
      <p>No wallet connection. The address is only looked up on the mountain.</p>
    </section>
    <section class="panel card" id="card" hidden>
      <header><span id="c-wallet"></span><button id="c-close">Close</button></header>
      <dl id="c-rows"></dl>
      <div class="row"><button id="c-go">Go to climber</button><button id="c-forget">Forget</button></div>
    </section>
    <button class="menu" id="menu" aria-label="Open panel"><i></i><i></i><i></i></button>
    <button class="record" id="record" aria-label="Record a clip"><i></i></button>
    <div class="banner" id="banner" hidden><span></span></div>
    <div class="backdrop" id="backdrop" hidden></div>
    <section class="sheet" id="sheet" hidden>
      <header><span>${BRAND}</span><button id="sheet-close">Close</button></header>
      <div class="sheet-body" id="sheet-body">
        <details class="panel speak" open>
          <summary>Burn $PEAK · send a flare</summary>
          <p class="s-intro">Burn $PEAK and your words arc over the mountain. Nobody receives the tokens: they are destroyed.</p>
          <div class="s-styles" id="s-styles">
            ${FLARE_STYLES.map((s, i) => `<button data-style="${s.style}" class="${i === 0 ? "on" : ""}"><b>${s.name}</b><span>$${s.usd} · ${s.laps} lap${s.laps > 1 ? "s" : ""}</span></button>`).join("")}
          </div>
          <div class="s-cost" id="s-cost"></div>
          <div class="row"><input id="s-text" maxlength="40" placeholder="YOUR LINE IN THE SKY" /><button class="s-send" id="s-send">Send</button></div>
        </details>
        <div class="panel soundpanel"><button id="sound" class="on">Sound: on</button></div>
        <details class="panel about">
          <summary>About</summary>
          <div class="about-body">${ABOUT.map((p) => `<p>${p}</p>`).join("")}</div>
        </details>
        <details class="panel treasury-panel">
          <summary>Expedition cache</summary>
          <div class="t-big" id="t-babel"></div>
          <div class="t-gold" id="t-gold"></div>
          <p>The mountain's own bag earns gold at every payday. The gold buys $PEAK back. Cache only falls on camps still on the wall.</p>
        </details>
      </div>
    </section>
    <div class="cover" id="cover">
      <div class="cover-top">
        <div class="cover-cunei"></div>
        <h1>THE PEAK</h1>
        <p class="cover-tag">${TAGLINE}<br/>Every holder is a climber. Cache only drops if you stay on the wall.</p>
        <button class="enter" id="enter">ENTER</button>
      </div>
      <div class="links">
        <button class="ca soon">CA soon</button>
        <a class="buy soon" href="#">Buy soon</a>
      </div>
    </div>
  `;

  const $ = (id) => root.querySelector("#" + id) || root.querySelector(id);
  let flareStyle = FLARE_STYLES[0];
  let mine = null;
  let bannerTimer = 0;

  function showBanner(text) {
    const el = $("banner");
    el.hidden = false;
    el.classList.remove("run");
    el.firstElementChild.textContent = text;
    void el.offsetWidth;
    el.classList.add("run");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { el.hidden = true; }, 3000);
  }

  $("enter").addEventListener("click", () => {
    audio.unlock();
    audio.enter();
    $("cover").classList.add("leaving");
    document.body.classList.remove("covered");
    setTimeout(() => $("cover").remove(), 700);
  });

  $("fold").addEventListener("click", () => $("readout").classList.toggle("folded"));
  $("menu").addEventListener("click", () => {
    $("sheet").hidden = !$("sheet").hidden;
    $("backdrop").hidden = $("sheet").hidden;
  });
  $("sheet-close").addEventListener("click", () => { $("sheet").hidden = true; $("backdrop").hidden = true; });
  $("backdrop").addEventListener("click", () => { $("sheet").hidden = true; $("backdrop").hidden = true; });

  root.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-view]").forEach((x) => x.classList.toggle("on", x === b));
    scene.setView(b.dataset.view, mine);
  }));
  root.querySelector("[data-mine]").addEventListener("click", () => {
    if (!mine) {
      $("find").hidden = false;
      $("find-input").focus();
      return;
    }
    scene.follow(mine);
  });
  root.querySelector("[data-zoom='out']").addEventListener("click", () => scene.zoomBy(0.8));
  root.querySelector("[data-zoom='in']").addEventListener("click", () => scene.zoomBy(1.25));

  root.querySelector("[data-feed='sim']").addEventListener("click", () => {
    store.mode = "sim";
    root.querySelector("[data-feed='sim']").classList.add("on");
    root.querySelector("[data-feed='live']").classList.remove("on");
    $("r-status").textContent = "Simulator · live mountain";
    $("r-status").className = "status sim";
  });
  root.querySelector("[data-feed='live']").addEventListener("click", () => {
    store.mode = "live";
    root.querySelector("[data-feed='live']").classList.add("on");
    root.querySelector("[data-feed='sim']").classList.remove("on");
    $("r-status").textContent = "Live feed · waiting for a price";
    $("r-status").className = "status live";
  });

  $("sound").addEventListener("click", () => {
    const on = audio.toggle();
    $("sound").textContent = "Sound: " + (on ? "on" : "off");
    $("sound").classList.toggle("on", on);
  });

  root.querySelector("[data-sim='pump']").addEventListener("click", () => {
    store.pumping = true; store.dumping = false;
    setTimeout(() => (store.pumping = false), 10000 / store.speed);
  });
  root.querySelector("[data-sim='dump']").addEventListener("click", () => {
    store.dumping = true; store.pumping = false;
    scene.shake(1.4);
    audio.fall();
    setTimeout(() => (store.dumping = false), 10000 / store.speed);
  });
  root.querySelector("[data-sim='whaleIn']").addEventListener("click", () => { hire(store, 28, true); audio.hire(); });
  root.querySelector("[data-sim='whaleOut']").addEventListener("click", () => { fall(store, 24, true); scene.shake(2); audio.fall(); });
  root.querySelector("[data-sim='whaleTrim']").addEventListener("click", () => { fall(store, Math.max(4, Math.floor(store.workers * 0.12)), true); audio.fall(); });
  root.querySelector("[data-sim='pause']").addEventListener("click", (e) => {
    store.paused = !store.paused;
    e.currentTarget.textContent = store.paused ? "Resume" : "Pause";
  });
  root.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => {
    store.speed = +b.dataset.speed;
    root.querySelectorAll("[data-speed]").forEach((x) => x.classList.toggle("on", x === b));
  }));
  root.querySelector("[data-sim='jump']").addEventListener("click", () => {
    jumpToCap(store, +$("sim-jump").value);
    scene.shake(0.6);
  });

  $("find-go").addEventListener("click", () => lookup());
  $("find-input").addEventListener("keydown", (e) => { if (e.key === "Enter") lookup(); });
  function lookup() {
    const c = findClimber(store, $("find-input").value);
    if (!c) { $("find").querySelector("p").textContent = "No climber on this mountain."; return; }
    mine = c;
    store.climbers.forEach((x) => (x.highlighted = x === c));
    openCard(c);
  }
  $("c-close").addEventListener("click", () => ($("card").hidden = true));
  $("c-go").addEventListener("click", () => { if (mine) scene.follow(mine); });
  $("c-forget").addEventListener("click", () => {
    if (mine) mine.highlighted = false;
    mine = null;
    $("card").hidden = true;
  });

  $("s-styles").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-style]");
    if (!b) return;
    flareStyle = FLARE_STYLES.find((s) => s.style === +b.dataset.style);
    $("s-styles").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    $("s-cost").textContent = `≈ ${formatTok(5400 * flareStyle.usd)} $PEAK for $${flareStyle.usd} at the price right now`;
  });
  $("s-send").addEventListener("click", () => {
    const text = $("s-text").value.trim() || "SUMMIT";
    sendFlare(store, text, flareStyle);
    audio.flare();
    showBanner(text.toUpperCase());
  });
  $("s-cost").textContent = "≈ 5,400 $PEAK for $1 at the price right now";

  let recorder = null;
  $("record").addEventListener("click", async () => {
    try {
      const canvas = scene.canvas;
      if (recorder) { recorder.stop(); recorder = null; $("record").classList.remove("on"); return; }
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, MediaRecorder.isTypeSupported("video/webm") ? { mimeType: "video/webm" } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: "video/webm" }));
      const a = document.createElement("a");
      a.href = url; a.download = "the-peak.webm"; a.click();
    };
      rec.start();
      recorder = rec;
      $("record").classList.add("on");
      setTimeout(() => { if (recorder === rec) { rec.stop(); recorder = null; $("record").classList.remove("on"); } }, 15000);
    } catch {
      $("record").classList.remove("on");
    }
  });

  function openCard(c) {
    $("card").hidden = false;
    $("c-wallet").textContent = shortWallet(c.wallet);
    $("c-rows").innerHTML = `
      <dt>Role</dt><dd>${c.role}</dd>
      <dt>Camp</dt><dd>${CAMPS[c.campId].name}</dd>
      <dt>On the wall</dt><dd>${c.holding && !c.falling ? "yes" : "fell"}</dd>
      <dt>Survived payday</dt><dd>${c.survivedPayday ? "yes" : "not yet"}</dd>
      <dt>Bag</dt><dd>${formatTok(c.bag)} $PEAK</dd>
    `;
  }

  function renderSealed() {
    const crew = store.workers;
    const cap = store.ath || store.cap;
    const openCrew = SEALED_CREW.filter((x) => crew >= x.at);
    const openCap = SEALED_CAP.filter((x) => cap >= x.at);
    $("sealed-count").textContent = "· " + (openCrew.length + openCap.length) + " opened";
    $("sealed-crew").innerHTML = SEALED_CREW.map((x) =>
      `<li class="${crew >= x.at ? "" : "locked"}"><span class="at">${x.at}</span><span class="nm">${crew >= x.at ? x.name : "Sealed"}</span></li>`
    ).join("");
    $("sealed-cap").innerHTML = SEALED_CAP.map((x) =>
      `<li class="${cap >= x.at ? "" : "locked"}"><span class="at">${formatUsd(x.at)}</span><span class="nm">${cap >= x.at ? x.name : "Sealed"}</span></li>`
    ).join("");
  }

  function renderPlan() {
    const cap = store.ath || 0;
    $("plan-list").innerHTML = [...CAMPS].reverse().map((c) =>
      `<li class="${cap >= c.cap ? "era-done" : ""}"><span class="num">${c.numeral}</span><span class="nm">${c.name}</span><span class="usd">${formatUsd(c.cap)}</span></li>`
    ).join("");
    const cv = $("plan-art");
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0e2434";
    g.fillRect(0, 0, 84, 150);
    g.fillStyle = "#d5eefc";
    g.beginPath();
    g.moveTo(42, 8);
    g.lineTo(8, 148);
    g.lineTo(76, 148);
    g.closePath();
    g.fill();
    g.fillStyle = "#7ec8e3";
    g.beginPath();
    g.moveTo(42, 8);
    g.lineTo(76, 148);
    g.lineTo(50, 148);
    g.closePath();
    g.fill();
    for (const c of CAMPS) {
      const y = 148 - (capToPitch(c.cap) / PITCHES) * 130;
      g.fillStyle = cap >= c.cap ? "#ffc14a" : "#2a6f8f";
      g.fillRect(28, y, 28, 2);
    }
  }

  function renderRuler() {
    const cap = store.cap || 0;
    const h = root.querySelector(".ruler").clientHeight || window.innerHeight;
    const pad = 40;
    const inner = h - pad * 2;
    const yFor = (c) => pad + (1 - capToPitch(c) / PITCHES) * inner;
    let html = `<div class="rail"></div><div class="rail-fill" id="rail-fill"></div>`;
    const next = nextCamp(cap);
    for (const c of CAMPS) {
      const y = yFor(c.cap);
      const done = cap >= c.cap;
      const isNext = next && next.id === c.id;
      const away = isNext ? (c.cap / Math.max(cap, 1)).toFixed(1) + "x away" : "";
      html += `<div class="mark ${done ? "done" : ""} ${isNext ? "next" : ""}" style="transform:translateY(${y}px)">
        <span class="brick">${c.numeral}</span><span class="usd">${formatUsd(c.cap)}</span>
        <span class="nm">${c.name}</span><span class="away">${away}</span></div>`;
    }
    const hereY = yFor(cap);
    html += `<div class="here" id="here" style="transform:translateY(${hereY}px)"><span>${formatUsd(cap)}</span></div>`;
    root.querySelector(".ruler").innerHTML = html;
    const fill = root.querySelector("#rail-fill");
    fill.style.top = hereY + "px";
    fill.style.height = (h - hereY - 8) + "px";
  }

  let lastPayday = null;
  function update() {
    const camp = campForCap(store.cap);
    const next = nextCamp(store.cap);
    const dark = coldPitches(store);
    $("r-cap").textContent = formatUsd(store.cap);
    $("r-floor").textContent = "Pitch " + Math.floor(capToPitch(store.cap) + 1) + " of " + PITCHES;
    $("r-tier").textContent = camp.name;
    $("r-dark").textContent = dark ? " · " + dark + " cold pitch" + (dark === 1 ? "" : "es") : "";
    $("r-crew").textContent = String(store.workers);
    $("r-ath").textContent = formatUsd(store.ath);
    $("r-tbabel").textContent = formatTok(store.treasury.peak) + " $PEAK";
    $("r-tgold").textContent = store.treasury.gold.toFixed(3);
    $("r-burned").textContent = formatTok(store.burned) + " $PEAK";
    $("t-babel").textContent = formatTok(store.treasury.peak) + " $PEAK";
    $("t-gold").textContent = store.treasury.gold.toFixed(3) + " gold";

    $("left-list").innerHTML = store.log.map((l) =>
      `<li><span class="who">${shortWallet(l.wallet)}</span><span class="how">${l.how}</span><span class="pnl ${l.up ? "up" : "down"}">${l.pnl >= 0 ? "+" : ""}${Math.round(l.pnl * 100)}%</span></li>`
    ).join("");

    renderSealed();
    renderPlan();
    renderRuler();

    if (store.lastPayday && store.lastPayday !== lastPayday) {
      lastPayday = store.lastPayday;
      audio.payday();
      const n = store.lastPayday.camps.length;
      showBanner(n ? `Cache dropped on ${n} occupied camp${n > 1 ? "s" : ""}` : "Empty wall — no cache");
    }
    if (store.banners.length) {
      const b = store.banners.shift();
      if (b && !b.startsWith("Cache")) showBanner(b);
    }
  }

  return { update, showBanner };
}
