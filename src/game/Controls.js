/**
 * Capa de control independiente de la lógica del juego.
 *
 * Cualquier fuente de entrada (teclado hoy; ESP32 por WebSocket mañana) solo
 * tiene que llamar a  controls.dispatch('<comando>').  Los comandos son los
 * métodos públicos de Game, con nombres en español:
 *
 *   moverIzquierda · moverDerecha · saltar · deslizarse
 *   iniciarJuego · pausarJuego · reiniciarJuego · alternarSonido
 *
 * Para añadir una fuente nueva (ver README, sección ESP32):
 *
 *   window.trainRunner.registerSource({
 *     start(dispatch) { ... dispatch('saltar') ... },
 *     stop() { ... },
 *   });
 */
export const COMMANDS = [
  'moverIzquierda',
  'moverDerecha',
  'saltar',
  'deslizarse',
  'iniciarJuego',
  'pausarJuego',
  'reiniciarJuego',
  'alternarSonido',
];

const KEY_MAP = {
  ArrowLeft: 'moverIzquierda',
  KeyA: 'moverIzquierda',
  ArrowRight: 'moverDerecha',
  KeyD: 'moverDerecha',
  ArrowUp: 'saltar',
  KeyW: 'saltar',
  Space: 'saltar',
  ArrowDown: 'deslizarse',
  KeyS: 'deslizarse',
  Escape: 'pausarJuego',
  KeyP: 'pausarJuego',
  Enter: 'iniciarJuego',
  KeyM: 'alternarSonido',
};

export class Controls {
  constructor(game) {
    this.game = game;
    this.down = new Set(); // teclas físicamente presionadas
    this.sources = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = () => this.down.clear();
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.sources.forEach((s) => s.stop?.());
    this.sources.clear();
  }

  /** Ejecuta un comando del juego (único punto de entrada para cualquier fuente). */
  dispatch(command) {
    if (!COMMANDS.includes(command)) {
      console.warn(`[Controls] Comando desconocido: ${command}`);
      return false;
    }
    const fn = this.game[command];
    if (typeof fn !== 'function') return false;
    fn.call(this.game);
    return true;
  }

  /** Registra una fuente externa (p. ej. ESP32 vía WebSocket). */
  registerSource(source) {
    if (!source || typeof source.start !== 'function') throw new Error('La fuente debe tener un método start(dispatch).');
    this.sources.add(source);
    source.start((cmd) => this.dispatch(cmd));
    return () => {
      source.stop?.();
      this.sources.delete(source);
    };
  }

  /** Objeto expuesto en window.trainRunner. */
  publicApi() {
    const game = this.game;
    return {
      comandos: [...COMMANDS],
      dispatch: (cmd) => this.dispatch(cmd),
      registerSource: (src) => this.registerSource(src),
      get estado() {
        return game.state; // 'menu' | 'playing' | 'paused' | 'gameover'
      },
    };
  }

  _onKeyDown(e) {
    const command = KEY_MAP[e.code];
    if (!command) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    // Ignora la repetición automática del teclado y las teclas que ya estaban
    // presionadas: mantener una tecla no provoca acciones repetidas.
    if (e.repeat || this.down.has(e.code)) return;
    this.down.add(e.code);
    this.dispatch(command);
  }

  _onKeyUp(e) {
    this.down.delete(e.code);
  }
}
