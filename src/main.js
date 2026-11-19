import './style.css';
import { Game } from './game/Game.js';
import { UI } from './game/UI.js';

const ui = new UI();
let game = null;

function fatal(message) {
  console.error(message);
  ui.showError(message);
  if (game) game.detenerPorError();
}

window.addEventListener('error', (e) => fatal(e.message || 'Error inesperado.'));
window.addEventListener('unhandledrejection', (e) => fatal(String(e.reason?.message || e.reason || 'Error inesperado.')));

function boot() {
  try {
    const canvas = document.getElementById('game-canvas');
    game = new Game(canvas, ui);
    game.init();

    // API pública: permite controlar el juego desde fuera (ESP32, consola, otras páginas).
    // Ejemplo en la consola del navegador:  trainRunner.dispatch('saltar')
    window.trainRunner = game.controls.publicApi();
    if (import.meta.env.DEV) window.__game = game;
  } catch (err) {
    fatal(err?.message || 'No se pudo iniciar el juego (¿WebGL desactivado?).');
  }
}

boot();
