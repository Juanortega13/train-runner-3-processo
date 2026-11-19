import { CONFIG, LANES } from './config.js';
import { OBSTACLE_DEPTH, TRAIN_PALETTES } from './Obstacle.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const ROW = 12; // longitud estándar de una fila con monedas
const lx = (lane) => lane * CONFIG.laneWidth;

/**
 * Genera el recorrido infinito por "filas": cada fila es un patrón de
 * obstáculos y monedas. Garantiza siempre una salida (carril libre o una
 * acción —saltar/deslizarse— que permita pasar) y separa las filas lo
 * suficiente para dar tiempo de reaccionar al aumentar la velocidad.
 */
export class Spawner {
  constructor(obstacles, coins) {
    this.obstacles = obstacles;
    this.coins = coins;
    this.reset();
  }

  reset() {
    this.frontier = CONFIG.startSafeZone; // borde lejano de la última fila
    this.rowCount = 0;
  }

  update(dz, speed, distance) {
    this.frontier += dz;
    let guard = 0;
    while (guard++ < 24) {
      const gap = Math.max(13, speed * 0.85) + rnd(0, 6);
      const near = this.frontier - gap;
      if (near < CONFIG.spawnZ) break;
      const length = this._makeRow(near, distance, speed);
      this.frontier = near - length;
      this.rowCount++;
    }
  }

  /* ------------------------ Filas ------------------------ */
  _makeRow(near, dist) {
    const lvl = Math.min(1, dist / 1800);
    const r = Math.random();
    if (this.rowCount < 2 || dist < 60) return r < 0.5 ? this._coinsRow(near) : this._singleRow(near);

    const pTrain = 0.16 + 0.26 * lvl;
    const pDouble = 0.12 + 0.14 * lvl;
    const pWall = 0.04 + 0.1 * lvl;
    const pCoins = 0.2;
    if (r < pTrain) return this._trainRow(near, lvl);
    if (r < pTrain + pDouble) return this._doubleRow(near);
    if (r < pTrain + pDouble + pWall) return this._wallRow(near);
    if (r < pTrain + pDouble + pWall + pCoins) return this._coinsRow(near);
    return this._singleRow(near);
  }

  _coinLine(lane, near, count, spacing = 2, y = 1.0) {
    for (let i = 0; i < count; i++) this.coins.add(lx(lane), y, near - 1 - i * spacing);
  }

  _coinArc(lane, near, count = 7, spacing = 2) {
    for (let i = 0; i < count; i++) {
      const y = 0.95 + 1.0 * Math.sin((Math.PI * i) / (count - 1));
      this.coins.add(lx(lane), y, near - 1 - i * spacing);
    }
  }

  _singleRow(near) {
    const lanes = shuffle(LANES);
    const kind = pick(['jersey', 'gantry', 'crate']);
    const lane = lanes[0];
    const center = near - ROW / 2;
    this.obstacles.spawn(kind, lane, center);

    const mode = Math.random();
    if (mode < 0.55) {
      if (kind === 'gantry') this._coinLine(lane, near, 6, 2, 0.9);
      else this._coinArc(lane, near);
    } else if (mode < 0.9) {
      this._coinLine(lanes[1], near, 6);
    }
    return ROW;
  }

  _doubleRow(near) {
    const lanes = shuffle(LANES);
    const center = near - ROW / 2;
    this.obstacles.spawn(pick(['jersey', 'gantry', 'crate']), lanes[0], center);
    this.obstacles.spawn(pick(['jersey', 'gantry', 'crate']), lanes[1], center);
    this._coinLine(lanes[2], near, 6);
    return ROW;
  }

  _wallRow(near) {
    // Los tres carriles bloqueados por obstáculos esquivables con una acción.
    const same = Math.random() < 0.6;
    const base = pick(['jersey', 'gantry']);
    const z = near - 2;
    for (const lane of LANES) {
      const kind = same ? base : pick(['jersey', 'gantry', 'crate']);
      this.obstacles.spawn(kind, lane, z);
    }
    // monedas sobre el salto / bajo la barra del carril central
    if (base === 'gantry' && same) this._coinLine(0, near + 4, 4, 2, 0.9);
    return 4;
  }

  _trainRow(near, lvl) {
    const length = pick([12, 18]);
    const center = near - length / 2;
    const two = Math.random() < 0.4 + 0.35 * lvl;
    const lanes = shuffle(LANES);
    const trainLanes = two ? [lanes[0], lanes[1]] : [lanes[0]];
    const free = lanes.filter((l) => !trainLanes.includes(l));

    const palette = (Math.random() * TRAIN_PALETTES.length) | 0;
    for (const l of trainLanes) {
      this.obstacles.spawn('train', l, center, { length, palette: two ? (palette + l + 2) % TRAIN_PALETTES.length : palette });
    }
    this._coinLine(free[0], near, Math.floor(length / 2));
    if (free[1] !== undefined && Math.random() < 0.45) {
      const kind = pick(['jersey', 'crate']);
      this.obstacles.spawn(kind, free[1], center);
    }
    return length;
  }

  _coinsRow(near) {
    const lane = pick(LANES);
    if (Math.random() < 0.5) {
      this._coinLine(lane, near, 10);
      return 20;
    }
    // zigzag entre carriles
    let current = lane;
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 3 === 0) {
        const options = LANES.filter((l) => Math.abs(l - current) === 1);
        current = pick(options);
      }
      this.coins.add(lx(current), 1.0, near - 1 - i * 2);
    }
    return 24;
  }
}

export { OBSTACLE_DEPTH };
