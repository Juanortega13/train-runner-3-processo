import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CONFIG } from './config.js';
import { World } from './World.js';
import { Player } from './Player.js';
import { ObstacleManager } from './Obstacle.js';
import { CoinSystem } from './Coin.js';
import { Spawner } from './Spawner.js';
import { Controls } from './Controls.js';
import { GameAudio } from './Audio.js';
import { createSkyTexture, createSunTexture } from './Textures.js';

const FOG_COLOR = 0xc98f72;

function loadRecord() {
  try {
    return parseInt(localStorage.getItem(CONFIG.storageKey) || '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveRecord(v) {
  try {
    localStorage.setItem(CONFIG.storageKey, String(v));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

/**
 * Orquesta todo: renderer, escena, estados (menu / playing / paused / gameover)
 * y el bucle principal. Los métodos en español son la API de comandos que usan
 * el teclado y, en el futuro, el ESP32.
 */
export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.state = 'loading';
    this.speed = CONFIG.startSpeed;
    this.distance = 0;
    this.coinCount = 0;
    this.score = 0;
    this.record = 0;
    this.crashTime = 0;
    this.shake = 0;
    this.failed = false;
    this.loop = this.loop.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  /* ================================================================ */
  /* Inicialización                                                    */
  /* ================================================================ */
  init() {
    this._initRenderer();
    this._initScene();

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.obstacles = new ObstacleManager(this.scene);
    this.coins = new CoinSystem(this.scene);
    this.spawner = new Spawner(this.obstacles, this.coins);
    this.audio = new GameAudio();
    this.controls = new Controls(this);
    this.controls.attach();

    this.record = loadRecord();
    this._bindUI();

    window.addEventListener('resize', this.onResize);
    this.onResize();
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.ui.showError('Se perdió el contexto gráfico (WebGL). Recarga la página.');
      this.detenerPorError();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pausarJuego();
    });

    this.camX = 0;
    this.camY = 4.6;
    this.fov = this.baseFov;
    this.updateCamera(1);

    // Compila shaders antes de mostrar el menú para evitar tirones.
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);

    this.state = 'menu';
    this.ui.hideLoading();
    this.ui.showMenu(this.record);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
  }

  _initScene() {
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.fog = new THREE.Fog(FOG_COLOR, 35, 150);

    // Reflejos para los metales (rieles, trenes, monedas)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    // Cielo y sol
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(550, 32, 16),
      new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
    );
    sky.renderOrder = -2;
    scene.add(sky);
    this.sky = sky;

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: createSunTexture(),
        fog: false,
        depthWrite: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
      })
    );
    sun.scale.set(260, 260, 1);
    sun.position.set(-90, 38, -440);
    sun.renderOrder = -1;
    scene.add(sun);

    // Luces
    scene.add(new THREE.HemisphereLight(0xffd9b8, 0x3a3140, 1.0));
    const dir = new THREE.DirectionalLight(0xffcf9c, 2.6);
    dir.position.set(-16, 26, 14);
    dir.target.position.set(0, 0, -14);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera;
    sc.left = -17;
    sc.right = 17;
    sc.top = 34;
    sc.bottom = -34;
    sc.near = 1;
    sc.far = 90;
    dir.shadow.bias = -0.0004;
    dir.shadow.normalBias = 0.04;
    scene.add(dir, dir.target);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.3, 700);
    this.baseFov = 62;
  }

  _bindUI() {
    const ui = this.ui;
    ui.on('play', () => this.iniciarJuego());
    ui.on('pause', () => this.pausarJuego());
    ui.on('resume', () => this.pausarJuego());
    ui.on('restart', () => this.reiniciarJuego());
    ui.on('menu', () => this.irAlMenu());
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.baseFov = this.camera.aspect < 1.25 ? 78 : 62;
    this.camera.updateProjectionMatrix();
  }

  /* ================================================================ */
  /* API de comandos (teclado hoy, ESP32 mañana)                        */
  /* ================================================================ */
  moverIzquierda() {
    if (this.state === 'playing' && this.player.moveLeft()) this.audio.lane();
  }

  moverDerecha() {
    if (this.state === 'playing' && this.player.moveRight()) this.audio.lane();
  }

  saltar() {
    if (this.state === 'playing' && this.player.jump()) this.audio.jump();
  }

  deslizarse() {
    if (this.state === 'playing' && this.player.slide() ) this.audio.slide();
  }

  /** Inicia desde el menú o tras un Game Over; si está en pausa, reanuda. */
  iniciarJuego() {
    if (this.failed) return;
    this.audio.unlock();
    if (this.state === 'menu' || this.state === 'gameover') this._startRun();
    else if (this.state === 'paused') this.pausarJuego();
  }

  /** Reinicia la partida desde cualquier estado (menos error). */
  reiniciarJuego() {
    if (this.failed) return;
    this.audio.unlock();
    this._startRun();
  }

  /** Alterna pausa / reanudar. */
  pausarJuego() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.ui.showPlaying();
    }
  }

  irAlMenu() {
    if (this.failed) return;
    this._resetRun();
    this.state = 'menu';
    this.ui.showMenu(this.record);
  }

  alternarSonido() {
    this.audio.unlock();
    const on = this.audio.toggle();
    this.ui.toast(on ? 'Sonido activado' : 'Sonido desactivado');
  }

  detenerPorError() {
    this.failed = true;
    this.state = 'error';
  }

  /* ================================================================ */
  /* Estados                                                           */
  /* ================================================================ */
  _resetRun() {
    this.speed = CONFIG.startSpeed;
    this.distance = 0;
    this.coinCount = 0;
    this.score = 0;
    this.shake = 0;
    this.crashTime = 0;
    this.newRecord = false;
    this.obstacles.clear();
    this.coins.clear();
    this.spawner.reset();
    this.player.reset();
  }

  _startRun() {
    this._resetRun();
    this.state = 'playing';
    this.ui.showPlaying();
    this._pushHUD();
  }

  _crash() {
    this.state = 'gameover';
    this.crashTime = 0;
    this.shake = 1;
    this.player.die();
    this.audio.crash();

    this.newRecord = this.score > this.record;
    if (this.newRecord) {
      this.record = this.score;
      saveRecord(this.record);
    }
    this._gameOverShown = false;
  }

  /* ================================================================ */
  /* Bucle                                                             */
  /* ================================================================ */
  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.failed) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    switch (this.state) {
      case 'playing':
        this._stepPlaying(dt);
        break;
      case 'gameover':
        this._stepGameOver(dt);
        break;
      case 'menu':
        this._stepMenu(dt);
        break;
      default:
        break; // paused
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _stepMenu(dt) {
    const dz = CONFIG.menuSpeed * dt;
    this.world.update(dz);
    this.player.update(dt, CONFIG.menuSpeed);
    this.coins.update(dt, 0);
  }

  _stepPlaying(dt) {
    // Sub-pasos: a alta velocidad un objeto fino no debe "atravesar" al jugador.
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (!this._simulate(h)) break;
    }
    this._pushHUD();
  }

  _simulate(h) {
    this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.accel * h);
    const dz = this.speed * h;
    this.distance += dz;

    this.world.update(dz);
    this.obstacles.update(dz);
    this.coins.update(h, dz);
    this.spawner.update(dz, this.speed, this.distance);
    this.player.update(h, this.speed);

    const box = this.player.getBox();
    const got = this.coins.collect(box);
    if (got) {
      this.coinCount += got;
      this.audio.coin();
    }
    this.score = Math.floor(this.distance) + this.coinCount * CONFIG.coinScore;

    if (this.obstacles.collides(box)) {
      this._crash();
      return false;
    }
    return true;
  }

  _stepGameOver(dt) {
    this.crashTime += dt;
    // El mundo se frena suavemente tras el choque
    this.speed *= Math.exp(-dt * 6);
    const dz = this.speed * dt;
    if (dz > 0.001) {
      this.world.update(dz);
      this.obstacles.update(dz);
      this.coins.update(dt, dz);
    }
    this.player.updateDead(dt);

    if (!this._gameOverShown && this.crashTime > 0.95) {
      this._gameOverShown = true;
      this.ui.showGameOver({
        score: this.score,
        distance: Math.floor(this.distance),
        coins: this.coinCount,
        record: this.record,
        isNew: this.newRecord,
      });
    }
  }

  _pushHUD() {
    this.ui.updateHUD({
      score: this.score,
      distance: Math.floor(this.distance),
      coins: this.coinCount,
      speedKmh: Math.round(this.speed * 3.6),
      speedRatio: (this.speed - CONFIG.startSpeed) / (CONFIG.maxSpeed - CONFIG.startSpeed),
    });
  }

  /* ================================================================ */
  /* Cámara en tercera persona                                         */
  /* ================================================================ */
  updateCamera(dt) {
    const p = this.player;
    const k = 1 - Math.exp(-dt * 7);
    this.camX += (p.x * 0.62 - this.camX) * k;
    this.camY += (4.2 + p.y * 0.3 - this.camY) * k;

    const speedFov = this.state === 'playing' ? (this.speed - CONFIG.startSpeed) * 0.28 : 0;
    this.fov += (this.baseFov + speedFov - this.fov) * Math.min(1, k * 0.6);
    if (Math.abs(this.camera.fov - this.fov) > 0.02) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      ox = (Math.random() - 0.5) * this.shake * 0.7;
      oy = (Math.random() - 0.5) * this.shake * 0.5;
    }
    this.camera.position.set(this.camX + ox, this.camY + oy, 7.6);
    this.camera.lookAt(p.x * 0.3 + ox, 1.5 + p.y * 0.25, -9);
    this.sky.position.copy(this.camera.position);
  }
}
