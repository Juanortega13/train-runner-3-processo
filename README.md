# Train Runner 3D

Juego de carreras infinitas en tercera persona (estilo Subway Surfers) hecho con **Three.js + Vite**. Todo el contenido gráfico (personaje, trenes, edificios, texturas, sonidos) se genera por código, así que no necesita descargar ningún recurso para jugar.

## Ejecutar desde Visual Studio Code

Requisito: [Node.js 18 o superior](https://nodejs.org/).

1. Abre la carpeta del proyecto en VS Code (`Archivo → Abrir carpeta`).
2. Abre la terminal integrada (`Ctrl + ñ` o `Terminal → Nueva terminal`).
3. Ejecuta:

```bash
npm install
npm run dev
```

4. Abre la dirección que muestra la terminal (normalmente <http://localhost:5173>).

Para generar la versión de producción: `npm run build` (queda en `dist/`) y `npm run preview` para probarla.

## Controles

| Tecla | Acción |
| --- | --- |
| ← / → (o A / D) | Cambiar de carril |
| ↑ / Espacio (o W) | Saltar |
| ↓ (o S) | Deslizarse (en el aire, cae rápido y se desliza al aterrizar) |
| Esc (o P) | Pausar / reanudar |
| Enter | Jugar (desde el menú o el Game Over) |
| M | Activar / desactivar sonido |

Mantener una tecla presionada **no** repite la acción: cada pulsación cuenta una sola vez.

## Cómo se esquiva cada obstáculo

- **Tren** (alto): cambia de carril.
- **Barrera de hormigón y caja** (bajos): salta.
- **Pórtico amarillo y negro** (alto, con hueco debajo): deslízate.
- Hay un carril libre o una acción posible en cada fila de obstáculos, y la distancia entre filas crece con la velocidad.

Puntuación = metros recorridos + 10 por moneda. La velocidad sube de 58 a 144 km/h. El récord se guarda en `localStorage`.

## Estructura

```
train-runner-3d/
├─ index.html              Estructura de pantallas (menú, HUD, pausa, Game Over, error)
├─ package.json
├─ public/assets/          Aquí van modelos/texturas externos (opcional)
└─ src/
   ├─ main.js              Arranque, captura de errores, API window.trainRunner
   ├─ style.css            Interfaz
   └─ game/
      ├─ config.js         Velocidad, gravedad, salto, dificultad…
      ├─ Game.js           Renderer, escena, estados, bucle, cámara y API de comandos
      ├─ World.js          Vía infinita: balasto, rieles, traviesas, edificios, postes, pórticos, pasos elevados
      ├─ Player.js         Personaje humanoide, carriles, salto, deslizamiento y animación
      ├─ Obstacle.js       Trenes, barreras, cajas, pórticos y colisiones (AABB)
      ├─ Coin.js           Monedas 3D instanciadas (1 sola llamada de dibujo)
      ├─ Spawner.js        Generador de patrones infinitos de obstáculos y monedas
      ├─ Controls.js       Teclado + bus de comandos (punto de entrada para el ESP32)
      ├─ UI.js             Pantallas y HUD (sin lógica de juego)
      ├─ Audio.js          Efectos de sonido sintetizados
      └─ Textures.js       Texturas procedurales (canvas)
```

## Preparado para el ESP32 (aún sin implementar)

La lógica del juego **no** lee el teclado directamente. El teclado solo traduce teclas a comandos, y los comandos son métodos de `Game`:

`moverIzquierda()` · `moverDerecha()` · `saltar()` · `deslizarse()` · `iniciarJuego()` · `pausarJuego()` · `reiniciarJuego()` · `alternarSonido()`

Cualquier fuente externa puede ejecutarlos con `trainRunner.dispatch('saltar')`. Puedes probarlo ya mismo en la consola del navegador (F12).

Cuando conectes el ESP32 (por ejemplo, con un WebSocket que reciba mensajes de texto con el nombre del comando), añade una fuente en `src/main.js` sin tocar las mecánicas:

```js
// Ejemplo (NO activo): ESP32 → WebSocket → comandos del juego
window.trainRunner.registerSource({
  start(dispatch) {
    this.ws = new WebSocket('ws://192.168.1.50:81');
    this.ws.onmessage = (e) => dispatch(e.data.trim()); // "saltar", "moverIzquierda"…
  },
  stop() { this.ws?.close(); },
});
```

Para el Serial/BLE se haría igual: solo hay que llamar a `dispatch(...)`.

## Mejorar gráficos con recursos externos

El personaje, los trenes y los edificios son geometrías provisionales y se pueden reemplazar:

- **Modelos 3D (glTF/GLB)**: [Quaternius](https://quaternius.com/) y [Kenney](https://kenney.nl/assets) (licencia CC0), [Poly Pizza](https://poly.pizza/) (CC0 / CC-BY según el modelo, revisa la licencia de cada uno). Guarda los `.glb` en `public/assets/models/` y cárgalos con `GLTFLoader` (`three/examples/jsm/loaders/GLTFLoader.js`) usando la ruta `/assets/models/mi-modelo.glb`. Para el jugador, sustituye `_buildModel()` en `Player.js`; para los trenes, `buildTrain()` en `Obstacle.js` (conserva `userData.boxes`, que define la colisión).
- **Texturas PBR**: [ambientCG](https://ambientcg.com/) y [Poly Haven](https://polyhaven.com/textures) (CC0). Guárdalas en `public/assets/textures/` y cárgalas con `THREE.TextureLoader` en lugar de las funciones de `Textures.js`.
- **Sonido**: [Kenney Audio](https://kenney.nl/assets/category:Audio) (CC0). Sustituye las funciones de `Audio.js` por `THREE.Audio` o `new Audio('/assets/sounds/…')`.

## Si algo falla

- *Pantalla "Ocurrió un problema"*: normalmente es WebGL desactivado. Activa la aceleración por hardware del navegador.
- *Va lento*: baja `setPixelRatio` o `shadowMap.mapSize` en `Game.js`.
- *Cambios de dificultad*: edita `src/game/config.js` (`startSpeed`, `maxSpeed`, `accel`, `jumpVelocity`…).
