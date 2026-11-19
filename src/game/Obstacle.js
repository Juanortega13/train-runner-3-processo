import * as THREE from 'three';
import { CONFIG } from './config.js';
import {
  TRAIN_PALETTES,
  createTrainSideTexture,
  createTrainFrontTexture,
  createStripeTexture,
  createCrateTexture,
} from './Textures.js';

/** Profundidad (eje Z) de cada obstáculo no-tren. */
export const OBSTACLE_DEPTH = { jersey: 0.7, gantry: 0.5, crate: 1.5 };

/** Cómo se esquiva cada tipo: 'jump', 'slide' o 'lane' (cambiar de carril). */
export const OBSTACLE_ACTION = { train: 'lane', jersey: 'jump', crate: 'jump', gantry: 'slide' };

let shared = null;

function getShared() {
  if (shared) return shared;
  shared = {
    stripeRed: new THREE.MeshStandardMaterial({ map: createStripeTexture('#e8e6df', '#d23b2c'), roughness: 0.8 }),
    stripeYellow: new THREE.MeshStandardMaterial({ map: createStripeTexture('#f2c81b', '#1d1d20'), roughness: 0.6, metalness: 0.2 }),
    crate: new THREE.MeshStandardMaterial({ map: createCrateTexture(), roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x55595f, roughness: 0.45, metalness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6b6f75, roughness: 0.6, metalness: 0.6 }),
    under: new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.8 }),
    acUnit: new THREE.MeshStandardMaterial({ color: 0x9a9fa6, roughness: 0.5, metalness: 0.6 }),
    headlight: new THREE.MeshBasicMaterial({ color: 0xfff4c9 }),
    geo: {
      jersey: new THREE.BoxGeometry(2.0, 0.85, 0.7),
      jerseyTop: new THREE.BoxGeometry(1.7, 0.1, 0.5),
      crate: new THREE.BoxGeometry(1.5, 1.05, 1.5),
      post: new THREE.BoxGeometry(0.2, 2.6, 0.2),
      bar: new THREE.BoxGeometry(2.3, 0.7, 0.4),
      sign: new THREE.BoxGeometry(0.9, 0.5, 0.06),
      skirt: new THREE.BoxGeometry(1.7, 0.45, 1),
      ac: new THREE.BoxGeometry(1.0, 0.3, 2.2),
      light: new THREE.SphereGeometry(0.13, 12, 10),
    },
  };
  return shared;
}

/* ------------------------------------------------------------------ */
/* Constructores de modelos. Devuelven un Group con userData.boxes       */
/* (cajas de colisión relativas al centro del objeto).                  */
/* ------------------------------------------------------------------ */
function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildTrain(length, palette) {
  const s = getShared();
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({
    map: createTrainSideTexture(palette, length),
    roughness: 0.42,
    metalness: 0.45,
  });
  const frontTex = createTrainFrontTexture(palette);
  const front = new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.4, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.85, length), [side, side, s.roof, s.under, front, front]);
  body.position.y = 0.35 + 1.425;
  shadowed(body);
  g.add(body);

  const skirt = new THREE.Mesh(s.geo.skirt, s.under);
  skirt.scale.z = length - 0.8;
  skirt.position.y = 0.22;
  g.add(skirt);

  for (const dz of [-0.27, 0.27]) {
    const ac = new THREE.Mesh(s.geo.ac, s.acUnit);
    ac.position.set(0, 3.2 + 0.15, dz * length);
    ac.scale.z = Math.min(1, length / 14);
    shadowed(ac);
    g.add(ac);
  }

  for (const x of [-0.62, 0.62]) {
    const l = new THREE.Mesh(s.geo.light, s.headlight);
    l.position.set(x, 0.95, length / 2 + 0.03);
    l.scale.set(1, 1, 0.5);
    g.add(l);
  }

  g.userData.ownMaterials = [side, front];
  g.userData.ownGeos = [body.geometry];
  g.userData.boxes = [{ hx: 1.0, hz: length / 2, minY: 0.2, maxY: 3.25 }];
  g.userData.halfLen = length / 2;
  return g;
}

