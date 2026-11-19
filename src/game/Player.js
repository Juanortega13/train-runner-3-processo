import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from './config.js';

const POSE_KEYS = [
  'bodyY', 'pivotRot', 'lean', 'twist',
  'thighL', 'thighR', 'shinL', 'shinR',
  'armL', 'armR', 'foreL', 'foreR',
];

const lerpPose = (out, a, b, t) => {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
};
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/**
 * Personaje humanoide hecho con geometrías (reemplazable por un modelo .glb:
 * ver README). Mantiene la física (carril, salto, deslizamiento) separada del
 * modelo para poder cambiar uno sin tocar el otro.
 */
export class Player {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this._buildModel();

    this.box = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: -0.28, maxZ: 0.28 };
    this.pose = {};
    this.poseRun = {};
    this.poseA = {};
    this.poseB = {};
    this.reset();
  }

  reset() {
    this.lane = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.sliding = false;
    this.slideT = 0;
    this.buffer = null;
    this.dead = false;
    this.phase = 0;
    this.wAir = 0;
    this.wSlide = 0;
    this.wDead = 0;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this._applyPose(0);
  }

  get grounded() {
    return this.y <= 0.001 && this.vy <= 0;
  }

  /* ------------------------- Acciones ------------------------- */
  moveLeft() {
    if (this.dead || this.lane <= -1) return false;
    this.lane -= 1;
    return true;
  }

  moveRight() {
    if (this.dead || this.lane >= 1) return false;
    this.lane += 1;
    return true;
  }

  jump() {
    if (this.dead) return false;
    if (this.grounded) {
      this.vy = CONFIG.jumpVelocity;
      this.y = 0.001;
      this.sliding = false;
      this.slideT = 0;
      this.buffer = null;
      return true;
    }
    this.buffer = { action: 'jump', t: CONFIG.inputBuffer };
    return false;
  }

  slide() {
    if (this.dead) return false;
    if (this.grounded) {
      this.sliding = true;
      this.slideT = CONFIG.slideTime;
      this.buffer = null;
      return true;
    }
    // En el aire: cae rápido y desliza al aterrizar
    this.vy = Math.min(this.vy, -CONFIG.fastFall);
    this.buffer = { action: 'slide', t: 0.4 };
    return false;
  }

  die() {
    this.dead = true;
    this.sliding = false;
    this.buffer = null;
  }

  /** Caja de colisión (AABB) en coordenadas de mundo. */
  getBox() {
    const b = this.box;
    b.minX = this.x - 0.32;
    b.maxX = this.x + 0.32;
    b.minY = this.y;
    b.maxY = this.y + (this.sliding ? 0.78 : 1.75);
    return b;
  }

  /* ------------------------- Actualización -------------------- */
  update(dt, speed) {
    const prevX = this.x;
    const targetX = this.lane * CONFIG.laneWidth;
    this.x += (targetX - this.x) * (1 - Math.exp(-CONFIG.laneSmoothing * dt));
    this.vx = (this.x - prevX) / Math.max(dt, 1e-4);

    // Física vertical
    if (this.y > 0 || this.vy > 0) {
      this.vy -= CONFIG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this._onLand();
      }
    }

    if (this.sliding) {
      this.slideT -= dt;
      if (this.slideT <= 0) this.sliding = false;
    }
    if (this.buffer) {
      this.buffer.t -= dt;
      if (this.buffer.t <= 0) this.buffer = null;
    }

    this.phase += dt * (5.5 + speed * 0.3);
    this._animate(dt);
  }

  _onLand() {
    const b = this.buffer;
    this.buffer = null;
    if (!b) return;
    if (b.action === 'jump') this.jump();
    else if (b.action === 'slide') this.slide();
  }

  /** Animación sin movimiento (cuando el juego está terminado). */
  updateDead(dt) {
    this.vx = 0;
    if (this.y > 0 || this.vy > 0) {
      this.vy -= CONFIG.gravity * dt;
      this.y = Math.max(0, this.y + this.vy * dt);
      if (this.y === 0) this.vy = 0;
    }
    this._animate(dt);
  }

  /* ------------------------- Animación ------------------------ */
  _animate(dt) {
    const p = this.phase;
    const s = Math.sin(p);
    const c = Math.cos(p);

    // Carrera
    const run = this.poseRun;
    run.bodyY = 0.95 - 0.045 * Math.cos(2 * p);
    run.pivotRot = 0;
    run.lean = -0.17;
    run.twist = 0.2 * s;
    run.thighL = 0.95 * s;
    run.thighR = -0.95 * s;
    run.shinL = 0.25 + 0.95 * Math.max(0, c);
    run.shinR = 0.25 + 0.95 * Math.max(0, -c);
    run.armL = -0.95 * s;
    run.armR = 0.95 * s;
    run.foreL = 1.15;
    run.foreR = 1.15;

    // Salto
    const air = this.poseA;
    air.bodyY = 1.0;
    air.pivotRot = 0;
    air.lean = -0.06;
    air.twist = 0;
    air.thighL = 1.25;
    air.thighR = -0.45;
    air.shinL = 1.45;
    air.shinR = 0.95;
    air.armL = 2.35;
    air.armR = 1.85;
    air.foreL = 0.35;
    air.foreR = 0.5;

    // Deslizamiento (de espaldas, pies por delante)
    const sl = this.poseB;
    sl.bodyY = 0.5;
    sl.pivotRot = 1.2;
    sl.lean = 0.1;
    sl.twist = 0;
    sl.thighL = 0.05;
    sl.thighR = 0.15;
    sl.shinL = 0.1;
    sl.shinR = 0.2;
    sl.armL = 0.35;
    sl.armR = 0.2;
    sl.foreL = 0.3;
    sl.foreR = 0.4;

    this.wAir = approach(this.wAir, !this.grounded && !this.dead ? 1 : 0, 22, dt);
    this.wSlide = approach(this.wSlide, this.sliding && this.grounded && !this.dead ? 1 : 0, 26, dt);
    this.wDead = approach(this.wDead, this.dead ? 1 : 0, 14, dt);

    const out = this.pose;
    lerpPose(out, run, air, this.wAir);
    lerpPose(out, out, sl, this.wSlide);
    lerpPose(out, out, this._deadPose(), this.wDead);
    this._applyPose(dt);
  }

  _deadPose() {
    const d = (this._dead ||= {});
    d.bodyY = 0.38;
    d.pivotRot = 1.45;
    d.lean = 0.2;
    d.twist = 0;
    d.thighL = 0.5;
    d.thighR = -0.25;
    d.shinL = 0.5;
    d.shinR = 0.2;
    d.armL = -1.0;
    d.armR = -0.6;
    d.foreL = 0.2;
    d.foreR = 0.2;
    return d;
  }

  _applyPose(dt) {
    const q = this.pose;
    const j = this.joints;
    if (q.bodyY === undefined) {
      // primera vez: pose inicial neutra
      Object.assign(q, { bodyY: 0.95, pivotRot: 0, lean: -0.1, twist: 0, thighL: 0, thighR: 0, shinL: 0.2, shinR: 0.2, armL: 0, armR: 0, foreL: 0.4, foreR: 0.4 });
    }
    j.pivot.position.y = q.bodyY;
    j.pivot.rotation.x = q.pivotRot;
    j.upper.rotation.x = q.lean;
    j.upper.rotation.y = q.twist;
    j.thighL.rotation.x = q.thighL;
    j.thighR.rotation.x = q.thighR;
    j.shinL.rotation.x = -q.shinL;
    j.shinR.rotation.x = -q.shinR;
    j.armL.rotation.x = q.armL;
    j.armR.rotation.x = q.armR;
    j.foreL.rotation.x = q.foreL;
    j.foreR.rotation.x = q.foreR;

    this.root.position.x = this.x;
    this.root.position.y = this.y;
    // inclinación lateral al cambiar de carril
    const tilt = Math.max(-0.28, Math.min(0.28, this.vx * 0.022));
    this.root.rotation.z = -tilt;
    this.root.rotation.y = -tilt * 0.8;
  }

  /* ------------------------- Modelo --------------------------- */
  _buildModel() {
    const mat = (color, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    const m = {
      skin: mat(0xe0ac82, 0.55),
      hoodie: mat(0xe8553d, 0.8),
      pants: mat(0x2f3b52, 0.85),
      shoe: mat(0xf2f2f2, 0.5),
      sole: mat(0x222226, 0.9),
      cap: mat(0x1f7a8c, 0.7),
      bag: mat(0xf2b632, 0.75),
      dark: mat(0x15151a, 0.4),
    };
    const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const group = (parent, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    const pivot = group(this.root, 0, 0.95, 0); // pelvis
    const upper = group(pivot, 0, 0, 0);        // tronco (se inclina)

    // Tronco, cabeza y mochila
    add(upper, new RoundedBoxGeometry(0.5, 0.62, 0.3, 3, 0.09), m.hoodie, 0, 0.33, 0);
    add(upper, new THREE.SphereGeometry(0.17, 20, 16), m.skin, 0, 0.82, 0);
    add(upper, new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), m.skin, 0, 0.67, 0);
    add(upper, new THREE.SphereGeometry(0.19, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.cap, 0, 0.85, 0);
    add(upper, new THREE.BoxGeometry(0.26, 0.03, 0.2), m.cap, 0, 0.86, -0.2);
    add(upper, new THREE.SphereGeometry(0.022, 8, 8), m.dark, -0.065, 0.81, -0.158);
    add(upper, new THREE.SphereGeometry(0.022, 8, 8), m.dark, 0.065, 0.81, -0.158);
    add(upper, new RoundedBoxGeometry(0.36, 0.42, 0.17, 2, 0.05), m.bag, 0, 0.34, 0.23);
    add(upper, new THREE.BoxGeometry(0.06, 0.4, 0.34), m.dark, -0.15, 0.36, 0.06);
    add(upper, new THREE.BoxGeometry(0.06, 0.4, 0.34), m.dark, 0.15, 0.36, 0.06);

    // Brazos
    const makeArm = (side) => {
      const shoulder = group(upper, side * 0.34, 0.55, 0);
      add(shoulder, new THREE.CapsuleGeometry(0.075, 0.2, 4, 10), m.hoodie, 0, -0.17, 0);
      const elbow = group(shoulder, 0, -0.33, 0);
      add(elbow, new THREE.CapsuleGeometry(0.065, 0.17, 4, 10), m.hoodie, 0, -0.14, 0);
      add(elbow, new THREE.SphereGeometry(0.07, 12, 10), m.skin, 0, -0.3, 0);
      return { shoulder, elbow };
    };
    const aL = makeArm(-1);
    const aR = makeArm(1);

    // Piernas
    const makeLeg = (side) => {
      const hip = group(pivot, side * 0.14, 0, 0);
      add(hip, new THREE.CapsuleGeometry(0.095, 0.3, 4, 10), m.pants, 0, -0.23, 0);
      const knee = group(hip, 0, -0.46, 0);
      add(knee, new THREE.CapsuleGeometry(0.08, 0.28, 4, 10), m.pants, 0, -0.22, 0);
      add(knee, new RoundedBoxGeometry(0.2, 0.11, 0.34, 2, 0.04), m.shoe, 0, -0.44, -0.04);
      add(knee, new THREE.BoxGeometry(0.205, 0.035, 0.345), m.sole, 0, -0.495, -0.04);
      return { hip, knee };
    };
    const lL = makeLeg(-1);
    const lR = makeLeg(1);

    this.joints = {
      pivot, upper,
      thighL: lL.hip, thighR: lR.hip,
      shinL: lL.knee, shinR: lR.knee,
      armL: aL.shoulder, armR: aR.shoulder,
      foreL: aL.elbow, foreR: aR.elbow,
    };
  }
}
