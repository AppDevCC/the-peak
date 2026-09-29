import { CAMPS, capToPitch, PITCHES, campForCap, BRAND, TAGLINE, TICKER } from "./config.js";
import { campOccupied } from "./sim.js";

const WORLD_H = 1520;
const WORLD_W = 1600;
const CX = WORLD_W / 2;

const LEDGES = [
  { y: 260, half: 70 },
  { y: 430, half: 150 },
  { y: 620, half: 240 },
  { y: 880, half: 360 },
  { y: 880, half: 360 },
  { y: 1100, half: 490 },
  { y: 1100, half: 490 },
  { y: 1480, half: 680 },
];

function hash(i, a = 12.9898, b = 43758.5453) {
  const n = Math.sin(i * a) * b;
  return n - Math.floor(n);
}

const STARS = Array.from({ length: 220 }, (_, i) => ({
  x: hash(i, 12.99, 43758.54),
  y: hash(i, 78.23, 24634.86) * 0.62,
  r: i % 23 === 0 ? 1.8 : i % 7 === 0 ? 1.15 : 0.55,
  a: 0.35 + hash(i, 3.1, 91.7) * 0.65,
  tw: 0.4 + hash(i, 9.2, 17.3) * 2.2,
}));

const FLAKES = Array.from({ length: 120 }, (_, i) => ({
  x: hash(i, 4.1, 917) * WORLD_W,
  y: hash(i, 7.7, 413) * WORLD_H,
  z: 0.25 + hash(i, 2.2, 88) * 0.9,
  s: 0.6 + hash(i, 5.5, 33) * 1.8,
}));

