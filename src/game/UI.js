/**
 * Interfaz: maneja el DOM (pantallas, HUD, avisos). No contiene lógica de juego;
 * el juego se suscribe con ui.on('evento', callback).
 */
export class UI {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      loading: $('loading'),
      hud: $('hud'),
      menu: $('screen-menu'),
      pause: $('screen-pause'),
      over: $('screen-gameover'),
      error: $('screen-error'),
      toast: $('toast'),
      score: $('hud-score'),
      distance: $('hud-distance'),
      coins: $('hud-coins'),
      speed: $('hud-speed'),
      speedBar: $('hud-speed-bar'),
      menuRecord: $('menu-record'),
      overScore: $('over-score'),
      overDistance: $('over-distance'),
      overCoins: $('over-coins'),
      overRecord: $('over-record'),
      overNew: $('over-new'),
      errorMsg: $('error-msg'),
    };
    this.handlers = {};
    this.cache = {};
    this._toastTimer = 0;

    const bind = (id, event) => {
      const btn = $(id);
      btn.addEventListener('click', () => {
        btn.blur(); // evita que Espacio/Enter reactiven el botón
        this.handlers[event]?.();
      });
    };
    bind('btn-play', 'play');
    bind('btn-pause', 'pause');
    bind('btn-resume', 'resume');
    bind('btn-restart-pause', 'restart');
    bind('btn-menu-pause', 'menu');
    bind('btn-again', 'restart');
    bind('btn-menu-over', 'menu');
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  /* --------------------- Pantallas --------------------- */
  _screens(...visible) {
    const all = ['menu', 'pause', 'over', 'error'];
    for (const name of all) this.el[name].classList.toggle('hidden', !visible.includes(name));
  }

  hideLoading() {
    this.el.loading.classList.add('hidden');
  }

  showMenu(record) {
    this.el.menuRecord.textContent = record;
    this.el.hud.classList.add('hidden');
    this._screens('menu');
  }

  showPlaying() {
    this.el.hud.classList.remove('hidden');
    this._screens();
    this.cache = {};
  }

  showPause() {
    this._screens('pause');
  }

  showGameOver({ score, distance, coins, record, isNew }) {
    this.el.overScore.textContent = score;
    this.el.overDistance.textContent = distance;
    this.el.overCoins.textContent = coins;
    this.el.overRecord.textContent = record;
    this.el.overNew.classList.toggle('hidden', !isNew);
    this.el.hud.classList.add('hidden');
    this._screens('over');
  }

  showError(message) {
    this.el.errorMsg.textContent = message;
    this.el.loading.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this._screens('error');
  }

  /* --------------------- HUD --------------------------- */
  updateHUD({ score, distance, coins, speedKmh, speedRatio }) {
    this._set('score', this.el.score, score);
    this._set('distance', this.el.distance, distance);
    this._set('coins', this.el.coins, coins);
    this._set('speed', this.el.speed, speedKmh);
    const pct = Math.round(speedRatio * 100);
    if (this.cache.bar !== pct) {
      this.cache.bar = pct;
      this.el.speedBar.style.width = `${pct}%`;
    }
  }

  _set(key, node, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    node.textContent = value;
  }

  toast(text, ms = 1400) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
  }
}
