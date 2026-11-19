import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from './config.js';

const MAX_COINS = 260;
const COLLECT_TIME = 0.28;

/**
 * Sistema de monedas: una sola malla instanciada (1 draw call) con giro,
 * reflejo metálico y animación al recogerse.
 */
export class CoinSystem {
  constructor(scene) {
    const disc = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 32).rotateX(Math.PI / 2);
    const ringA = new THREE.TorusGeometry(0.3, 0.032, 8, 32).translate(0, 0, 0.045);
    const ringB = new THREE.TorusGeometry(0.3, 0.032, 8, 32).translate(0, 0, -0.045);
    const star = new THREE.CylinderGeometry(0.14, 0.14, 0.1, 5).rotateX(Math.PI / 2);
    const geo = mergeGeometries([disc, ringA, ringB, star]);
    [disc, ringA, ringB, star].forEach((g) => g.dispose());

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc933,
      metalness: 1,
      roughness: 0.22,
      emissive: 0x6b3d00,
      emissiveIntensity: 0.55,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_COINS);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.count = 0;
    scene.add(this.mesh);

    this.coins = [];
    this.spin = 0;
    this.dummy = new THREE.Object3D();
  }

  add(x, y, z) {
    if (this.coins.length >= MAX_COINS) return;
    this.coins.push({ x, y, z, collected: false, t: 0 });
  }

  update(dt, dz) {
    this.spin += dt * 4.5;
    const list = this.coins;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      c.z += dz;
      if (c.collected) c.t += dt;
      if (c.z > CONFIG.despawnZ || c.t > COLLECT_TIME) list.splice(i, 1);
    }
    this._write();
  }

  /** Recoge las monedas que tocan la caja del jugador. Devuelve cuántas. */
  collect(b) {
    let n = 0;
    for (const c of this.coins) {
      if (c.collected) continue;
      if (c.x < b.minX - 0.45 || c.x > b.maxX + 0.45) continue;
      if (c.z < b.minZ - 0.45 || c.z > b.maxZ + 0.45) continue;
      if (c.y < b.minY - 0.4 || c.y > b.maxY + 0.4) continue;
      c.collected = true;
      c.t = 0;
      n++;
    }
    return n;
  }

  clear() {
    this.coins.length = 0;
    this._write();
  }

  _write() {
    const d = this.dummy;
    let i = 0;
    for (const c of this.coins) {
      let s = 1;
      let y = c.y;
      if (c.collected) {
        const k = c.t / COLLECT_TIME;
        s = 1 + 0.5 * k * (1 - k) * 2 - k; // crece un poco y se desvanece
        s = Math.max(0.001, s);
        y += k * 1.4;
      }
      d.position.set(c.x, y, c.z);
      d.rotation.set(0, this.spin + c.z * 0.18, 0);
      d.scale.setScalar(s);
      d.updateMatrix();
      this.mesh.setMatrixAt(i++, d.matrix);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