export function createScene(canvas, store) {
  const ctx = canvas.getContext("2d", { alpha: false });

  let w = 480;
  let h = 270;
  let camY = WORLD_H * 0.52;
  let camX = 0;
  let zoom = 1;
  let view = "whole";
  let follow = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let t = 0;
  let shake = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    w = Math.max(420, Math.floor(rect.width));
    h = Math.max(240, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
  }

  function pitchY(p) {
    return WORLD_H - 70 - (p / PITCHES) * (WORLD_H - 200);
  }

  function alt(y) {
    return Math.max(0, Math.min(1, 1 - (y - 18) / (WORLD_H - 80)));
  }

  function spurOut(y, centers) {
    let extra = 0;
    for (const c of centers) {
      const d = Math.abs(y - c.y);
      if (d < c.h) extra += c.w * (1 - d / c.h);
    }
    return extra;
  }

  function mountainHalf(y) {
    const t = Math.max(0, Math.min(1, (y - 30) / 1470));
    return 36 + Math.pow(t, 0.94) * 690;
  }

  function leftEdge(y) {
    return CX - mountainHalf(y) + Math.sin(y * 0.008) * 8;
  }
  function rightEdge(y) {
    return CX + mountainHalf(y) * 0.99 - Math.sin(y * 0.007) * 7;
  }

  function ledgeForCamp(campId) {
    const id = Math.max(0, Math.min(CAMPS.length - 1, campId | 0));
    return LEDGES[LEDGES.length - 2 - id];
  }

  function aroundLedge(ledge, ang) {
    const y = ledge.y - 2;
    const rad = Math.max(22, mountainHalf(y) * 0.62);
    return {
      x: CX + Math.sin(ang) * rad,
      y,
      ang,
      facing: Math.cos(ang),
    };
  }

  function trailAt(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const campId = Math.round(p * (CAMPS.length - 1));
    return aroundLedge(ledgeForCamp(campId), p * Math.PI * 2);
  }

  function worldToScreen(x, y) {
    return {
      x: (x - CX - camX) * zoom + w / 2,
      y: (y - camY) * zoom + h / 2,
    };
  }

  function fitView() {
    const cap = store.cap || 3000;
    if (view === "whole") {
      zoom = Math.min(w / WORLD_W, h / WORLD_H) * 1.06;
      camY = WORLD_H * 0.5;
      camX = 0;
    } else if (view === "working") {
      const camp = campForCap(store.cap || 3000);
      const L = ledgeForCamp(camp.id);
      zoom = 1.45;
      camY = L.y;
      camX = 0;
    } else if (view === "mine" && follow) {
      const tr = climberTrailPos(follow);
      zoom = 2.2;
      camY = tr.y - 8;
      camX = (tr.x - CX) * 0.5;
    } else {
      zoom = 1.15;
      camY = pitchY(capToPitch(cap));
    }
  }

  function pathWorld(pts) {
    ctx.beginPath();
    const a = worldToScreen(pts[0].x, pts[0].y);
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < pts.length; i++) {
      const s = worldToScreen(pts[i].x, pts[i].y);
      ctx.lineTo(s.x, s.y);
    }
  }

  function fillPoly(pts, color) {
    if (pts.length < 2) return;
    pathWorld(pts);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function clipMountain() {
    ctx.beginPath();
    const peak = worldToScreen(CX, -10);
    ctx.moveTo(peak.x, peak.y);
    for (let y = 8; y <= WORLD_H - 2; y += 3) {
      const s = worldToScreen(leftEdge(y), y);
      ctx.lineTo(s.x, s.y);
    }
    for (let y = WORLD_H - 2; y >= 8; y -= 3) {
      const s = worldToScreen(rightEdge(y), y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.closePath();
  }

  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#061018");
    g.addColorStop(0.42, "#0a1c36");
    g.addColorStop(0.78, "#12344f");
    g.addColorStop(1, "#1a4a62");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#eef6ff";
    for (const s of STARS) {
      if (s.y > 0.68) continue;
      ctx.globalAlpha = 0.28 + s.a * 0.55;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r > 1.2 ? 1.6 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(w * 0.14, h * 0.1);
    ctx.strokeStyle = "#fff8dc";
    ctx.lineWidth = Math.max(7, Math.min(11, w * 0.01));
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 0, 26, -0.75, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  function drawFarRange() {
    const bot = h * 0.92;
    ctx.fillStyle = "#1a3048";
    ctx.beginPath();
    ctx.moveTo(-20, bot);
    ctx.lineTo(w * 0.18, h * 0.62);
    ctx.lineTo(w * 0.34, bot);
    ctx.lineTo(w * 0.72, h * 0.58);
    ctx.lineTo(w * 0.92, bot);
    ctx.lineTo(w + 20, bot);
    ctx.lineTo(w + 20, h + 20);
    ctx.lineTo(-20, h + 20);
    ctx.closePath();
    ctx.fill();
  }

  function mixX(y, u) {
    return leftEdge(y) + (rightEdge(y) - leftEdge(y)) * u;
  }

  function ridgeStroke(pts, color, width) {
    ctx.beginPath();
    const a = worldToScreen(pts[0].x, pts[0].y);
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < pts.length; i++) {
      const s = worldToScreen(pts[i].x, pts[i].y);
      ctx.lineTo(s.x, s.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawMountainBody() {
    clipMountain();
    ctx.fillStyle = "#2c2a28";
    ctx.fill();

    ctx.save();
    clipMountain();
    ctx.clip();
    const midL = worldToScreen(leftEdge(WORLD_H * 0.5), WORLD_H * 0.5);
    const midR = worldToScreen(rightEdge(WORLD_H * 0.5), WORLD_H * 0.5);
    const shadeG = ctx.createLinearGradient(midL.x, 0, midR.x, 0);
    shadeG.addColorStop(0, "rgba(70,66,62,0.35)");
    shadeG.addColorStop(0.42, "rgba(0,0,0,0)");
    shadeG.addColorStop(1, "rgba(8,8,8,0.5)");
    ctx.fillStyle = shadeG;
    ctx.fillRect(0, 0, w, h);

    ctx.lineJoin = "round";
    for (let row = 0; row < 8; row++) {
      const y0 = 50 + row * 185;
      const y1 = y0 + 220;
      const cols = 2 + Math.min(3, row);
      for (let i = 0; i < cols; i++) {
        const u0 = Math.max(0.02, i / cols + (hash(row * 20 + i, 2.1, 9) - 0.5) * 0.08);
        const u1 = Math.min(0.98, (i + 1) / cols + (hash(row * 20 + i, 3.3, 11) - 0.5) * 0.08);
        const j0 = (hash(row + i, 1.1, 7) - 0.5) * 36;
        const j1 = (hash(row + i, 4.2, 9) - 0.5) * 28;
        const pts = [
          { x: mixX(y0, u0), y: y0 + j0 },
          { x: mixX(y0, u1), y: y0 + j1 * 0.4 },
          { x: mixX(y1, Math.min(0.98, u1 + 0.04)), y: y1 + j1 },
          { x: mixX(y1, Math.max(0.02, u0 - 0.04)), y: y1 + j0 * 0.3 },
        ];
        fillPoly(pts, hash(row * 11 + i, 5, 13) > 0.5 ? "rgba(12,10,9,0.38)" : "rgba(78,72,66,0.16)");
        ridgeStroke([...pts, pts[0]], "rgba(14,12,10,0.85)", Math.max(1.6, zoom * 1.8));
      }
    }
    ctx.restore();

    clipMountain();
    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = Math.max(3.4, zoom * 4);
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawSummit() {
    ctx.save();
    clipMountain();
    ctx.clip();
    fillPoly(
      [
        { x: CX, y: 16 },
        { x: leftEdge(340), y: 340 },
        { x: rightEdge(340), y: 340 },
      ],
      "#f4f1ea"
    );
    fillPoly(
      [
        { x: CX, y: 16 },
        { x: mixX(340, 0.48), y: 200 },
        { x: rightEdge(340), y: 340 },
      ],
      "#c5c0b6"
    );
    ctx.restore();
    ridgeStroke(
      [
        { x: leftEdge(340), y: 340 },
        { x: CX, y: 16 },
        { x: rightEdge(340), y: 340 },
      ],
      "#1a1410",
      Math.max(2.2, zoom * 2.4)
    );
  }

  function wrapBand(y, thick, tilt, waveAmp) {
    const top = [];
    const bot = [];
    for (let i = 0; i <= 28; i++) {
      const u = i / 28;
      const x = mixX(y, 0.002 + u * 0.996);
      const wav = Math.sin(u * Math.PI * 1.35 + tilt * 0.02) * waveAmp;
      const wav2 = Math.cos(u * Math.PI * 1.1 + 0.6) * waveAmp * 0.45;
      top.push({ x, y: y - thick * 0.42 + wav + (u - 0.5) * tilt * 0.35 });
      bot.push({ x, y: y + thick * 0.58 + wav2 + (u - 0.5) * tilt * 0.2 });
    }
    return { top, bot };
  }

  function drawPine(wx, wy, height, lean = 0) {
    const p = worldToScreen(wx, wy);
    const s = height * zoom;
    if (p.x < -40 || p.x > w + 40 || p.y < -20 || p.y > h + 40) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(lean);
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(-s * 0.055, -s * 0.12, s * 0.11, s * 0.18);
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const top = -s * (0.98 - i * 0.22);
      const bot = -s * (0.52 - i * 0.2);
      const hw = s * (0.26 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(-hw, bot);
      ctx.lineTo(hw, bot);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? "#1f4d32" : "#276344";
      ctx.fill();
      ctx.strokeStyle = "#1a1410";
      ctx.lineWidth = Math.max(1.3, s * 0.07);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(-hw * 0.62, top + (bot - top) * 0.42);
      ctx.lineTo(hw * 0.5, top + (bot - top) * 0.36);
      ctx.closePath();
      ctx.fillStyle = "#f3f0e8";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLedges() {
    const bands = [
      { y: 430, thick: 78, tilt: -52, wave: 22 },
      { y: 620, thick: 86, tilt: 40, wave: 20 },
      { y: 880, thick: 96, tilt: -46, wave: 22 },
      { y: 1100, thick: 112, tilt: 24, wave: 16 },
    ];
    ctx.save();
    clipMountain();
    ctx.clip();
    for (const b of bands) {
      const { top, bot } = wrapBand(b.y, b.thick, b.tilt, b.wave);
      fillPoly([...top, ...bot.slice().reverse()], "#f3f0e8");
    }
    ctx.restore();

    ctx.save();
    clipMountain();
    ctx.clip();
    for (const b of bands) {
      const { top, bot } = wrapBand(b.y, b.thick, b.tilt, b.wave);
      ridgeStroke(top, "#1a1410", Math.max(2.2, zoom * 2.4));
      ridgeStroke(bot, "#1a1410", Math.max(1.8, zoom * 2));
    }
    ctx.restore();
  }

  function drawPines() {
    const spots = [
      { y: 430, u: 0.22, h: 36 },
      { y: 430, u: 0.52, h: 30 },
      { y: 430, u: 0.78, h: 34 },
      { y: 620, u: 0.16, h: 38 },
      { y: 620, u: 0.74, h: 36 },
      { y: 880, u: 0.12, h: 32 },
      { y: 1100, u: 0.14, h: 40 },
      { y: 1100, u: 0.84, h: 38 },
    ];
    for (const s of spots) {
      drawPine(mixX(s.y, s.u), s.y + 10, s.h, (s.u - 0.5) * 0.05);
    }
  }

  function drawForeground() {
    ctx.beginPath();
    const a = worldToScreen(0, WORLD_H - 28);
    ctx.moveTo(-20, h + 20);
    ctx.lineTo(a.x, a.y);
    for (let x = 0; x <= WORLD_W; x += 26) {
      const s = worldToScreen(x, WORLD_H - 22 - Math.sin(x * 0.016) * 8);
      ctx.lineTo(s.x, s.y);
    }
    ctx.lineTo(w + 20, h + 20);
    ctx.closePath();
    ctx.fillStyle = "#d8d4cc";
    ctx.fill();
    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = Math.max(2, zoom * 2);
    ctx.beginPath();
    let started = false;
    for (let x = 0; x <= WORLD_W; x += 26) {
      const s = worldToScreen(x, WORLD_H - 22 - Math.sin(x * 0.016) * 8);
      if (!started) {
        ctx.moveTo(s.x, s.y);
        started = true;
      } else ctx.lineTo(s.x, s.y);
    }
    ctx.stroke();

    const floorY = WORLD_H - 18;
    const mL = leftEdge(floorY);
    const mR = rightEdge(floorY);
    for (let i = 0; i < 6; i++) {
      drawPine(mL - 30 - i * 48 - hash(i, 2.2, 12) * 12, floorY - (i % 2) * 5, 22 + (i % 4) * 8, (hash(i, 3, 4) - 0.5) * 0.08);
    }
    for (let i = 0; i < 6; i++) {
      drawPine(mR + 30 + i * 48 + hash(i, 4.4, 12) * 12, floorY - (i % 2) * 5, 22 + (i % 4) * 8, (hash(i, 6, 4) - 0.5) * 0.08);
    }
  }

  function drawTrail() {
    const pts = [];
    for (let i = 0; i <= 240; i++) {
      const p = i / 240;
      const y = 1360 - p * 1210;
      const amp = mountainHalf(y) * 0.58;
      const zig = Math.sin(p * Math.PI * 9.2) * amp;
      pts.push({ x: CX + zig, y, facing: Math.cos(p * Math.PI * 9.2) });
    }

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const strokeVisible = (width, color, offsetY = 0) => {
      ctx.beginPath();
      let started = false;
      for (const p of pts) {
        if (p.facing < -0.55) {
          started = false;
          continue;
        }
        const s = worldToScreen(p.x, p.y + offsetY);
        if (!started) {
          ctx.moveTo(s.x, s.y);
          started = true;
        } else ctx.lineTo(s.x, s.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };

    strokeVisible(Math.max(4.4, zoom * 5.2), "rgba(12, 32, 48, 0.45)", 1.2);
    strokeVisible(Math.max(3.2, zoom * 3.8), "#cfe8f4");
    strokeVisible(Math.max(1.2, zoom * 1.6), "#eef6ff", -0.6);
  }

  function drawLodge(sx, sy, s) {
    ctx.fillStyle = "#3a2416";
    ctx.fillRect(sx - 7 * s, sy - 5 * s, 14 * s, 7 * s);
    ctx.fillStyle = "#2a1810";
    ctx.beginPath();
    ctx.moveTo(sx - 8 * s, sy - 5 * s);
    ctx.lineTo(sx, sy - 11 * s);
    ctx.lineTo(sx + 8 * s, sy - 5 * s);
    ctx.fill();
    ctx.fillStyle = "#eef4ff";
    ctx.beginPath();
    ctx.moveTo(sx - 8.2 * s, sy - 5.2 * s);
    ctx.lineTo(sx, sy - 11.4 * s);
    ctx.lineTo(sx + 8.2 * s, sy - 5.2 * s);
    ctx.lineTo(sx + 6 * s, sy - 5.2 * s);
    ctx.lineTo(sx, sy - 9.4 * s);
    ctx.lineTo(sx - 6 * s, sy - 5.2 * s);
    ctx.fill();
    ctx.fillStyle = "#ffd48a";
    ctx.fillRect(sx - 4 * s, sy - 2.2 * s, 2.2 * s, 2.4 * s);
    ctx.fillRect(sx + 1.4 * s, sy - 2.2 * s, 2.2 * s, 2.4 * s);
    ctx.fillStyle = "rgba(255, 200, 110, 0.28)";
    ctx.beginPath();
    ctx.arc(sx, sy - s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCamp(camp, occupied, cold) {
    const tr = aroundLedge(ledgeForCamp(camp.id), 0);
    const p = worldToScreen(tr.x, tr.y);
    const s = Math.max(1.6, zoom * 2.4);

    ctx.fillStyle = cold ? "rgba(160, 180, 200, 0.55)" : "rgba(40, 60, 90, 0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + s, 11 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    if (camp.id === 0 && !cold) {
      drawLodge(p.x, p.y, s * 0.85);
      return;
    }

    if (cold) {
      ctx.fillStyle = "#dce6ef";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - s, 6 * s, 2.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a7e90";
      ctx.fillRect(p.x - 4 * s, p.y - 0.4 * s, 8 * s, 1.6 * s);
      return;
    }

    const tent = occupied ? "#c4452d" : "#6a4030";
    ctx.beginPath();
    ctx.moveTo(p.x - 1.5 * s, p.y - 8 * s);
    ctx.lineTo(p.x - 8 * s, p.y + s);
    ctx.lineTo(p.x + 6 * s, p.y + s);
    ctx.closePath();
    ctx.fillStyle = tent;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(p.x - 1.5 * s, p.y - 8 * s);
    ctx.lineTo(p.x + 6 * s, p.y + s);
    ctx.lineTo(p.x + 2.5 * s, p.y - 5 * s);
    ctx.closePath();
    ctx.fillStyle = occupied ? "#e8a090" : "#4a2c22";
    ctx.fill();
    ctx.strokeStyle = "rgba(20,16,12,0.45)";
    ctx.lineWidth = Math.max(0.6, zoom * 0.7);
    ctx.beginPath();
    ctx.moveTo(p.x - 1.5 * s, p.y - 8 * s);
    ctx.lineTo(p.x - 8 * s, p.y + s);
    ctx.stroke();

    if (occupied) {
      ctx.fillStyle = "rgba(255, 180, 70, 0.22)";
      ctx.beginPath();
      ctx.arc(p.x, p.y - 2 * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc14a";
      ctx.beginPath();
      ctx.arc(p.x + 5 * s, p.y - 0.5 * s, 1.3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, rw, rh, r) {
    const rad = Math.min(r, rw / 2, rh / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, rad);
    ctx.arcTo(x + rw, y + rh, x, y + rh, rad);
    ctx.arcTo(x, y + rh, x, y, rad);
    ctx.arcTo(x, y, x + rw, y, rad);
    ctx.closePath();
  }

  function drawPerson(sx, sy, color, opts = {}) {
    const s = Math.max(1.8, opts.scale || zoom * 2.6);
    const bob = opts.bob || 0;
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(opts.flip ? -1 : 1, 1);

    ctx.fillStyle = "rgba(12, 24, 48, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 3.6 * s, 2.6 * s, 0.7 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = Math.max(1.2, s * 0.55);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-0.7 * s, 0.2 * s);
    ctx.lineTo(-1.1 * s, 3.2 * s);
    ctx.moveTo(0.8 * s, 0.2 * s);
    ctx.lineTo(0.7 * s + (opts.step ? 0.6 * s : 0), 3.2 * s);
    ctx.stroke();
    ctx.fillStyle = "#16100c";
    ctx.beginPath();
    ctx.ellipse(-1.2 * s, 3.4 * s, 0.7 * s, 0.32 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0.9 * s + (opts.step ? 0.5 * s : 0), 3.4 * s, 0.7 * s, 0.32 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    roundRect(-2.1 * s, -5.2 * s, 4.3 * s, 5.4 * s, 1.3 * s);
    ctx.fill();
    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = Math.max(1.1, s * 0.28);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(-1.6 * s, -5 * s, 2 * s, 2.2 * s, 0.8 * s);
    ctx.fill();

    ctx.fillStyle = "#2c2218";
    ctx.fillRect(-2.1 * s, -1.1 * s, 4.3 * s, 0.55 * s);

    ctx.fillStyle = "#3a3228";
    roundRect(-3.1 * s, -4.8 * s, 1.5 * s, 3.2 * s, 0.5 * s);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.3, s * 0.7);
    ctx.beginPath();
    ctx.moveTo(-2.2 * s, -3.4 * s);
    ctx.lineTo(-3.4 * s, -1.2 * s);
    ctx.moveTo(2.1 * s, -3.6 * s);
    ctx.lineTo(3.3 * s, -4.8 * s);
    ctx.stroke();

    ctx.strokeStyle = "#d5dde4";
    ctx.lineWidth = Math.max(1.1, s * 0.42);
    ctx.beginPath();
    ctx.moveTo(3.2 * s, -6.2 * s);
    ctx.lineTo(3.5 * s, -0.4 * s);
    ctx.stroke();
    ctx.strokeStyle = "#8a93a0";
    ctx.lineWidth = Math.max(1.4, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(2.4 * s, -6.15 * s);
    ctx.lineTo(4.2 * s, -6.15 * s);
    ctx.stroke();

    ctx.fillStyle = "#f0c9a0";
    ctx.beginPath();
    ctx.arc(0, -6.6 * s, 1.35 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -7.15 * s, 1.55 * s, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.1, s * 0.45);
    ctx.beginPath();
    ctx.arc(0, -6.5 * s, 1.55 * s, 0.15, Math.PI - 0.15);
    ctx.stroke();

    if (opts.highlight) {
      ctx.fillStyle = "#ffc14a";
      ctx.beginPath();
      ctx.arc(0, -9.2 * s, 0.7 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function climberTrailPos(c) {
    const L = ledgeForCamp(c.campId);
    const ang = (c.id * 2.399 + (c.phase || 0) * 0.7 + t * 0.32) % (Math.PI * 2);
    return aroundLedge(L, ang);
  }

  function drawClimber(c) {
    if (!c.holding && !c.falling) return;
    const tr = climberTrailPos(c);
    let x = tr.x;
    let y = tr.y - 2;
    if (c.arriving) x -= c.arriving * 22;
    const bob = c.holding && !c.falling ? Math.sin(t * 5 + c.phase) * 1.2 - (c.cheer || 0) * 3 : 0;
    if (c.falling) {
      y += c.fallT * c.fallT * 210;
      x += Math.sin(c.fallT * 9) * 16 + c.fallT * 36;
    }
    if (!c.falling && tr.facing < -0.38) return;
    const p = worldToScreen(x, y);
    drawPerson(p.x, p.y, c.color, {
      scale: Math.max(1.8, zoom * 2.55),
      flip: Math.sin(tr.ang) < 0,
      bob,
      step: Math.sin(t * 6 + c.phase) > 0,
      highlight: c.highlighted,
    });
    if (c.falling) {
      ctx.fillStyle = "rgba(240,248,255,0.7)";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, 8, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCache() {
    for (const d of store.cacheDrops || []) {
      const camp = CAMPS[d.campId];
      if (!camp) continue;
      const tr = aroundLedge(ledgeForCamp(d.campId), 0);
      const p = worldToScreen(tr.x, tr.y - 36 + d.t * 42);
      ctx.globalAlpha = Math.max(0, 1 - d.t / 2.8);
      ctx.fillStyle = "#ffc14a";
      roundRect(p.x - 5, p.y, 10, 8, 2);
      ctx.fill();
      ctx.fillStyle = "#fff4c8";
      ctx.fillRect(p.x - 3, p.y + 2, 6, 2);
      ctx.fillStyle = "#ffe08a";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(d.t * 9 + i) * 14, p.y + i * 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawFlares() {
    for (const f of store.flares || []) {
      const y = 70 + Math.sin(f.t * 3) * 18;
      const x = 50 + f.x * (WORLD_W - 100);
      const p = worldToScreen(x, y);
      ctx.fillStyle = f.style.color;
      roundRect(p.x, p.y, 10, 5, 2);
      ctx.fill();
      ctx.strokeStyle = "#ffc14a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + 5, p.y + 5);
      ctx.lineTo(p.x + 5, p.y + 16);
      ctx.stroke();
      ctx.font = "700 12px Unbounded, sans-serif";
      ctx.fillStyle = f.style.color;
      ctx.fillText(f.text, p.x + 14, p.y + 10);
    }
  }

  function drawSnow() {
    ctx.fillStyle = "#f7fbff";
    for (const s of FLAKES) {
      s.y += s.z * 22 * (store.speed || 1) * 0.016 * 3.2;
      s.x += Math.sin(t * 0.8 + s.y * 0.01) * 0.5;
      if (s.y > WORLD_H) s.y = 0;
      if (s.x < 0) s.x += WORLD_W;
      if (s.x > WORLD_W) s.x -= WORLD_W;
      const p = worldToScreen(s.x, s.y);
      if (p.x < -4 || p.x > w + 4 || p.y < -4 || p.y > h + 4) continue;
      ctx.globalAlpha = 0.45 + s.z * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.s * Math.max(0.6, zoom * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function frame(dt) {
    t += dt;
    if (view !== "free") fitView();
    if (shake > 0) {
      camX += (Math.random() - 0.5) * shake * 4;
      shake *= 0.86;
    }

    drawSky();
    drawFarRange();
    drawMountainBody();
    drawSummit();
    drawLedges();
    drawPines();

    const cap = store.cap || 0;
    const ath = store.ath || cap;
    for (const camp of CAMPS) {
      if (camp.cap > ath * 1.05 && camp.id > 0) continue;
      const cold = camp.cap > cap && camp.cap <= ath;
      const occ = !cold && campOccupied(store, camp.id);
      drawCamp(camp, occ, cold);
    }

    const list = store.climbers || [];
    const perCamp = {};
    const back = [];
    const front = [];
    for (const c of list) {
      if (c.falling && c.fallT < 2.3) {
        front.push(c);
        continue;
      }
      if (!c.holding) continue;
      perCamp[c.campId] = (perCamp[c.campId] || 0) + 1;
      if (perCamp[c.campId] > 40 && !c.highlighted) continue;
      const tr = climberTrailPos(c);
      if (tr.facing < 0) back.push(c);
      else front.push(c);
    }
    for (const c of back) drawClimber(c);
    for (const c of front) drawClimber(c);

    drawForeground();
    drawCache();
    drawFlares();
    drawSnow();
    if (store.paydayPulse) {
      ctx.fillStyle = `rgba(255,193,74,${store.paydayPulse * 0.08})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    view = "free";
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => (dragging = false));
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    camX -= (e.clientX - lastX) / zoom;
    camY -= (e.clientY - lastY) / zoom;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      view = "free";
      zoom = Math.max(0.35, Math.min(3.2, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    },
    { passive: false }
  );

  function drawBannerLettering() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const title = BRAND;
    const titleSize = Math.min(86, w * 0.084);
    const titleY = h * 0.038;
    ctx.font = `700 ${titleSize}px Unbounded, "Arial Black", sans-serif`;
    ctx.fillStyle = "#8a651c";
    ctx.fillText(title, w / 2, titleY + titleSize * 0.045);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(title, w / 2, titleY + titleSize * 0.09);
    ctx.fillStyle = "#ffc14a";
    ctx.fillText(title, w / 2, titleY);

    ctx.font = `500 ${Math.max(16, Math.min(22, w * 0.018))}px Barlow, sans-serif`;
    ctx.fillStyle = "rgba(6,16,24,0.45)";
    ctx.fillText(TAGLINE, w / 2 + 1, titleY + titleSize + 15);
    ctx.fillStyle = "#eef6ff";
    ctx.fillText(TAGLINE, w / 2, titleY + titleSize + 14);

    const tick = `$${TICKER}`;
    const tickSize = Math.min(64, w * 0.062);
    const tickY = h * 0.88;
    ctx.font = `700 ${tickSize}px Unbounded, "Arial Black", sans-serif`;
    ctx.fillStyle = "#8a651c";
    ctx.fillText(tick, w / 2, tickY + tickSize * 0.045);
    ctx.fillStyle = "#ffc14a";
    ctx.fillText(tick, w / 2, tickY);
    ctx.restore();
  }

  function captureBanner(outW = 1280, outH = 720) {
    const dpr = 2;
    w = outW;
    h = outH;
    canvas.width = Math.floor(outW * dpr);
    canvas.height = Math.floor(outH * dpr);
    canvas.style.width = `${outW}px`;
    canvas.style.height = `${outH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    view = "whole";
    follow = null;
    camX = 0;
    shake = 0;
    fitView();
    zoom *= 0.8;
    camY = WORLD_H * 0.42;
    view = "free";
    frame(0);
    drawBannerLettering();
    return canvas.toDataURL("image/png");
  }

  return {
    resize,
    frame,
    captureBanner,
    setView(v, climber) {
      view = v;
      follow = climber || follow;
      fitView();
    },
    follow(climber) {
      follow = climber;
      view = "mine";
      fitView();
    },
    zoomBy(f) {
      view = "free";
      zoom = Math.max(0.35, Math.min(3.2, zoom * f));
    },
    shake(n = 1) {
      shake = n;
    },
    get canvas() {
      return canvas;
    },
  };
}
