# Fuente 3D del Núcleo Z

Esta carpeta contiene la escena original con la que se renderizaron los 540 fotogramas.
No se carga en la página pública: sólo sirve para volver a renderizar (cambiar colores,
cámara, duración, resolución, etc.).

- `scene.js` — escena Three.js: cápsula hexagonal de 6 módulos (segmento + pétalo frontal + pétalo
  trasero), emblema Z de tres piezas, estudio de luz procedural (PMREM), piso con reflejo real,
  sombras, partículas, bloom, gradación y pistas de cámara por fotograma (spline Hermite).
- `index.html` — página que carga la escena. El `importmap` apunta a three.js r186.
- `render.py` — renderiza fotogramas en Chromium headless (Playwright) y guarda PNG.
- `encode.py` — convierte los PNG a WebP para `seq/d` y `seq/m`.

## Uso

```bash
pip install playwright pillow && python -m playwright install chromium
# servir esta carpeta
python -m http.server 8765
# escritorio (1600x900, supermuestreo 1.5x) y celular vertical (720x1280)
python render.py --mode desk --w 1600 --h 900 --ss 1.5 --frames 0-539 --out raw/desk
python render.py --mode mob  --w 720  --h 1280 --ss 1.5 --frames 0-539 --out raw/mob
python encode.py
```

Parámetros de la URL de la escena: `mode=desk|mob`, `w`, `h`, `ss` (supermuestreo).
`window.renderFrame(n)` devuelve el fotograma `n` como PNG (data URL). Todo es determinista:
el mismo número de fotograma produce siempre la misma imagen.
