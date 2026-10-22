# Zenix AR — Núcleo Z · Experiencia cinematográfica

Página web completa de Zenix AR construida alrededor de una película 3D original
que avanza y retrocede con el scroll.

## Cómo funciona

| Capa | Qué hace |
|---|---|
| `seq/d/*.webp` · `seq/m/*.webp` | 540 fotogramas pre-renderizados del **Núcleo Z** (escena 3D original). `d` = escritorio 1600×900, `m` = celular vertical 720×1280, con encuadre propio. |
| `js/app.js` | Motor de secuencia sobre `<canvas>`: carga progresiva por prioridad, memoria acotada, fundido entre fotogramas vecinos e inercia suave. |
| GSAP + ScrollTrigger (`vendor/`) | Mapea cada capítulo a su rango de fotogramas y coreografía los textos (entrada/salida con desenfoque, desplazamiento y escalonado). |
| `css/style.css` | Diseño, HUD, adaptación a escritorio / celular. |

### Capítulos (scroll → fotogramas)

| Capítulo | Fotogramas | Animación |
|---|---|---|
| 01 Apertura | 0–119 | Barrido de luz que revela la cápsula hexagonal sellada; acercamiento macro y retroceso. |
| 02 Núcleo | 119–214 | Las ranuras se iluminan, los módulos se “desbloquean” y los pétalos frontales/traseros se abren revelando la Z. |
| 03 Despliegue (proceso) | 214–334 | Los seis módulos se separan, giran y la órbita se inclina a horizontal; la Z gira 360°. |
| 04 Servicios | 334–454 | Cada módulo pasa al frente, se adelanta y enciende: un módulo = un servicio. |
| 05 Contacto | 454–539 | Los módulos se reensamblan como marco hexagonal alrededor de la Z (la marca) + CTA de WhatsApp. |

Al subir con el scroll todo se reproduce en reversa de forma exacta, porque cada posición
del scroll corresponde a un fotograma concreto.

### Rendimiento

- **Precarga progresiva**: primero se baja una pasada gruesa (1 de cada 12 fotogramas, ~45 imágenes)
  para que toda la película sea navegable en segundos; después se completa priorizando lo que está
  cerca del cabezal y en la dirección del scroll.
- **Memoria acotada**: sólo se decodifican (`ImageBitmap`) ~20 fotogramas alrededor del cabezal;
  el resto queda comprimido (~25 MB por set). Apto para Android de gama media.
- **Set por pantalla**: el celular en vertical baja sólo el set `m`; escritorio sólo el `d`.
- **Sin pantallas negras**: el primer fotograma se precarga como póster CSS antes del JavaScript.
- **Ahorro de datos** (`Save-Data`) reduce las descargas simultáneas. `prefers-reduced-motion`
  desactiva inercia y animaciones de texto.

## Publicar

### GitHub Pages (ruta independiente)
La carpeta ya está lista para servirse tal cual en una subruta, por ejemplo
`https://<usuario>.github.io/<repo>/zx-nucleo-7dfa9c/`. Todas las rutas son relativas,
no toca ningún otro sitio.

### Cloudflare Pages
Crear un proyecto → “Subir recursos” (o conectar el repo) → carpeta de salida: esta carpeta,
sin comando de build. El archivo `_headers` agrega caché de larga duración para los fotogramas.

## Créditos y licencias

- Escena 3D, modelado, animación, cámara, iluminación y render: **originales** para Zenix AR
  (código fuente en `fuente-3d/`). No se usó ningún recurso, nombre ni imagen de Marvel / Iron Man.
- El proyecto de referencia (devinilabs/iron-man) **no tiene licencia publicada**, por eso no se
  reutilizó su código ni sus imágenes: sólo se estudió la técnica (canvas fijo + secuencia de fotogramas + scroll).
- Logo Z: provisto por Zenix AR.
- [GSAP 3.15 + ScrollTrigger](https://gsap.com/standard-license) — licencia estándar sin cargo de GreenSock (uso comercial permitido).
- [three.js r186](https://github.com/mrdoob/three.js) — MIT (sólo para renderizar los fotogramas; no se carga en la página).
- Tipografías Unbounded, Manrope y JetBrains Mono — SIL Open Font License (Google Fonts).

## Regenerar los fotogramas

Ver `fuente-3d/LEEME.md`.
