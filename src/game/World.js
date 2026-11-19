import * as THREE from 'three';
import { CONFIG, LANES } from './config.js';
import {
  createBallastTexture,
  createAsphaltTexture,
  createConcreteTexture,
  createBuildingTextures,
  BUILDING_TILE,
} from './Textures.js';

const SEG = 48;          // longitud de cada segmento (m)
const COUNT = 5;         // segmentos en reciclaje
const SLEEPER_COUNT = 56;
const TRACK_HALF = (LANES.length * CONFIG.laneWidth) / 2 + 1.2;

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/**
 * Escenario infinito: segmentos de vía que se reciclan y se vuelven a decorar
 * (edificios, postes, pórticos con semáforos, pasos elevados tipo túnel).
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this._createShared();
    for (let i = 0; i < COUNT; i++) {
      const seg = this._createSegment();
      seg.group.position.z = -10 - i * SEG;
      this._populate(seg);
      scene.add(seg.group);
      this.segments.push(seg);
    }
  }

  /** Avanza el escenario dz metros hacia el jugador. */
  update(dz) {
    for (const seg of this.segments) {
      seg.group.position.z += dz;
      if (seg.group.position.z - SEG / 2 > CONFIG.despawnZ) {
        seg.group.position.z -= SEG * COUNT;
        this._populate(seg);
      }
    }
  }

  /* -------------------------------------------------------------- */
  _createShared() {
    const lw = CONFIG.laneWidth;
    this.mats = {
      ballast: new THREE.MeshStandardMaterial({
        map: createBallastTexture([(TRACK_HALF * 2) / 2.6, SEG / 2.6]),
        roughness: 1,
        metalness: 0,
      }),
      ground: new THREE.MeshStandardMaterial({
        map: createAsphaltTexture([120 / 6, SEG / 6]),
        roughness: 0.95,
      }),
      concrete: new THREE.MeshStandardMaterial({
        map: createConcreteTexture([SEG / 5, 0.5]),
        roughness: 0.9,
      }),
      concreteSolid: new THREE.MeshStandardMaterial({
        map: createConcreteTexture([3, 2]),
        roughness: 0.9,
      }),
      sleeper: new THREE.MeshStandardMaterial({ color: 0x4a3b2f, roughness: 0.95 }),
      rail: new THREE.MeshStandardMaterial({ color: 0xaab0b6, roughness: 0.28, metalness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.5, metalness: 0.8 }),
      lamp: new THREE.MeshBasicMaterial({ color: 0xffe3ab }),
      signalBox: new THREE.MeshStandardMaterial({ color: 0x1f2124, roughness: 0.6 }),
      red: new THREE.MeshBasicMaterial({ color: 0xff3b2f }),
      green: new THREE.MeshBasicMaterial({ color: 0x3dff7a }),
      underLight: new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
    };

    this.buildingMats = createBuildingTextures().map(
      (t) =>
        new THREE.MeshStandardMaterial({
          map: t.map,
          emissiveMap: t.emissiveMap,
          emissive: 0xffffff,
          emissiveIntensity: 1.1,
          roughness: 0.85,
        })
    );

    this.geo = {
      ballast: new THREE.PlaneGeometry(TRACK_HALF * 2, SEG).rotateX(-Math.PI / 2),
      ground: new THREE.PlaneGeometry(120, SEG).rotateX(-Math.PI / 2),
      wall: new THREE.BoxGeometry(0.6, 1.4, SEG),
      sleeper: new THREE.BoxGeometry(lw * 0.84, 0.12, 0.26),
      rail: new THREE.BoxGeometry(0.11, 0.17, SEG),
      pole: new THREE.CylinderGeometry(0.07, 0.1, 6.6, 8),
      arm: new THREE.BoxGeometry(1.7, 0.08, 0.08),
      lampHead: new THREE.BoxGeometry(0.55, 0.1, 0.26),
      gantryPost: new THREE.BoxGeometry(0.3, 6.6, 0.3),
      gantryBeam: new THREE.BoxGeometry(TRACK_HALF * 2 + 0.6, 0.34, 0.34),
      signalBox: new THREE.BoxGeometry(0.46, 1.0, 0.3),
      signalLight: new THREE.CircleGeometry(0.12, 12),
      slab: new THREE.BoxGeometry(26, 1.0, 7),
      pillar: new THREE.BoxGeometry(1.3, 7.2, 2),
      underStrip: new THREE.BoxGeometry(0.22, 0.06, 5),
    };
  }

  _createSegment() {
    const g = new THREE.Group();
    const lw = CONFIG.laneWidth;

    const ground = new THREE.Mesh(this.geo.ground, this.mats.ground);
    ground.position.y = -0.06;
    ground.receiveShadow = true;
    g.add(ground);

    const ballast = new THREE.Mesh(this.geo.ballast, this.mats.ballast);
    ballast.position.y = 0;
    ballast.receiveShadow = true;
    g.add(ballast);

    // Traviesas (una sola malla instanciada)
    const sleepers = new THREE.InstancedMesh(this.geo.sleeper, this.mats.sleeper, SLEEPER_COUNT * LANES.length);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const lane of LANES) {
      for (let i = 0; i < SLEEPER_COUNT; i++) {
        const z = -SEG / 2 + (i + 0.5) * (SEG / SLEEPER_COUNT);
        m.makeTranslation(lane * lw, 0.06, z);
        sleepers.setMatrixAt(n++, m);
      }
    }
    sleepers.receiveShadow = true;
    g.add(sleepers);

    // Rieles
    for (const lane of LANES) {
      for (const s of [-1, 1]) {
        const rail = new THREE.Mesh(this.geo.rail, this.mats.rail);
        rail.position.set(lane * lw + s * 0.62, 0.2, 0);
        rail.receiveShadow = true;
        g.add(rail);
      }
    }

    // Muros de contención
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(this.geo.wall, this.mats.concrete);
      wall.position.set(s * (TRACK_HALF + 0.3), 0.7, 0);
      wall.receiveShadow = true;
      g.add(wall);
    }

    // Postes de alumbrado (instanciados)
    const poleZ = [-SEG / 2 + 8, -SEG / 2 + 24, -SEG / 2 + 40];
    const poles = new THREE.InstancedMesh(this.geo.pole, this.mats.metal, poleZ.length * 2);
    const arms = new THREE.InstancedMesh(this.geo.arm, this.mats.metal, poleZ.length * 2);
    const heads = new THREE.InstancedMesh(this.geo.lampHead, this.mats.lamp, poleZ.length * 2);
    let k = 0;
    for (const s of [-1, 1]) {
      for (const z of poleZ) {
        const x = s * (TRACK_HALF - 0.4);
        m.makeTranslation(x, 3.3, z);
        poles.setMatrixAt(k, m);
        m.makeTranslation(x - s * 0.8, 6.55, z);
        arms.setMatrixAt(k, m);
        m.makeTranslation(x - s * 1.45, 6.48, z);
        heads.setMatrixAt(k, m);
        k++;
      }
    }
    poles.castShadow = true;
    g.add(poles, arms, heads);

    const decor = new THREE.Group();
    g.add(decor);
    return { group: g, decor };
  }

  /** Regenera la decoración aleatoria de un segmento. */
  _populate(seg) {
    const d = seg.decor;
    d.traverse((o) => {
      if (o.userData.ownGeo && o.geometry) o.geometry.dispose();
    });
    d.clear();

    // Edificios: primera fila (cerca) y segunda fila (siluetas altas al fondo)
    for (const s of [-1, 1]) {
      this._buildingRow(d, s, 9.5, 8, 14, 12, 34, 5);
      this._buildingRow(d, s, 30, 14, 22, 36, 80, 6);
    }

    // Pórtico con semáforos
    if (Math.random() < 0.55) this._gantry(d, rnd(-SEG / 2 + 4, SEG / 2 - 4));

    // Paso elevado (efecto túnel)
    if (Math.random() < 0.26) this._overpass(d, rnd(-SEG / 2 + 6, SEG / 2 - 6));
  }

  _buildingRow(parent, side, xStart, dMin, dMax, hMin, hMax, minWidth) {
    let cursor = -SEG / 2;
    while (cursor < SEG / 2 - minWidth) {
      const w = Math.min(rnd(9, 18), SEG / 2 - cursor);
      if (w < minWidth) break;
      const depth = rnd(dMin, dMax);
      const h = rnd(hMin, hMax);
      const geo = new THREE.BoxGeometry(depth, h, w);
      // Escala UV para que las ventanas mantengan su tamaño real
      const uv = geo.attributes.uv;
      const ou = Math.random();
      for (let f = 0; f < 6; f++) {
        const horiz = f < 2 ? w : depth;
        for (let i = 0; i < 4; i++) {
          const idx = f * 4 + i;
          uv.setXY(idx, uv.getX(idx) * (horiz / BUILDING_TILE) + ou, uv.getY(idx) * (h / BUILDING_TILE));
        }
      }
      const mesh = new THREE.Mesh(geo, pick(this.buildingMats));
      mesh.userData.ownGeo = true;
      mesh.position.set(side * (xStart + depth / 2 + rnd(0, 1.5)), h / 2 - 0.1, cursor + w / 2);
      parent.add(mesh);
      cursor += w + rnd(0.5, 3.5);
    }
  }

  _gantry(parent, z) {
    const half = TRACK_HALF + 0.4;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(this.geo.gantryPost, this.mats.metal);
      post.position.set(s * half, 3.3, z);
      post.castShadow = true;
      parent.add(post);
    }
    const beam = new THREE.Mesh(this.geo.gantryBeam, this.mats.metal);
    beam.position.set(0, 6.4, z);
    beam.castShadow = true;
    parent.add(beam);

    for (const lane of LANES) {
      const box = new THREE.Mesh(this.geo.signalBox, this.mats.signalBox);
      box.position.set(lane * CONFIG.laneWidth, 5.55, z);
      parent.add(box);
      const green = Math.random() < 0.6;
      for (const [dy, mat, on] of [[0.26, this.mats.red, !green], [-0.2, this.mats.green, green]]) {
        const light = new THREE.Mesh(this.geo.signalLight, on ? mat : this.mats.signalBox);
        light.position.set(lane * CONFIG.laneWidth, 5.55 + dy, z + 0.16);
        parent.add(light);
      }
    }
  }

  _overpass(parent, z) {
    const slab = new THREE.Mesh(this.geo.slab, this.mats.concreteSolid);
    slab.position.set(0, 7.3, z);
    slab.castShadow = true;
    slab.receiveShadow = true;
    parent.add(slab);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(this.geo.pillar, this.mats.concreteSolid);
      pillar.position.set(s * (TRACK_HALF + 1.6), 3.6, z);
      pillar.castShadow = true;
      parent.add(pillar);
    }
    for (const x of [-4, 0, 4]) {
      const strip = new THREE.Mesh(this.geo.underStrip, this.mats.underLight);
      strip.position.set(x, 6.77, z);
      parent.add(strip);
    }
  }
}
