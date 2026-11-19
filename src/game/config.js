// Parámetros globales del juego. Ajusta aquí la dificultad y la sensación de control.
export const CONFIG = {
  laneWidth: 2.4,          // separación entre carriles (m)
  startSpeed: 16,          // m/s
  maxSpeed: 40,            // m/s
  accel: 0.22,             // m/s por segundo
  menuSpeed: 7,            // velocidad del fondo en el menú

  gravity: 32,
  jumpVelocity: 10.5,      // altura máx ≈ 1.7 m
  slideTime: 0.75,         // s
  fastFall: 24,            // velocidad de caída al deslizarse en el aire
  laneSmoothing: 16,       // mayor = cambio de carril más rápido
  inputBuffer: 0.15,       // s en los que se recuerda una acción pedida en el aire

  spawnZ: -160,            // distancia a la que aparecen filas nuevas
  startSafeZone: -40,      // sin obstáculos en los primeros metros
  despawnZ: 14,

  coinScore: 10,
  storageKey: 'trainRunner3D.record.v1',
};

export const LANES = [-1, 0, 1];
