// Texturas procedurales generadas con <canvas>. No requieren archivos externos.
// Para usar texturas reales (p. ej. de ambientCG o Poly Haven) sustituye estas
// funciones por un THREE.TextureLoader().load('/assets/textures/archivo.jpg').
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function addNoise(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function toTexture(canvas, { repeat = [1, 1], srgb = true, repeatWrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (repeatWrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

/* ------------------------------------------------------------------ */
/* Suelo                                                               */
/* ------------------------------------------------------------------ */
export function createBallastTexture(repeat) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#6a6259';
  ctx.fillRect(0, 0, S, S);
  const tones = ['#8b837a', '#5a534b', '#7a7166', '#4a443d', '#9a9288', '#6e5f52'];
  for (let i = 0; i < 1300; i++) {
    const x = rnd(0, S);
    const y = rnd(0, S);
    const r = rnd(2, 6);
    ctx.fillStyle = tones[(Math.random() * tones.length) | 0];
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const px = x + ox;
        const py = y + oy;
        if (px < -8 || px > S + 8 || py < -8 || py > S + 8) continue;
        ctx.beginPath();
        ctx.ellipse(px, py, r, r * rnd(0.6, 1), rnd(0, Math.PI), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  addNoise(ctx, S, S, 28);
  return toTexture(c, { repeat });
}

export function createAsphaltTexture(repeat) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#34343a';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(${(Math.random() * 120) | 0},${(Math.random() * 120) | 0},${(Math.random() * 120) | 0},0.12)`;
    ctx.fillRect(rnd(0, S), rnd(0, S), rnd(1, 3), rnd(1, 3));
  }
  addNoise(ctx, S, S, 22);
  return toTexture(c, { repeat });
}

export function createConcreteTexture(repeat) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#8c887f';
  ctx.fillRect(0, 0, S, S);
  addNoise(ctx, S, S, 30);
  // manchas y vetas verticales
  for (let i = 0; i < 26; i++) {
    const x = rnd(0, S);
    const g = ctx.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(30,25,20,0)');
    g.addColorStop(1, `rgba(30,25,20,${rnd(0.08, 0.22)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rnd(2, 9), S);
  }
  // juntas
  ctx.strokeStyle = 'rgba(40,38,34,0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, S, S);
  return toTexture(c, { repeat });
}

/* ------------------------------------------------------------------ */
/* Edificios: cada textura cubre 12 m x 12 m (4 x 4 ventanas)           */
/* ------------------------------------------------------------------ */
export const BUILDING_TILE = 12;

export function createBuildingTextures() {
  const palettes = [
    ['#6e5b52', '#3d322d'],
    ['#4d5967', '#2b333c'],
    ['#7d7468', '#4a4339'],
    ['#5a4a58', '#312731'],
    ['#8a6f5a', '#4a3a2d'],
  ];
  return palettes.map(([wall, trim]) => {
    const S = 512;
    const [c, ctx] = makeCanvas(S, S);
    const [e, ectx] = makeCanvas(S, S);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, S, S);
    addNoise(ctx, S, S, 22);
    ectx.fillStyle = '#000';
    ectx.fillRect(0, 0, S, S);

    const cell = S / 4;
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        const w = cell * 0.52;
        const h = cell * 0.62;
        const x = cx * cell + (cell - w) / 2;
        const y = cy * cell + cell * 0.2;
        ctx.fillStyle = trim;
        ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
        const lit = Math.random() < 0.38;
        if (lit) {
          const warm = Math.random() < 0.7 ? ['#ffd68a', '#ffb347'] : ['#cfe8ff', '#9cc7f0'];
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, warm[0]);
          g.addColorStop(1, warm[1]);
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w, h);
          ectx.fillStyle = warm[1];
          ectx.globalAlpha = rnd(0.55, 0.9);
          ectx.fillRect(x, y, w, h);
          ectx.globalAlpha = 1;
        } else {
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, '#46566e');
          g.addColorStop(1, '#141a26');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = trim;
        ctx.fillRect(x + w / 2 - 1.5, y, 3, h);
        ctx.fillRect(x, y + h * 0.45, w, 3);
      }
      // cornisa de cada piso
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, cy * cell + cell - 5, S, 5);
    }
    return { map: toTexture(c), emissiveMap: toTexture(e) };
  });
}

/* ------------------------------------------------------------------ */
/* Trenes                                                              */
/* ------------------------------------------------------------------ */
export const TRAIN_PALETTES = [
  { body: '#c0392b', accent: '#f4c542' },
  { body: '#2f6f9f', accent: '#e9eef2' },
  { body: '#3b8a5a', accent: '#f0f0e8' },
  { body: '#d9822b', accent: '#26262a' },
  { body: '#8a929c', accent: '#c0392b' },
];

const sideCache = new Map();

export function createTrainSideTexture(paletteIndex, length) {
  const key = `${paletteIndex}-${length}`;
  if (sideCache.has(key)) return sideCache.get(key);

  const p = TRAIN_PALETTES[paletteIndex];
  const W = Math.round(length * 85);
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);

  ctx.fillStyle = p.body;
  ctx.fillRect(0, 0, W, H);
  // degradado vertical para dar volumen
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(255,255,255,0.18)');
  vg.addColorStop(0.5, 'rgba(255,255,255,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = shade(p.body, -0.2);
  ctx.fillRect(0, 0, W, 14); // techo
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, H * 0.66, W, 15);
  ctx.fillStyle = '#25262a';
  ctx.fillRect(0, H * 0.9, W, H * 0.1); // faldón

  const doorX = length >= 16 ? [0.17, 0.5, 0.83] : [0.22, 0.78];
  const doorW = 96;
  const doorCenters = doorX.map((d) => d * W);

  const drawWindow = (x, y, w, h) => {
    ctx.fillStyle = '#1b1c20';
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#5b7894');
    g.addColorStop(0.55, '#243445');
    g.addColorStop(1, '#0f151d');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y);
    ctx.lineTo(x + w * 0.45, y);
    ctx.lineTo(x + w * 0.2, y + h);
    ctx.lineTo(x - w * 0.15, y + h);
    ctx.closePath();
    ctx.fill();
  };

  for (const cx of doorCenters) {
    const x = cx - doorW / 2;
    ctx.fillStyle = shade(p.body, -0.1);
    ctx.fillRect(x, 26, doorW, H * 0.88 - 26);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 26, doorW, H * 0.88 - 26);
    ctx.beginPath();
    ctx.moveTo(cx, 26);
    ctx.lineTo(cx, H * 0.88);
    ctx.stroke();
    drawWindow(x + 9, 46, doorW / 2 - 14, 92);
    drawWindow(cx + 5, 46, doorW / 2 - 14, 92);
  }

  for (let x = 70; x < W - 70; x += 150) {
    if (doorCenters.some((d) => Math.abs(d - x - 50) < doorW / 2 + 75)) continue;
    drawWindow(x, 50, 100, 84);
  }

  // suciedad y desgaste
  for (let i = 0; i < 38; i++) {
    const x = rnd(0, W);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,15,10,0)');
    g.addColorStop(1, `rgba(20,15,10,${rnd(0.1, 0.3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, rnd(2, 8), H);
  }
  addNoise(ctx, W, H, 16);

  const tex = toTexture(c, { repeatWrap: false });
  sideCache.set(key, tex);
  return tex;
}

const frontCache = new Map();

export function createTrainFrontTexture(paletteIndex) {
  if (frontCache.has(paletteIndex)) return frontCache.get(paletteIndex);
  const p = TRAIN_PALETTES[paletteIndex];
  const W = 256;
  const H = 384;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = p.body;
  ctx.fillRect(0, 0, W, H);
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(255,255,255,0.15)');
  vg.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // parabrisas
  ctx.fillStyle = '#17181c';
  ctx.beginPath();
  ctx.roundRect(22, 34, W - 44, 170, 16);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 40, 0, 200);
  g.addColorStop(0, '#6a8aa8');
  g.addColorStop(0.5, '#27394d');
  g.addColorStop(1, '#0d131b');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(30, 42, W - 60, 154, 12);
  ctx.fill();
  ctx.fillStyle = '#17181c';
  ctx.fillRect(W / 2 - 3, 42, 6, 154);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(40, 44);
  ctx.lineTo(110, 44);
  ctx.lineTo(60, 194);
  ctx.lineTo(34, 194);
  ctx.fill();

  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 232, W, 16);
  ctx.fillStyle = '#25262a';
  ctx.fillRect(0, 330, W, 54);

  // faros pintados + placa
  for (const x of [58, W - 58]) {
    const rg = ctx.createRadialGradient(x, 285, 3, x, 285, 30);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.5, '#fff1b8');
    rg.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, 285, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8e6df';
  ctx.fillRect(W / 2 - 34, 268, 68, 30);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(100 + ((Math.random() * 899) | 0)), W / 2, 291);
  addNoise(ctx, W, H, 14);

  const tex = toTexture(c, { repeatWrap: false });
  frontCache.set(paletteIndex, tex);
  return tex;
}

/* ------------------------------------------------------------------ */
/* Obstáculos                                                          */
/* ------------------------------------------------------------------ */
export function createStripeTexture(c1, c2) {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = c2;
  for (let x = -128; x <= 128; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 32, 0);
    ctx.lineTo(x + 32 + 128, 128);
    ctx.lineTo(x + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  addNoise(ctx, S, S, 18);
  return toTexture(c);
}

export function createCrateTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#8a6137';
  ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? '#94683c' : '#7d5630';
    ctx.fillRect(0, y, S, 62);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + 62, S, 3);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(50,30,10,${rnd(0.05, 0.18)})`;
    ctx.fillRect(rnd(0, S), rnd(0, S), rnd(20, 90), 1.5);
  }
  // marco y refuerzo diagonal
  ctx.strokeStyle = '#4e3418';
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, S - 16, S - 16);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(14, 14);
  ctx.lineTo(S - 14, S - 14);
  ctx.stroke();
  addNoise(ctx, S, S, 20);
  return toTexture(c, { repeatWrap: false });
}

/* ------------------------------------------------------------------ */
/* Cielo                                                               */
/* ------------------------------------------------------------------ */
export function createSkyTexture() {
  const [c, ctx] = makeCanvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#1a2650');
  g.addColorStop(0.28, '#4a5088');
  g.addColorStop(0.42, '#c9798a');
  g.addColorStop(0.485, '#f2a46c');
  g.addColorStop(0.5, '#c98f72'); // horizonte = color de la niebla
  g.addColorStop(1.0, '#c98f72');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSunTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,248,220,1)');
  g.addColorStop(0.12, 'rgba(255,225,160,0.95)');
  g.addColorStop(0.4, 'rgba(255,170,90,0.35)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