function buildJersey() {
  const s = getShared();
  const g = new THREE.Group();
  const base = shadowed(new THREE.Mesh(s.geo.jersey, s.stripeRed));
  base.position.y = 0.425;
  g.add(base);
  const top = shadowed(new THREE.Mesh(s.geo.jerseyTop, s.stripeYellow));
  top.position.y = 0.88;
  g.add(top);
  g.userData.boxes = [{ hx: 1.0, hz: 0.35, minY: 0, maxY: 0.9 }];
  g.userData.halfLen = 0.35;
  return g;
}

function buildCrate() {
  const s = getShared();
  const g = new THREE.Group();
  const c = shadowed(new THREE.Mesh(s.geo.crate, s.crate));
  c.position.y = 0.525;
  g.add(c);
  g.userData.boxes = [{ hx: 0.75, hz: 0.75, minY: 0, maxY: 1.05 }];
  g.userData.halfLen = 0.75;
  return g;
}

function buildGantry() {
  const s = getShared();
  const g = new THREE.Group();
  for (const x of [-1.1, 1.1]) {
    const post = shadowed(new THREE.Mesh(s.geo.post, s.steel));
    post.position.set(x, 1.3, 0);
    g.add(post);
  }
  const bar = shadowed(new THREE.Mesh(s.geo.bar, s.stripeYellow));
  bar.position.y = 1.5;
  g.add(bar);
  // la zona de colisión empieza más arriba que la altura del jugador deslizándose
  g.userData.boxes = [{ hx: 1.15, hz: 0.22, minY: 1.1, maxY: 1.9 }];
  g.userData.halfLen = 0.25;
  return g;
}

/* ------------------------------------------------------------------ */
export class ObstacleManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pool = new Map();
  }

  /**
   * @param {'train'|'jersey'|'crate'|'gantry'} kind
   * @param {number} lane  -1, 0 o 1
   * @param {number} z     posición del centro del obstáculo
   * @param {{length?:number, palette?:number}} opts
   */
  spawn(kind, lane, z, opts = {}) {
    const key = kind === 'train' ? `train-${opts.palette}-${opts.length}` : kind;
    let list = this.pool.get(key);
    if (!list) this.pool.set(key, (list = []));
    let group = list.pop();
    if (!group) {
      if (kind === 'train') group = buildTrain(opts.length, opts.palette);
      else if (kind === 'jersey') group = buildJersey();
      else if (kind === 'crate') group = buildCrate();
      else group = buildGantry();
      group.userData.poolKey = key;
      this.scene.add(group);
    }
    group.visible = true;
    group.position.set(lane * CONFIG.laneWidth, 0, z);
    this.active.push(group);
    return group;
  }

  update(dz) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const g = this.active[i];
      g.position.z += dz;
      if (g.position.z - g.userData.halfLen > CONFIG.despawnZ) this._release(i);
    }
  }

  /** ¿Choca la caja del jugador con algún obstáculo? */
  collides(b) {
    for (const g of this.active) {
      const gz = g.position.z;
      if (Math.abs(gz) > g.userData.halfLen + 1) continue;
      const gx = g.position.x;
      for (const o of g.userData.boxes) {
        if (b.maxX <= gx - o.hx || b.minX >= gx + o.hx) continue;
        if (b.maxZ <= gz - o.hz || b.minZ >= gz + o.hz) continue;
        if (b.maxY <= o.minY || b.minY >= o.maxY) continue;
        return true;
      }
    }
    return false;
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this._release(i);
  }

  _release(index) {
    const g = this.active[index];
    this.active.splice(index, 1);
    g.visible = false;
    this.pool.get(g.userData.poolKey).push(g);
  }
}

export { TRAIN_PALETTES };
