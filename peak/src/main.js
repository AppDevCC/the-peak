import { createSim, tickSim, beginLive } from "./sim.js";
import { createScene } from "./scene.js";
import { createAudio } from "./audio.js";
import { mountUI } from "./ui.js";
import { resolveMint } from "./config.js";
import { startFeed } from "./feed.js";

const store = createSim();
const canvas = document.getElementById("glacier");
const scene = createScene(canvas, store);
const audio = createAudio();
const feed = startFeed(store);

const mint = resolveMint();
if (mint) {
  store.mint = mint;
  beginLive(store);
  feed.watch(mint);
}

const ui = mountUI(document.getElementById("ui"), store, scene, audio, feed);

scene.resize();
window.addEventListener("resize", () => scene.resize());
window.__peakCaptureBanner = async () => {
  const ui = document.getElementById("ui");
  if (ui) ui.style.display = "none";
  document.body.classList.remove("covered");
  const cover = document.getElementById("cover");
  if (cover) cover.remove();
  await document.fonts.ready;
  await document.fonts.load("700 92px Unbounded");
  await document.fonts.load("500 22px Barlow");
  return scene.captureBanner(1280, 720);
};

let last = performance.now();
let uiAcc = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  tickSim(store, dt);
  scene.frame(dt);
  uiAcc += dt;
  if (uiAcc > 0.12) {
    ui.update();
    uiAcc = 0;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
